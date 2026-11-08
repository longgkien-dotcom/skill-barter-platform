import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// [NGHIỆP VỤ]: Gom các endpoint và nghiệp vụ hồ sơ người dùng.
// [CHỐNG GIAN LẬN]: Ví sử dụng CreditsService dùng chung để áp dụng cùng quy tắc ledger.
// [CẨN THẬN KHI SỬA]: PrismaModule và WalletModule được cung cấp toàn cục trong AppModule.
// [ĐIỂM MỞ RỘNG]: Đăng ký auth guard và dịch vụ gửi email trong module này.
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
