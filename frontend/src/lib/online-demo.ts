import type { User } from "./types";

// [GIAO DIỆN HỌC ONLINE OMEGLE]: Dữ liệu và quy tắc thuần cho phòng ghép đôi trải nghiệm, không chứa WebRTC hay ví thật.
// [HỆ THỐNG MÀU LUMINOUS NAVY]: Topic dùng icon/tone trong component; model không phụ thuộc CSS hoặc giao diện Landing.
// [KẾT NỐI API]: Chỉ nhận roster GET /users có sẵn. Không tạo Session, không POST escrow/review và không đổi database contracts.
// [CẨN THẬN KHI SỬA]: Backend hiện dùng Int cho credit; các mức 0.25/0.5 dưới đây chỉ là giá trị mô phỏng trong bộ nhớ.
// [KIẾN TRÚC & THIẾT KẾ]: Tách lọc đối tác, deadline và hợp đồng để kiểm thử các trường hợp biên độc lập React/timer.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Countdown tính từ deadline thật, tránh trôi thời gian khi tab bị trình duyệt giảm tần suất timer.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Không tự ghép với mình; Next ưu tiên người khác, nhưng vẫn dùng được khi chỉ có một hồ sơ mẫu.
// [ĐIỂM MỞ RỘNG]: Thay model này bằng signaling/queue và wallet contract online khi backend hỗ trợ chính thức.
export type OnlineRole = "teach" | "learn" | "exchange";
export const ONLINE_TOPICS = [
  {
    id: "english",
    label: "Tiếng Anh giao tiếp",
    icon: "language",
    goals: [
      "Giới thiệu bản thân trong 60 giây",
      "Luyện một tình huống giao tiếp",
      "Góp ý 3 cách diễn đạt tự nhiên",
    ],
  },
  {
    id: "chinese",
    label: "Luyện phát âm Tiếng Trung HSK",
    icon: "language",
    goals: [
      "Ôn các thanh điệu cần cải thiện",
      "Đọc một đoạn hội thoại HSK",
      "Ghi lại 3 lỗi phát âm và cách sửa",
    ],
  },
  {
    id: "code",
    label: "Review Code React/NestJS",
    icon: "code",
    goals: [
      "Giải thích luồng xử lý hiện tại",
      "Cùng tìm một điểm cần cải thiện",
      "Đề xuất một cách refactor rõ ràng",
    ],
  },
  {
    id: "rubik",
    label: "Giải Rubik CFOP",
    icon: "cube",
    goals: [
      "Ôn các bước giải CFOP",
      "Thực hành một nhóm công thức",
      "Ghi lại cách luyện tốc độ phù hợp",
    ],
  },
  {
    id: "music",
    label: "Guitar & Nhạc lý",
    icon: "music",
    goals: [
      "Ôn hợp âm hoặc nhịp đang học",
      "Thực hành một đoạn nhạc ngắn",
      "Chốt bài luyện tập cho buổi sau",
    ],
  },
  {
    id: "math",
    label: "Toán cao cấp",
    icon: "math",
    goals: [
      "Xác định khái niệm cần làm rõ",
      "Cùng giải một bài toán mẫu",
      "Tự trình bày lại phương pháp giải",
    ],
  },
] as const;
export const ONLINE_ROLES = [
  { id: "teach", label: "Chia sẻ kỹ năng", detail: "Chia sẻ điều bạn biết" },
  { id: "learn", label: "Học kỹ năng", detail: "Mở một góc nhìn mới" },
  {
    id: "exchange",
    label: "Trao đổi song phương",
    detail: "15 phút bạn dạy, 15 phút tôi dạy",
  },
] as const;
export const ONLINE_PLANS = [
  { minutes: 15, credits: 0.25 },
  { minutes: 30, credits: 0.5 },
  { minutes: 45, credits: 1 },
] as const;
export function eligibleDemoPartners(users: User[], activeId: string): User[] {
  return users.filter(
    (person) =>
      person.id !== activeId &&
      person.is_verified &&
      /^[^@\s]+@[^@\s]+\.edu\.vn$/i.test(person.email),
  );
}
export function pickDemoPartner(
  pool: User[],
  previousId: string | null,
  random: () => number = Math.random,
): User | null {
  const fresh = pool.filter((person) => person.id !== previousId);
  const candidates = fresh.length ? fresh : pool;
  if (!candidates.length) return null;
  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(random() * candidates.length)),
  );
  return candidates[index];
}
export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function formatCountdown(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}
export function validOnlineGoals(goals: string[]): boolean {
  return (
    goals.length === 3 &&
    goals.every((goal) => goal.trim().length >= 3 && goal.trim().length <= 300)
  );
}
export const demoCreditLabel = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
