import { Module } from '@nestjs/common';
import { SafeZonesController } from './safe-zones.controller';
import { SafeZonesService } from './safe-zones.service';

// [NGHIỆP VỤ]: Đăng ký API và service Safe Zone.
// [CHỐNG GIAN LẬN]: SafeZonesService không công khai QR hash trong truy vấn đọc.
// [CẨN THẬN KHI SỬA]: Bổ sung quyền quản trị trước khi đưa CRUD lên môi trường public.
// [ĐIỂM MỞ RỘNG]: Đăng ký provider quét QR/GPS hoặc truy vấn PostGIS tại đây.
@Module({
  controllers: [SafeZonesController],
  providers: [SafeZonesService],
})
export class SafeZonesModule {}
