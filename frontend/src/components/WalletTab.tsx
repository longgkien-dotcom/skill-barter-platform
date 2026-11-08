"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Bike,
  Coffee,
  Coins,
  DoorOpen,
  Gift,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { api } from "../lib/api";
import { dateTime, shortDate, VOUCHERS } from "../lib/constants";
import type { CreditType, Transaction, WorkspaceProps } from "../lib/types";
import { BusyLabel, Empty, Modal, Panel } from "./ui";

// [KIẾN TRÚC & THIẾT KẾ]: KPI tabular, catalog bốn voucher minh họa icon; ledger có header rõ và scroll ngang trên mobile.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Card reveal/hover, meter chuyển width; giữ số dư từ snapshot backend thay vì tăng số giả.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Xác minh nhận vốn, nạp Premium demo, xác nhận đổi quà và xem ledger có hạn tín dụng.
// [KẾT NỐI API]: POST users/:id/{verify-email,top-up,vouchers/redeem}; GET users/:id/transactions.
// [CẨN THẬN KHI SỬA]: API redeem chỉ đốt tín dụng, chưa phát hành voucher. Phải báo rõ mô phỏng và không tạo mã quà giả.
// [ĐIỂM MỞ RỘNG]: Thêm cổng thanh toán, mã voucher thật, tồn kho và phân trang lịch sử khi backend hỗ trợ.
// [SỬA TRÀN MOBILE]: Ledger là region nhận Tab để cuộn ngang độc lập; KPI, top-up, voucher và nút xác nhận co theo responsive.css, payload ví giữ nguyên.
const voucherIcons = {
  coffee: Coffee,
  bike: Bike,
  printer: Printer,
  room: DoorOpen,
};
const transactionLabels = {
  EARN: "Nhận tín dụng",
  SPEND: "Chi tiêu",
  ESCROW_LOCK: "Khóa ký quỹ",
  ESCROW_REFUND: "Hoàn ký quỹ",
  TOPUP: "Nạp Premium",
  REDEEM_VOUCHER: "Đổi quà",
};
export default function WalletTab({
  transactions,
  ledgerLoading,
  ledgerError,
  user,
  busy,
  run,
}: WorkspaceProps & {
  transactions: Transaction[];
  ledgerLoading: boolean;
  ledgerError: string;
}) {
  const [amount, setAmount] = useState(5);
  const [creditType, setCreditType] = useState<CreditType>("STANDARD");
  const [voucher, setVoucher] = useState<(typeof VOUCHERS)[number] | null>(
    null,
  );
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const balance =
    creditType === "STANDARD" ? user.standard_balance : user.premium_balance;
  return (
    <div className="workspace-section">
      <div className="wallet-kpis">
        <Panel className="kpi kpi-standard" hover>
          <div className="kpi-label">
            <Coins size={18} /> Standard Credit
          </div>
          <div className="kpi-value">
            {user.standard_balance}
            <span>/20</span>
          </div>
          <div className="meter">
            <i
              style={{ width: `${Math.min(100, user.standard_balance * 5)}%` }}
            />
          </div>
          <p>Một giờ tri thức, một tín dụng.</p>
        </Panel>
        <Panel className="kpi" hover>
          <div className="kpi-label">
            <Sparkles size={18} /> Premium Credit
          </div>
          <div className="kpi-value">
            {user.premium_balance}
            <span>Credit</span>
          </div>
          <p>Nạp thêm để tiếp nối việc học.</p>
        </Panel>
        <Panel className="kpi" hover>
          <div className="kpi-label">
            <Star size={18} /> Trust Score
          </div>
          <div className="kpi-value">
            {user.trust_score.toFixed(1)}
            <span>/5.0</span>
          </div>
          <p>
            {user.trust_score >= 4.5
              ? "Đủ uy tín tham gia bồi thẩm."
              : "Mỗi cam kết tốt xây thêm uy tín."}
          </p>
        </Panel>
      </div>
      <div className="wallet-tools">
        <Panel className="identity-card" hover>
          <div className="identity-icon">
            <ShieldCheck size={29} />
          </div>
          <div>
            <h3>
              {user.is_verified
                ? "Danh tính đã xác minh"
                : "Bắt đầu bằng sự tin cậy"}
            </h3>
            <p>{user.email}</p>
            {user.is_verified ? (
              <span className="verified">
                <BadgeCheck size={15} /> Sinh viên .edu.vn
              </span>
            ) : (
              <button
                className="button primary"
                disabled={
                  busy || !/^[^@\s]+@[^@\s]+\.edu\.vn$/i.test(user.email)
                }
                onClick={() =>
                  void run(
                    () => api.verify(user.id),
                    "Đã xác minh email. Thưởng tối đa +1 Standard Credit trong trần 20.",
                  )
                }
              >
                Xác thực .edu.vn · +1 Credit
              </button>
            )}
            {!user.is_verified &&
              !user.email.toLowerCase().endsWith(".edu.vn") && (
                <p className="danger-text">Cần email trường có đuôi .edu.vn.</p>
              )}
          </div>
        </Panel>
        <Panel className="topup-card" hover>
          <div className="topup-title">
            <div>
              <h3>Nạp nhanh Premium</h3>
              <p>Cộng Credit thử nghiệm, không phát sinh thanh toán.</p>
            </div>
            <Plus size={23} />
          </div>
          <div className="quick-topups">
            {[5, 10, 20].map((value) => (
              <button
                className="button secondary"
                key={value}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => api.topUp(user.id, value),
                    `Đã cộng ${value} Premium Credit vào ví.`,
                  )
                }
              >
                +{value} <span>Credit</span>
              </button>
            ))}
          </div>
          <form
            className="custom-topup"
            onSubmit={(event) => {
              event.preventDefault();
              if (validAmount)
                void run(
                  () => api.topUp(user.id, amount),
                  `Đã cộng ${amount} Premium Credit vào ví.`,
                );
            }}
          >
            <label>
              <span className="sr-only">Số Premium Credit tùy chọn</span>
              <input
                type="number"
                min={1}
                step={1}
                max={1000000}
                value={Number.isNaN(amount) ? "" : amount}
                onChange={(event) => setAmount(event.target.valueAsNumber)}
                required
              />
            </label>
            <button className="button primary" disabled={busy || !validAmount}>
              Nạp tín dụng <ArrowUpRight size={15} />
            </button>
          </form>
        </Panel>
      </div>
      <div className="section-heading">
        <div>
          <h2>Góc quà khuôn viên</h2>
          <p>Một phần thưởng nhỏ cho hành trình học.</p>
        </div>
        <label className="credit-select">
          <span>Dùng ví</span>
          <select
            value={creditType}
            onChange={(event) =>
              setCreditType(event.target.value as CreditType)
            }
            disabled={busy}
          >
            <option value="STANDARD">Standard Credit</option>
            <option value="PREMIUM">Premium Credit</option>
          </select>
        </label>
      </div>
      <div className="voucher-grid">
        {VOUCHERS.map((item) => {
          const Icon = voucherIcons[item.icon];
          return (
            <Panel className={`voucher-card ${item.color}`} key={item.id} hover>
              <div className="voucher-art">
                <Icon size={40} strokeWidth={1.2} />
                <span className="voucher-spark">✧</span>
                <span className="voucher-serial">
                  CAMPUS / 0{VOUCHERS.indexOf(item) + 1}
                </span>
              </div>
              <div className="voucher-content">
                <span className="category-label">{item.merchant}</span>
                <h3>{item.title}</h3>
                <div>
                  <strong>
                    {item.cost} <small>Credit</small>
                  </strong>
                  <button
                    className="text-button"
                    disabled={busy || balance < item.cost}
                    onClick={() => setVoucher(item)}
                  >
                    Đổi ngay <ArrowUpRight size={15} />
                  </button>
                </div>
                {balance < item.cost && (
                  <small className="muted">Chưa đủ số dư ví đã chọn.</small>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      <p className="catalog-note">
        <Gift size={14} /> Danh mục đang chuẩn bị phát hành · Chưa có mã sử dụng
        tại cửa hàng.
      </p>
      <Panel className="ledger-panel">
        <div className="section-heading">
          <div>
            <h2>Lịch sử tín dụng</h2>
            <p>
              {ledgerLoading
                ? "Đang tải giao dịch…"
                : `${transactions.length} giao dịch gần nhất`}
            </p>
          </div>
          <span className="badge stone">Sổ cái ví</span>
        </div>
        {ledgerError && (
          <p className="form-error" role="alert">
            {ledgerError}
          </p>
        )}
        <div
          className="table-scroll"
          role="region"
          aria-label="Bảng giao dịch, có thể cuộn ngang trên màn hình nhỏ"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Giao dịch</th>
                <th>Thời gian</th>
                <th>Loại tín dụng</th>
                <th className="numeric">Số lượng</th>
                <th>Hạn sử dụng</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const income = ["EARN", "TOPUP", "ESCROW_REFUND"].includes(
                  transaction.transaction_type,
                );
                const color =
                  transaction.transaction_type === "ESCROW_LOCK"
                    ? "amber"
                    : transaction.transaction_type === "REDEEM_VOUCHER"
                      ? "rose"
                      : income
                        ? "emerald"
                        : "stone";
                return (
                  <tr key={transaction.id}>
                    <td>
                      <div className="transaction-name">
                        <span className={`transaction-icon ${color}`}>
                          {income ? (
                            <ArrowDownLeft size={16} />
                          ) : (
                            <ArrowUpRight size={16} />
                          )}
                        </span>
                        <span>
                          <b>
                            {transactionLabels[transaction.transaction_type]}
                          </b>
                          <span className={`transaction-code ${color}`}>
                            {transaction.transaction_type}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>{dateTime(transaction.created_at)}</td>
                    <td>
                      <span
                        className={`badge ${transaction.credit_type === "STANDARD" ? "stone" : "indigo"}`}
                      >
                        {transaction.credit_type}
                      </span>
                    </td>
                    <td
                      className={`numeric ${income ? "verified" : "danger-text"}`}
                    >
                      {income ? "+" : "−"}
                      {Math.abs(transaction.amount)}
                    </td>
                    <td>
                      {transaction.expires_at
                        ? shortDate(transaction.expires_at)
                        : "Không có hạn"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!ledgerLoading && !ledgerError && transactions.length === 0 && (
          <Empty
            title="Sổ cái còn mới"
            detail="Giao dịch của bạn sẽ xuất hiện sau lần nhận hoặc sử dụng tín dụng đầu tiên."
          />
        )}
      </Panel>
      {voucher && (
        <Modal
          title="Xác nhận đổi quà"
          subtitle={voucher.merchant}
          busy={busy}
          onClose={() => setVoucher(null)}
        >
          <div className="form">
            <div className="redemption-summary">
              <Gift size={35} />
              <h3>{voucher.title}</h3>
              <p>
                {voucher.cost}{" "}
                {creditType === "STANDARD" ? "Standard" : "Premium"} Credit · Số
                dư sau đổi: {balance - voucher.cost}
              </p>
            </div>
            <div className="info-note">
              Credit sẽ bị trừ và giao dịch được lưu vào ví. Ưu đãi này chưa có
              mã sử dụng tại cửa hàng.
            </div>
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setVoucher(null)}
              >
                Để sau
              </button>
              <button
                className="button primary"
                disabled={busy || balance < voucher.cost}
                onClick={async () => {
                  if (
                    await run(
                      () => api.redeem(user.id, voucher.cost, creditType),
                      "Đã ghi nhận đổi Credit và cập nhật ví.",
                    )
                  )
                    setVoucher(null);
                }}
              >
                <BusyLabel busy={busy}>Đổi {voucher.cost} Credit</BusyLabel>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
