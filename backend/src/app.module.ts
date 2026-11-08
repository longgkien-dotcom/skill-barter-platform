import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { WalletModule } from './core/wallet/wallet.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SafeZonesModule } from './modules/safe-zones/safe-zones.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SkillsModule } from './modules/skills/skills.module';
import { UsersModule } from './modules/users/users.module';

// [NGHIỆP VỤ]: Lắp ráp các module nền tảng, ví và các luồng chính của marketplace.
// [CHỐNG GIAN LẬN]: Prisma và CreditsService dùng chung để bảo toàn quy tắc dữ liệu xuyên module.
// [CẨN THẬN KHI SỬA]: Giữ PrismaModule trước các feature module cần kết nối database.
// [ĐIỂM MỞ RỘNG]: Đăng ký AuthModule, health checks và payment adapter khi sẵn sàng.
@Module({
  imports: [
    PrismaModule,
    WalletModule,
    UsersModule,
    SkillsModule,
    SafeZonesModule,
    SessionsModule,
    ReviewsModule,
    DisputesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
