import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { withSerializableRetry } from '../../core/prisma/serializable-transaction';
import { CreateReviewDto } from './dto/create-review.dto';

// [NGHIỆP VỤ]: Ghi nhận đánh giá sau phiên và cập nhật trust score bằng moving average.
// [CHỐNG GIAN LẬN]: Chỉ hai người tham gia đã hoàn tất phiên được đánh giá lẫn nhau.
// [CẨN THẬN KHI SỬA]: Tạo review và cập nhật trust score cần atomic; unique constraint ngăn đánh giá lặp.
// [ĐIỂM MỞ RỘNG]: Thêm kiểm duyệt nội dung, phân tích review bombing và quyền phản hồi.
@Injectable()
export class ReviewsService {
  // [NGHIỆP VỤ]: Nhận PrismaService để ghi review và cập nhật trust score nguyên tử.
  // [CHỐNG GIAN LẬN]: Cùng transaction bảo vệ review và điểm tin cậy khỏi cập nhật lệch.
  // [CẨN THẬN KHI SỬA]: Không dùng client khác trong callback Serializable.
  // [ĐIỂM MỞ RỘNG]: Inject moderation service để xử lý review bị gắn cờ.
  constructor(private readonly prisma: PrismaService) {}

  // [NGHIỆP VỤ]: Tạo đánh giá với điểm trung bình của ba tiêu chí và cập nhật điểm tin cậy.
  // [CHỐNG GIAN LẬN]: Đánh dấu review có điểm trung bình <= 1.5 để đưa vào kiểm duyệt.
  // [CẨN THẬN KHI SỬA]: Một reviewer chỉ được đánh giá một lần mỗi phiên; cập nhật điểm chạy Serializable.
  // [ĐIỂM MỞ RỘNG]: Chuyển cờ is_flagged thành hàng đợi moderation có lý do và trạng thái xử lý.
  async create(sessionId: string, dto: CreateReviewDto) {
    if (dto.reviewer_id === dto.reviewee_id) {
      throw new BadRequestException('Không thể tự đánh giá chính mình');
    }

    return withSerializableRetry(this.prisma, async (transaction) => {
      const session = await transaction.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên');
      }
      if (session.status !== SessionStatus.COMPLETED) {
        throw new ConflictException('Chỉ có thể đánh giá phiên đã hoàn tất');
      }

      const isTeacherReviewingStudent =
        dto.reviewer_id === session.teacher_id &&
        dto.reviewee_id === session.student_id;
      const isStudentReviewingTeacher =
        dto.reviewer_id === session.student_id &&
        dto.reviewee_id === session.teacher_id;
      if (!isTeacherReviewingStudent && !isStudentReviewingTeacher) {
        throw new ForbiddenException(
          'Người đánh giá và người được đánh giá phải thuộc phiên',
        );
      }

      const sessionAverage =
        (dto.prep_score + dto.attitude_score + dto.knowledge_score) / 3;
      const review = await transaction.review.create({
        data: {
          session_id: sessionId,
          reviewer_id: dto.reviewer_id,
          reviewee_id: dto.reviewee_id,
          prep_score: dto.prep_score,
          attitude_score: dto.attitude_score,
          knowledge_score: dto.knowledge_score,
          comment: dto.comment.trim(),
          is_flagged: sessionAverage <= 1.5,
        },
      });

      const reviewee = await transaction.user.findUnique({
        where: { id: dto.reviewee_id },
        select: { trust_score: true },
      });
      if (!reviewee) {
        throw new NotFoundException('Không tìm thấy người được đánh giá');
      }
      const newScore = Number(
        (reviewee.trust_score * 0.8 + sessionAverage * 0.2).toFixed(2),
      );
      await transaction.user.update({
        where: { id: dto.reviewee_id },
        data: { trust_score: newScore },
      });
      return review;
    });
  }
}
