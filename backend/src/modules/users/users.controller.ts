import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';
import { TopUpDto } from './dto/top-up.dto';
import { UsersService } from './users.service';

// [NGHIỆP VỤ]: Công khai các route tạo hồ sơ, xác minh email và thao tác ví.
// [CHỐNG GIAN LẬN]: Các route hiện nhận user ID từ URL theo chế độ trusted-client, không được public trực tiếp.
// [CẨN THẬN KHI SỬA]: ParseUUIDPipe chỉ xác nhận định dạng ID, không thay thế xác thực/ủy quyền.
// [ĐIỂM MỞ RỘNG]: Gắn JWT guard và lấy user ID từ principal thay vì từ client.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // [NGHIỆP VỤ]: Liệt kê hồ sơ mẫu để bộ chuyển người dùng của UI có thể hoạt động.
  // [CHỐNG GIAN LẬN]: Response không chứa dữ liệu nhạy cảm ngoài thông tin ví cơ bản.
  // [CẨN THẬN KHI SỬA]: Route này phục vụ trusted-client, không được dùng thay authentication.
  // [ĐIỂM MỞ RỘNG]: Thay bằng danh sách giới hạn theo quyền khi thêm JWT.
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // [NGHIỆP VỤ]: Tạo tài khoản sinh viên với email và tên hiển thị.
  // [CHỐNG GIAN LẬN]: DTO được kiểm tra bởi ValidationPipe toàn cục trước khi lưu.
  // [CẨN THẬN KHI SỬA]: Email chuẩn hóa và khóa unique được xử lý trong service/database.
  // [ĐIỂM MỞ RỘNG]: Kích hoạt email OTP sau khi tài khoản được tạo.
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // [NGHIỆP VỤ]: Xác minh email .edu.vn và cấp thưởng ban đầu.
  // [CHỐNG GIAN LẬN]: Việc giới hạn thưởng một lần được thực thi trong transaction service.
  // [CẨN THẬN KHI SỬA]: ID URL không chứng minh người gọi sở hữu email ở chế độ trusted-client.
  // [ĐIỂM MỞ RỘNG]: Thay route trực tiếp bằng xác minh OTP gửi email.
  @Post(':id/verify-email')
  verifyEduEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.verifyEduEmail(id);
  }

  // [NGHIỆP VỤ]: Lấy hồ sơ ví cơ bản theo UUID.
  // [CHỐNG GIAN LẬN]: Không trả ledger đầy đủ hoặc dữ liệu quan hệ không cần thiết.
  // [CẨN THẬN KHI SỬA]: Thêm kiểm tra quyền sở hữu khi chuyển sang xác thực người dùng.
  // [ĐIỂM MỞ RỘNG]: Có thể bổ sung endpoint đọc giao dịch với phân trang.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // [NGHIỆP VỤ]: Trả lịch sử ledger gần nhất của người dùng đang chọn.
  // [CHỐNG GIAN LẬN]: Service lọc truy vấn theo khóa user_id.
  // [CẨN THẬN KHI SỬA]: Hiện user ID URL chưa được xác thực quyền sở hữu.
  // [ĐIỂM MỞ RỘNG]: Thêm cursor và bộ lọc transaction type.
  @Get(':id/transactions')
  findTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findTransactions(id);
  }

  // [NGHIỆP VỤ]: Nạp Premium Credit mô phỏng theo số lượng trong payload.
  // [CHỐNG GIAN LẬN]: Service chặn route này khi NODE_ENV=production.
  // [CẨN THẬN KHI SỬA]: Không xem request client là chứng từ thanh toán.
  // [ĐIỂM MỞ RỘNG]: Thay bằng cổng thanh toán và webhook ký số.
  @Post(':id/top-up')
  topUp(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TopUpDto) {
    return this.usersService.topUp(id, dto.amount);
  }

  // [NGHIỆP VỤ]: Đổi lượng tín dụng chỉ định và ghi giao dịch đổi voucher.
  // [CHỐNG GIAN LẬN]: Số lượng nguyên dương và loại tín dụng được validate trước khi trừ ví.
  // [CẨN THẬN KHI SỬA]: Route này đốt tín dụng, chưa tạo/tra cứu một mã voucher thực.
  // [ĐIỂM MỞ RỘNG]: Thêm chính sách voucher và phát hành vật phẩm sau khi trừ tín dụng.
  @Post(':id/vouchers/redeem')
  redeemVoucher(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RedeemVoucherDto,
  ) {
    return this.usersService.redeemVoucher(id, dto.amount, dto.credit_type);
  }
}
