"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CircleCheck,
  ImagePlus,
  LockKeyhole,
  MapPin,
  QrCode,
  Scale,
  Star,
} from "lucide-react";
import { api } from "../lib/api";
import { dateTime, STATUS } from "../lib/constants";
import type { Session, User, WorkspaceProps } from "../lib/types";
import { BusyLabel, Empty, Milestones, Modal, Panel } from "./ui";
import IdentityChip from "./IdentityChip";

// [KIẾN TRÚC & THIẾT KẾ]: Phiên là panel rộng với hợp đồng, tiến trình và vùng tác vụ stone tách biệt.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Panel xuất hiện theo scroll; chấm escrow pulse, nhãn trạng thái có cả chữ lẫn màu.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Chế độ Demo hiển thị mọi phiên và chuyển vai; form theo trạng thái thực.
// [KẾT NỐI API]: POST /sessions/:id/{check-in,check-out,cancel,no-show,reviews}; POST /disputes.
// [CẨN THẬN KHI SỬA]: Checkout chỉ teacher; no-show chỉ student sau 15 phút; cancel trước giờ hẹn; không tự giải ngân ở client.
// [ĐIỂM MỞ RỘNG]: Thay URL ảnh bằng upload có chữ ký, QR nhập tay bằng scanner; bổ sung API trạng thái review.
// [BỀ MẶT & DANH TÍNH]: Container satin tầng 2 bao session royal slate tầng 3; check verified tra từ users theo ID, không tự gán cho relation thiếu trường.
type DialogAction = {
  kind: "review" | "dispute" | "cancel" | "no-show";
  session: Session;
};
function SessionCard({
  session,
  user,
  busy,
  run,
  onSwitch,
  onDialog,
  reviewed,
  users,
}: WorkspaceProps & {
  session: Session;
  onSwitch: (id: string) => void;
  onDialog: (value: DialogAction) => void;
  reviewed: boolean;
  users: User[];
}) {
  const [qr, setQr] = useState("");
  const [proof, setProof] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    // [HIỆU ỨNG CHUYỂN ĐỘNG]: Đồng hồ cập nhật từ callback ngoài render để mở no-show đúng lúc mà không cần tải lại trang.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const participant =
    user.id === session.student_id || user.id === session.teacher_id;
  const teacher = user.id === session.teacher_id;
  const statusIndex =
    session.status === "ESCROWED"
      ? 0
      : session.status === "IN_PROGRESS"
        ? 1
        : session.status === "COMPLETED"
          ? 3
          : session.status === "DISPUTED"
            ? 2
            : 0;
  const cancelled = session.status === "CANCELLED";
  return (
    <Panel className="session-card" hover>
      <div className="session-top">
        <div>
          <div className="eyeline">
            <span>{session.skill.category}</span>
            <span>#{session.id.slice(0, 8)}</span>
          </div>
          <h3>{session.skill.title}</h3>
        </div>
        <span
          className={`badge ${session.status === "DISPUTED" ? "rose" : cancelled ? "stone" : "emerald"}`}
        >
          {session.status === "ESCROWED" && <span className="status-dot" />}
          {STATUS[session.status]}
        </span>
      </div>
      <div className="session-meta">
        <span>
          <CalendarDays size={15} />
          {dateTime(session.scheduled_start)} →{" "}
          {new Intl.DateTimeFormat("vi-VN", { timeStyle: "short" }).format(
            new Date(session.scheduled_end),
          )}
        </span>
        <span>
          <MapPin size={15} />
          {session.safe_zone?.name ?? "Điểm hẹn trong trường"}
        </span>
        <strong>
          <LockKeyhole size={14} />
          {session.cost_credits} Credit
        </strong>
      </div>
      <div className="session-people">
        <div className="session-party">
          <IdentityChip
            person={
              users.find((person) => person.id === session.student_id) ??
              session.student
            }
            role="Học viên"
          />
          <button
            className="text-button"
            disabled={busy || user.id === session.student_id}
            onClick={() => onSwitch(session.student_id)}
          >
            {user.id === session.student_id ? "Bạn" : "Chuyển vai"}
          </button>
        </div>
        <div className="session-party">
          <IdentityChip
            person={
              users.find((person) => person.id === session.teacher_id) ??
              session.teacher
            }
            role="Người dạy"
          />
          <button
            className="text-button"
            disabled={busy || user.id === session.teacher_id}
            onClick={() => onSwitch(session.teacher_id)}
          >
            {teacher ? "Bạn" : "Chuyển vai"}
          </button>
        </div>
      </div>
      <ol className="session-progress" aria-label="Tiến trình phiên học">
        {[
          "Đã khóa cọc",
          "Đang học",
          session.status === "DISPUTED" ? "Tạm đóng băng" : "Nghiệm thu",
          session.status === "DISPUTED"
            ? "Tranh chấp"
            : cancelled
              ? "Đã hoàn cọc"
              : "Hoàn tất",
        ].map((label, index) => (
          <li
            className={`${index <= statusIndex || (cancelled && index === 3) ? "done" : ""} ${session.status === "DISPUTED" && index >= 2 ? "disputed" : ""}`}
            key={label}
          >
            <span>{index < statusIndex ? <Check size={13} /> : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      <details className="contract-details">
        <summary>3 mục tiêu đã cam kết</summary>
        <Milestones items={session.micro_contract.milestones} />
      </details>
      {!participant && (
        <div className="session-controls">
          <p className="muted">
            Bạn đang xem phiên của tài khoản khác. Chuyển sang người học hoặc
            người dạy để thao tác.
          </p>
        </div>
      )}
      {participant && session.status === "ESCROWED" && (
        <div className="session-controls">
          <form
            className="action-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => api.checkIn(session.id, user.id, qr.trim()),
                "Đã check-in. Phiên học bắt đầu.",
              );
            }}
          >
            <label>
              Mã QR điểm hẹn
              <input
                value={qr}
                onChange={(event) => setQr(event.target.value)}
                minLength={16}
                maxLength={256}
                required
                placeholder="Nhập qr_code_hash tại Safe Zone"
              />
            </label>
            <div className="action-row">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setQr((await api.qr(session.safe_zone_id)).qr_code_hash);
                  }, "Đã điền mã QR của điểm hẹn.")
                }
              >
                <QrCode size={15} /> Tự điền mã QR
              </button>
              <button className="button primary" disabled={busy}>
                <QrCode size={15} /> Quét QR Check-in
              </button>
            </div>
          </form>
          <div className="secondary-actions">
            <button
              className="text-button danger-text"
              disabled={
                busy ||
                !now ||
                new Date(session.scheduled_start).getTime() <= now
              }
              onClick={() => onDialog({ kind: "cancel", session })}
            >
              Hủy & Hoàn cọc
            </button>
            <button
              className="text-button danger-text"
              disabled={
                busy ||
                !now ||
                teacher ||
                now < new Date(session.scheduled_start).getTime() + 15 * 60000
              }
              title="Chỉ người học, sau giờ hẹn 15 phút"
              onClick={() => onDialog({ kind: "no-show", session })}
            >
              Báo vắng mặt
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => onDialog({ kind: "dispute", session })}
            >
              Mở khiếu nại
            </button>
          </div>
          <small className="muted">
            Hủy trước giờ hẹn; người học báo vắng sau 15 phút. Người dạy hủy bị
            trừ 0.2 Trust.
          </small>
        </div>
      )}
      {participant && session.status === "IN_PROGRESS" && (
        <div className="session-controls">
          {teacher ? (
            <form
              className="action-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => api.checkOut(session.id, user.id, proof.trim()),
                  "Đã nghiệm thu. Escrow được giải ngân cho người dạy.",
                );
              }}
            >
              <label>
                Ảnh bằng chứng nghiệm thu
                <input
                  type="url"
                  value={proof}
                  onChange={(event) => setProof(event.target.value)}
                  required
                  placeholder="https://…/anh-nghiem-thu.jpg"
                />
              </label>
              <div className="action-row">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    setProof(
                      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
                    )
                  }
                >
                  <ImagePlus size={15} /> Dùng ảnh mẫu
                </button>
                <button className="button primary" disabled={busy}>
                  <Camera size={15} /> Nghiệm thu & Mở khóa điểm
                </button>
              </div>
              <small className="muted">
                Ảnh mẫu chỉ phục vụ thử nghiệm luồng nghiệm thu.
              </small>
            </form>
          ) : (
            <p>Người dạy sẽ nộp ảnh nghiệm thu để hoàn tất phiên.</p>
          )}
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() => onDialog({ kind: "dispute", session })}
          >
            <Scale size={14} /> Mở khiếu nại (Tòa án)
          </button>
        </div>
      )}
      {session.status === "COMPLETED" && (
        <div className="session-controls completed-controls">
          <span>
            <CircleCheck size={18} />
            Ký quỹ đã được giải ngân.
          </span>
          {participant && (
            <button
              className="button secondary"
              disabled={busy || reviewed}
              onClick={() => onDialog({ kind: "review", session })}
            >
              <Star size={15} />
              {reviewed ? "Đã gửi đánh giá" : "Đánh giá kín"}
            </button>
          )}
          {session.proof_image_url && (
            <a
              href={session.proof_image_url}
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              Xem bằng chứng <ArrowRight size={13} />
            </a>
          )}
        </div>
      )}
      {session.status === "DISPUTED" && (
        <div className="session-controls">
          <p className="danger-text">
            <Scale size={16} /> Ký quỹ đang đóng băng. Theo dõi phân xử tại Tòa
            án cộng đồng.
          </p>
        </div>
      )}
    </Panel>
  );
}
export default function SessionsTab({
  sessions,
  users,
  user,
  busy,
  run,
  onSwitch,
}: WorkspaceProps & {
  sessions: Session[];
  users: User[];
  onSwitch: (id: string) => void;
}) {
  const [demo, setDemo] = useState(true);
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [ratings, setRatings] = useState([5, 5, 5]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const visible = demo
    ? sessions
    : sessions.filter(
        (session) =>
          session.teacher_id === user.id || session.student_id === user.id,
      );
  async function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const { session, kind } = dialog;
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") ?? "").trim();
    if (kind === "dispute" && reason.length < 10) {
      setError("Lý do cần ít nhất 10 ký tự có nghĩa.");
      return;
    }
    const success = await run(
      () =>
        kind === "review"
          ? api.review(session.id, {
              reviewer_id: user.id,
              reviewee_id:
                user.id === session.teacher_id
                  ? session.student_id
                  : session.teacher_id,
              prep_score: ratings[0],
              attitude_score: ratings[1],
              knowledge_score: ratings[2],
              comment: String(data.get("comment") ?? "").trim(),
            })
          : kind === "dispute"
            ? api.dispute(session.id, user.id, reason)
            : kind === "cancel"
              ? api.cancel(session.id, user.id)
              : api.noShow(session.id, user.id),
      kind === "review"
        ? "Đã gửi đánh giá. Trust Score được cập nhật."
        : kind === "dispute"
          ? "Đã mở khiếu nại và đóng băng Escrow."
          : "Phiên đã hủy. Escrow được hoàn cho người học.",
    );
    if (success) {
      if (kind === "review") setReviewed([...reviewed, session.id]);
      setDialog(null);
    }
  }
  return (
    <div className="workspace-section">
      <div className="section-heading">
        <div>
          <h2>
            Hành trình học tập <span className="count">{visible.length}</span>
          </h2>
          <p>Cam kết rõ ràng. Tín dụng an toàn.</p>
        </div>
        <div className="segmented" aria-label="Chế độ xem">
          <button
            aria-pressed={!demo}
            className={!demo ? "selected" : ""}
            onClick={() => setDemo(false)}
          >
            Phiên của tôi
          </button>
          <button
            aria-pressed={demo}
            className={demo ? "selected" : ""}
            onClick={() => setDemo(true)}
          >
            Tất cả phiên
          </button>
        </div>
      </div>
      <div className="session-list">
        {visible.map((session) => (
          <SessionCard
            users={users}
            key={session.id}
            session={session}
            user={user}
            busy={busy}
            run={run}
            onSwitch={onSwitch}
            onDialog={(value) => {
              setRatings([5, 5, 5]);
              setError("");
              setDialog(value);
            }}
            reviewed={reviewed.includes(session.id)}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <Empty
          title={demo ? "Chưa có phiên học" : "Bạn chưa có phiên học"}
          detail={
            demo
              ? "Đặt lịch từ một kỹ năng OFFER ở Khám phá để bắt đầu."
              : "Chọn Tất cả phiên hoặc đặt một lịch học mới."
          }
        />
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === "review"
              ? "Đánh giá kín"
              : dialog.kind === "dispute"
                ? "Mở khiếu nại"
                : dialog.kind === "cancel"
                  ? "Hủy & Hoàn cọc"
                  : "Báo người dạy vắng mặt"
          }
          subtitle={dialog.session.skill.title}
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <form className="form" onSubmit={submitDialog}>
            {dialog.kind === "review" ? (
              <>
                <div className="info-note">
                  Đánh giá độc lập; bạn không xem điểm đối phương trước khi gửi.
                </div>
                {["Chuẩn bị", "Thái độ", "Kiến thức"].map((label, index) => (
                  <label className="rating-field" key={label}>
                    <span>
                      {label}
                      <strong>
                        <Star size={15} />
                        {ratings[index]}/5
                      </strong>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={ratings[index]}
                      onChange={(event) =>
                        setRatings(
                          ratings.map((value, position) =>
                            position === index
                              ? Number(event.target.value)
                              : value,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <label>
                  Nhận xét
                  <textarea
                    name="comment"
                    maxLength={2000}
                    rows={3}
                    placeholder="Chia sẻ góp ý để cả hai cùng tiến bộ…"
                  />
                </label>
                <div className="info-note">
                  <b>Trust mới = 80% điểm cũ + 20% điểm phiên.</b>
                  <p>
                    Điểm trung bình ≤ 1.5 được gắn cờ kiểm duyệt để chống review
                    bombing.
                  </p>
                </div>
              </>
            ) : dialog.kind === "dispute" ? (
              <>
                <label>
                  Lý do khiếu nại
                  <textarea
                    name="reason"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={5}
                    placeholder="Mô tả điều chưa đúng với 3 mục tiêu đã cam kết…"
                  />
                </label>
                <div className="info-note">
                  Escrow được đóng băng trong lúc 3 thành viên đủ uy tín phân
                  xử.
                </div>
              </>
            ) : (
              <div className="info-note">
                <p>
                  {dialog.kind === "cancel"
                    ? "Hủy trước giờ hẹn sẽ hoàn ký quỹ cho người học. Nếu bạn là người dạy, Trust Score giảm 0.2."
                    : "Bạn xác nhận người dạy chưa có mặt sau ít nhất 15 phút. Escrow hoàn cho người học và Trust người dạy giảm 0.2."}
                </p>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Quay lại
              </button>
              <button
                className={`button ${dialog.kind === "review" ? "primary" : "danger"}`}
                disabled={busy}
              >
                <BusyLabel busy={busy}>
                  {dialog.kind === "review" ? "Gửi đánh giá" : "Xác nhận"}
                </BusyLabel>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
