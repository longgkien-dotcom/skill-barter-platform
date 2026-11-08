import { createHash } from 'node:crypto';
import {
  CreditType,
  PrismaClient,
  ProficiencyLevel,
  SessionStatus,
  SkillType,
  TransactionType,
} from '@prisma/client';

const prisma = new PrismaClient();

// [NGHIỆP VỤ]: Nạp dữ liệu tiếng Việt có thể chạy lặp lại để phát triển và thử nghiệm API.
// [CHỐNG GIAN LẬN]: Dữ liệu ví mẫu luôn có ledger đối ứng; hash QR chỉ là dữ liệu demo.
// [CẨN THẬN KHI SỬA]: Không xóa hoặc reset dữ liệu thật; seed chỉ cập nhật hồ sơ và tạo bản ghi còn thiếu.
// [ĐIỂM MỞ RỘNG]: Có thể bổ sung script tách môi trường demo và tài khoản quản trị.
async function seed(): Promise<void> {
  const users = await Promise.all([
    upsertUser('an.nguyen@hcmut.edu.vn', 'Nguyễn Minh An', 4.9, 8),
    upsertUser('binh.tran@hcmut.edu.vn', 'Trần Gia Bình', 4.6, 6),
    upsertUser('chi.le@hcmut.edu.vn', 'Lê Ngọc Chi', 4.2, 5),
    upsertUser('duy.pham@hcmut.edu.vn', 'Phạm Hoàng Duy', 3.8, 4),
  ]);
  const [an, binh, chi, duy] = users;

  const skills = await Promise.all([
    upsertSkill(
      an.id,
      SkillType.OFFER,
      'Ngoại ngữ',
      'Giao tiếp Tiếng Trung HSK4',
      ProficiencyLevel.ADVANCED,
    ),
    upsertSkill(
      binh.id,
      SkillType.OFFER,
      'Lập trình',
      'Lập trình NestJS',
      ProficiencyLevel.INTERMEDIATE,
    ),
    upsertSkill(
      chi.id,
      SkillType.OFFER,
      'Giải trí',
      'Giải khối Rubik CFOP',
      ProficiencyLevel.ADVANCED,
    ),
    upsertSkill(
      duy.id,
      SkillType.NEED,
      'Ngoại ngữ',
      'Tìm bạn luyện giao tiếp tiếng Anh',
      ProficiencyLevel.INTERMEDIATE,
    ),
    upsertSkill(
      an.id,
      SkillType.NEED,
      'Lập trình',
      'Cần học React cơ bản',
      ProficiencyLevel.BEGINNER,
    ),
    upsertSkill(
      binh.id,
      SkillType.NEED,
      'Âm nhạc',
      'Tìm người hướng dẫn guitar',
      ProficiencyLevel.BEGINNER,
    ),
  ]);

  const safeZones = await Promise.all([
    upsertSafeZone(
      'Thư viện ĐHQG',
      'Khu phố 6, Linh Trung, Thủ Đức, TP. Hồ Chí Minh',
      10.8702,
      106.8031,
      'thu-vien-dhqg',
    ),
    upsertSafeZone(
      'Highlands Coffee KTX Khu B',
      'Ký túc xá Khu B, Đông Hòa, Dĩ An, Bình Dương',
      10.8771,
      106.8016,
      'highlands-ktx-khu-b',
    ),
    upsertSafeZone(
      'Sảnh Nhà điều hành ĐHQG',
      'Đường Võ Trường Toản, Linh Trung, Thủ Đức, TP. Hồ Chí Minh',
      10.8753,
      106.8036,
      'sanh-nha-dieu-hanh',
    ),
  ]);

  await upsertSampleSession(an.id, chi.id, skills[0].id, safeZones[0].id);
  console.log(
    `Seed hoàn tất: ${users.length} người dùng, ${skills.length} kỹ năng, ${safeZones.length} Safe Zone.`,
  );
}

// [NGHIỆP VỤ]: Tạo tài khoản đã xác minh và cấp số dư demo ban đầu khi tài khoản chưa tồn tại.
// [CHỐNG GIAN LẬN]: Bản ghi EARN được tạo đồng thời với số dư ban đầu; chạy seed lại không cấp thêm tín dụng.
// [CẨN THẬN KHI SỬA]: Không ghi đè số dư hiện tại khi seed chạy lại.
// [ĐIỂM MỞ RỘNG]: Tạo người dùng qua API registration khi seed chạy trên môi trường tích hợp.
async function upsertUser(
  email: string,
  fullName: string,
  trustScore: number,
  initialBalance: number,
) {
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { full_name: fullName, is_verified: true, trust_score: trustScore },
    });
  }

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        email: normalizedEmail,
        full_name: fullName,
        is_verified: true,
        standard_balance: initialBalance,
        trust_score: trustScore,
      },
    });
    await transaction.transaction.create({
      data: {
        user_id: user.id,
        amount: initialBalance,
        credit_type: CreditType.STANDARD,
        transaction_type: TransactionType.EARN,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    return user;
  });
}

