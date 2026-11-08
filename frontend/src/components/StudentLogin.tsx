"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  GraduationCap,
  LoaderCircle,
  Search,
} from "lucide-react";
import type { User } from "../lib/types";
import { Empty, Modal } from "./ui";
import IdentityChip, { identityRole } from "./IdentityChip";
import { isStudentAccount } from "../lib/auth-session";

// [KIẾN TRÚC & THIẾT KẾ]: Modal trắng dùng cùng hệ thống form, chữ Be Vietnam Pro và border slate của dashboard.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Dialog native giữ focus/Escape; không tạo animation dịch từng ký tự có thể làm rời dấu tiếng Việt.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Tìm theo email hoặc tên, chọn hồ sơ .edu.vn rồi xác nhận; trạng thái xác minh hiển thị đúng dữ liệu backend.
// [KẾT NỐI API]: Danh sách lấy từ GET /users trong snapshot hiện có; modal không thêm endpoint, gửi mật khẩu hay giả xác thực OTP.
// [CẨN THẬN KHI SỬA]: Chỉ nhận email .edu.vn từ roster backend; trạng thái verified hiển thị đúng dữ liệu, gate demo không thay authentication server.
// [ĐIỂM MỞ RỘNG]: Thay danh sách bằng OTP email khi backend có route đăng nhập và session xác thực.
// [THIẾT KẾ BESIDE HERO & LANDING]: Portal cuối trang mở modal này bằng pill đăng nhập, không lồng dashboard dưới Story.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Sau khi xác nhận đăng nhập, page cuộn đầu workspace và đưa focus vào main của dashboard.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Giữ nhãn bản trải nghiệm để người dùng hiểu họ đang chọn hồ sơ có sẵn.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Chọn radio chưa mở Dashboard; chỉ submit nút đăng nhập mới gửi ID lên Home. Không có nút bypass.
// [DANH TÍNH SINH VIÊN]: Dùng cùng chip avatar hai vòng, check .edu.vn và Trust như Header; email thật vẫn hiện đầy đủ dưới chip.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Modal trắng, lựa chọn nền alabaster, nút xác nhận navy và chữ obsidian dễ đọc.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Hai bước chọn hồ sơ rồi xác nhận; đóng modal không tạo phiên, không thu mật khẩu khi backend chưa hỗ trợ.
export default function StudentLogin({
  users,
  loading,
  error,
  onSelect,
  onClose,
  onRetry,
}: {
  users: User[];
  loading: boolean;
  error: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const students = users.filter(isStudentAccount);
  const selected = students.find((user) => user.id === selectedId);
  const visible = students.filter((user) =>
    `${user.email} ${user.full_name}`
      .toLocaleLowerCase("vi")
      .includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <Modal
      title="Đăng nhập hệ thống SkillBarter"
      subtitle="Chọn hồ sơ sinh viên .edu.vn và xác nhận đăng nhập."
      onClose={onClose}
    >
      <form
        className="form student-login-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected && !loading && !error) onSelect(selected.id);
        }}
      >
        <div className="student-login-emblem">
          <GraduationCap size={27} />
          <div>
            <b>Một danh tính. Một cộng đồng.</b>
            <p>Hồ sơ trường học là bước khởi đầu của sự tin cậy.</p>
          </div>
        </div>
        <label className="student-login-search">
          Tìm tên hoặc email
          <span>
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId("");
              }}
              placeholder="Tên sinh viên hoặc email .edu.vn"
              autoComplete="off"
            />
          </span>
        </label>
        {loading && (
          <p className="login-loading" role="status">
            <LoaderCircle className="spin" size={18} />
            Đang tải hồ sơ sinh viên…
          </p>
        )}
        {error ? (
          <div className="info-note">
            <p role="alert">{error}</p>
            <button
              className="button secondary"
              type="button"
              onClick={onRetry}
              disabled={loading}
            >
              Tải lại hồ sơ
            </button>
          </div>
        ) : (
          <div className="student-account-list">
            {visible.map((user) => (
              <label
                key={user.id}
                className="student-account"
                data-selected={selectedId === user.id}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="student-account"
                  value={user.id}
                  checked={selectedId === user.id}
                  onChange={() => setSelectedId(user.id)}
                  required
                />
                <span className="student-account-identity">
                  <IdentityChip
                    person={user}
                    role={identityRole(user)}
                    size="medium"
                  />
                  <small className="student-account-email">{user.email}</small>
                </span>
                <span className="student-account-check" aria-hidden="true">
                  {selectedId === user.id && <Check size={18} />}
                </span>
              </label>
            ))}
            {!loading && !visible.length && (
              <Empty
                title="Chưa tìm thấy hồ sơ phù hợp"
                detail="Thử tìm tên hoặc email .edu.vn khác, hoặc tải lại danh sách tài khoản."
              />
            )}
          </div>
        )}
        <p className="student-login-note">
          Beta · Chọn hồ sơ kiểm thử có sẵn. Không nhập mật khẩu.
        </p>
        {selected && (
          <p className="student-login-selection">
            Đã chọn: <b>{selected.full_name}</b>
          </p>
        )}
        <button
          className="button primary student-login-submit"
          type="submit"
          disabled={!selected || loading || !!error}
        >
          Đăng nhập vào Không gian Học tập <ArrowRight size={16} />
        </button>
      </form>
    </Modal>
  );
}
