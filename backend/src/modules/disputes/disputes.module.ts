import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

// [NGHIỆP VỤ]: Đăng ký Community Tribunal và các endpoint biểu quyết.
// [CHỐNG GIAN LẬN]: Vote uniqueness được lưu bằng bảng TribunalVote.
// [CẨN THẬN KHI SỬA]: Không xóa persistence của voter nếu vẫn cần chống bỏ phiếu lặp.
// [ĐIỂM MỞ RỘNG]: Bổ sung quy trình phân hội đồng, kiểm toán và kháng nghị.
@Module({
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
