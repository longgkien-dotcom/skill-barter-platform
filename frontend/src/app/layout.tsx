import type { Metadata } from "next";
import { Be_Vietnam_Pro, Newsreader } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./dashboard.css";
import "./tritone.css";
import "./workspace-chrome.css";
import "./support-chatbot.css";
import "./online-pip.css";
import "./beta-polish.css";
import "./responsive.css";

// [KIẾN TRÚC & THIẾT KẾ]: Newsreader cho tiêu đề biên tập, Be Vietnam Pro cho UI; cả hai tự host bởi next/font với đủ tập latin và vietnamese.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: MotionConfig đặt ở client page; server layout không tạo animation khi hydration.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Khai báo lang vi để trình đọc màn hình phát âm đúng, metadata mang tên sản phẩm.
// [KẾT NỐI API]: Không fetch ở layout; dữ liệu luôn tải mới qua adapter HTTP phía client.
// [CẨN THẬN KHI SỬA]: Chỉ có src/app là App Router; không tạo lại frontend/app sẽ che nguồn mới.
// [ĐIỂM MỞ RỘNG]: Khi thêm font mới, giữ subset vietnamese và biến CSS thay vì quay về font serif hệ thống thiếu glyph.
// [THIẾT KẾ BESIDE HERO & LANDING]: Nạp landing.css sau hệ thống nền; selector có phạm vi riêng cho khung hero và Story.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Layout server không tạo hiệu ứng; MotionConfig ở page tôn trọng cài đặt giảm chuyển động.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Metadata đổi sang SkillBarter để khớp wordmark của trải nghiệm giới thiệu.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Hai chế độ dùng chung root layout và tài nguyên, không reload khi chuyển.
// [PHÔNG CHỮ & UNICODE NFC]: Nạp cả nét thường/nghiêng cho tiếng Việt; nội dung src được kiểm tra NFC, không bỏ dấu hoặc tách chữ để tạo hiệu ứng.
// [GIAO DIỆN HỌC ONLINE OMEGLE]: Phòng online là component client của Discovery, không thêm dữ liệu nhạy cảm hoặc media provider vào layout.
// [HỆ THỐNG MÀU LUMINOUS NAVY]: dashboard.css luôn scope .mode-app; tritone.css nạp sau cùng để phối trắng/đen/navy mà giữ hình học sẵn có.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: tritone.css nạp cuối để khóa frame đen, workspace trắng và section Story sáng/tối rõ ràng.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Gate client ở Home, layout không tự chọn tài khoản hoặc coi localStorage là xác thực server.
// [GIAO DIỆN HEADER & SIDEBAR MỚI]: Chrome pearl/satin ghi đè có phạm vi sau tritone, không thay màu card hay Story.
// [TRỢ LÝ CHATBOT 24/7]: Layout chỉ nạp CSS, không render widget; chỉ Dashboard đã xác thực mới mount orb và hội thoại.
// [BỐ CỤC VIDEO PIP]: online-pip.css nạp sau theme để sân khấu đối tác và thumbnail tự co theo viewport, không thay media/API.
// [SỬA TRÀN MOBILE]: responsive.css nạp cuối, chỉ thay breakpoint dưới 1024px và các giới hạn an toàn của popover/modal; desktop/API giữ nguyên.
const editorial = Newsreader({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-editorial",
});
const ui = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ui",
});
export const metadata: Metadata = {
  title: "SkillBarter — Đổi một giờ dạy. Nhận một giờ học.",
  description:
    "Không gian trao đổi kỹ năng sinh viên. Học cùng nhau, ký quỹ an toàn và xây dựng sự tin cậy trong khuôn viên.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${editorial.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
