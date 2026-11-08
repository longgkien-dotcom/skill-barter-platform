import type {
  Dispute,
  ReviewInput,
  SafeZone,
  Session,
  Skill,
  Transaction,
  User,
} from "./types";

// [CHẾ ĐỘ CLOUD]: Kho dữ liệu độc lập với NestJS; tuyệt đối không đồng bộ credit ảo lên backend.
// [LƯU TRỮ]: Một bản ghi có phiên bản chứa cả ví, escrow và ledger; commit một lần sau khi kiểm tra nghiệp vụ.
// [ĐỒNG THỜI]: Hàng đợi trong tab + Web Locks giữa các tab ngăn ghi đè ví trên trình duyệt hỗ trợ.
// [CẨN THẬN KHI SỬA]: Không dùng dữ liệu này làm xác thực, thanh toán hay voucher thật; localStorage do người dùng kiểm soát.
export const DEMO_STORAGE_KEY = "skillbarter.cloud-demo.v1";
export interface ApiSnapshot {
  users: User[];
  skills: Skill[];
  zones: SafeZone[];
  sessions: Session[];
  disputes: Dispute[];
}
type StoredSkill = Omit<Skill, "user">;
type StoredZone = SafeZone & { qr_code_hash: string };
type StoredSession = Omit<
  Session,
  "skill" | "safe_zone" | "teacher" | "student"
