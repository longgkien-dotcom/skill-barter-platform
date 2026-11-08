import type { User } from "./types";

// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Model phiên độc lập CSS; giao diện đăng nhập trắng và chrome đen dùng chung danh tính đã chọn.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Chỉ lưu phiên sau nút xác nhận đăng nhập; logout xóa khóa, reload phải đối chiếu lại ID với roster API.
// [KẾT NỐI API]: Không tạo token/JWT hay endpoint mới. Đây là gate giao diện cho demo account, không thay xác thực/ủy quyền server.
// [CẨN THẬN KHI SỬA]: Không tin tên, số dư hoặc Trust trong localStorage; chỉ nhận version/flag/ID rồi tìm hồ sơ .edu.vn từ dữ liệu backend.
// [KIẾN TRÚC & THIẾT KẾ]: Hàm đọc/ghi nhận storage tùy chọn để kiểm thử lỗi JSON, phiên hết hiệu lực và storage bị chặn.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Hồ sơ chưa verified vẫn có thể đăng nhập demo để dùng nút xác minh ví; booking thật tiếp tục chịu kiểm tra của backend.
// [ĐIỂM MỞ RỘNG]: Thay gate này bằng cookie httpOnly và endpoint OTP khi backend hỗ trợ authentication thật.
export const AUTH_SESSION_KEY = "skillbarter.student-session.v1";
type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function browserStorage(): SessionStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
export function parseSession(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Record<string, unknown>;
    return session.version === 1 &&
      session.isAuthenticated === true &&
      typeof session.userId === "string" &&
      session.userId.length > 0 &&
      session.userId.length <= 128
      ? session.userId
      : null;
  } catch {
    return null;
  }
}
export function isStudentAccount(person: User | undefined): person is User {
  return !!person && /^[^@\s]+@[^@\s]+\.edu\.vn$/i.test(person.email);
}
export function resolveSessionUser(
  users: User[],
  id: string | null,
): User | null {
  const person = users.find((user) => user.id === id);
  return isStudentAccount(person) ? person : null;
}
export function readSession(storage = browserStorage()): string | null {
  try {
    return parseSession(storage?.getItem(AUTH_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}
export function writeSession(
  userId: string,
  storage = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ version: 1, isAuthenticated: true, userId }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearSession(storage = browserStorage()): void {
  try {
    storage?.removeItem(AUTH_SESSION_KEY);
  } catch {
    /* Phiên trong state vẫn bị xóa nếu trình duyệt chặn localStorage. */
  }
}
