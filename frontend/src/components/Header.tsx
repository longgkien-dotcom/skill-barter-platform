"use client";

import {
  ChevronRight,
  Coins,
  GraduationCap,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";
import type { User } from "../lib/types";
import IdentityMenu from "./IdentityMenu";

// [KIẾN TRÚC & THIẾT KẾ]: Command bar pearl glass, metric pill độc lập và identity capsule navy; font UI lấy từ layout.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Thanh tiến trình chuyển width nhẹ; nút tải quay khi đồng bộ.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Chọn bất kỳ hồ sơ seed, xem Standard/Premium/Trust và xác minh ngay trên đầu trang.
// [KẾT NỐI API]: users từ GET /users; onRefresh tải lại snapshot, onSwitch thay ID và ledger.
// [CẨN THẬN KHI SỬA]: Khóa switch khi POST đang chạy để không đổi actor giữa một thao tác tài chính.
// [ĐIỂM MỞ RỘNG]: Thay switcher demo bằng menu tài khoản sau khi có JWT.
// [THIẾT KẾ BESIDE HERO & LANDING]: Header chỉ nằm trong Dashboard riêng, không xếp dưới navbar Story.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Header sticky đầu viewport; Home đưa focus về phần giới thiệu sau khi logout kết thúc phiên.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Nội dung giới thiệu nằm ở StoryLanding; Header chỉ hiển thị hồ sơ và ví thực.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Không có nút quay lại Landing; chỉ IdentityMenu logout mới kết thúc phiên và trở về Story.
// [DANH TÍNH & POPOVER]: IdentityMenu thay select bằng listbox glass; giữ nguyên onSwitch và khóa khi đang mutation.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Header trắng kính hòa workspace alabaster, capsule navy tạo điểm nhấn danh tính.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: onLogout được truyền vào menu, không còn back link cho phép bỏ qua kết thúc phiên.
// [GIAO DIỆN HEADER & SIDEBAR MỚI]: Breadcrumb theo tab, badge chỉ pulse khi snapshot kết nối; ba metric có surface và semantic riêng.
// [TRỢ LÝ CHATBOT 24/7]: Header dùng cùng activeUser với chatbot; số dư và Trust luôn lấy snapshot API, không tạo dữ liệu mẫu.
// [BỘ CÂU HỎI & TRẢ LỜI TỰ ĐỘNG]: Quy tắc hướng dẫn nằm trong SupportChatbot; Header không chứa hay gọi engine trả lời.
// [SỬA TRÀN MOBILE]: Dưới 1024px dùng grid: identity bên trái, status/refresh bên phải, KPI ba cột ở hàng thứ hai; desktop giữ bố cục cũ.
// [GHIM KHI CUỘN]: Command bar sticky top:0 trên desktop, nằm dưới thanh bốn tab trên mobile; giữ ví và hồ sơ trong tầm nhìn.
export default function Header({
  users,
  user,
  onSwitch,
  onRefresh,
  loading,
  busy,
  onLogout,
  teacherIds,
  workspace,
  connected,
}: {
  users: User[];
  user?: User;
  onSwitch: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
  busy: boolean;
  onLogout: () => void;
  teacherIds: readonly string[];
  workspace: string;
  connected: boolean;
}) {
  return (
    <header className="header">
      <a className="mobile-brand" href="#main">
        <GraduationCap size={25} />
        <b>SkillBarter</b>
      </a>
      <div className="command-context">
        <div className="command-breadcrumb">
          <span>Không gian học tập</span>
          <ChevronRight size={12} />
          <b>{workspace}</b>
        </div>
        <span
          className={`command-status ${connected ? "is-connected" : "is-offline"}`}
          role="status"
          title={
            connected ? "Workspace đang hoạt động" : "Đang chờ kết nối API"
          }
        >
          <i aria-hidden="true" />{" "}
          {connected ? "Workspace đang hoạt động" : "Đang chờ kết nối API"}
        </span>
      </div>
      <div className="wallet-strip" aria-label="Ví hiện tại">
        <div className="standard-meter command-metric">
          <span>
            <Coins size={15} /> Standard{" "}
            <strong>
              {user?.standard_balance ?? "—"}
              <small>/20</small>
            </strong>
          </span>
          <div
            className="meter"
            role="progressbar"
            aria-label="Standard Credit trên giới hạn 20"
            aria-valuemin={0}
            aria-valuemax={20}
            aria-valuenow={Math.min(
              20,
              Math.max(0, user?.standard_balance ?? 0),
            )}
          >
            <i
              style={{
                width: `${Math.min(100, (user?.standard_balance ?? 0) * 5)}%`,
              }}
            />
          </div>
        </div>
        <div className="premium-mini command-metric">
          <span className="tiny">
            <Sparkles size={12} /> Premium
          </span>
          <strong>{user?.premium_balance ?? "—"}</strong>
        </div>
        <div
          className={`trust command-metric ${(user?.trust_score ?? 0) >= 4.5 ? "is-juror" : ""}`}
        >
          <span className="tiny">
            <Star size={12} /> Trust Score
          </span>
          <strong>
            {user?.trust_score.toFixed(1) ?? "—"}
            <small>/5.0</small>
          </strong>
        </div>
      </div>
      <IdentityMenu
        users={users}
        user={user}
        teacherIds={teacherIds}
        busy={busy}
        onSwitch={onSwitch}
        onLogout={onLogout}
      />
      <button
        className="icon-button header-refresh"
        aria-label="Tải lại dữ liệu"
        title="Tải lại dữ liệu"
        disabled={loading || busy}
        onClick={onRefresh}
      >
        <RefreshCw size={17} className={loading ? "spin" : ""} />
      </button>
    </header>
  );
}
