import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { SearchSkillsDto } from './dto/search-skills.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

// [NGHIỆP VỤ]: Quản lý kỹ năng OFFER/NEED và chức năng khám phá kỹ năng đang hoạt động.
// [CHỐNG GIAN LẬN]: Chỉ chủ sở hữu được sửa hoặc xóa kỹ năng theo owner ID do client cung cấp.
// [CẨN THẬN KHI SỬA]: Owner ID hiện không được xác thực bằng JWT; không công khai API này trước khi có auth.
// [ĐIỂM MỞ RỘNG]: Thêm full-text search, phân trang và xếp hạng theo độ phù hợp.
@Injectable()
export class SkillsService {
  // [NGHIỆP VỤ]: Nhận PrismaService để quản lý listing trên cơ sở dữ liệu chính.
  // [CHỐNG GIAN LẬN]: Dùng DI để kiểm tra ownership nhất quán ở mọi thao tác.
  // [CẨN THẬN KHI SỬA]: Không thay bằng client kết nối khác có thể lệch transaction context.
  // [ĐIỂM MỞ RỘNG]: Inject search index khi cần discovery quy mô lớn.
  constructor(private readonly prisma: PrismaService) {}

  // [NGHIỆP VỤ]: Tạo một bản ghi kỹ năng gắn với người dùng sở hữu.
  // [CHỐNG GIAN LẬN]: Foreign key đảm bảo user_id phải tham chiếu người dùng tồn tại.
  // [CẨN THẬN KHI SỬA]: Không nhận user relation object từ client; chỉ lưu khóa ngoại đã validate.
  // [ĐIỂM MỞ RỘNG]: Bổ sung kiểm duyệt nội dung hoặc gợi ý category chuẩn hóa.
  async create(dto: CreateSkillDto) {
    return this.prisma.skill.create({
      data: {
        user_id: dto.user_id,
        skill_type: dto.skill_type,
        category: dto.category.trim(),
        title: dto.title.trim(),
        proficiency_level: dto.proficiency_level,
        is_active: dto.is_active ?? true,
      },
    });
  }

  // [NGHIỆP VỤ]: Lọc kỹ năng đang hoạt động theo loại, danh mục và trình độ tùy chọn.
  // [CHỐNG GIAN LẬN]: Không hiển thị listing đã bị chủ sở hữu tắt.
  // [CẨN THẬN KHI SỬA]: contains search được giới hạn bằng DTO; thêm pagination trước khi dữ liệu tăng lớn.
  // [ĐIỂM MỞ RỘNG]: Có thể thêm tìm kiếm gần đúng và chỉ số full-text PostgreSQL.
  async search(filters: SearchSkillsDto) {
    return this.prisma.skill.findMany({
      where: {
        is_active: true,
        skill_type: filters.skill_type,
        proficiency_level: filters.proficiency_level,
        category: filters.category
          ? { contains: filters.category.trim(), mode: 'insensitive' }
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            trust_score: true,
            is_verified: true,
          },
        },
      },
      orderBy: { title: 'asc' },
    });
  }

  // [NGHIỆP VỤ]: Lấy chi tiết một kỹ năng theo UUID.
  // [CHỐNG GIAN LẬN]: Chỉ trả thông tin hồ sơ công khai tối thiểu của chủ kỹ năng.
  // [CẨN THẬN KHI SỬA]: Không include sessions hoặc transactions vào endpoint discovery.
  // [ĐIỂM MỞ RỘNG]: Thêm số liệu đánh giá tổng hợp đã được ẩn danh.
  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            trust_score: true,
            is_verified: true,
          },
        },
      },
    });
    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng');
    }
    return skill;
  }

  // [NGHIỆP VỤ]: Cập nhật các thuộc tính đã gửi của kỹ năng.
  // [CHỐNG GIAN LẬN]: Bắt buộc owner ID khớp chủ kỹ năng để ngăn sửa chéo tài khoản.
  // [CẨN THẬN KHI SỬA]: Không cho đổi user_id qua DTO cập nhật; kiểm tra ownership trước khi ghi.
  // [ĐIỂM MỞ RỘNG]: Thay owner ID của request bằng subject của JWT guard.
  async update(id: string, ownerId: string, dto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng');
    }
    if (skill.user_id !== ownerId) {
      throw new ForbiddenException('Bạn không sở hữu kỹ năng này');
    }
    return this.prisma.skill.update({
      where: { id },
      data: {
        skill_type: dto.skill_type,
        category: dto.category?.trim(),
        title: dto.title?.trim(),
        proficiency_level: dto.proficiency_level,
        is_active: dto.is_active,
      },
    });
  }

  // [NGHIỆP VỤ]: Xóa kỹ năng do chính chủ sở hữu tạo.
  // [CHỐNG GIAN LẬN]: Kiểm tra owner ID trước khi xóa để tránh xóa kỹ năng của người khác.
  // [CẨN THẬN KHI SỬA]: Foreign key từ Session có thể chặn xóa kỹ năng đã được dùng; không cascade lịch sử.
  // [ĐIỂM MỞ RỘNG]: Ưu tiên soft delete qua is_active=false nếu cần lưu lịch sử lâu dài.
  async remove(id: string, ownerId: string): Promise<{ success: true }> {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng');
    }
    if (skill.user_id !== ownerId) {
      throw new ForbiddenException('Bạn không sở hữu kỹ năng này');
    }
    await this.prisma.skill.delete({ where: { id } });
    return { success: true };
  }
}
