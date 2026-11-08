import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BookSessionDto } from './dto/book-session.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ListSessionsDto } from './dto/list-sessions.dto';
import { SessionActorDto } from './dto/session-actor.dto';
import { SessionsService } from './sessions.service';

// [NGHIỆP VỤ]: Cung cấp các route đặt, check-in, hủy và kết thúc phiên.
// [CHỐNG GIAN LẬN]: Input có DTO, UUID pipe và kiểm tra actor trong service.
// [CẨN THẬN KHI SỬA]: Actor ID từ payload chưa được ràng buộc với phiên đăng nhập.
// [ĐIỂM MỞ RỘNG]: Lấy danh tính từ JWT và giới hạn quyền đọc theo thành viên phiên.
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // [NGHIỆP VỤ]: Liệt kê phiên mới nhất, tùy chọn lọc theo SessionStatus.
  // [CHỐNG GIAN LẬN]: DTO chỉ chấp nhận các status enum đã khai báo.
  // [CẨN THẬN KHI SỬA]: Danh sách chưa giới hạn theo user do MVP chưa có authentication.
  // [ĐIỂM MỞ RỘNG]: Thêm phân trang và tự lấy user ID từ access token.
  @Get()
  findAll(@Query() query: ListSessionsDto) {
    return this.sessionsService.findAll(query.status);
  }

  // [NGHIỆP VỤ]: Tạo phiên và khóa escrow theo skill OFFER đã chọn.
  // [CHỐNG GIAN LẬN]: Service xác thực student, skill, ba mốc hợp đồng và số dư.
  // [CẨN THẬN KHI SỬA]: Đặt phiên là thao tác tài chính nguyên tử.
  // [ĐIỂM MỞ RỘNG]: Gửi thông báo giáo viên sau khi transaction commit.
  @Post()
  book(@Body() dto: BookSessionDto) {
    return this.sessionsService.book(dto);
  }

  // [NGHIỆP VỤ]: Đọc trạng thái và thông tin công khai của phiên.
  // [CHỐNG GIAN LẬN]: QR hash và ledger không được trả cho client.
  // [CẨN THẬN KHI SỬA]: Cần authorization theo thành viên khi có auth.
  // [ĐIỂM MỞ RỘNG]: Bổ sung lịch sử trạng thái dạng audit.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOne(id);
  }

  // [NGHIỆP VỤ]: Check-in bằng QR tại Safe Zone.
  // [CHỐNG GIAN LẬN]: Service kiểm tra actor tham gia và QR hash constant-time.
  // [CẨN THẬN KHI SỬA]: Chỉ phiên ESCROWED mới được chuyển sang IN_PROGRESS.
  // [ĐIỂM MỞ RỘNG]: Tích hợp scanner QR/GPS ở ứng dụng di động.
  @Post(':id/check-in')
  checkIn(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckInDto) {
    return this.sessionsService.checkIn(id, dto.user_id, dto.qr_code_hash);
  }

  // [NGHIỆP VỤ]: Hủy phiên trước giờ bắt đầu và hoàn phần escrow.
  // [CHỐNG GIAN LẬN]: Service xác nhận actor thuộc phiên; nếu teacher hủy sẽ giảm trust score.
  // [CẨN THẬN KHI SỬA]: Không gọi hoàn tiền ngoài transaction đổi trạng thái.
  // [ĐIỂM MỞ RỘNG]: Thêm lý do hủy và chính sách phí theo thời điểm.
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SessionActorDto) {
    return this.sessionsService.cancel(id, dto.user_id);
  }

  // [NGHIỆP VỤ]: Sinh viên báo giáo viên không đến sau thời gian ân hạn.
  // [CHỐNG GIAN LẬN]: Chỉ đúng sinh viên và phiên ESCROWED mới được báo no-show.
  // [CẨN THẬN KHI SỬA]: Refund và giảm trust score phải atomic, tránh báo cáo lặp.
  // [ĐIỂM MỞ RỘNG]: Thu thập bằng chứng check-in/GPS để phân xử báo cáo sai.
  @Post(':id/no-show')
  reportTeacherNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SessionActorDto,
  ) {
    return this.sessionsService.reportTeacherNoShow(id, dto.user_id);
  }

  // [NGHIỆP VỤ]: Giáo viên nộp ảnh chứng minh, hoàn tất phiên và nhận escrow.
  // [CHỐNG GIAN LẬN]: Chỉ giáo viên liên kết với phiên được gọi route này.
  // [CẨN THẬN KHI SỬA]: Proof, trạng thái COMPLETED và ledger payout phải commit đồng thời.
  // [ĐIỂM MỞ RỘNG]: Chuyển ảnh sang object storage có kiểm tra MIME và chữ ký URL.
  @Post(':id/check-out')
  checkOut(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckOutDto) {
    return this.sessionsService.checkOut(
      id,
      dto.teacher_id,
      dto.proof_image_url,
    );
  }
}
