import type { NextConfig } from "next";

// [KIẾN TRÚC & THIẾT KẾ]: Một nguồn App Router src/app; bỏ loader CSS cũ để token không xung đột.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Animation nằm trong component client, không cần cờ experimental.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Cho phép loopback và IP LAN được chỉ định; ẩn indicator Next để nhường góc màn hình cho trợ lý.
// [KẾT NỐI API]: CORS NestJS tách biệt với allowedDevOrigins; API mặc định localhost:3001.
// [CẨN THẬN KHI SỬA]: Chỉ ghi hostname, không thêm giao thức hoặc cổng vào origin.
// [ĐIỂM MỞ RỘNG]: Thêm hostname preview cụ thể khi cần kiểm thử qua mạng nội bộ.
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.24"],
  devIndicators: false,
  experimental: { agentFeedback: true },
};
export default nextConfig;
