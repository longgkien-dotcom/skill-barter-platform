"use client";

import { BadgeCheck, Star } from "lucide-react";
import { initials } from "../lib/constants";
import type { Person } from "../lib/types";

// [KIẾN TRÚC & THIẾT KẾ]: Một hệ identity dùng chung: avatar hai vòng indigo kim loại, tên silver và micro-tag không phô trương.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Avatar không lắc/nhấp nháy; chỉ điểm xác minh emerald có glow tĩnh để giữ giao diện yên mắt.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Chip hiển thị tên đầy đủ, vai trò trong ngữ cảnh, Trust Score và check xác minh thực.
// [KẾT NỐI API]: Person đến từ users/skills/sessions hiện có; không fetch, không suy đoán verified khi thiếu trường.
// [CẨN THẬN KHI SỬA]: Nhãn bồi thẩm chỉ diễn giải ngưỡng Trust ≥4.5, không cấp quyền; backend vẫn kiểm tra người tham gia và phiếu.
// [ĐIỂM MỞ RỘNG]: Có thể thêm ảnh đại diện đã kiểm duyệt vào lõi avatar mà vẫn giữ vòng và trạng thái xác minh.
// [THIẾT KẾ BESIDE HERO & LANDING]: Màu nền và viền dùng cùng hệ satin navy của dashboard và login modal.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Không animate từng ký tự tiếng Việt; chip đi theo chuyển động card cha.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Role là nhãn trình bày; OFFER = người dạy, NEED = học viên, Trust cao đủ điều kiện bồi thẩm.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Chip không điều hướng; component cha quyết định chọn tài khoản hoặc chuyển vai.
export function identityRole(
  person: Person,
  teacherIds: readonly string[] = [],
): string {
  if ((person.trust_score ?? 0) >= 4.5) return "Bồi thẩm viên";
  return teacherIds.includes(person.id) ? "Người dạy" : "Học viên";
}

export function IdentityAvatar({
  person,
  size = "small",
}: {
  person: Person;
  size?: "small" | "medium";
}) {
  return (
    <span
      className={`identity-avatar identity-avatar-${size}`}
      aria-hidden="true"
    >
      <span className="identity-avatar-core">{initials(person.full_name)}</span>
      {person.is_verified && <i className="identity-verified-dot" />}
    </span>
  );
}

export default function IdentityChip({
  person,
  role,
  size = "small",
  className = "",
}: {
  person: Person;
  role: string;
  size?: "small" | "medium";
  className?: string;
}) {
  return (
    <span className={`identity-chip ${className}`}>
      <IdentityAvatar person={person} size={size} />
      <span className="identity-stack">
        <span className="identity-name-row">
          <span className="identity-name">{person.full_name}</span>
          {person.is_verified && (
            <BadgeCheck
              className="identity-verified-icon"
              size={13}
              role="img"
              aria-label="Email .edu.vn đã xác minh"
            />
          )}
        </span>
        <span className="identity-meta">
          <span className="identity-role">{role}</span>
          {typeof person.trust_score === "number" && (
            <>
              <span className="identity-meta-dot" aria-hidden="true">
                ·
              </span>
              <span className="identity-reputation">
                <Star size={10} aria-hidden="true" />
                {person.trust_score.toFixed(1)}
                <span className="sr-only"> trên 5 Trust Score</span>
              </span>
            </>
          )}
        </span>
      </span>
    </span>
  );
}
