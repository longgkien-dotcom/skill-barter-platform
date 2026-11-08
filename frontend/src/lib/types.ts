// [KIẾN TRÚC & THIẾT KẾ]: Kiểu miền tách biệt trình bày; tên snake_case trùng Prisma và DTO NestJS.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Trạng thái enum là khóa ổn định cho chuyển panel và tiến trình.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Các workspace dùng chung kiểu hồ sơ, phiên và ví.
// [KẾT NỐI API]: Response GET users, skills, safe-zones, sessions, disputes và transactions.
// [CẨN THẬN KHI SỬA]: Địa điểm public không có qr_code_hash; phiên trong dispute không include safe_zone.
// [ĐIỂM MỞ RỘNG]: Thêm kiểu phân trang khi backend thay giới hạn 100 bản ghi bằng cursor.
export type Tab = "discovery" | "sessions" | "tribunal" | "wallet";
export type CreditType = "STANDARD" | "PREMIUM";
export type SkillType = "OFFER" | "NEED";
export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type SessionStatus =
  | "REQUESTED"
  | "ESCROWED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";
export interface Person {
  id: string;
  full_name: string;
  trust_score?: number;
  is_verified?: boolean;
}
export interface User extends Person {
  email: string;
  avatar_url: string | null;
  is_verified: boolean;
  standard_balance: number;
  premium_balance: number;
  trust_score: number;
}
export interface Skill {
  id: string;
  user_id: string;
  skill_type: SkillType;
  category: string;
  title: string;
  proficiency_level: Level;
  is_active: boolean;
  user: Person;
}
export interface SafeZone {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
}
export interface Session {
  id: string;
  teacher_id: string;
  student_id: string;
  skill_id: string;
  safe_zone_id: string;
  micro_contract: { milestones: string[] };
  scheduled_start: string;
  scheduled_end: string;
  cost_credits: number;
  status: SessionStatus;
  proof_image_url?: string | null;
  skill: { title: string; category: string };
  safe_zone?: SafeZone;
  teacher: Person;
  student: Person;
}
export interface Dispute {
  id: string;
  session_id: string;
  complainant_id: string;
  reason: string;
  votes_for_teacher: number;
  votes_for_student: number;
  status: "PENDING" | "RESOLVED_TEACHER_WINS" | "RESOLVED_STUDENT_WINS";
  session: Session;
}
export interface Transaction {
  id: string;
  amount: number;
  credit_type: CreditType;
  transaction_type:
    | "EARN"
    | "SPEND"
    | "ESCROW_LOCK"
    | "ESCROW_REFUND"
    | "TOPUP"
    | "REDEEM_VOUCHER";
  expires_at: string | null;
  created_at: string;
}
export interface SkillInput {
  user_id: string;
  skill_type: SkillType;
  category: string;
  title: string;
  proficiency_level: Level;
}
export interface ZoneInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  qr_code_hash: string;
}
export interface BookingInput {
  student_id: string;
  skill_id: string;
  safe_zone_id: string;
  scheduled_start: string;
  scheduled_end: string;
  cost_credits: number;
  micro_contract: { milestones: string[] };
}
export interface ReviewInput {
  reviewer_id: string;
  reviewee_id: string;
  prep_score: number;
  attitude_score: number;
  knowledge_score: number;
  comment: string;
}
export type RunAction = (
  work: () => Promise<unknown>,
  success: string,
) => Promise<boolean>;
export interface WorkspaceProps {
  user: User;
  busy: boolean;
  run: RunAction;
}
