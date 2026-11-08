import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateSafeZoneDto } from './dto/create-safe-zone.dto';
import { UpdateSafeZoneDto } from './dto/update-safe-zone.dto';

const EARTH_RADIUS_KM = 6371;

// [NGHIỆP VỤ]: Quản lý địa điểm an toàn và tìm các điểm gần tọa độ người dùng.
// [CHỐNG GIAN LẬN]: QR lưu dưới dạng hash; không trả hash ra kết quả tìm kiếm công khai.
// [CẨN THẬN KHI SỬA]: CRUD Safe Zone hiện chưa có vai trò quản trị vì hệ thống chưa có xác thực.
// [ĐIỂM MỞ RỘNG]: Tích hợp PostGIS hoặc dịch vụ định vị để mở rộng dữ liệu lớn và kiểm tra GPS.
@Injectable()
export class SafeZonesService {
  // [NGHIỆP VỤ]: Nhận PrismaService để đọc/ghi danh mục địa điểm an toàn.
  // [CHỐNG GIAN LẬN]: Tất cả query đọc phải chọn trường công khai, không trả QR hash.
  // [CẨN THẬN KHI SỬA]: QR hash chỉ được sử dụng nội bộ trong luồng check-in.
  // [ĐIỂM MỞ RỘNG]: Inject geospatial provider khi chuyển sang PostGIS.
  constructor(private readonly prisma: PrismaService) {}

  // [NGHIỆP VỤ]: Tạo một địa điểm an toàn cùng mã QR đã được băm.
  // [CHỐNG GIAN LẬN]: QR raw secret không được lưu; caller phải gửi hash.
  // [CẨN THẬN KHI SỬA]: Bắt buộc kiểm tra quyền quản trị trước khi mở API ra mạng công cộng.
  // [ĐIỂM MỞ RỘNG]: Tạo QR secret ngẫu nhiên và chỉ trả QR một lần cho admin.
  async create(dto: CreateSafeZoneDto) {
    this.validateCoordinates(dto.latitude, dto.longitude);
    return this.prisma.safeZone.create({
      data: {
        name: dto.name.trim(),
        address: dto.address.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        qr_code_hash: dto.qr_code_hash,
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  // [NGHIỆP VỤ]: Trả danh sách địa điểm an toàn nhưng loại bỏ QR hash khỏi response.
  // [CHỐNG GIAN LẬN]: Không tiết lộ bí mật dùng xác thực check-in.
  // [CẨN THẬN KHI SỬA]: Phân trang khi số địa điểm tăng để tránh tải toàn bảng.
  // [ĐIỂM MỞ RỘNG]: Thêm trạng thái hoạt động và phân quyền quản trị.
  async findAll() {
    return this.prisma.safeZone.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // [NGHIỆP VỤ]: Trả QR hash phục vụ thử check-in ở môi trường phát triển.
  // [CHỐNG GIAN LẬN]: Cấm tuyệt đối việc xuất hash dùng check-in khi NODE_ENV=production.
  // [CẨN THẬN KHI SỬA]: QR hash có quyền check-in; không đưa trường này vào danh sách Safe Zone công khai.
  // [ĐIỂM MỞ RỘNG]: Thay bằng endpoint admin có xác thực hoặc phát hành QR động có thời hạn.
  async getCheckInHash(id: string): Promise<{ qr_code_hash: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Không thể xem QR hash trong production');
    }
    const safeZone = await this.prisma.safeZone.findUnique({
      where: { id },
      select: { qr_code_hash: true },
    });
    if (!safeZone) {
      throw new NotFoundException('Không tìm thấy Safe Zone');
    }
    return safeZone;
  }

  // [NGHIỆP VỤ]: Tính khoảng cách great-circle giữa hai điểm bằng công thức Haversine.
  // [CHỐNG GIAN LẬN]: Giới hạn tọa độ hợp lệ trước khi tính khoảng cách.
  // [CẨN THẬN KHI SỬA]: Công thức giả định Trái Đất hình cầu, phù hợp discovery bán kính nhỏ.
  // [ĐIỂM MỞ RỘNG]: Dùng PostGIS geography để truy vấn chỉ mục không gian khi dữ liệu lớn.
  async findNearby(latitude: number, longitude: number, radiusKm = 5) {
    this.validateCoordinates(latitude, longitude);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 1000) {
      throw new BadRequestException(
        'Bán kính tìm kiếm phải lớn hơn 0 và không vượt quá 1000 km',
      );
    }

    const zones = await this.prisma.safeZone.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
    return zones
      .map((zone) => ({
        ...zone,
        distance_km: this.haversineKm(
          latitude,
          longitude,
          zone.latitude,
          zone.longitude,
        ),
      }))
      .filter((zone) => zone.distance_km <= radiusKm)
      .sort((left, right) => left.distance_km - right.distance_km);
  }

  // [NGHIỆP VỤ]: Cập nhật tên, địa chỉ, tọa độ hoặc hash của địa điểm.
  // [CHỐNG GIAN LẬN]: Validate tọa độ mới trước khi lưu.
  // [CẨN THẬN KHI SỬA]: Thay QR hash sẽ vô hiệu QR cũ, cần đồng bộ bản in tại địa điểm.
  // [ĐIỂM MỞ RỘNG]: Chỉ cho role quản trị thay đổi QR hash.
  async update(id: string, dto: UpdateSafeZoneDto) {
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const current = await this.prisma.safeZone.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Không tìm thấy Safe Zone');
      }
      this.validateCoordinates(
        dto.latitude ?? current.latitude,
        dto.longitude ?? current.longitude,
      );
    }

    try {
      return await this.prisma.safeZone.update({
        where: { id },
        data: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          name: dto.name?.trim(),
          address: dto.address?.trim(),
          qr_code_hash: dto.qr_code_hash,
        },
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException('Không tìm thấy Safe Zone');
      }
      throw error;
    }
  }

  // [NGHIỆP VỤ]: Xóa địa điểm không còn được sử dụng.
  // [CHỐNG GIAN LẬN]: Không cascade xóa phiên đã từng gắn địa điểm này.
  // [CẨN THẬN KHI SỬA]: Foreign key sẽ chặn xóa Safe Zone đang được Session tham chiếu.
  // [ĐIỂM MỞ RỘNG]: Thêm trạng thái inactive thay cho xóa cứng để giữ lịch sử.
  async remove(id: string): Promise<{ success: true }> {
    try {
      await this.prisma.safeZone.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException('Không tìm thấy Safe Zone');
      }
      throw error;
    }
    return { success: true };
  }