>;
type StoredDispute = Omit<Dispute, "session">;
type LedgerEntry = Transaction & { user_id: string; session_id: string | null };
type StoredReview = ReviewInput & {
  id: string;
  session_id: string;
  is_flagged: boolean;
};
type Vote = {
  dispute_id: string;
  voter_id: string;
  choice: "TEACHER" | "STUDENT";
};
interface Store {
  version: 1;
  revision: number;
  users: User[];
  skills: StoredSkill[];
  zones: StoredZone[];
  sessions: StoredSession[];
  disputes: StoredDispute[];
  transactions: LedgerEntry[];
  reviews: StoredReview[];
  votes: Vote[];
}
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export interface DemoOptions {
  storage?: () => StoragePort | undefined;
  now?: () => number;
  id?: () => string;
  lock?: <T>(work: () => Promise<T>) => Promise<T>;
}
const DAY = 86400000;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function text(value: unknown, min: number, max: number, label: string) {
  ensure(typeof value === "string", `${label} không hợp lệ.`);
  const result = value.trim().normalize("NFC");
  ensure(
    result.length >= min && result.length <= max,
    `${label} cần từ ${min} đến ${max} ký tự.`,
  );
  return result;
}
function integer(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER) {
  ensure(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max,
    "Số lượng hoặc điểm không hợp lệ.",
  );
  return value;
}
function coordinate(value: unknown, max: number) {
  ensure(
    typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) <= max,
    "Tọa độ không hợp lệ.",
  );
  return value;
}
function object(value: unknown): Record<string, unknown> {
  ensure(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "Nội dung yêu cầu không hợp lệ.",
  );
  return value as Record<string, unknown>;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  ensure(values.includes(value as T), "Lựa chọn không hợp lệ.");
  return value as T;
}
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
const seedId = (group: number, n: number) =>
  `${String(group).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const byId = <T extends { id: string }>(rows: T[], id: unknown): T => {
  const row = rows.find((item) => item.id === id);
  ensure(row, "Không tìm thấy dữ liệu. Hãy tải lại danh sách.");
  return row;
};
function ledger(
  s: Store,
  user: User,
  amount: number,
  credit_type: Transaction["credit_type"],
  transaction_type: Transaction["transaction_type"],
  now: number,
  id: () => string,
  session_id: string | null = null,
  days?: number,
) {
  if (!amount) return;
  s.transactions.unshift({
    id: id(),
    user_id: user.id,
    amount,
    credit_type,
    transaction_type,
    session_id,
    created_at: new Date(now).toISOString(),
    expires_at: days ? new Date(now + days * DAY).toISOString() : null,
  });
}
function lockEscrow(
  s: Store,
  session: StoredSession,
  now: number,
  id: () => string,
) {
  const student = byId(s.users, session.student_id);
  ensure(
    student.standard_balance + student.premium_balance >= session.cost_credits,
    "Ví không đủ Credit để ký quỹ.",
  );
  const standard = Math.min(student.standard_balance, session.cost_credits);
  const premium = session.cost_credits - standard;
  student.standard_balance -= standard;
  student.premium_balance -= premium;
  ledger(s, student, standard, "STANDARD", "ESCROW_LOCK", now, id, session.id);
  ledger(s, student, premium, "PREMIUM", "ESCROW_LOCK", now, id, session.id);
}
function settle(
  s: Store,
  session: StoredSession,
  refund: boolean,
  now: number,
  id: () => string,
) {
  ensure(
    !s.transactions.some(
      (t) =>
        t.session_id === session.id &&
        ["EARN", "ESCROW_REFUND"].includes(t.transaction_type),
    ),
    "Ký quỹ đã được xử lý.",
  );
  const locked = s.transactions.filter(
    (t) => t.session_id === session.id && t.transaction_type === "ESCROW_LOCK",
  );
  const total = locked.reduce((sum, t) => sum + t.amount, 0);
  ensure(total === session.cost_credits, "Sổ ký quỹ không khớp hợp đồng.");
  const user = byId(s.users, refund ? session.student_id : session.teacher_id);
  const standardPool = refund
    ? locked
        .filter((t) => t.credit_type === "STANDARD")
        .reduce((sum, t) => sum + t.amount, 0)
    : total;
  const standard = Math.min(20 - user.standard_balance, standardPool);
  const premium = total - standard;
  user.standard_balance += standard;
  user.premium_balance += premium;
  const kind = refund ? "ESCROW_REFUND" : "EARN";
  ledger(
    s,
    user,
    standard,
    "STANDARD",
    kind,
    now,
    id,
    session.id,
    refund ? undefined : 90,
  );
  ledger(s, user, premium, "PREMIUM", kind, now, id, session.id);
}
function seed(now: number): Store {
  const s: Store = {
    version: 1,
    revision: 0,
    users: [],
    skills: [],
    zones: [],
    sessions: [],
    disputes: [],
    transactions: [],
    reviews: [],
    votes: [],
  };
  const names = [
    "Hoàng Đức Duy",
    "Nguyễn Ngọc Chi",
    "Trần Minh An",
    "Lê Thanh Bình",
    "Nguyễn Hồng Hà",
    "Phạm Mai Linh",
    "Hoàng Minh Khuê",
  ];
  const balances = [6, 10, 12, 8, 10, 5, 0];
  const trust = [3.8, 4.8, 4.9, 4.7, 4.8, 4.6, 4.2];
  names.forEach((full_name, i) => {
    const u: User = {
      id: seedId(1, i + 1),
      full_name,
      email: `${["duy", "chi", "an", "binh", "ha", "linh", "khue"][i]}@student.hcmus.edu.vn`,
      avatar_url: null,
      is_verified: i !== 6,
      standard_balance: balances[i],
      premium_balance: i === 1 ? 2 : i === 2 ? 3 : i === 3 ? 1 : 0,
      trust_score: trust[i],
    };
    s.users.push(u);
    ledger(s, u, u.standard_balance, "STANDARD", "EARN", now, uuid, null, 90);
    ledger(s, u, u.premium_balance, "PREMIUM", "TOPUP", now, uuid);
  });
  const titles = [
    "IELTS Speaking: tự tin kể câu chuyện của bạn",
    "React & TypeScript từ nền tảng",
    "Thiết kế giao diện với Figma",
    "Guitar đệm hát cho người mới",
    "Python và phân tích dữ liệu",
    "Tiếng Nhật giao tiếp tại trường",
    "Cần bạn luyện phỏng vấn tiếng Anh",
    "Nhiếp ảnh và bố cục bằng điện thoại",
  ];
  const categories = [
    "Ngoại ngữ",
    "Lập trình",
    "Thiết kế",
    "Âm nhạc",
    "Lập trình",
    "Ngoại ngữ",
    "Ngoại ngữ",
    "Nghệ thuật",
  ];
  const owners = [1, 2, 3, 4, 2, 5, 0, 4];
  titles.forEach((title, i) =>
    s.skills.push({
      id: seedId(2, i + 1),
      user_id: s.users[owners[i]].id,
      title,
      category: categories[i],
      skill_type: i === 6 ? "NEED" : "OFFER",
      proficiency_level:
        i === 3 ? "BEGINNER" : i === 1 ? "ADVANCED" : "INTERMEDIATE",
      is_active: true,
    }),
  );
  [
    [
      "Thư viện Trung tâm ĐHQG",
      "Khu phố 6, phường Linh Trung, TP. Thủ Đức",
      10.8682,
      106.7964,
    ],
    [
      "Không gian học nhóm Nhà Văn hóa Sinh viên",
      "Khu đô thị ĐHQG, Đông Hòa, Dĩ An",
      10.8757,
      106.8006,
    ],
    [
      "Vườn học tập Khoa học Tự nhiên",
      "227 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh",
      10.7626,
      106.6822,
    ],
  ].forEach(([name, address, latitude, longitude], i) =>
    s.zones.push({
      id: seedId(3, i + 1),
      name: String(name),
      address: String(address),
      latitude: Number(latitude),
      longitude: Number(longitude),
      qr_code_hash: `skillbarter-campus-zone-${i + 1}-qr-v1`,
    }),
  );
  const add = (
    n: number,
    teacher: number,
    student: number,
    skill: number,
    cost: number,
    start: number,
    status: Session["status"],
  ) => {
    const session: StoredSession = {
      id: seedId(4, n),
      teacher_id: s.users[teacher].id,
      student_id: s.users[student].id,
      skill_id: s.skills[skill].id,
      safe_zone_id: s.zones[0].id,
      scheduled_start: new Date(start).toISOString(),
      scheduled_end: new Date(start + cost * 3600000).toISOString(),
      cost_credits: cost,
      status,
      micro_contract: {
        milestones: [
          "Trao đổi mục tiêu và kiến thức nền",
          "Cùng thực hành bài tập theo chủ đề",
          "Tổng kết và góp ý bước tiếp theo",
        ],
      },
      proof_image_url: null,
    };
    s.sessions.unshift(session);
    lockEscrow(s, session, now, uuid);
    if (status === "COMPLETED") {
      session.proof_image_url =
        "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800";
      settle(s, session, false, now, uuid);
    }
    return session;
  };
  add(1, 1, 0, 0, 1, now + DAY, "ESCROWED");
  add(2, 2, 1, 1, 2, now - 10 * 60000, "IN_PROGRESS");
  add(3, 3, 1, 2, 1, now - DAY, "COMPLETED");
  const disputed = add(4, 2, 3, 1, 1, now - 3600000, "DISPUTED");
  s.disputes.push({
    id: seedId(5, 1),
    session_id: disputed.id,
    complainant_id: disputed.student_id,
    reason:
      "Hai bên cần cộng đồng xem xét mục tiêu thực hành đã thống nhất trong hợp đồng.",
    votes_for_teacher: 0,
    votes_for_student: 0,
    status: "PENDING",
  });
  add(5, 1, 0, 0, 1, now - 20 * 60000, "ESCROWED");
  return s;
}
// [KHÔI PHỤC]: Bản ghi hỏng/khác schema được thay bằng seed; không để một JSON lỗi khóa toàn bộ ứng dụng.
function validStore(value: unknown): value is Store {
  try {
    const s = value as Store;
    if (!s || s.version !== 1 || !Number.isSafeInteger(s.revision))
      return false;
    for (const key of [
      "users",
      "skills",
      "zones",
      "sessions",
      "disputes",
      "transactions",
      "reviews",
      "votes",
    ] as const)
      if (!Array.isArray(s[key])) return false;
    for (const rows of [
      s.users,
      s.skills,
      s.zones,
      s.sessions,
      s.disputes,
      s.transactions,
      s.reviews,
    ]) {
      if (
        rows.some((r) => !r || typeof r.id !== "string") ||
        new Set(rows.map((r) => r.id)).size !== rows.length
      )
        return false;
    }
    if (
      !s.users.length ||
      s.users.some(
        (u) =>
          typeof u.full_name !== "string" ||
          typeof u.email !== "string" ||
          typeof u.is_verified !== "boolean" ||
          !Number.isSafeInteger(u.standard_balance) ||
          u.standard_balance < 0 ||
          u.standard_balance > 20 ||
          !Number.isSafeInteger(u.premium_balance) ||
          u.premium_balance < 0 ||
          !Number.isFinite(u.trust_score) ||
          u.trust_score < 0 ||
          u.trust_score > 5,
      )
    )
      return false;
    for (const skill of s.skills) {
      byId(s.users, skill.user_id);
      text(skill.title, 2, 160, "Kỹ năng");
      choice(skill.skill_type, ["OFFER", "NEED"]);
      choice(skill.proficiency_level, ["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
    }
    for (const z of s.zones) {
      text(z.name, 2, 120, "Địa điểm");
      coordinate(z.latitude, 90);
      coordinate(z.longitude, 180);
      text(z.qr_code_hash, 16, 256, "QR");
    }
    for (const session of s.sessions) {
      byId(s.users, session.teacher_id);
      byId(s.users, session.student_id);
      byId(s.skills, session.skill_id);
      byId(s.zones, session.safe_zone_id);
      integer(session.cost_credits);
      choice(session.status, [
        "REQUESTED",
        "ESCROWED",
        "IN_PROGRESS",
        "COMPLETED",
        "DISPUTED",
        "CANCELLED",
      ]);
      if (
        !Number.isFinite(Date.parse(session.scheduled_start)) ||
        !Number.isFinite(Date.parse(session.scheduled_end)) ||
        !Array.isArray(session.micro_contract?.milestones) ||
        session.micro_contract.milestones.length !== 3
      )
        return false;
    }
    for (const t of s.transactions) {
      byId(s.users, t.user_id);
      integer(t.amount);
      if (t.session_id) byId(s.sessions, t.session_id);
    }
    for (const d of s.disputes) {
      byId(s.sessions, d.session_id);
      byId(s.users, d.complainant_id);
      integer(d.votes_for_teacher, 0, 3);
      integer(d.votes_for_student, 0, 3);
    }
    for (const r of s.reviews) {
      byId(s.sessions, r.session_id);
      byId(s.users, r.reviewer_id);
      byId(s.users, r.reviewee_id);
    }
    for (const v of s.votes) {
      byId(s.disputes, v.dispute_id);
      byId(s.users, v.voter_id);
      choice(v.choice, ["TEACHER", "STUDENT"]);
    }
    return true;
  } catch {
    return false;
  }
}
function publicZone(zone: StoredZone): SafeZone {
  const { id, name, address, latitude, longitude } = zone;
  return { id, name, address, latitude, longitude };
}
function hydratedSkill(s: Store, skill: StoredSkill): Skill {
  return { ...skill, user: byId(s.users, skill.user_id) };
}
function hydratedSession(s: Store, session: StoredSession): Session {
  const skill = byId(s.skills, session.skill_id);
  return {
    ...session,
    skill: { title: skill.title, category: skill.category },
    teacher: byId(s.users, session.teacher_id),
    student: byId(s.users, session.student_id),
    safe_zone: publicZone(byId(s.zones, session.safe_zone_id)),
  };
}
function hydratedDispute(s: Store, dispute: StoredDispute): Dispute {
  return {
    ...dispute,
    session: hydratedSession(s, byId(s.sessions, dispute.session_id)),
  };
}
function snapshot(s: Store): ApiSnapshot {
  return {
    users: s.users,
    skills: s.skills.map((r) => hydratedSkill(s, r)),
    zones: s.zones.map(publicZone),
    sessions: s.sessions.map((r) => hydratedSession(s, r)),
    disputes: s.disputes.map((r) => hydratedDispute(s, r)),
  };
}
const browserStorage = () =>
  typeof window === "undefined" ? undefined : window.localStorage;
async function browserLock<T>(work: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(DEMO_STORAGE_KEY, work)
    : work();
}
export function createDemoApi(options: DemoOptions = {}) {
  const now = options.now ?? Date.now;
  const id = options.id ?? uuid;
  const getStorage = options.storage ?? browserStorage;
  const lock = options.lock ?? browserLock;
  let memory: Store | undefined;
  let persistent = true;
  let queue: Promise<unknown> = Promise.resolve();
  function load() {
    if (persistent) {
      try {
        const storage = getStorage();
        if (!storage) persistent = false;
        else {
          const raw = storage.getItem(DEMO_STORAGE_KEY);
          if (raw) {
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              /* JSON hỏng được thay bằng seed và lưu lại. */
            }
            if (validStore(parsed)) memory = parsed;
            else memory = seed(now());
          } else memory = seed(now());
        }
      } catch {
        persistent = false;
        if (!memory) memory = seed(now());
      }
    }
    return (memory ??= seed(now()));
  }
  function save(s: Store) {
    if (persistent) {
      try {
        const storage = getStorage();
        if (!storage) persistent = false;
        else storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(s));
      } catch {
        persistent = false;
      }
    }
    memory = s;
  }
  function transact<T>(
    mutate: boolean,
    work: (s: Store) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    const execute = () =>
      lock(async () => {
        signal?.throwIfAborted();
        const source = load();
        const s = mutate ? clone(source) : source;
        const result = work(s);
        signal?.throwIfAborted();
        if (mutate) s.revision++;
        // Lưu cả seed lần đầu; nếu storage bị chặn, tiếp tục bằng bộ nhớ và báo rõ ở UI.
        save(s);
        return clone(result);
      });
    const result = queue.then(execute, execute);
    queue = result.catch(() => undefined);
    return result;
  }
  function route(
    s: Store,
    path: string,
    method: string,
    body: unknown,
  ): unknown {
    const url = new URL(path, "https://skillbarter.invalid");
    const [root, key, action, subaction] = url.pathname
      .split("/")
      .filter(Boolean);
    const input = method === "GET" ? {} : object(body ?? {});
    const time = now();
    if (root === "users") {
      if (method === "GET" && !key) return s.users;
      if (method === "POST" && !key) {
        const email = text(input.email, 5, 254, "Email").toLowerCase();
        ensure(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "Email không hợp lệ.");
        ensure(
          !s.users.some((u) => u.email.toLowerCase() === email),
          "Email này đã được đăng ký.",
        );
        const user: User = {
          id: id(),
          full_name: text(input.full_name, 2, 120, "Họ tên"),
          email,
          avatar_url: null,
          is_verified: false,
          standard_balance: 0,
          premium_balance: 0,
          trust_score: 5,
        };
        s.users.push(user);
        return user;
      }
      const user = byId(s.users, key);
      if (method === "GET" && !action) return user;
      if (method === "GET" && action === "transactions")
        return s.transactions.filter((t) => t.user_id === user.id);
      if (method === "POST" && action === "verify-email") {
        ensure(
          /^[^@\s]+@[^@\s]+\.edu\.vn$/i.test(user.email),
          "Chỉ chấp nhận địa chỉ email .edu.vn.",
        );
        ensure(!user.is_verified, "Email này đã được xác minh.");
        user.is_verified = true;
        const bonus = Math.min(1, 20 - user.standard_balance);
        user.standard_balance += bonus;
        ledger(s, user, bonus, "STANDARD", "EARN", time, id, null, 7);
        return user;
      }
      if (method === "POST" && action === "top-up") {
        const amount = integer(input.amount);
        integer(user.premium_balance + amount, 0);
        user.premium_balance += amount;
        ledger(s, user, amount, "PREMIUM", "TOPUP", time, id);
        return user;
      }
      if (
        method === "POST" &&
        action === "vouchers" &&
        subaction === "redeem"
      ) {
        const amount = integer(input.amount);
        const type = choice(input.credit_type, ["STANDARD", "PREMIUM"]);
        const balance =
          type === "STANDARD" ? "standard_balance" : "premium_balance";
        ensure(user[balance] >= amount, "Ví không đủ Credit để đổi quà.");
        user[balance] -= amount;
        ledger(s, user, amount, type, "REDEEM_VOUCHER", time, id);
        return { success: true };
      }
    }
    if (root === "skills") {
      if (method === "GET" && !key)
        return s.skills
          .filter(
            (skill) =>
              skill.is_active &&
              ["skill_type", "category", "proficiency_level"].every(
                (field) =>
                  !url.searchParams.get(field) ||
                  skill[field as keyof StoredSkill] ===
                    url.searchParams.get(field),
              ),
          )
          .map((skill) => hydratedSkill(s, skill));
      if (method === "POST" && !key) {
        const user = byId(s.users, input.user_id);
        const skill: StoredSkill = {
          id: id(),
          user_id: user.id,
          title: text(input.title, 2, 160, "Tiêu đề"),
          category: text(input.category, 2, 80, "Danh mục"),
          skill_type: choice(input.skill_type, ["OFFER", "NEED"]),
          proficiency_level: choice(input.proficiency_level, [
            "BEGINNER",
            "INTERMEDIATE",
            "ADVANCED",
          ]),
          is_active: true,
        };
        s.skills.unshift(skill);
        return hydratedSkill(s, skill);
      }
    }
    if (root === "safe-zones") {
      if (method === "GET" && !key) return s.zones.map(publicZone);
      if (method === "GET" && key === "nearby") {
        const lat = coordinate(Number(url.searchParams.get("latitude")), 90);
        const lon = coordinate(Number(url.searchParams.get("longitude")), 180);
        const radius = Number(url.searchParams.get("radiusKm") ?? 5);
        ensure(
          Number.isFinite(radius) && radius >= 0.01 && radius <= 1000,
          "Bán kính không hợp lệ.",
        );
        const rad = (n: number) => (n * Math.PI) / 180;
        return s.zones
          .map((z) => {
            const a =
              Math.sin(rad(z.latitude - lat) / 2) ** 2 +
              Math.cos(rad(lat)) *
                Math.cos(rad(z.latitude)) *
                Math.sin(rad(z.longitude - lon) / 2) ** 2;
            return {
              ...publicZone(z),
              distance_km: 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a))),
            };
          })
          .filter((z) => z.distance_km <= radius)
          .sort((a, b) => a.distance_km - b.distance_km);
      }
      if (method === "GET" && action === "qr")
        return { qr_code_hash: byId(s.zones, key).qr_code_hash };
      if (method === "POST" && !key) {
        const zone: StoredZone = {
          id: id(),
          name: text(input.name, 2, 120, "Tên địa điểm"),
          address: text(input.address, 5, 240, "Địa chỉ"),
          latitude: coordinate(input.latitude, 90),
          longitude: coordinate(input.longitude, 180),
          qr_code_hash: text(input.qr_code_hash, 16, 256, "Mã QR"),
        };
        ensure(
          !s.zones.some((z) => z.qr_code_hash === zone.qr_code_hash),
          "Mã QR đã được sử dụng.",
        );
        s.zones.unshift(zone);
        return publicZone(zone);
      }
    }
    if (root === "sessions") {
      if (method === "GET" && !key)
        return s.sessions.map((r) => hydratedSession(s, r));
      if (method === "POST" && !key) {
        const student = byId(s.users, input.student_id);
        const skill = byId(s.skills, input.skill_id);
        byId(s.zones, input.safe_zone_id);
        ensure(
          student.is_verified,
          "Cần xác minh email .edu.vn trước khi đặt lịch.",
        );
        ensure(
          skill.is_active &&
            skill.skill_type === "OFFER" &&
            skill.user_id !== student.id,
          "Hãy chọn kỹ năng đang được người khác chia sẻ.",
        );
        const start = Date.parse(String(input.scheduled_start));
        const end = Date.parse(String(input.scheduled_end));
        ensure(
          Number.isFinite(start) &&
            Number.isFinite(end) &&
            start > time &&
            end > start,
          "Giờ hẹn phải ở tương lai và kết thúc sau giờ bắt đầu.",
        );
        const contract = object(input.micro_contract);
        ensure(
          Array.isArray(contract.milestones) &&
            contract.milestones.length === 3,
          "Hợp đồng cần đúng 3 mục tiêu.",
        );
        const milestones = contract.milestones.map((goal) =>
          text(goal, 3, 300, "Mục tiêu"),
        );
        const session: StoredSession = {
          id: id(),
          student_id: student.id,
          teacher_id: skill.user_id,
          skill_id: skill.id,
          safe_zone_id: String(input.safe_zone_id),
          scheduled_start: new Date(start).toISOString(),
          scheduled_end: new Date(end).toISOString(),
          cost_credits: integer(input.cost_credits),
          micro_contract: { milestones },
          status: "ESCROWED",
          proof_image_url: null,
        };
        lockEscrow(s, session, time, id);
        s.sessions.unshift(session);
        return hydratedSession(s, session);
      }
      if (method === "POST" && key) {
        const session = byId(s.sessions, key);
        const participant = (actor: unknown) =>
          ensure(
            actor === session.teacher_id || actor === session.student_id,
            "Chỉ người tham gia phiên được thực hiện thao tác này.",
          );
        if (action === "check-in") {
          participant(input.user_id);
          ensure(
            session.status === "ESCROWED",
            "Phiên không còn chờ check-in.",
          );
          ensure(
            input.qr_code_hash ===
              byId(s.zones, session.safe_zone_id).qr_code_hash,
            "Mã QR không đúng điểm hẹn.",
          );
          session.status = "IN_PROGRESS";
          return hydratedSession(s, session);
        }
        if (action === "cancel" || action === "no-show") {
          participant(input.user_id);
          ensure(
            session.status === "ESCROWED",
            "Chỉ có thể hủy phiên đang ký quỹ.",
          );
          if (action === "cancel")
            ensure(
              time < Date.parse(session.scheduled_start),
              "Đã đến giờ hẹn, không thể hủy theo cách này.",
            );
          else
            ensure(
              input.user_id === session.student_id &&
                time >= Date.parse(session.scheduled_start) + 15 * 60000,
              "Chỉ người học được báo vắng mặt sau 15 phút.",
            );
          settle(s, session, true, time, id);
          session.status = "CANCELLED";
          if (action === "no-show" || input.user_id === session.teacher_id) {
            const teacher = byId(s.users, session.teacher_id);
            teacher.trust_score = Math.max(
              0,
              Number((teacher.trust_score - 0.2).toFixed(2)),
            );
          }
          return hydratedSession(s, session);
        }
        if (action === "check-out") {
          ensure(
            input.teacher_id === session.teacher_id,
            "Chỉ người dạy được nghiệm thu.",
          );
          ensure(
            session.status === "IN_PROGRESS",
            "Phiên chưa diễn ra hoặc đang tranh chấp.",
          );
          const proof = text(
            input.proof_image_url,
            8,
            2048,
            "URL ảnh minh chứng",
          );
          let valid = false;
          try {
            valid = ["https:", "http:"].includes(new URL(proof).protocol);
          } catch {
            /* Báo lỗi validation bên dưới. */
          }
          ensure(valid, "Ảnh minh chứng cần URL HTTP hoặc HTTPS hợp lệ.");
          settle(s, session, false, time, id);
          session.proof_image_url = proof;
          session.status = "COMPLETED";
          return hydratedSession(s, session);
        }
        if (action === "reviews") {
          ensure(
            session.status === "COMPLETED",
            "Chỉ có thể đánh giá phiên đã hoàn tất.",
          );
          participant(input.reviewer_id);
          participant(input.reviewee_id);
          ensure(
            input.reviewer_id !== input.reviewee_id,
            "Không thể tự đánh giá.",
          );
          ensure(
            !s.reviews.some(
              (r) =>
                r.session_id === session.id &&
                r.reviewer_id === input.reviewer_id,
            ),
            "Bạn đã đánh giá phiên này.",
          );
          const prep_score = integer(input.prep_score, 1, 5),
            attitude_score = integer(input.attitude_score, 1, 5),
            knowledge_score = integer(input.knowledge_score, 1, 5);
          const avg = (prep_score + attitude_score + knowledge_score) / 3;
          const review: StoredReview = {
            id: id(),
            session_id: session.id,
            reviewer_id: String(input.reviewer_id),
            reviewee_id: String(input.reviewee_id),
            prep_score,
            attitude_score,
            knowledge_score,
            comment: text(input.comment ?? "", 0, 2000, "Nhận xét"),
            is_flagged: avg <= 1.5,
          };
          s.reviews.unshift(review);
          const reviewee = byId(s.users, review.reviewee_id);
          reviewee.trust_score = Number(
            (reviewee.trust_score * 0.8 + avg * 0.2).toFixed(2),
          );
          return review;
        }
      }
    }
    if (root === "disputes") {
      if (method === "GET" && !key)
        return s.disputes.map((r) => hydratedDispute(s, r));
      if (method === "POST" && !key) {
        const session = byId(s.sessions, input.session_id);
        ensure(
          input.complainant_id === session.teacher_id ||
            input.complainant_id === session.student_id,
          "Chỉ người tham gia được mở tranh chấp.",
        );
        ensure(
          ["ESCROWED", "IN_PROGRESS"].includes(session.status),
          "Chỉ phiên đang ký quỹ hoặc đang học được mở tranh chấp.",
        );
        ensure(
          !s.disputes.some((d) => d.session_id === session.id),
          "Phiên này đã có tranh chấp.",
        );
        const dispute: StoredDispute = {
          id: id(),
          session_id: session.id,
          complainant_id: String(input.complainant_id),
          reason: text(input.reason, 10, 4000, "Lý do"),
          votes_for_teacher: 0,
          votes_for_student: 0,
          status: "PENDING",
        };
        session.status = "DISPUTED";
        s.disputes.unshift(dispute);
        return hydratedDispute(s, dispute);
      }
      if (method === "POST" && action === "votes") {
        const dispute = byId(s.disputes, key),
          session = byId(s.sessions, dispute.session_id),
          voter = byId(s.users, input.voter_id);
        ensure(dispute.status === "PENDING", "Tranh chấp đã được giải quyết.");
        ensure(
          voter.trust_score >= 4.5 &&
            ![session.teacher_id, session.student_id].includes(voter.id),
          "Cử tri phải ngoài phiên và có Trust từ 4.5.",
        );
        ensure(
          !s.votes.some(
            (v) => v.dispute_id === dispute.id && v.voter_id === voter.id,
          ),
          "Bạn đã bỏ phiếu cho tranh chấp này.",
        );
        const vote = choice(input.choice, ["TEACHER", "STUDENT"]);
        s.votes.push({
          dispute_id: dispute.id,
          voter_id: voter.id,
          choice: vote,
        });
        if (vote === "TEACHER") dispute.votes_for_teacher++;
        else dispute.votes_for_student++;
        if (dispute.votes_for_teacher + dispute.votes_for_student === 3) {
          const teacherWins =
            dispute.votes_for_teacher > dispute.votes_for_student;
          settle(s, session, !teacherWins, time, id);
          dispute.status = teacherWins
            ? "RESOLVED_TEACHER_WINS"
            : "RESOLVED_STUDENT_WINS";
          session.status = teacherWins ? "COMPLETED" : "CANCELLED";
        }
        return hydratedDispute(s, dispute);
      }
    }
    throw new Error("Thao tác chưa được hỗ trợ trong chế độ trải nghiệm.");
  }
  return {
    isPersistent: () => persistent,
    snapshot: (signal?: AbortSignal) => transact(false, snapshot, signal),
    request: <T>(
      path: string,
      method = "GET",
      body?: unknown,
      signal?: AbortSignal,
    ): Promise<T> =>
      transact(
        method !== "GET",
        (s) => route(s, path, method, body) as T,
        signal,
      ),
  };
}
