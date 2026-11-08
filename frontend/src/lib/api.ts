import type {
  BookingInput,
  CreditType,
  Dispute,
  Level,
  ReviewInput,
  SafeZone,
  Session,
  Skill,
  SkillInput,
  SkillType,
  Transaction,
  User,
  ZoneInput,
} from "./types";
import { createApiTransport } from "./api-transport";

// [KIẾN TRÚC & THIẾT KẾ]: Bộ chuyển HTTP duy nhất; component không phụ thuộc đường dẫn nội bộ backend.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Promise cho phép UI hiển thị chờ và giữ panel ổn định.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Lỗi validation dạng mảng được nối thành thông báo đọc được.
// [KẾT NỐI API]: Route/method/payload đối chiếu controller và DTO trong backend/src/modules.
// [CẨN THẬN KHI SỬA]: Không tự retry POST tài chính; timeout không khẳng định giao dịch rollback. Actor ID chỉ dùng demo.
// [ĐIỂM MỞ RỘNG]: Thêm JWT khi backend có authentication; thay mock top-up bằng webhook thanh toán.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
).replace(/\/$/, "");
// [CLOUD FALLBACK]: Facade giữ nguyên route/payload; transport chọn NestJS hoặc kho trình duyệt bền vững.
const transport = createApiTransport({ baseUrl: API_URL });
const request = transport.request;
export const getApiStatus = transport.getStatus;
export const getServerApiStatus = transport.getServerStatus;
export const subscribeApiStatus = transport.subscribe;
const query = (filters: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.size ? `?${params}` : "";
};
export const api = {
  snapshot: transport.snapshot,
  users: (signal?: AbortSignal) =>
    request<User[]>("/users", "GET", undefined, signal),
  // [KẾT NỐI API]: CreateUserDto chỉ nhận tên/email; Trust mặc định do backend quyết định, client không tự gán quyền.
  createUser: (input: { email: string; full_name: string }) =>
    request<User>("/users", "POST", input),
  user: (id: string, signal?: AbortSignal) =>
    request<User>(`/users/${id}`, "GET", undefined, signal),
  verify: (id: string) => request<User>(`/users/${id}/verify-email`, "POST"),
  transactions: (id: string, signal?: AbortSignal) =>
    request<Transaction[]>(
      `/users/${id}/transactions`,
      "GET",
      undefined,
      signal,
    ),
  topUp: (id: string, amount: number) =>
    request(`/users/${id}/top-up`, "POST", { amount }),
  redeem: (id: string, amount: number, credit_type: CreditType) =>
    request(`/users/${id}/vouchers/redeem`, "POST", { amount, credit_type }),
  // [KẾT NỐI API]: DTO không có keyword; lọc từ khóa phía client sau bộ lọc enum/category.
  skills: (
    filters: {
      skill_type?: SkillType;
      category?: string;
      proficiency_level?: Level;
    } = {},
    signal?: AbortSignal,
  ) => request<Skill[]>(`/skills${query(filters)}`, "GET", undefined, signal),
  createSkill: (input: SkillInput) => request<Skill>("/skills", "POST", input),
  zones: (signal?: AbortSignal) =>
    request<SafeZone[]>("/safe-zones", "GET", undefined, signal),
  nearby: (
    latitude: number,
    longitude: number,
    radiusKm: number,
    signal?: AbortSignal,
  ) =>
    request<SafeZone[]>(
      `/safe-zones/nearby${query({ latitude, longitude, radiusKm })}`,
      "GET",
      undefined,
      signal,
    ),
  createZone: (input: ZoneInput) =>
    request<SafeZone>("/safe-zones", "POST", input),
  qr: (id: string) => request<{ qr_code_hash: string }>(`/safe-zones/${id}/qr`),
  sessions: (signal?: AbortSignal) =>
    request<Session[]>("/sessions", "GET", undefined, signal),
  book: (input: BookingInput) => request<Session>("/sessions", "POST", input),
  checkIn: (id: string, user_id: string, qr_code_hash: string) =>
    request(`/sessions/${id}/check-in`, "POST", { user_id, qr_code_hash }),
  cancel: (id: string, user_id: string) =>
    request(`/sessions/${id}/cancel`, "POST", { user_id }),
  noShow: (id: string, user_id: string) =>
    request(`/sessions/${id}/no-show`, "POST", { user_id }),
  checkOut: (id: string, teacher_id: string, proof_image_url: string) =>
    request(`/sessions/${id}/check-out`, "POST", {
      teacher_id,
      proof_image_url,
    }),
  review: (id: string, input: ReviewInput) =>
    request(`/sessions/${id}/reviews`, "POST", input),
  disputes: (signal?: AbortSignal) =>
    request<Dispute[]>("/disputes", "GET", undefined, signal),
  dispute: (session_id: string, complainant_id: string, reason: string) =>
    request("/disputes", "POST", { session_id, complainant_id, reason }),
  vote: (id: string, voter_id: string, choice: "TEACHER" | "STUDENT") =>
    request(`/disputes/${id}/votes`, "POST", { voter_id, choice }),
};