// [NGHIỆP VỤ]: Tạo listing seed theo cặp chủ sở hữu và tiêu đề, cập nhật nội dung khi chạy lại.
// [CHỐNG GIAN LẬN]: Loại và trình độ lấy từ enum Prisma, tránh lưu giá trị tùy ý.
// [CẨN THẬN KHI SỬA]: Không xóa listing NEED/OFFER của người dùng khi seed chạy lại.
// [ĐIỂM MỞ RỘNG]: Bổ sung unique constraint user_id/title nếu muốn upsert trực tiếp.
async function upsertSkill(
  userId: string,
  skillType: SkillType,
  category: string,
  title: string,
  proficiencyLevel: ProficiencyLevel,
) {
  const existing = await prisma.skill.findFirst({
    where: { user_id: userId, title },
  });
  if (existing) {
    return prisma.skill.update({
      where: { id: existing.id },
      data: {
        skill_type: skillType,
        category,
        proficiency_level: proficiencyLevel,
        is_active: true,
      },
    });
  }
  return prisma.skill.create({
    data: {
      user_id: userId,
      skill_type: skillType,
      category,
      title,
      proficiency_level: proficiencyLevel,
      is_active: true,
    },
  });
}

// [NGHIỆP VỤ]: Tạo hoặc cập nhật Safe Zone demo dựa trên tên địa điểm.
// [CHỐNG GIAN LẬN]: QR hash được băm SHA-256, không lưu chuỗi QR dùng trực tiếp.
// [CẨN THẬN KHI SỬA]: Mã QR demo không được tái sử dụng làm bí mật production.
// [ĐIỂM MỞ RỘNG]: Phát hành secret QR riêng cho từng môi trường qua công cụ quản trị.
async function upsertSafeZone(
  name: string,
  address: string,
  latitude: number,
  longitude: number,
  demoSeed: string,
) {
  const qrCodeHash = createHash('sha256')
    .update(`local-demo:${demoSeed}`)
    .digest('hex');
  const existing = await prisma.safeZone.findFirst({ where: { name } });
  if (existing) {
    return prisma.safeZone.update({
      where: { id: existing.id },
      data: { address, latitude, longitude, qr_code_hash: qrCodeHash },
    });
  }
  return prisma.safeZone.create({
    data: { name, address, latitude, longitude, qr_code_hash: qrCodeHash },
  });
}

// [NGHIỆP VỤ]: Tạo một phiên escrow mẫu giữa hai tài khoản đã seed nếu chưa có phiên phù hợp.
// [CHỐNG GIAN LẬN]: Trừ số dư người học và tạo ESCROW_LOCK trong transaction; không tạo phiên không có tiền đảm bảo.
// [CẨN THẬN KHI SỬA]: Seed kiểm tra session cũ trước; không khóa tiền lần nữa khi chạy lặp.
// [ĐIỂM MỞ RỘNG]: Gọi API booking khi môi trường seed có authentication người dùng.
async function upsertSampleSession(
  teacherId: string,
  studentId: string,
  skillId: string,
  safeZoneId: string,
): Promise<void> {
  const existing = await prisma.session.findFirst({
    where: { teacher_id: teacherId, student_id: studentId, skill_id: skillId },
  });
  if (existing) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const student = await transaction.user.findUniqueOrThrow({
      where: { id: studentId },
    });
    const cost = 2;
    if (student.standard_balance + student.premium_balance < cost) {
      throw new Error('Không đủ số dư để tạo phiên seed mẫu');
    }

    const standardAmount = Math.min(student.standard_balance, cost);
    const premiumAmount = cost - standardAmount;
    await transaction.user.update({
      where: { id: studentId },
      data: {
        standard_balance: { decrement: standardAmount },
        premium_balance: { decrement: premiumAmount },
      },
    });

    const start = new Date();
    start.setDate(start.getDate() + 2);
    start.setHours(14, 0, 0, 0);
    const session = await transaction.session.create({
      data: {
        teacher_id: teacherId,
        student_id: studentId,
        skill_id: skillId,
        safe_zone_id: safeZoneId,
        micro_contract: {
          milestones: [
            'Ôn tập từ vựng và cấu trúc HSK4',
            'Thực hành hội thoại theo chủ đề',
            'Nhận góp ý phát âm và bài luyện tập',
          ],
        },
        scheduled_start: start,
        scheduled_end: new Date(start.getTime() + 60 * 60 * 1000),
        cost_credits: cost,
        status: SessionStatus.ESCROWED,
      },
    });

    const locks = [
      { amount: standardAmount, credit_type: CreditType.STANDARD },
      { amount: premiumAmount, credit_type: CreditType.PREMIUM },
    ].filter((row) => row.amount > 0);
    await transaction.transaction.createMany({
      data: locks.map((row) => ({
        user_id: studentId,
        session_id: session.id,
        amount: row.amount,
        credit_type: row.credit_type,
        transaction_type: TransactionType.ESCROW_LOCK,
      })),
    });
  });
}

// [NGHIỆP VỤ]: Đảm bảo Prisma Client luôn được đóng dù seed thành công hay thất bại.
// [CHỐNG GIAN LẬN]: Lỗi seed được in ra stderr và trả exit code khác 0, không giả báo thành công.
// [CẨN THẬN KHI SỬA]: Không bỏ finally vì connection pool có thể giữ tiến trình chạy mãi.
// [ĐIỂM MỞ RỘNG]: Có thể thêm bước kiểm tra dữ liệu sau seed.
seed()
  .catch((error: unknown) => {
    console.error('Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
