import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { ListDisputesDto } from './dto/list-disputes.dto';
import { VoteDisputeDto } from './dto/vote-dispute.dto';
import { DisputesService } from './disputes.service';

// [NGHIỆP VỤ]: Định tuyến tạo, xem và bỏ phiếu tranh chấp cộng đồng.
// [CHỐNG GIAN LẬN]: DTO giới hạn trường; service xác nhận participant, trust score và phiếu duy nhất.
// [CẨN THẬN KHI SỬA]: ID complainant/voter từ client chưa phải danh tính đã xác thực.
// [ĐIỂM MỞ RỘNG]: Gắn quyền từ JWT và hạn chế thông tin tranh chấp theo hội đồng.
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  // [NGHIỆP VỤ]: Liệt kê các tranh chấp cho màn hình Community Tribunal.
  // [CHỐNG GIAN LẬN]: Hỗ trợ lọc enum status hợp lệ từ query.
  // [CẨN THẬN KHI SỬA]: Danh sách được công khai trong trusted-client MVP.
  // [ĐIỂM MỞ RỘNG]: Giới hạn danh sách theo hội đồng và phân trang.
  @Get()
  findAll(@Query() query: ListDisputesDto) {
    return this.disputesService.findAll(query.status);
  }

  // [NGHIỆP VỤ]: Mở tranh chấp cho một phiên và đóng băng escrow.
  // [CHỐNG GIAN LẬN]: Chỉ giáo viên hoặc sinh viên thuộc phiên được khiếu nại.
  // [CẨN THẬN KHI SỬA]: Session status và bản ghi tranh chấp phải được commit chung.
  // [ĐIỂM MỞ RỘNG]: Thêm file bằng chứng và notification khi mở tranh chấp.
  @Post()
  open(@Body() dto: OpenDisputeDto) {
    return this.disputesService.open(dto);
  }

  // [NGHIỆP VỤ]: Xem nội dung và tiến độ tranh chấp.
  // [CHỐNG GIAN LẬN]: Response không tiết lộ cử tri để bảo vệ tính độc lập của tribunal.
  // [CẨN THẬN KHI SỬA]: Thêm kiểm tra quyền xem theo quan hệ phiên khi bật xác thực.
  // [ĐIỂM MỞ RỘNG]: Bổ sung lịch sử xử lý và kháng nghị.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.disputesService.findOne(id);
  }

  // [NGHIỆP VỤ]: Ghi lựa chọn của thành viên hội đồng cho tranh chấp.
  // [CHỐNG GIAN LẬN]: Service chặn người trust thấp, người tham gia và phiếu trùng.
  // [CẨN THẬN KHI SỬA]: Phiếu thứ ba có thể hoàn tất chuyển tiền escrow.
  // [ĐIỂM MỞ RỘNG]: Tạo hội đồng được phân công để chống thông đồng.
  @Post(':id/votes')
  vote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoteDisputeDto) {
    return this.disputesService.vote(id, dto);
  }
}
