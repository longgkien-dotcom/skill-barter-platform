import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { withSerializableRetry } from '../../core/prisma/serializable-transaction';
import { CreditsService } from '../../core/wallet/credits.service';
import { CreateUserDto } from './dto/create-user.dto';

// [NGHIỆP VỤ]: Điều phối đăng ký, xác minh email trường và thao tác ví của người dùng.
// [CHỐNG GIAN LẬN]: Chỉ cấp thưởng xác minh một lần và giới hạn Standard Credit ở mức 20.
// [CẨN THẬN KHI SỬA]: Thưởng và giao dịch ledger phải ghi nguyên tử để không cấp trùng khi request chạy đồng thời.
// [ĐIỂM MỞ RỘNG]: Thêm OTP email và guard JWT; hiện tại API theo lựa chọn trusted-client chưa xác thực danh tính.
@Injectable()
export class UsersService {
  // [NGHIỆP VỤ]: Nhận Prisma và CreditsService để hồ sơ và ví dùng chung chính sách.
  // [CHỐNG GIAN LẬN]: Không tự khởi tạo wallet client riêng ngoài CreditsService.
  // [CẨN THẬN KHI SỬA]: CreditsService phải tiếp tục được dùng cho top-up và đổi tín dụng.
  // [ĐIỂM MỞ RỘNG]: Inject OTP sender hoặc authentication service khi bổ sung xác minh thật.
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
  ) {}

  // [NGHIỆP VỤ]: Cung cấp danh sách người dùng an toàn để chọn hồ sơ trong môi trường trusted-client.
  // [CHỐNG GIAN LẬN]: Chỉ trả trường cần cho UI; danh sách bị giới hạn để tránh lộ ledger và tải quá lớn.
  // [CẨN THẬN KHI SỬA]: Đây không phải cơ chế đăng nhập; public production cần thay bằng principal đã xác thực.
  // [ĐIỂM MỞ RỘNG]: Thêm phân trang và chỉ trả account đã được phép discover sau khi có auth.
  async findAll() {
    return this.prisma.user.findMany({
      take: 100,
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        is_verified: true,
        standard_balance: true,
        premium_balance: true,
        trust_score: true,
        created_at: true,
      },
    });
  }

  // [NGHIỆP VỤ]: Tạo hồ sơ người dùng mới với ví ban đầu rỗng.
  // [CHỐNG GIAN LẬN]: Chuẩn hóa email để tránh tạo nhiều tài khoản khác chữ hoa/thường.
  // [CẨN THẬN KHI SỬA]: Email có unique constraint; để Prisma/Nest trả lỗi xung đột thay vì tạo hồ sơ trùng.
  // [ĐIỂM MỞ RỘNG]: Bổ sung mật khẩu băm, OTP email và quy trình chống đăng ký tự động trước khi mở public.
  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          full_name: dto.full_name.trim(),
          avatar_url: dto.avatar_url,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw error;
    }
  }

  // [NGHIỆP VỤ]: Xác minh email miền .edu.vn và cấp tối đa một Standard Credit thưởng khởi đầu.
  // [CHỐNG GIAN LẬN]: Chỉ email đúng miền trường được xác minh; cờ verified được cập nhật có điều kiện.
  // [CẨN THẬN KHI SỬA]: Cờ verified, số dư và ledger thưởng phải nằm trong cùng Serializable transaction.
  // [ĐIỂM MỞ RỘNG]: Thay xác nhận trực tiếp bằng mã OTP dùng một lần gửi tới email đã đăng ký.
  async verifyEduEmail(userId: string) {
    return withSerializableRetry(this.prisma, async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      if (!/^[^@\s]+@[^@\s]+\.edu\.vn$/i.test(user.email)) {
        throw new BadRequestException('Chỉ chấp nhận địa chỉ email .edu.vn');
      }
      if (user.is_verified) {
        throw new ConflictException('Email này đã được xác minh');
      }

      const bonus = Math.min(1, Math.max(0, 20 - user.standard_balance));
      const updated = await transaction.user.updateMany({
        where: { id: userId, is_verified: false },
        data: {
          is_verified: true,
          standard_balance: { increment: bonus },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Email đã được xác minh');
      }

      if (bonus > 0) {
        await transaction.transaction.create({
          data: {
            user_id: userId,
            amount: bonus,
            credit_type: CreditType.STANDARD,
            transaction_type: TransactionType.EARN,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
      return transaction.user.findUniqueOrThrow({ where: { id: userId } });
    });
  }

  // [NGHIỆP VỤ]: Trả hồ sơ và số dư hiện tại cho giao diện người dùng.
  // [CHỐNG GIAN LẬN]: Không trả các quan hệ hoặc thông tin nhạy cảm không cần thiết cho màn hình hồ sơ.
  // [CẨN THẬN KHI SỬA]: Tránh include toàn bộ ledger vì lượng giao dịch có thể tăng lớn.
  // [ĐIỂM MỞ RỘNG]: Thêm phân trang giao dịch qua endpoint ví riêng khi cần.
  async findOne(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        is_verified: true,
        standard_balance: true,
        premium_balance: true,
        trust_score: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  // [NGHIỆP VỤ]: Lấy tối đa 100 giao dịch ledger mới nhất của ví được chọn.
  // [CHỐNG GIAN LẬN]: Lọc theo user_id phía máy chủ để không trộn ledger của tài khoản khác.
  // [CẨN THẬN KHI SỬA]: Không trả giao dịch cho người dùng khác khi API chuyển sang auth thực.
  // [ĐIỂM MỞ RỘNG]: Thêm cursor pagination khi ledger phát triển lớn.
  async findTransactions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return this.prisma.transaction.findMany({
      where: { user_id: userId },
      take: 100,
      orderBy: { created_at: 'desc' },
    });
  }

  // [NGHIỆP VỤ]: Chuyển yêu cầu nạp thử nghiệm sang CreditsService để tăng Premium Credit và ghi TOPUP.
  // [CHỐNG GIAN LẬN]: Giá trị chỉ được chấp nhận ở môi trường phát triển; môi trường production luôn bị chặn.
  // [CẨN THẬN KHI SỬA]: Không trả thành công trước khi transaction cập nhật ví và ledger commit.
  // [ĐIỂM MỞ RỘNG]: Thay mock bằng payment intent đã xác nhận từ server-to-server webhook.
  async topUp(userId: string, amount: number): Promise<{ success: true }> {
    await this.creditsService.mockTopUp(userId, amount);
    return { success: true };
  }

  // [NGHIỆP VỤ]: Đốt một lượng tín dụng do người dùng chọn và ghi lại loại giao dịch REDEEM_VOUCHER.
  // [CHỐNG GIAN LẬN]: Không cho số dư âm; không coi request đổi tín dụng là bằng chứng đã có mã voucher.
  // [CẨN THẬN KHI SỬA]: Giao dịch ví và ledger cần được commit hoặc rollback cùng nhau.
  // [ĐIỂM MỞ RỘNG]: Thêm mã voucher, giá trị quy đổi và bảng phát hành khi voucher có chính sách riêng.
  async redeemVoucher(
    userId: string,
    amount: number,
    creditType: CreditType,
  ): Promise<{ success: true }> {
    await this.creditsService.redeemVoucher(userId, amount, creditType);
    return { success: true };
  }
}
