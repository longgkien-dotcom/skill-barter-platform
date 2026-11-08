import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateSkillDto } from './dto/create-skill.dto';
import { SearchSkillsDto } from './dto/search-skills.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillsService } from './skills.service';

// [NGHIỆP VỤ]: Định tuyến CRUD kỹ năng và API tìm kiếm.
// [CHỐNG GIAN LẬN]: DTO và ParseUUIDPipe chặn input sai định dạng; ownership được kiểm tra trong service.
// [CẨN THẬN KHI SỬA]: ownerId gửi qua query chỉ phù hợp trusted-client, không phải cơ chế xác thực.
// [ĐIỂM MỞ RỘNG]: Bổ sung guard đăng nhập và authorization policy theo người dùng.
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  // [NGHIỆP VỤ]: Tạo OFFER hoặc NEED skill theo payload hợp lệ.
  // [CHỐNG GIAN LẬN]: Enum và chiều dài trường được validate toàn cục.
  // [CẨN THẬN KHI SỬA]: user_id phải tồn tại và không được tin cậy như danh tính thật.
  // [ĐIỂM MỞ RỘNG]: Gắn user hiện tại từ auth principal.
  @Post()
  create(@Body() dto: CreateSkillDto) {
    return this.skillsService.create(dto);
  }

  // [NGHIỆP VỤ]: Tìm kỹ năng đang hoạt động theo các filter được cung cấp.
  // [CHỐNG GIAN LẬN]: Query filter được whitelist bằng DTO.
  // [CẨN THẬN KHI SỬA]: Thêm pagination/cursor khi số listing tăng.
  // [ĐIỂM MỞ RỘNG]: Bổ sung ranking gần đúng dựa trên hồ sơ và trust score.
  @Get()
  search(@Query() filters: SearchSkillsDto) {
    return this.skillsService.search(filters);
  }

  // [NGHIỆP VỤ]: Lấy thông tin chi tiết một kỹ năng.
  // [CHỐNG GIAN LẬN]: UUID được parse trước khi truy vấn cơ sở dữ liệu.
  // [CẨN THẬN KHI SỬA]: Không thêm thông tin ví hoặc dữ liệu riêng tư vào response.
  // [ĐIỂM MỞ RỘNG]: Thêm endpoint lịch sử/đánh giá ở dạng tổng hợp.
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.skillsService.findOne(id);
  }

  // [NGHIỆP VỤ]: Cập nhật kỹ năng hiện có của đúng chủ sở hữu.
  // [CHỐNG GIAN LẬN]: ID chủ sở hữu được đối chiếu trong service.
  // [CẨN THẬN KHI SỬA]: Query ownerId sẽ được thay bằng danh tính từ JWT khi có auth.
  // [ĐIỂM MỞ RỘNG]: Có thể bổ sung nhật ký kiểm duyệt thay đổi.
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skillsService.update(id, ownerId, dto);
  }

  // [NGHIỆP VỤ]: Xóa listing do chủ sở hữu yêu cầu.
  // [CHỐNG GIAN LẬN]: Service chặn xóa nếu ID người sở hữu không trùng.
  // [CẨN THẬN KHI SỬA]: Lịch sử Session có thể khiến database từ chối xóa.
  // [ĐIỂM MỞ RỘNG]: Có thể thay xóa cứng bằng thao tác tắt listing.
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('ownerId', ParseUUIDPipe) ownerId: string,
  ) {
    return this.skillsService.remove(id, ownerId);
  }
}
