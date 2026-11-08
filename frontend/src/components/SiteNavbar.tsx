"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";

// [THIẾT KẾ BESIDE HERO & LANDING]: Thanh điều hướng kính navy nằm ngoài hero obsidian; giữ logo nét liên kết và CTA indigo dạng pill.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Anchor chuyển qua callback để cuộn sau khi Story hiện lại; reduced-motion được xử lý tại page.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Danh sách links là nơi đổi tên năm chương của câu chuyện mà không sửa dashboard.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Navbar chỉ mount trong Story, chỉ có mục lục marketing và CTA đăng nhập; không còn switcher Story/Dashboard.
// [KIẾN TRÚC & THIẾT KẾ]: Navbar responsive độc lập với Header ví hiện tại; mobile dùng menu mở rộng có aria-controls.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Hover CSS ngắn, không chạy animation vô hạn trên thanh điều hướng.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Mục lục cuộn trong Story, CTA mở StudentLogin; menu mobile chỉ chứa cùng các chương giới thiệu.
// [KẾT NỐI API]: Navbar không fetch hoặc chọn tài khoản; giữ callback onStart nối gate Home hiện có.
// [CẨN THẬN KHI SỬA]: Không thêm lại công tắc app trong navbar marketing; CTA luôn qua requestLogin, không tạo đường bypass.
// [ĐIỂM MỞ RỘNG]: Có thể bổ sung URL deep link sau này nhưng phải giữ account và state của workspace.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Navbar và hero đen giữ frame kiến trúc; CTA navy là điểm nhấn trên các phần nội dung trắng.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Bắt đầu gọi gate ở Home; các link nội dung chỉ cuộn Story, không mở Dashboard.
const links = [
  ["gioi-thieu", "Giới thiệu"],
  ["y-tuong", "Ý tưởng hình thành"],
  ["cach-hoat-dong", "Cách hoạt động"],
  ["tinh-nang", "Tính năng"],
  ["toa-an", "Tòa án cộng đồng"],
] as const;

export function SkillBarterMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="31"
      height="31"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18.5 4H10a6 6 0 0 0-6 6v8.5M13.5 28H22a6 6 0 0 0 6-6v-8.5M4 18.5 18.5 4M13.5 28 28 13.5M4 12v6.5h6.5M21.5 13.5H28V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SiteNavbar({
  onSection,
  onStart,
  busy,
}: {
  onSection: (id: string) => void;
  onStart: () => void;
  busy: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (id: string) => {
    setMenuOpen(false);
    onSection(id);
  };
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <a
          className="site-wordmark"
          href="#story-main"
          onClick={(event) => {
            event.preventDefault();
            navigate("story-main");
          }}
          aria-label="SkillBarter — về trang giới thiệu"
        >
          <SkillBarterMark />
          <span>
            SkillBarter<span className="wordmark-dot">.</span>
          </span>
        </a>
        <nav className="site-nav-links" aria-label="Các phần giới thiệu">
          {links.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                navigate(id);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="site-start"
          disabled={busy}
          onClick={() => {
            setMenuOpen(false);
            onStart();
          }}
        >
          <span className="start-full">Bắt đầu trao đổi</span>
          <span className="start-short">Bắt đầu</span>
          <ArrowUpRight size={17} />
        </button>
        <button
          type="button"
          className="site-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="story-mobile-menu"
          aria-label={
            menuOpen ? "Đóng mục lục giới thiệu" : "Mở mục lục giới thiệu"
          }
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <nav
          id="story-mobile-menu"
          className="site-mobile-menu"
          aria-label="Mục lục giới thiệu"
        >
          {links.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                navigate(id);
              }}
            >
              {label}
              <ArrowRight size={15} />
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
