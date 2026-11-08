import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

// [NGHIỆP VỤ]: Đăng ký API đánh giá và cập nhật trust score.
// [CHỐNG GIAN LẬN]: Service đảm bảo review gắn đúng người và phiên đã hoàn tất.
// [CẨN THẬN KHI SỬA]: Bảo toàn unique session-reviewer trong schema Prisma.
// [ĐIỂM MỞ RỘNG]: Đăng ký moderation service khi có quy trình xử lý review bị gắn cờ.
@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
