import { Global, Module } from '@nestjs/common';
import { CreditsService } from './credits.service';

// [NGHIỆP VỤ]: Cung cấp CreditsService dùng chung cho phiên, tranh chấp và ví người dùng.
// [CHỐNG GIAN LẬN]: Tập trung quy tắc ledger để tránh mỗi module tự tạo biến thể ghi số dư.
// [CẨN THẬN KHI SỬA]: Đăng ký global chỉ sau PrismaModule để CreditsService có thể inject PrismaService.
// [ĐIỂM MỞ RỘNG]: Đăng ký adapter cổng thanh toán hoặc chính sách hết hạn tín dụng tại đây.
@Global()
@Module({
  providers: [CreditsService],
  exports: [CreditsService],
})
export class WalletModule {}