  // [NGHIỆP VỤ]: Kiểm tra giá trị vĩ độ và kinh độ trong miền địa lý hợp lệ.
  // [CHỐNG GIAN LẬN]: Từ chối NaN, Infinity và tọa độ ngoài biên trước khi lưu hoặc tính toán.
  // [CẨN THẬN KHI SỬA]: Tọa độ sai có thể làm kết quả tìm kiếm Haversine không đáng tin cậy.
  // [ĐIỂM MỞ RỘNG]: Thêm kiểm tra khuôn viên trường hoặc vùng được phép nếu sản phẩm yêu cầu.
  private validateCoordinates(latitude: number, longitude: number): void {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException('Tọa độ latitude/longitude không hợp lệ');
    }
  }

  // [NGHIỆP VỤ]: Trả khoảng cách giữa điểm truy vấn và địa điểm theo kilomet.
  // [CHỐNG GIAN LẬN]: Giá trị đầu vào đã phải qua validateCoordinates trước khi gọi.
  // [CẨN THẬN KHI SỬA]: Giới hạn haversine trong [0,1] nếu thay đổi phép tính để tránh sai số Math.asin.
  // [ĐIỂM MỞ RỘNG]: Đổi sang truy vấn địa lý được index bởi PostGIS khi số Safe Zone lớn.
  private haversineKm(
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number,
  ): number {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = toRadians(latitude2 - latitude1);
    const longitudeDelta = toRadians(longitude2 - longitude1);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(latitude1)) *
        Math.cos(toRadians(latitude2)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
  }
}
