import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// [NGHIỆP VỤ]: Đăng ký PrismaService toàn cục để mọi feature module dùng chung kết nối.
// [CHỐNG GIAN LẬN]: Các module phải thao tác dữ liệu qua service đã kiểm soát thay vì khởi tạo client riêng.
// [CẨN THẬN KHI SỬA]: Module này phải được import đúng một lần trong AppModule.
// [ĐIỂM MỞ RỘNG]: Đăng ký interceptor hoặc provider truy cập dữ liệu dùng chung tại đây.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
