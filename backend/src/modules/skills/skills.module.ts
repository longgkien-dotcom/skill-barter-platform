import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

// [NGHIỆP VỤ]: Đăng ký API và service quản lý kỹ năng.
// [CHỐNG GIAN LẬN]: Service là nơi thực thi quy tắc ownership và trạng thái listing.
// [CẨN THẬN KHI SỬA]: Không chuyển thao tác ownership sang controller.
// [ĐIỂM MỞ RỘNG]: Thêm module tìm kiếm khi cần mở rộng discovery.
@Module({
  controllers: [SkillsController],
  providers: [SkillsService],
})
export class SkillsModule {}
