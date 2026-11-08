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
import { CreateSafeZoneDto } from './dto/create-safe-zone.dto';
import { NearbySafeZonesDto } from './dto/nearby-safe-zones.dto';
import { UpdateSafeZoneDto } from './dto/update-safe-zone.dto';
import { SafeZonesService } from './safe-zones.service';

// [NGHIỆP VỤ]: Định tuyến quản trị địa điểm an toàn và tìm kiếm theo vị trí.
// [CHỐNG GIAN LẬN]: Response public không chứa QR hash; input được validate trước khi lưu.
// [CẨN THẬN KHI SỬA]: Endpoint CRUD chưa có admin guard do lựa chọn trusted-client.
// [ĐIỂM MỞ RỘNG]: Thêm role-based authorization và integration QR/GPS ở controller/service này.
@Controller('safe-zones')
export class SafeZonesController {
  constructor(private readonly safeZonesService: SafeZonesService) {}

  // [NGHIỆP VỤ]: Tạo địa điểm an toàn mới.
  // [CHỐNG GIAN LẬN]: DTO giới hạn độ dài trường và định dạng hash QR.
  // [CẨN THẬN KHI SỬA]: Không mở route này công khai nếu chưa thêm quyền admin.
  // [ĐIỂM MỞ RỘNG]: Sinh và hiển thị QR secret một lần qua luồng quản trị riêng.
  @Post()
  create(@Body() dto: CreateSafeZoneDto) {
    return this.safeZonesService.create(dto);
  }

  // [NGHIỆP VỤ]: Liệt kê Safe Zone với các trường công khai.
  // [CHỐNG GIAN LẬN]: Service chủ động loại qr_code_hash khỏi response.
  // [CẨN THẬN KHI SỬA]: Bổ sung pagination nếu danh sách lớn.
  // [ĐIỂM MỞ RỘNG]: Có thể thêm trạng thái hoạt động và phân vùng campus.
  @Get()
  findAll() {
    return this.safeZonesService.findAll();
  }

  // [NGHIỆP VỤ]: Cho phép copy dữ liệu QR trong local development để kiểm thử check-in.
  // [CHỐNG GIAN LẬN]: Service từ chối trả dữ liệu này trong production.
  // [CẨN THẬN KHI SỬA]: Giá trị là thông tin xác thực, không log hoặc cache trên CDN.
  // [ĐIỂM MỞ RỘNG]: Dùng quyền admin và QR token có hạn khi triển khai thật.
  @Get(':id/qr')
  getCheckInHash(@Param('id', ParseUUIDPipe) id: string) {
    return this.safeZonesService.getCheckInHash(id);
  }

  // [NGHIỆP VỤ]: Tìm Safe Zone cách tọa độ cung cấp không quá radiusKm, mặc định 5 km.
  // [CHỐNG GIAN LẬN]: Tọa độ và bán kính được chuyển kiểu và kiểm tra giới hạn.
  // [CẨN THẬN KHI SỬA]: Haversine hiện tính trên danh sách toàn bảng; dùng PostGIS khi dữ liệu tăng.
  // [ĐIỂM MỞ RỘNG]: Có thể lấy vị trí GPS qua ứng dụng thay vì query thủ công.
  @Get('nearby')
  findNearby(@Query() query: NearbySafeZonesDto) {
    return this.safeZonesService.findNearby(
      query.latitude,
      query.longitude,
      query.radiusKm,
    );
  }

  // [NGHIỆP VỤ]: Cập nhật các trường Safe Zone được gửi lên.
  // [CHỐNG GIAN LẬN]: Service kiểm tra tọa độ trước khi ghi và không trả QR hash.
  // [CẨN THẬN KHI SỬA]: Cập nhật QR hash sẽ làm mất hiệu lực mã cũ.
  // [ĐIỂM MỞ RỘNG]: Giới hạn thao tác này cho tài khoản quản trị.
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSafeZoneDto,
  ) {
    return this.safeZonesService.update(id, dto);
  }

  // [NGHIỆP VỤ]: Xóa địa điểm an toàn theo UUID.
  // [CHỐNG GIAN LẬN]: UUID được parse và service không cascade lịch sử phiên.
  // [CẨN THẬN KHI SỬA]: Database từ chối xóa nếu còn phiên tham chiếu địa điểm.
  // [ĐIỂM MỞ RỘNG]: Thêm trạng thái ngừng hoạt động để bảo toàn lịch sử.
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.safeZonesService.remove(id);
  }
}
