"use client";

import {
  ArrowUpRight,
  BookOpen,
  Compass,
  GraduationCap,
  LogOut,
  Scale,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { TABS } from "../lib/constants";
import type { Tab } from "../lib/types";

// [KIẾN TRÚC & THIẾT KẾ]: Sidebar satin navy-slate, glow sky cục bộ và card kính; vùng thấp có thể cuộn tới logout.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Nền nút chuyển nhẹ theo CSS, chấm API chỉ pulse khi kết nối thật.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Bốn workspace luôn có nhãn; mobile đổi thành thanh điều hướng ngang.
// [KẾT NỐI API]: online phản ánh lần GET snapshot gần nhất, không giả định kết nối từ timer.
// [CẨN THẬN KHI SỬA]: aria-current phải đồng bộ tab đang xem; không dùng icon làm nhãn duy nhất.
// [ĐIỂM MỞ RỘNG]: Có thể chuyển tab thành route con khi cần deep link từng workspace.
// [THIẾT KẾ BESIDE HERO & LANDING]: Wordmark SkillBarter đồng nhất navbar Story; giữ nguyên bố cục sidebar của dashboard.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Sidebar sticky đầu viewport của Dashboard riêng; không còn nằm dưới phần cuộn Story.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Chỉ đổi tên thương hiệu, các nhãn nghiệp vụ vẫn lấy TABS như trước.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Sidebar chỉ mount khi phiên hợp lệ; logout xóa ID và reset tab ở Home trước khi quay lại Story.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Frame navy-slate sáng hơn obsidian; pill active royal blue/indigo kết nối với workspace trắng.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Nút cuối sidebar gọi cùng onLogout với Header, khóa trong mutation để không ngắt giao dịch.
// [GIAO DIỆN HEADER & SIDEBAR MỚI]: Gradient satin và radial glow nằm trong CSS chrome; card thông tin/backend dùng kính trắng trong suốt.
// [TRỢ LÝ CHATBOT 24/7]: Shortcut trợ lý gọi cùng setTab ở Home; sidebar phản ánh đúng tab qua aria-current, không tạo workspace thứ hai.
// [BỘ CÂU HỎI & TRẢ LỜI TỰ ĐỘNG]: Muốn thêm hướng dẫn sidebar hãy sửa knowledge base tại SupportChatbot, không sửa API hoặc nhãn TABS.
const icons = [Compass, BookOpen, Scale, Wallet];
// [SỬA TRÀN MOBILE]: Nhãn ngắn có đúng hai dòng, bốn ô cùng chiều cao; aria-label luôn giữ tên nghiệp vụ đầy đủ.
// [GHIM KHI CUỘN]: Desktop dùng rail sticky 100dvh trong app-shell; các khối không co, vùng thừa nằm trước sidebar-bottom và nội dung dài cuộn trong rail.
const mobileLabels: Record<Tab, readonly [string, string]> = {
  discovery: ["Khám phá", "Điểm hẹn"],
  sessions: ["Phiên học", "Ký quỹ"],
  tribunal: ["Tòa án", "Cộng đồng"],
  wallet: ["Ví", "Đổi quà"],
};
export default function Sidebar({
  tab,
  onChange,
  online,
  demoMode,
  sessionCount,
  disputeCount,
  onLogout,
  busy,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  online: boolean;
  demoMode: boolean;
  sessionCount: number;
  disputeCount: number;
  onLogout: () => void;
  busy: boolean;
}) {
  return (
    <aside className="sidebar">
      <a href="#main" className="brand">
        <span className="brand-mark">
          <GraduationCap size={26} />
        </span>
        <span>
          <b>
            SkillBarter<span className="brand-period">.</span>
          </b>
          <small>TRI THỨC LÀ GIÁ TRỊ</small>
        </span>
      </a>
      <div className="sidebar-section small-label">KHÔNG GIAN CỦA BẠN</div>
      <nav aria-label="Workspace">
        {TABS.map((item, index) => {
          const Icon = icons[index];
          const count =
            item.id === "sessions"
              ? sessionCount
              : item.id === "tribunal"
                ? disputeCount
                : 0;
          return (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? "active" : ""}`}
              aria-current={tab === item.id ? "page" : undefined}
              aria-label={item.label}
              onClick={() => onChange(item.id)}
            >
              <Icon size={19} />
              <span className="nav-label-desktop">{item.label}</span>
              <span className="nav-label-mobile" aria-hidden="true">
                <span>{mobileLabels[item.id][0]}</span>
                <span>{mobileLabels[item.id][1]}</span>
              </span>
              {count > 0 && <small>{count}</small>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="fairness">
          <ShieldCheck size={23} />
          <h3>Một giờ. Một tín dụng.</h3>
          <p>
            Trao điều bạn biết.
            <br />
            Nhận điều bạn cần.
          </p>
          <button onClick={() => onChange("wallet")}>
            Khám phá ví <ArrowUpRight size={15} />
          </button>
        </div>
        <div
          className={`connection ${online ? "online" : "offline"}`}
          role="status"
        >
          <span className="status-dot" />
          <span>
            {demoMode
              ? "Dữ liệu trên trình duyệt"
              : `Backend ${online ? "đã kết nối" : "chưa kết nối"}`}
          </span>
        </div>
        <div className="sidebar-foot">
          Được xây dựng từ sự tin cậy.<span>Campus Exchange · 2026</span>
        </div>
        <button
          type="button"
          className="sidebar-logout"
          disabled={busy}
          onClick={onLogout}
        >
          <LogOut size={17} /> Đăng xuất tài khoản
        </button>
      </div>
    </aside>
  );
}
