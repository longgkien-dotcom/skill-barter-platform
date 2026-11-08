import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

// [NGHIỆP VỤ]: Đăng ký core engine cho vòng đời phiên và escrow.
// [CHỐNG GIAN LẬN]: CreditsService trung tâm áp dụng thống nhất logic wallet.
// [CẨN THẬN KHI SỬA]: Không tách payout/refund khỏi transaction đổi trạng thái phiên.
// [ĐIỂM MỞ RỘNG]: Thêm job nhắc lịch và adapter bằng chứng phiên tại đây.
@Module({
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
