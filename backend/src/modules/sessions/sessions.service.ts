import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus, SkillType } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { CreditsService } from '../../core/wallet/credits.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { withSerializableRetry } from '../../core/prisma/serializable-transaction';
import { BookSessionDto } from './dto/book-session.dto';

const NO_SHOW_GRACE_MS = 15 * 60 * 1000;

// [NGHIỆP VỤ]: Điều phối đặt lịch, escrow, Safe Zone check-in và giải ngân phiên học.
// [CHỐNG GIAN LẬN]: Xác minh quyền tham gia, mã QR theo constant-time compare và trạng thái phiên hợp lệ.
// [CẨN THẬN KHI SỬA]: Mỗi chuyển trạng thái và thay đổi ví phải commit trong cùng Serializable transaction.
// [ĐIỂM MỞ RỘNG]: Thay actor ID bằng JWT principal và tích hợp QR/GPS, kho ảnh có chữ ký.
@Injectable()
export class SessionsService {
  // [NGHIỆP VỤ]: Nhận Prisma và CreditsService để xử lý trạng thái phiên cùng escrow.
  // [CHỐNG GIAN LẬN]: CreditsService là nơi duy nhất khóa, hoàn và payout tín dụng.
  // [CẨN THẬN KHI SỬA]: Transaction client phải được truyền xuyên suốt từ service này sang ví.
  // [ĐIỂM MỞ RỘNG]: Inject dịch vụ thông báo và lưu ảnh sau khi transaction commit.
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
  ) {}

  // [NGHIỆP VỤ]: Đặt phiên cho một kỹ năng OFFER, yêu cầu hợp đồng ba mốc và khóa tín dụng ngay.
  // [CHỐNG GIAN LẬN]: Chỉ người học đã xác minh mới đặt phiên; không cho tự đặt kỹ năng của mình.
  // [CẨN THẬN KHI SỬA]: Tạo Session và trừ ví/ghi ESCROW_LOCK phải nguyên tử để không có phiên thiếu tiền.
  // [ĐIỂM MỞ RỘNG]: Thêm kiểm tra xung đột lịch, thông báo cho giáo viên và quy tắc giá động.
  async book(dto: BookSessionDto) {
    const start = new Date(dto.scheduled_start);
    const end = new Date(dto.scheduled_end);
    if (start <= new Date() || end <= start) {
      throw new BadRequestException('Thời gian phiên không hợp lệ hoặc đã qua');
    }

    return withSerializableRetry(this.prisma, async (transaction) => {
      const skill = await transaction.skill.findUnique({
        where: { id: dto.skill_id },
        include: { user: { select: { id: true } } },
      });
      if (!skill || !skill.is_active || skill.skill_type !== SkillType.OFFER) {
        throw new NotFoundException(
          'Không tìm thấy kỹ năng OFFER đang hoạt động',
        );
      }
      if (skill.user_id === dto.student_id) {
        throw new BadRequestException('Không thể đặt phiên với chính mình');
      }

      const student = await transaction.user.findUnique({
        where: { id: dto.student_id },
        select: { id: true, is_verified: true },
      });
      if (!student) {
        throw new NotFoundException('Không tìm thấy người học');
      }
      if (!student.is_verified) {
        throw new ForbiddenException(
          'Người học cần xác minh email .edu.vn trước khi đặt phiên',
        );
      }
      const safeZone = await transaction.safeZone.findUnique({
        where: { id: dto.safe_zone_id },
        select: { id: true },
      });
      if (!safeZone) {
        throw new NotFoundException('Không tìm thấy Safe Zone');
      }

      const session = await transaction.session.create({
        data: {
          teacher_id: skill.user_id,
          student_id: dto.student_id,
          skill_id: skill.id,
          safe_zone_id: safeZone.id,
          micro_contract: {
            milestones: dto.micro_contract.milestones.map((item) =>
              item.trim(),
            ),
          },
          scheduled_start: start,
          scheduled_end: end,
          cost_credits: dto.cost_credits,
          status: SessionStatus.ESCROWED,
        },
      });
      await this.creditsService.lockEscrow(
        transaction,
        dto.student_id,
        session.id,
        dto.cost_credits,
      );
      return session;
    });
  }

  // [NGHIỆP VỤ]: Lấy thông tin phiên với kỹ năng và địa điểm công khai liên quan.
  // [CHỐNG GIAN LẬN]: Không trả QR hash của Safe Zone trong response.
  // [CẨN THẬN KHI SỬA]: Không include ledger hay thông tin ví của người tham gia.
  // [ĐIỂM MỞ RỘNG]: Thêm kiểm tra người xem là thành viên phiên sau khi có JWT.
  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        skill: { select: { id: true, title: true, category: true } },
        safe_zone: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên');
    }
    return session;
  }

  // [NGHIỆP VỤ]: Trả các phiên mới nhất để hiển thị dashboard lifecycle và lọc trạng thái.
  // [CHỐNG GIAN LẬN]: QR hash và ledger không được include trong danh sách.
  // [CẨN THẬN KHI SỬA]: Dữ liệu danh sách hiện phục vụ trusted-client; cần lọc quyền theo user khi có auth.
  // [ĐIỂM MỞ RỘNG]: Thêm cursor pagination và lọc teacher/student.
  async findAll(status?: SessionStatus) {
    return this.prisma.session.findMany({
      where: { status },
      take: 100,
      orderBy: { created_at: 'desc' },
      include: {
        skill: { select: { id: true, title: true, category: true } },
        safe_zone: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        teacher: { select: { id: true, full_name: true, trust_score: true } },
        student: { select: { id: true, full_name: true, trust_score: true } },
      },
    });
  }

  // [NGHIỆP VỤ]: Xác nhận người tham gia đã có mặt tại Safe Zone và chuyển phiên sang IN_PROGRESS.
  // [CHỐNG GIAN LẬN]: So sánh QR hash an toàn theo độ dài và timingSafeEqual, đồng thời giới hạn actor là hai bên.
  // [CẨN THẬN KHI SỬA]: Check-in chỉ chuyển ESCROWED một lần; không cho session bị dispute tiếp tục.
  // [ĐIỂM MỞ RỘNG]: Kết hợp xác nhận hai phía hoặc GPS để chống chia sẻ ảnh QR từ xa.
  async checkIn(sessionId: string, userId: string, providedHash: string) {
    return withSerializableRetry(this.prisma, async (transaction) => {
      const session = await transaction.session.findUnique({
        where: { id: sessionId },
        include: { safe_zone: { select: { qr_code_hash: true } } },
      });
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên');
      }
      if (userId !== session.teacher_id && userId !== session.student_id) {
        throw new ForbiddenException(
          'Chỉ người tham gia phiên mới được check-in',
        );
      }
      if (session.status !== SessionStatus.ESCROWED) {
        throw new ConflictException('Phiên không ở trạng thái chờ check-in');
      }
      if (
        !this.constantTimeHashEquals(
          session.safe_zone.qr_code_hash,
          providedHash,
        )
      ) {
        throw new ForbiddenException('Mã QR không hợp lệ');
      }

      return transaction.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.IN_PROGRESS },
      });
    });
  }

  // [NGHIỆP VỤ]: Hủy phiên trước giờ bắt đầu, hoàn tiền người học và phạt người dạy nếu họ hủy.
  // [CHỐNG GIAN LẬN]: Chỉ giáo viên hoặc sinh viên trong phiên được yêu cầu hủy; không nhận bên thứ ba.
  // [CẨN THẬN KHI SỬA]: Refund, penalty và đổi trạng thái phải nguyên tử để không hoàn tiền hai lần.
  // [ĐIỂM MỞ RỘNG]: Thêm chính sách phí hủy theo thời điểm và thông báo cho hai bên.
  async cancel(sessionId: string, userId: string) {
    return withSerializableRetry(this.prisma, async (transaction) => {
      const session = await transaction.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên');
      }
      if (userId !== session.teacher_id && userId !== session.student_id) {
        throw new ForbiddenException('Chỉ người tham gia phiên mới được hủy');
      }
      if (
        session.status !== SessionStatus.ESCROWED ||
        session.scheduled_start <= new Date()
      ) {
        throw new ConflictException(
          'Chỉ có thể hủy phiên đang chờ trước giờ bắt đầu',
        );
      }

      const updated = await transaction.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.CANCELLED },
      });
      await this.creditsService.refundEscrow(
        transaction,
        sessionId,
        session.student_id,
      );
      if (userId === session.teacher_id) {
        const teacher = await transaction.user.findUniqueOrThrow({
          where: { id: session.teacher_id },
          select: { trust_score: true },
        });
        await transaction.user.update({
          where: { id: session.teacher_id },
          data: { trust_score: Math.max(0, teacher.trust_score - 0.2) },
        });
      }
      return updated;
    });
  }

  // [NGHIỆP VỤ]: Xử lý báo giáo viên vắng mặt sau 15 phút kể từ giờ hẹn và hoàn escrow cho người học.
  // [CHỐNG GIAN LẬN]: Chỉ sinh viên của phiên được báo cáo; không thể báo trước khi hết thời gian ân hạn.
  // [CẨN THẬN KHI SỬA]: Trạng thái, hoàn tiền và trust penalty phải nằm trong một transaction duy nhất.
  // [ĐIỂM MỞ RỘNG]: Thêm bằng chứng GPS/check-in và quy trình khiếu nại đối với báo cáo no-show sai.
  async reportTeacherNoShow(sessionId: string, studentId: string) {
    return withSerializableRetry(this.prisma, async (transaction) => {
      const session = await transaction.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên');
      }
      if (studentId !== session.student_id) {
        throw new ForbiddenException(
          'Chỉ người học của phiên mới được báo vắng mặt',
        );
      }
      if (Date.now() < session.scheduled_start.getTime() + NO_SHOW_GRACE_MS) {
        throw new BadRequestException(
          'Cần chờ 15 phút sau giờ hẹn để báo vắng mặt',
        );
      }
      if (session.status !== SessionStatus.ESCROWED) {
        throw new ConflictException(
          'Phiên không còn ở trạng thái có thể báo vắng mặt',
        );
      }

      const updated = await transaction.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.CANCELLED },
      });
      await this.creditsService.refundEscrow(
        transaction,
        sessionId,
        session.student_id,
      );
      const teacher = await transaction.user.findUniqueOrThrow({
        where: { id: session.teacher_id },
        select: { trust_score: true },
      });
      await transaction.user.update({
        where: { id: session.teacher_id },
        data: { trust_score: Math.max(0, teacher.trust_score - 0.2) },
      });
      return updated;
    });
  }

  // [NGHIỆP VỤ]: Lưu bằng chứng ảnh, hoàn tất phiên và giải ngân tín dụng từ escrow cho giáo viên.
  // [CHỐNG GIAN LẬN]: Chỉ teacher ID của phiên được checkout; payout bị chặn khi trạng thái không IN_PROGRESS.
  // [CẨN THẬN KHI SỬA]: Cập nhật COMPLETED và ghi EARN phải commit cùng transaction để tránh chi trả lặp.
  // [ĐIỂM MỞ RỘNG]: Lưu ảnh qua object storage với URL có chữ ký và kiểm tra loại nội dung.
  async checkOut(sessionId: string, teacherId: string, proofImageUrl: string) {
    return withSerializableRetry(this.prisma, async (transaction) => {
      const session = await transaction.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) {
        throw new NotFoundException('Không tìm thấy phiên');
      }
      if (teacherId !== session.teacher_id) {
        throw new ForbiddenException(
          'Chỉ người dạy của phiên mới được checkout',
        );
      }
      if (session.status !== SessionStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Phiên chưa check-in hoặc không thể checkout',
        );
      }

      const updated = await transaction.session.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.COMPLETED,
          proof_image_url: proofImageUrl,
        },
      });
      await this.creditsService.payoutEscrow(
        transaction,
        sessionId,
        session.teacher_id,
      );
      return updated;
    });
  }

  // [NGHIỆP VỤ]: So sánh QR hash với thời gian thực thi gần như không phụ thuộc nội dung.
  // [CHỐNG GIAN LẬN]: Từ chối độ dài khác nhau trước khi gọi constant-time primitive.
  // [CẨN THẬN KHI SỬA]: Buffer encoding phải giống nhau ở lúc tạo và kiểm tra hash.
  // [ĐIỂM MỞ RỘNG]: Dùng HMAC có khóa server-side nếu cần chống giả mạo QR offline.
  private constantTimeHashEquals(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  }
}
