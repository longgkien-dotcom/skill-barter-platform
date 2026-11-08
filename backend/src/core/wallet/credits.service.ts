import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableRetry } from '../prisma/serializable-transaction';

export const MAX_STANDARD_BALANCE = 20;

// [NGHIỆP VỤ]: Tập trung quy tắc khóa, hoàn, chi và ghi sổ tín dụng cho toàn bộ nền tảng.
// [CHỐNG GIAN LẬN]: Số dư không được thay đổi nếu không có ledger tương ứng trong cùng transaction.
// [CẨN THẬN KHI SỬA]: Mỗi thao tác wallet cần giữ invariant số dư không âm và standard_balance không vượt 20.
// [ĐIỂM MỞ RỘNG]: Thay top-up mô phỏng bằng adapter cổng thanh toán có webhook đã xác thực.
@Injectable()
export class CreditsService {
  // [NGHIỆP VỤ]: Nhận PrismaService để wallet dùng chung kết nối với các nghiệp vụ khác.
  // [CHỐNG GIAN LẬN]: Không tạo PrismaClient riêng có thể làm tách transaction khỏi ledger.
  // [CẨN THẬN KHI SỬA]: Giữ dependency injection để transaction client được truyền vào từng thao tác.
  // [ĐIỂM MỞ RỘNG]: Thêm policy service khi có nhiều loại nguồn tín dụng.
  constructor(private readonly prisma: PrismaService) {}

  // [NGHIỆP VỤ]: Ưu tiên khóa Standard Credit, sau đó dùng Premium Credit để đủ chi phí phiên.
  // [CHỐNG GIAN LẬN]: Kiểm tra đủ tiền và cập nhật có điều kiện để chống tiêu lặp do request đồng thời.
  // [CẨN THẬN KHI SỬA]: Các dòng ESCROW_LOCK là nguồn sự thật để hoàn hoặc chi trả; phải tạo cùng transaction.
  // [ĐIỂM MỞ RỘNG]: Có thể thêm quy tắc chọn lô tín dụng chưa hết hạn khi ledger hỗ trợ truy vết lô.
  async lockEscrow(
    transaction: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    amount: number,
  ): Promise<void> {
    const user = await transaction.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người học');
    }
    if (user.standard_balance + user.premium_balance < amount) {
      throw new BadRequestException('Số dư không đủ để đặt phiên');
    }

    const standardAmount = Math.min(user.standard_balance, amount);
    const premiumAmount = amount - standardAmount;
    const update = await transaction.user.updateMany({
      where: {
        id: userId,
        standard_balance: user.standard_balance,
        premium_balance: user.premium_balance,
      },
      data: {
        standard_balance: { decrement: standardAmount },
        premium_balance: { decrement: premiumAmount },
      },
    });
    if (update.count !== 1) {
      throw new BadRequestException('Số dư đã thay đổi, vui lòng thử lại');
    }

    const lockRows = [
      { amount: standardAmount, credit_type: CreditType.STANDARD },
      { amount: premiumAmount, credit_type: CreditType.PREMIUM },
    ].filter((row) => row.amount > 0);

