import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// [NGHIỆP VỤ]: Cung cấp một Prisma Client dùng chung để các module truy cập PostgreSQL.
// [CHỐNG GIAN LẬN]: Mọi thay đổi số dư phải chạy trong transaction tại service nghiệp vụ; không sửa DB trực tiếp ở controller.
// [CẨN THẬN KHI SỬA]: Đóng kết nối khi ứng dụng dừng để tránh rò rỉ connection pool.
// [ĐIỂM MỞ RỘNG]: Có thể bổ sung logging, tracing hoặc middleware Prisma tại lớp dùng chung này.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // [NGHIỆP VỤ]: Mở kết nối cơ sở dữ liệu khi Nest khởi động.
  // [CHỐNG GIAN LẬN]: Lỗi kết nối được phát ra để ứng dụng không chạy ở trạng thái dữ liệu không nhất quán.
  // [CẨN THẬN KHI SỬA]: Không nuốt lỗi kết nối; health check và deploy cần phát hiện lỗi ngay.
  // [ĐIỂM MỞ RỘNG]: Cấu hình pool size và log query qua Prisma constructor khi tải tăng.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // [NGHIỆP VỤ]: Đóng connection pool một cách rõ ràng khi ứng dụng tắt.
  // [CHỐNG GIAN LẬN]: Không áp dụng thay đổi nghiệp vụ trong vòng đời shutdown.
  // [CẨN THẬN KHI SỬA]: Không bỏ lời gọi disconnect vì có thể làm tiến trình treo.
  // [ĐIỂM MỞ RỘNG]: Thêm hook flush telemetry trước khi disconnect nếu cần.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
