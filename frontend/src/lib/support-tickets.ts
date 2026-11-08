import type { User } from "./types";

// [TRỢ LÝ CHATBOT 24/7]: Bản nháp hỗ trợ được lưu riêng từng hồ sơ trên thiết bị, không gửi mạng hoặc thay endpoint nghiệp vụ.
// [BỘ CÂU HỎI & TRẢ LỜI TỰ ĐỘNG]: Ticket không phải trả lời tự động hay biên nhận của Admin; trạng thái local-only phải đi cùng bản xuất.
// [CẨN THẬN KHI SỬA]: Không hứa email phản hồi khi chưa có dịch vụ tiếp nhận; bắt lỗi storage và kiểm tra owner khi đọc dữ liệu.
// [ĐIỂM MỞ RỘNG]: Thay lớp lưu bằng API ticket có xác thực và trạng thái giao nhận khi backend hỗ trợ, không dùng API escrow làm hộp thư.
export interface SupportTicketDraft {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  message: string;
  reference: string;
  createdAt: string;
  delivery: "local-only";
}
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
const keyFor = (ownerId: string) => `skillbarter.support-drafts.v1.${ownerId}`;
function browserStorage(): DraftStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
export function validateSupportIssue(message: string): string {
  if (message.trim().length < 20)
    return "Mô tả ít nhất 20 ký tự để Admin hiểu vấn đề.";
  if (message.trim().length > 2000) return "Mô tả tối đa 2.000 ký tự.";
  return "";
}
export function createSupportDraft(
  user: User,
  message: string,
  reference: string,
  id: string,
  now: number,
): SupportTicketDraft {
  const error = validateSupportIssue(message);
  if (error) throw new Error(error);
  return {
    id,
    ownerId: user.id,
    name: user.full_name,
    email: user.email,
    message: message.trim(),
    reference: reference.trim().slice(0, 128),
    createdAt: new Date(now).toISOString(),
    delivery: "local-only",
  };
}
export function readSupportDrafts(
  ownerId: string,
  storage = browserStorage(),
): SupportTicketDraft[] {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(keyFor(ownerId)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is SupportTicketDraft =>
          !!item &&
          typeof item === "object" &&
          item.ownerId === ownerId &&
          item.delivery === "local-only" &&
          typeof item.id === "string" &&
          /^SB-[A-Z0-9-]{5,60}$/.test(item.id) &&
          typeof item.name === "string" &&
          item.name.length <= 200 &&
          typeof item.email === "string" &&
          item.email.length <= 254 &&
          typeof item.message === "string" &&
          !validateSupportIssue(item.message) &&
          typeof item.reference === "string" &&
          item.reference.length <= 128 &&
          typeof item.createdAt === "string" &&
          Number.isFinite(Date.parse(item.createdAt)),
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}
export function saveSupportDraft(
  draft: SupportTicketDraft,
  storage = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    const drafts = readSupportDrafts(draft.ownerId, storage).filter(
      (item) => item.id !== draft.id,
    );
    storage.setItem(
      keyFor(draft.ownerId),
      JSON.stringify([draft, ...drafts].slice(0, 20)),
    );
    return true;
  } catch {
    return false;
  }
}
export function supportDraftText(draft: SupportTicketDraft): string {
  return [
    `YÊU CẦU HỖ TRỢ SKILLBARTER ${draft.id}`,
    "Trạng thái: BẢN NHÁP CỤC BỘ — CHƯA GỬI ADMIN",
    `Tạo lúc: ${draft.createdAt}`,
    `Sinh viên: ${draft.name}`,
    `Email liên hệ: ${draft.email}`,
    `Mã phiên/lỗi: ${draft.reference || "Chưa cung cấp"}`,
    "",
    draft.message,
    "",
    "Vui lòng gửi bản này qua kênh liên hệ Admin của bạn. Ứng dụng chưa có dịch vụ nhận ticket hoặc gửi email.",
  ].join("\n");
}