    await transaction.transaction.createMany({
      data: lockRows.map((row) => ({
        user_id: userId,
        session_id: sessionId,
        amount: row.amount,
        credit_type: row.credit_type,
        transaction_type: TransactionType.ESCROW_LOCK,
      })),
    });
  }

  // [NGHIỆP VỤ]: Hoàn lại toàn bộ tín dụng đã khóa cho người học khi hủy hoặc người dạy vắng mặt.
  // [CHỐNG GIAN LẬN]: Chỉ hoàn theo ledger escrow gốc, không nhận số tiền hoàn từ dữ liệu client.
  // [CẨN THẬN KHI SỬA]: Nếu hoàn Standard vượt trần 20, phần vượt được chuyển sang Premium để không làm mất giá trị escrow.
  // [ĐIỂM MỞ RỘNG]: Có thể giữ nguyên hạn sử dụng theo từng lô khi triển khai quản lý expiry theo ledger.
  async refundEscrow(
    transaction: Prisma.TransactionClient,
    sessionId: string,
    studentId: string,
  ): Promise<void> {
    const locks = await transaction.transaction.findMany({
      where: {
        session_id: sessionId,
        user_id: studentId,
        transaction_type: TransactionType.ESCROW_LOCK,
      },
    });
    if (locks.length === 0) {
      throw new BadRequestException('Không tìm thấy tín dụng escrow để hoàn');
    }

    const standardLocked = locks
      .filter((row) => row.credit_type === CreditType.STANDARD)
      .reduce((sum, row) => sum + row.amount, 0);
    const premiumLocked = locks
      .filter((row) => row.credit_type === CreditType.PREMIUM)
      .reduce((sum, row) => sum + row.amount, 0);
    const user = await transaction.user.findUnique({
      where: { id: studentId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người học');
    }

    const standardRefund = Math.min(
      standardLocked,
      Math.max(0, MAX_STANDARD_BALANCE - user.standard_balance),
    );
    const premiumRefund = premiumLocked + standardLocked - standardRefund;
    await transaction.user.update({
      where: { id: studentId },
      data: {
        standard_balance: { increment: standardRefund },
        premium_balance: { increment: premiumRefund },
      },
    });

    const refunds = [
      { amount: standardRefund, credit_type: CreditType.STANDARD },
      { amount: premiumRefund, credit_type: CreditType.PREMIUM },
    ].filter((row) => row.amount > 0);
    await transaction.transaction.createMany({
      data: refunds.map((row) => ({
        user_id: studentId,
        session_id: sessionId,
        amount: row.amount,
        credit_type: row.credit_type,
        transaction_type: TransactionType.ESCROW_REFUND,
      })),
    });
  }

  // [NGHIỆP VỤ]: Trả tín dụng đã escrow cho người dạy sau khi hoàn tất phiên hoặc xử lý tranh chấp.
  // [CHỐNG GIAN LẬN]: Số tiền trả lấy từ các dòng escrow của phiên, không lấy từ payload của người gọi.
  // [CẨN THẬN KHI SỬA]: Standard Credit tối đa 20; phần vượt trần chuyển sang Premium để bảo toàn tổng giá trị.
  // [ĐIỂM MỞ RỘNG]: Có thể thay quy tắc chuyển phần vượt bằng sổ pending payout hoặc cơ chế giải ngân khác.
  async payoutEscrow(
    transaction: Prisma.TransactionClient,
    sessionId: string,
    teacherId: string,
  ): Promise<void> {
    const locks = await transaction.transaction.findMany({
      where: {
        session_id: sessionId,
        transaction_type: TransactionType.ESCROW_LOCK,
      },
    });
    const amount = locks.reduce((sum, row) => sum + row.amount, 0);
    if (amount <= 0) {
      throw new BadRequestException(
        'Không tìm thấy tín dụng escrow để chi trả',
      );
    }

    const teacher = await transaction.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new NotFoundException('Không tìm thấy người dạy');
    }

    const standardEarned = Math.min(
      amount,
      Math.max(0, MAX_STANDARD_BALANCE - teacher.standard_balance),
    );
    const premiumEarned = amount - standardEarned;
    await transaction.user.update({
      where: { id: teacherId },
      data: {
        standard_balance: { increment: standardEarned },
        premium_balance: { increment: premiumEarned },
      },
    });

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const earnings = [
      { amount: standardEarned, credit_type: CreditType.STANDARD },
      { amount: premiumEarned, credit_type: CreditType.PREMIUM },
    ].filter((row) => row.amount > 0);
    await transaction.transaction.createMany({
      data: earnings.map((row) => ({
        user_id: teacherId,
        session_id: sessionId,
        amount: row.amount,
        credit_type: row.credit_type,
        transaction_type: TransactionType.EARN,
        expires_at: expiresAt,
      })),
    });
  }

  // [NGHIỆP VỤ]: Nạp Premium Credit theo chế độ mô phỏng cục bộ để kiểm thử ví.
  // [CHỐNG GIAN LẬN]: Từ chối nạp trong production vì số tiền client gửi không chứng minh đã thanh toán.
  // [CẨN THẬN KHI SỬA]: Không gỡ chặn production nếu chưa xác thực webhook/chữ ký của cổng thanh toán.
  // [ĐIỂM MỞ RỘNG]: Thay nhánh mô phỏng bằng payment intent và chỉ ghi TOPUP sau callback đã xác thực.
  async mockTopUp(userId: string, amount: number): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Top-up mô phỏng đã bị tắt trong production',
      );
    }

    await withSerializableRetry(this.prisma, async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      await transaction.user.update({
        where: { id: userId },
        data: { premium_balance: { increment: amount } },
      });
      await transaction.transaction.create({
        data: {
          user_id: userId,
          amount,
          credit_type: CreditType.PREMIUM,
          transaction_type: TransactionType.TOPUP,
        },
      });
    });
  }

  // [NGHIỆP VỤ]: Cho phép người dùng đổi một lượng Standard hoặc Premium Credit lấy voucher.
  // [CHỐNG GIAN LẬN]: Loại tín dụng và số lượng được kiểm tra server-side, số dư không được âm.
  // [CẨN THẬN KHI SỬA]: Cập nhật balance và ghi REDEEM_VOUCHER phải nằm trong cùng transaction.
  // [ĐIỂM MỞ RỘNG]: Bổ sung bảng voucher, mã định danh, nhà phát hành và trạng thái sử dụng khi có quy tắc phát hành.
  async redeemVoucher(
    userId: string,
    amount: number,
    creditType: CreditType,
  ): Promise<void> {
    await withSerializableRetry(this.prisma, async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      const field =
        creditType === CreditType.STANDARD
          ? 'standard_balance'
          : 'premium_balance';
      if (user[field] < amount) {
        throw new BadRequestException('Số dư không đủ để đổi voucher');
      }
      if (creditType === CreditType.STANDARD) {
        await transaction.user.update({
          where: { id: userId },
          data: { standard_balance: { decrement: amount } },
        });
      } else {
        await transaction.user.update({
          where: { id: userId },
          data: { premium_balance: { decrement: amount } },
        });
      }
      await transaction.transaction.create({
        data: {
          user_id: userId,
          amount,
          credit_type: creditType,
          transaction_type: TransactionType.REDEEM_VOUCHER,
        },
      });
    });
  }
}
