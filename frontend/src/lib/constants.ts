// [KIẾN TRÚC & THIẾT KẾ]: Nhãn tập trung; số liệu dạng tabular theo Stripe, màu theo ngữ nghĩa.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Key tab cố định giúp AnimatePresence nhận biết đổi workspace.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Nhãn tiếng Việt ngắn; giữ mã enum để tra cứu ledger.
// [KẾT NỐI API]: Voucher gửi amount và credit_type; API chưa phát hành mã quà thực tế.
// [CẨN THẬN KHI SỬA]: Trần 20 chỉ áp dụng Standard Credit, không áp dụng Premium.
// [ĐIỂM MỞ RỘNG]: Chuyển catalog sang API khi có bảng voucher và tồn kho.
export const LEVELS = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
} as const;
export const STATUS = {
  REQUESTED: "Chờ xác nhận",
  ESCROWED: "Đã khóa cọc",
  IN_PROGRESS: "Đang học",
  COMPLETED: "Hoàn tất",
  DISPUTED: "Tranh chấp",
  CANCELLED: "Đã hủy",
} as const;
export const TABS = [
  {
    id: "discovery",
    label: "Khám phá & Điểm hẹn",
    short: "Khám phá",
    description: "Tìm một người bạn. Học thêm một điều mới.",
  },
  {
    id: "sessions",
    label: "Phiên học & Ký quỹ",
    short: "Phiên học",
    description: "Mỗi giờ học, một cam kết được giữ.",
  },
  {
    id: "tribunal",
    label: "Tòa án cộng đồng",
    short: "Cộng đồng",
    description: "Công bằng được xây dựng từ sự tin cậy.",
  },
  {
    id: "wallet",
    label: "Ví & Đổi quà",
    short: "Ví tín dụng",
    description: "Tri thức bạn chia sẻ, giá trị bạn nhận lại.",
  },
] as const;
export const VOUCHERS = [
  {
    id: "coffee",
    title: "Một chút cà phê",
    merchant: "Highlands Coffee Khu B",
    cost: 1,
    icon: "coffee",
    color: "rose",
  },
  {
    id: "parking",
    title: "An tâm đến lớp",
    merchant: "Vé gửi xe tháng ĐHQG",
    cost: 2,
    icon: "bike",
    color: "indigo",
  },
  {
    id: "printing",
    title: "Sẵn sàng bài vở",
    merchant: "Gói in ấn Thư viện",
    cost: 1,
    icon: "printer",
    color: "amber",
  },
  {
    id: "room",
    title: "Không gian ý tưởng",
    merchant: "Phòng học nhóm VIP",
    cost: 3,
    icon: "room",
    color: "emerald",
  },
] as const;
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const shortDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(value),
  );
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(-2)
    .map((word) => word[0])
    .join("");
