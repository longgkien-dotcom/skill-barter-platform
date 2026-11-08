import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  Prisma,
  SessionStatus,
  TribunalVoteChoice,
} from '@prisma/client';
import { CreditsService } from '../../core/wallet/credits.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { withSerializableRetry } from '../../core/prisma/serializable-transaction';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { VoteDisputeDto } from './dto/vote-dispute.dto';

// [NGHIỆP VỤ]: Quản lý mở tranh chấp và hội đồng cộng đồng biểu quyết kết quả.
// [CHỐNG GIAN LẬN]: Chỉ người uy tín không tham gia phiên được bỏ một phiếu duy nhất cho mỗi tranh chấp.
// [CẨN THẬN KHI SỬA]: Đóng băng payout bằng trạng thái DISPUTED; quyết định thứ ba và chuyển escrow phải atomic.
// [ĐIỂM MỞ RỘNG]: Thêm ẩn danh cử tri, phân bổ hội đồng và quy trình kháng nghị.
@Injectable()
export class DisputesService {
  // [NGHIỆP VỤ]: Nhận Prisma và CreditsService để tribunal có thể quyết định escrow.
  // [CHỐNG GIAN LẬN]: Quyết định bỏ phiếu và chuyển ví dùng cùng transaction context.
  // [CẨN THẬN KHI SỬA]: Không chuyển payout/refund ra khỏi transaction của vote thứ ba.
  // [ĐIỂM MỞ RỘNG]: Inject dịch vụ chọn hội đồng hoặc thông báo khi có quy trình thực tế.
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
  ) {}

  // [NGHIỆP VỤ]: Tạo tranh chấp khi phiên đang escrow hoặc đang diễn ra và đóng băng giải ngân.
  // [CHỐNG GIAN LẬN]: Chỉ giáo viên hoặc sinh viên trong chính phiên đó được khiếu nại.
  // [CẨN THẬN KHI SỬA]: Ghi Dispute và đặt Session.DISPUTED cùng transaction; mỗi phiên chỉ có một tranh chấp.
  // [ĐIỂM MỞ RỘNG]: Lưu bằng chứng đính kèm và gửi thông báo tới hội đồng.
  async open(dto: OpenDisputeDto) {
    try {
      return await withSerializableRetry(this.prisma, async (transaction) => {
        const session = await transaction.session.findUnique({
          where: { id: dto.session_id },
        });
        if (!session) {
          throw new NotFoundException('Không tìm thấy phiên');
        }
        if (
          dto.complainant_id !== session.teacher_id &&
          dto.complainant_id !== session.student_id
        ) {
          throw new ForbiddenException(
            'Chỉ người tham gia phiên mới được mở tranh chấp',
          );
        }
        if (
          session.status !== SessionStatus.ESCROWED &&
          session.status !== SessionStatus.IN_PROGRESS
        ) {
          throw new ConflictException(
            'Chỉ phiên đang escrow hoặc đang diễn ra mới được tranh chấp',
          );
        }

        const dispute = await transaction.dispute.create({
          data: {
            session_id: session.id,
            complainant_id: dto.complainant_id,
            reason: dto.reason.trim(),
            status: DisputeStatus.PENDING,
          },
        });
        await transaction.session.update({
          where: { id: session.id },
          data: { status: SessionStatus.DISPUTED },
        });
        return dispute;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Phiên này đã có tranh chấp');
      }
      throw error;
    }
  }

  // [NGHIỆP VỤ]: Đọc nội dung tranh chấp, trạng thái và số phiếu hiện tại.
  // [CHỐNG GIAN LẬN]: Không trả danh sách voter để tránh gây áp lực lên hội đồng.
  // [CẨN THẬN KHI SỬA]: Tránh include dữ liệu cá nhân không cần thiết của người khiếu nại.
  // [ĐIỂM MỞ RỘNG]: Thêm timeline quyết định và thông tin kháng nghị đã được phân quyền.
  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      select: {
        id: true,
        session_id: true,
        complainant_id: true,
        reason: true,
        votes_for_teacher: true,
        votes_for_student: true,
        status: true,
        created_at: true,
      },
    });
    if (!dispute) {
      throw new NotFoundException('Không tìm thấy tranh chấp');
    }
    return dispute;
  }

  // [NGHIỆP VỤ]: Liệt kê tranh chấp mới nhất kèm hợp đồng và danh tính công khai của hai bên.
  // [CHỐNG GIAN LẬN]: Không trả danh sách voter để tránh gây áp lực lên hội đồng.
  // [CẨN THẬN KHI SỬA]: Tối đa 100 record; production cần phân trang và authorization.
  // [ĐIỂM MỞ RỘNG]: Thêm bộ lọc theo session và phân công juror.
  async findAll(status?: DisputeStatus) {
    return this.prisma.dispute.findMany({
      where: { status },
      take: 100,
      orderBy: { created_at: 'desc' },
      include: {
        session: {
          include: {
            skill: { select: { title: true, category: true } },
            teacher: { select: { id: true, full_name: true } },
            student: { select: { id: true, full_name: true } },
          },
        },
      },
    });
  }

  // [NGHIỆP VỤ]: Ghi phiếu và tự động xử lý ngay khi có đủ ba phiếu hợp lệ.
  // [CHỐNG GIAN LẬN]: Chỉ user trust_score >= 4.5 ngoài phiên được bỏ một phiếu duy nhất.
  // [CẨN THẬN KHI SỬA]: Phiếu, bộ đếm, trạng thái phân xử và payout/refund phải commit atomic, có retry serializable.
  // [ĐIỂM MỞ RỘNG]: Có thể chọn ngẫu nhiên hội đồng trước khi cho phép truy cập tranh chấp.
  async vote(disputeId: string, dto: VoteDisputeDto) {
    try {
      return await withSerializableRetry(this.prisma, async (transaction) => {
        const dispute = await transaction.dispute.findUnique({
          where: { id: disputeId },
          include: { session: true },
        });
        if (!dispute) {
          throw new NotFoundException('Không tìm thấy tranh chấp');
        }
        if (dispute.status !== DisputeStatus.PENDING) {
          throw new ConflictException('Tranh chấp đã được giải quyết');
        }

        const voter = await transaction.user.findUnique({
          where: { id: dto.voter_id },
          select: { trust_score: true },
        });
        if (!voter) {
          throw new NotFoundException('Không tìm thấy cử tri');
        }
        if (voter.trust_score < 4.5) {
          throw new ForbiddenException(
            'Chỉ thành viên có trust score từ 4.5 mới được bỏ phiếu',
          );
        }
        if (
          dto.voter_id === dispute.session.teacher_id ||
          dto.voter_id === dispute.session.student_id
        ) {
          throw new ForbiddenException(
            'Người tham gia phiên không được bỏ phiếu cho tranh chấp',
          );
        }

        const existingVote = await transaction.tribunalVote.findUnique({
          where: {
            dispute_id_voter_id: {
              dispute_id: disputeId,
              voter_id: dto.voter_id,
            },
          },
        });
        if (existingVote) {
          throw new ConflictException('Bạn đã bỏ phiếu cho tranh chấp này');
        }

        await transaction.tribunalVote.create({
          data: {
            dispute_id: disputeId,
            voter_id: dto.voter_id,
            choice: dto.choice,
          },
        });

        const votesForTeacher =
          dispute.votes_for_teacher +
          (dto.choice === TribunalVoteChoice.TEACHER ? 1 : 0);
        const votesForStudent =
          dispute.votes_for_student +
          (dto.choice === TribunalVoteChoice.STUDENT ? 1 : 0);
        const voteCount = votesForTeacher + votesForStudent;
        if (voteCount < 3) {
          return transaction.dispute.update({
            where: { id: disputeId },
            data: {
              votes_for_teacher: {
                increment: dto.choice === TribunalVoteChoice.TEACHER ? 1 : 0,
              },
              votes_for_student: {
                increment: dto.choice === TribunalVoteChoice.STUDENT ? 1 : 0,
              },
            },
          });
        }

        const teacherWins = votesForTeacher > votesForStudent;
        const resolvedStatus = teacherWins
          ? DisputeStatus.RESOLVED_TEACHER_WINS
          : DisputeStatus.RESOLVED_STUDENT_WINS;
        const updatedDispute = await transaction.dispute.update({
          where: { id: disputeId },
          data: {
            votes_for_teacher: votesForTeacher,
            votes_for_student: votesForStudent,
            status: resolvedStatus,
          },
        });
        await transaction.session.update({
          where: { id: dispute.session_id },
          data: {
            status: teacherWins
              ? SessionStatus.COMPLETED
              : SessionStatus.CANCELLED,
          },
        });
        if (teacherWins) {
          await this.creditsService.payoutEscrow(
            transaction,
            dispute.session_id,
            dispute.session.teacher_id,
          );
        } else {
          await this.creditsService.refundEscrow(
            transaction,
            dispute.session_id,
            dispute.session.student_id,
          );
        }
        return updatedDispute;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bạn đã bỏ phiếu cho tranh chấp này');
      }
      throw error;
    }
  }
}
