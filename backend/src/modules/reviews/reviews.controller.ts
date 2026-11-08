import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

// [NGHIỆP VỤ]: Cung cấp route gửi review cho một phiên.
// [CHỐNG GIAN LẬN]: DTO giới hạn điểm số trong miền 1..5; service xác nhận vai trò tham gia.
// [CẨN THẬN KHI SỬA]: reviewer_id từ client cần được thay bằng danh tính đã xác thực.
// [ĐIỂM MỞ RỘNG]: Thêm route báo cáo review và phản hồi của người được đánh giá.
@Controller('sessions/:sessionId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // [NGHIỆP VỤ]: Gửi một đánh giá gắn với phiên.
  // [CHỐNG GIAN LẬN]: Session UUID và điểm đánh giá được validate trước khi xử lý.
  // [CẨN THẬN KHI SỬA]: Review và trust score cập nhật nguyên tử ở service.
  // [ĐIỂM MỞ RỘNG]: Gửi review vào pipeline kiểm duyệt nếu bị gắn cờ.
  @Post()
  create(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(sessionId, dto);
  }
}
