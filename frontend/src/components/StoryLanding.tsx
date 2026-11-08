"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Coffee,
  FileCheck2,
  Fingerprint,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  Music2,
  Printer,
  QrCode,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import type { Tab } from "../lib/types";

// [THIẾT KẾ BESIDE HERO & LANDING]: Hero obsidian tràn viewport không margin hai bên; chân trời 160% nâng thẻ kính, typography giữ trục giữa và portal đăng nhập duy nhất.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Reveal opacity 0/y36 → 1/y0, viewport once:false/amount:0.2; delay theo thứ tự, duration 0.65s. Reduced-motion bỏ dịch chuyển và bộ đếm.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Copy, số liệu quy tắc và bốn bước được gom ngay đầu file. Thẻ hero và mini-preview là minh họa, không giả làm giao dịch API thật.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: onOpen lưu tab mong muốn và mở modal như onLogin; chỉ xác nhận tài khoản mới vào Dashboard riêng, không render workspace dưới portal.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Hero/portal obsidian, nội dung trắng và bento đen tạo nhịp 60/30/10; navy dành cho CTA.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: onOpen chỉ mở modal và lưu tab mong muốn; mọi tính năng đều qua nút xác nhận đăng nhập, không có bypass demo.
// [KIẾN TRÚC & THIẾT KẾ]: Mỗi chương có anchor và tiêu đề riêng; hầu hết đồ họa dùng CSS/SVG để sắc nét mà không phụ thuộc ảnh ngoài.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Counter chỉ animate khi vào viewport; timeline sáng theo onViewportEnter hoặc click và cập nhật khung xem trước.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Thanh trượt ví, điểm trên bản đồ và lựa chọn hội đồng có thể tương tác bằng chuột/bàn phím; CTA mở gate đăng nhập trước workspace.
// [KẾT NỐI API]: Chỉ nhận averageTrust/liveCount/connected từ Home; không đổi adapter, không POST từ các bản xem trước.
// [CẨN THẬN KHI SỬA]: Thưởng xác minh hạn 7 ngày; tín dụng nhận phiên ghi hạn 90 ngày; voucher backend vẫn là mô phỏng. Không hứa an toàn tuyệt đối hoặc chọn juror ngẫu nhiên.
// [ĐIỂM MỞ RỘNG]: Có thể thay notification mẫu bằng feed có xác thực; giữ nhãn minh họa cho tới khi dữ liệu thực sự nối API.
const timeline = [
  {
    title: "Một danh tính. Một khởi đầu.",
    label: "Định danh .edu.vn",
    detail:
      "Xác thực email sinh viên để nhận +1 Standard Credit đầu tiên. Phần thưởng khởi đầu có hạn 7 ngày — vừa đủ để bắt đầu một cuộc trao đổi.",
    icon: Fingerprint,
    code: "VERIFIED",
    preview: "+1",
    unit: "STANDARD CREDIT",
    note: "7 ngày để bắt đầu điều mới",
    tags: ["Email .edu.vn", "Vốn khởi đầu"],
  },
  {
    title: "Rõ mục tiêu. Chắc lời hẹn.",
    label: "Hợp đồng & Ký quỹ",
    detail:
      "Chốt 3 mục tiêu đầu ra trong Micro-Contract. Khi đặt lịch, Credit của người học được khóa vào Escrow, chờ buổi học hoàn thành.",
    icon: LockKeyhole,
    code: "ESCROWED",
    preview: "03",
    unit: "MỤC TIÊU CAM KẾT",
    note: "Credit được bảo chứng bằng ký quỹ",
    tags: ["Micro-Contract", "Escrow Lock"],
  },
  {
    title: "Gặp đúng nơi. Học cùng nhau.",
    label: "Safe Zone & Check-in",
    detail:
      "Hẹn nhau ở thư viện hoặc căn tin trong trường. Mã QR tại Safe Zone xác nhận check-in và chuyển phiên sang IN_PROGRESS.",
    icon: QrCode,
    code: "IN_PROGRESS",
    preview: "QR",
    unit: "CHECK-IN TẠI ĐIỂM HẸN",
    note: "Một nơi quen thuộc, một kết nối mới",
    tags: ["Safe Zone", "QR Check-in"],
  },
  {
    title: "Có bằng chứng. Có sự tin cậy.",
    label: "Nghiệm thu & Uy tín",
    detail:
      "Người dạy nộp ảnh bằng chứng để nhận Credit. Đánh giá 3 tiêu chí cập nhật Trust Score: 80% điểm cũ + 20% điểm phiên mới.",
    icon: FileCheck2,
    code: "COMPLETED",
    preview: "80/20",
    unit: "CÔNG THỨC TRUST SCORE",
    note: "Uy tín lớn lên sau mỗi lời hẹn được giữ",
    tags: ["Ảnh nghiệm thu", "Đánh giá độc lập"],
  },
] as const;

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{
        duration: reduced ? 0 : 0.65,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { amount: 0.2 });
  const reduced = useReducedMotion();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (number) => Math.round(number));
  useEffect(() => {
    const controls = animate(count, visible ? value : 0, {
      duration: reduced ? 0 : 1.2,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [count, visible, value, reduced]);
  return (
    <span ref={ref} role="img" aria-label={`${value}${suffix}`}>
      <span aria-hidden="true">
        <motion.span>{rounded}</motion.span>
        {suffix}
      </span>
    </span>
  );
}

function StepTimeline({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const current = timeline[active];
  const CurrentIcon = current.icon;
  return (
    <section
      id="cach-hoat-dong"
      className="story-section story-how"
      aria-labelledby="how-title"
    >
      <div className="story-how-aside">
        <Reveal>
          <div className="story-eyebrow">
            <span>03</span> TỪ LỜI HẸN ĐẾN TRI THỨC
          </div>
          <h2 id="how-title">
            Bốn bước.
            <br />
            Một vòng tròn
            <br />
            <em>giá trị.</em>
          </h2>
          <p>
            Không chỉ gặp để học.
            <br />
            Gặp để tin nhau hơn.
          </p>
          <div className="timeline-preview" aria-live="polite">
            <div className="timeline-preview-top">
              <CurrentIcon size={20} />
              <span>{current.code}</span>
              <span className="timeline-preview-index">0{active + 1}/04</span>
            </div>
            <strong>{current.preview}</strong>
            <span className="timeline-preview-unit">{current.unit}</span>
            <p>{current.note}</p>
            <div className="timeline-preview-dots">
              {timeline.map((step, index) => (
                <button
                  key={step.code}
                  aria-label={`Xem bước ${index + 1}: ${step.label}`}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
      <div className="story-timeline">
        {timeline.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.button
              type="button"
              className={`story-timeline-step ${index === active ? "is-active" : ""}`}
              key={step.code}
              aria-pressed={active === index}
              initial={{ opacity: 0, y: reduced ? 0 : 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              onViewportEnter={() => setActive(index)}
              transition={{ duration: reduced ? 0 : 0.6 }}
              onClick={() => setActive(index)}
              onFocus={() => setActive(index)}
            >
              <span className="timeline-step-number">0{index + 1}</span>
              <div>
                <span className="timeline-label">
                  <Icon size={15} />
                  {step.label}
                </span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                <div className="timeline-tags">
                  {step.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <ArrowDownLeft className="timeline-step-arrow" size={22} />
            </motion.button>
          );
        })}
        <button
          type="button"
          className="story-text-link timeline-try"
          onClick={() => onOpen("discovery")}
        >
          Thử đặt lịch đầu tiên <ArrowUpRight size={18} />
        </button>
      </div>
    </section>
  );
}

function FeatureBento({ onOpen }: { onOpen: (tab: Tab) => void }) {
  const [balance, setBalance] = useState(14);
  const [place, setPlace] = useState(0);
  const [winner, setWinner] = useState<"teacher" | "student">("teacher");
  const places = ["Thư viện ĐHQG", "Căn tin khuôn viên", "Không gian tự học"];
  return (
    <section
      id="tinh-nang"
      className="story-section story-features"
      aria-labelledby="features-title"
    >
      <Reveal className="story-section-heading">
        <div>
          <div className="story-eyebrow">
            <span>04</span> MỘT HỆ SINH THÁI CÙNG TIẾN BỘ
          </div>
          <h2 id="features-title">
            Nhỏ trong từng chi tiết.
            <br />
            <em>Lớn trong sự an tâm.</em>
          </h2>
        </div>
        <p>
          Đằng sau mỗi cuộc trao đổi tốt
          <br />
          là những cơ chế giữ lời hẹn.
        </p>
      </Reveal>
      <div className="story-bento">
        <Reveal className="bento-cap-wrap">
          <article className="story-bento-card bento-cap">
            <div className="bento-topline">
              <span className="bento-icon">
                <Wallet size={21} />
              </span>
              <span>01 / DÒNG CHẢY TRI THỨC</span>
            </div>
            <h3>
              Luân chuyển,
              <br />
              <em>không tích trữ.</em>
            </h3>
            <p>
              Trần ví 20 Standard Credit giữ giá trị ở việc học, thay vì đầu cơ.
              Credit nhận từ phiên học được ghi hạn 90 ngày.
            </p>
            <div
              className="cap-preview story-interactive"
              aria-label="Minh họa trần ví Standard Credit"
            >
              <div>
                <span>VÍ STANDARD · MINH HỌA</span>
                <LockKeyhole size={14} />
              </div>
              <strong>
                {balance}
                <span>/20</span>
              </strong>
              <div className="cap-bars" aria-hidden="true">
                {Array.from({ length: 20 }, (_, index) => (
                  <span
                    className={index < balance ? "filled" : ""}
                    key={index}
                  />
                ))}
              </div>
              <label>
                <span>Kéo để khám phá giới hạn ví</span>
                <input
                  aria-label="Số Standard Credit trong ví minh họa"
                  type="range"
                  min={0}
                  max={20}
                  value={balance}
                  onChange={(event) => setBalance(Number(event.target.value))}
                />
              </label>
              <div className="cap-preview-bottom">
                <span>
                  <Clock3 size={12} /> Hạn ghi nhận 90 ngày
                </span>
                <span>
                  {balance === 20
                    ? "Đã chạm trần ví"
                    : `${20 - balance} Credit còn trống`}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="story-feature-link"
              onClick={() => onOpen("wallet")}
            >
              Khám phá ví tín dụng <ArrowUpRight size={18} />
            </button>
          </article>
        </Reveal>
        <Reveal className="bento-map-wrap" delay={0.08}>
          <article className="story-bento-card bento-map">
            <div className="bento-topline">
              <span className="bento-icon">
                <MapPin size={21} />
              </span>
              <span>02 / ĐIỂM HẸN TIN CẬY</span>
            </div>
            <h3>Gần bạn. An tâm hơn.</h3>
            <p>
              Tìm điểm hẹn bằng khoảng cách Haversine.
              <br />
              Check-in bằng QR tại khuôn viên.
            </p>
            <div className="campus-map-preview story-interactive">
              <div className="campus-path path-one" />
              <div className="campus-path path-two" />
              <div className="campus-block block-one" />
              <div className="campus-block block-two" />
              <div className="campus-block block-three" />
              {places.map((name, index) => (
                <button
                  type="button"
                  key={name}
                  className={`campus-pin pin-${index} ${place === index ? "selected" : ""}`}
                  aria-label={`Xem điểm hẹn minh họa ${name}`}
                  aria-pressed={place === index}
                  onClick={() => setPlace(index)}
                >
                  <MapPin size={18} />
                </button>
              ))}
              <div className="campus-map-caption">
                <span>
                  <span className="map-status-dot" />
                  {places[place]}
                </span>
                <QrCode size={17} />
              </div>
              <span className="campus-map-note">BẢN ĐỒ MINH HỌA</span>
            </div>
            <button
              type="button"
              className="story-feature-link"
              onClick={() => onOpen("discovery")}
            >
              Tìm Safe Zone <ArrowUpRight size={18} />
            </button>
          </article>
        </Reveal>
        <Reveal className="bento-jury-wrap" delay={0.12}>
          <article id="toa-an" className="story-bento-card bento-jury">
            <div className="bento-topline">
              <span className="bento-icon">
                <Scale size={21} />
              </span>
              <span>03 / TÒA ÁN CỘNG ĐỒNG</span>
            </div>
            <h3>Công bằng từ cộng đồng.</h3>
            <p>
              3 thành viên ngoài phiên với Trust ≥ 4.5 bỏ phiếu phân xử. Phiếu
              thứ ba chốt kết quả và xử lý ký quỹ.
            </p>
            <div className="jury-preview story-interactive">
              <div className="jury-preview-head">
                <div className="jury-avatars">
                  <span>HA</span>
                  <span>LN</span>
                  <span>MK</span>
                </div>
                <span>
                  <ShieldCheck size={13} /> ≥ 4.5 Trust
                </span>
              </div>
              <div
                className="jury-choice"
                role="group"
                aria-label="Thử biểu quyết minh họa"
              >
                <button
                  type="button"
                  aria-pressed={winner === "teacher"}
                  onClick={() => setWinner("teacher")}
                >
                  Người dạy
                </button>
                <button
                  type="button"
                  aria-pressed={winner === "student"}
                  onClick={() => setWinner("student")}
                >
                  Người học
                </button>
              </div>
              <div
                className="jury-preview-votes"
                aria-label={`Minh họa 2 phiếu cho ${winner === "teacher" ? "người dạy" : "người học"}`}
              >
                <i />
                <i />
                <i className="minority" />
              </div>
              <p>
                Minh họa: <b>2/3 phiếu</b> chọn{" "}
                {winner === "teacher" ? "người dạy" : "người học"}.
              </p>
            </div>
            <button
              type="button"
              className="story-feature-link"
              onClick={() => onOpen("tribunal")}
            >
              Xem Tòa án cộng đồng <ArrowUpRight size={18} />
            </button>
          </article>
        </Reveal>
        <Reveal className="bento-store-wrap" delay={0.08}>
          <article className="story-bento-card bento-store">
            <div className="bento-store-copy">
              <div className="bento-topline">
                <span className="bento-icon">
                  <Coffee size={21} />
                </span>
                <span>04 / QUÀ TỪ KHUÔN VIÊN</span>
              </div>
              <h3>
                Học thêm điều mới.
                <br />
                Thưởng mình một chút.
              </h3>
              <p>
                Highlands, vé gửi xe tháng hay gói in ấn.
                <br />
                Danh mục ưu đãi đang chuẩn bị phát hành.
              </p>
              <button
                type="button"
                className="story-feature-link"
                onClick={() => onOpen("wallet")}
              >
                Ghé cửa hàng Campus <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="store-mini-vouchers" aria-hidden="true">
              <div>
                <Coffee size={31} strokeWidth={1.3} />
                <span>COFFEE BREAK</span>
                <b>1 Credit</b>
              </div>
              <div>
                <GraduationCap size={31} strokeWidth={1.3} />
                <span>CAMPUS PASS</span>
                <b>2 Credits</b>
              </div>
              <div>
                <Printer size={31} strokeWidth={1.3} />
                <span>PRINT & LEARN</span>
                <b>1 Credit</b>
              </div>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

export default function StoryLanding({
  onOpen,
  onSection,
  averageTrust,
  liveCount,
  connected,
  onLogin,
}: {
  onOpen: (tab: Tab) => void;
  onSection: (id: string) => void;
  averageTrust: number | null;
  liveCount: number;
  connected: boolean;
  onLogin: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <main id="story-main" className="story-landing" tabIndex={-1}>
      <div className="story-hero-outer">
        <section className="story-hero" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <motion.div
              className="hero-announcement"
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <Sparkles size={13} />
              <span>
                Nền tảng Ngân hàng Thời gian đầu tiên cho Sinh viên Việt Nam
              </span>
              <ArrowRight size={14} />
            </motion.div>
            <motion.h1
              id="hero-title"
              initial={{ opacity: 0, y: reduced ? 0 : 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.08 }}
            >
              Đổi một giờ dạy.
              <br />
              <span>Nhận một giờ học.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Nền tảng trao đổi kỹ năng ngang hàng bảo chứng bằng hợp đồng ký
              quỹ Escrow, điểm hẹn Safe Zone tại trường và Bồi thẩm đoàn sinh
              viên.
            </motion.p>
            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.28 }}
            >
              <button
                type="button"
                className="hero-primary"
                onClick={() => onOpen("discovery")}
              >
                Khám phá Kỹ năng ngay <ArrowUpRight size={17} />
              </button>
              <a
                href="#cach-hoat-dong"
                className="hero-secondary"
                onClick={(event) => {
                  event.preventDefault();
                  onSection("cach-hoat-dong");
                }}
              >
                Xem cách hoạt động <ArrowDown size={16} />
              </a>
            </motion.div>
          </div>
          <div className="hero-stage">
            <div className="horizon-aura" aria-hidden="true" />
            <div className="horizon-sphere" aria-hidden="true" />
            <motion.div
              className="hero-orbit-chip chip-verified"
              animate={reduced ? undefined : { y: [0, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <BadgeCheck size={16} />
              <span>.edu.vn đã xác minh</span>
            </motion.div>
            <motion.div
              className="hero-orbit-chip chip-credit"
              animate={reduced ? undefined : { y: [0, 6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowUpRight size={16} />
              <span>Tri thức của bạn có giá trị.</span>
            </motion.div>
            <motion.div
              className="hero-session-card"
              initial={{ opacity: 0, y: reduced ? 0 : 30 }}
              animate={{ opacity: 1, y: reduced ? 0 : [0, -7, 0] }}
              transition={{
                opacity: { duration: 0.8, delay: 0.35 },
                y: reduced
                  ? { duration: 0 }
                  : { duration: 6, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <div className="hero-session-top">
                <div className="hero-session-avatars">
                  <span>HD</span>
                  <span>MA</span>
                </div>
                <div>
                  <span className="hero-session-kicker">
                    <span /> PHIÊN HỌC MỚI
                  </span>
                  <h2>
                    Giải khối Rubik CFOP <span>↔</span>
                    <br className="hero-session-mobile-break" /> Giao tiếp Tiếng
                    Trung HSK4
                  </h2>
                </div>
                <span className="hero-demo-label">MINH HỌA</span>
              </div>
              <div className="hero-escrow-status">
                <LockKeyhole size={13} />
                <span>
                  Đã khóa <b>2 Time Credits</b> vào Escrow
                  <span className="hero-status-separator"> · </span>
                  <br className="hero-status-break" />
                  Điểm hẹn: Thư viện ĐHQG
                </span>
              </div>
              <div className="hero-message">
                <span className="message-line" />
                “Chào Duy! Lịch hẹn đã được xác nhận lúc 14:00 chiều mai tại Bàn
                số 4 Safe Zone Thư viện. Quét QR khi tới nhé!”
                <CheckCheck size={15} />
              </div>
            </motion.div>
          </div>
          <div className="hero-trust-footer">
            <span>
              <Star size={13} />
              {averageTrust === null
                ? "—"
                : `${averageTrust.toFixed(1)}/5`}{" "}
              ĐIỂM TIN CẬY CỘNG ĐỒNG
            </span>
            <span>
              <ShieldCheck size={13} /> XÁC THỰC EMAIL .EDU.VN
            </span>
            <span>
              <Clock3 size={13} /> 1 GIỜ = 1 TÍN DỤNG CÔNG BẰNG
            </span>
          </div>
        </section>
      </div>
      <div className="story-values-strip">
        <span>
          TRI THỨC LÀ THỨ DUY NHẤT
          <br />
          CÀNG CHIA SẺ, CÀNG NHIỀU HƠN.
        </span>
        <div>
          <GraduationCap size={20} /> Sinh viên với sinh viên
        </div>
        <div>
          <HeartHandshake size={21} /> Giá trị thay tiền mặt
        </div>
        <div>
          <MapPin size={19} /> Kết nối trong khuôn viên
        </div>
      </div>
      <section
        id="gioi-thieu"
        className="story-section story-intro"
        aria-labelledby="intro-title"
      >
        <div className="intro-editorial">
          <Reveal>
            <div className="story-eyebrow">
              <span>01</span> ĐÂY LÀ SKILLBARTER
            </div>
            <h2 id="intro-title">
              Bạn có điều giỏi.
              <br />
              Ai đó <em>đang cần.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="story-lead">
              Một giờ tiếng Trung của bạn có thể mở ra một giờ lập trình của
              người khác.
            </p>
            <p>
              SkillBarter biến tri thức còn để dành thành một loại giá trị có
              thể trao đổi. Bạn dạy điều mình biết, nhận Time Credit, rồi dùng
              nó để học điều mình muốn — không cần chi tiền mặt.
            </p>
            <button
              type="button"
              className="story-text-link"
              onClick={() => onOpen("discovery")}
            >
              Tìm điều bạn muốn học <ArrowUpRight size={17} />
            </button>
          </Reveal>
        </div>
        <div className="story-stat-grid">
          {[
            {
              value: 1,
              suffix: "",
              label: "Giờ = 1 Credit",
              detail: "Bình đẳng mọi kỹ năng",
              icon: Clock3,
            },
            {
              value: 20,
              suffix: "",
              label: "Credit là giới hạn ví",
              detail: "Chống tích trữ & đầu cơ",
              icon: Wallet,
            },
            {
              value: 100,
              suffix: "%",
              label: "Giao dịch có sổ cái",
              detail: "Tự động ghi nhận tín dụng",
              icon: FileCheck2,
            },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Reveal key={stat.label} delay={index * 0.08}>
                <article className="story-stat">
                  <span className="story-stat-icon">
                    <Icon size={21} strokeWidth={1.5} />
                  </span>
                  <strong>
                    <Counter value={stat.value} suffix={stat.suffix} />
                  </strong>
                  <h3>{stat.label}</h3>
                  <p>{stat.detail}</p>
                  <span className="stat-index">/ 0{index + 1}</span>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>
      <section
        id="y-tuong"
        className="story-section story-origin"
        aria-labelledby="origin-title"
      >
        <Reveal className="story-section-heading">
          <div>
            <div className="story-eyebrow">
              <span>02</span> TỪ MỘT CÂU HỎI RẤT SINH VIÊN
            </div>
            <h2 id="origin-title">
              Điều gì xảy ra khi
              <br />
              <em>tri thức thay tiền mặt?</em>
            </h2>
          </div>
          <p>
            Chúng tôi bắt đầu từ những điều
            <br />
            đã quá quen trong giảng đường.
          </p>
        </Reveal>
        <div className="origin-grid">
          <Reveal>
            <article className="origin-problem">
              <div className="origin-card-top">
                <span className="origin-number">01 / THỰC TẾ</span>
                <span className="origin-pill">Điều còn thiếu</span>
              </div>
              <div className="origin-skill-icons" aria-hidden="true">
                <span>
                  <BookOpen size={24} />
                </span>
                <span>
                  <Music2 size={24} />
                </span>
                <span>
                  <GraduationCap size={24} />
                </span>
              </div>
              <h3>
                Có khả năng.
                <br />
                Thiếu một cơ hội.
              </h3>
              <p>
                Giỏi ngoại ngữ, lập trình, nhạc cụ hay thể thao — nhưng không
                phải ai cũng có đủ chi phí để học thêm điều mới.
              </p>
              <div className="origin-flake-note">
                <span className="flake-avatar">A</span>
                <div>
                  <b>“Mai mình học nhé?”</b>
                  <span>Đã xem. Rồi không ai tới.</span>
                </div>
                <span className="flake-dots">···</span>
              </div>
              <p className="origin-problem-foot">
                Các nhóm trao đổi tự phát thiếu cam kết, dễ bùng hẹn và khó kiểm
                chứng độ an toàn.
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="origin-solution">
              <div className="origin-card-top">
                <span className="origin-number">02 / LỜI GIẢI</span>
                <span className="origin-pill">Cùng xây sự tin cậy</span>
              </div>
              <div className="time-exchange-mark" aria-hidden="true">
                <Clock3 size={36} strokeWidth={1} />
                <span>↔</span>
                <HeartHandshake size={36} strokeWidth={1} />
              </div>
              <h3>
                Trao thời gian.
                <br />
                <em>Giữ lời hẹn.</em>
              </h3>
              <p>
                Kết nối triết lý Time Banking với những cơ chế bảo chứng cụ thể.
                Mỗi buổi học là một cam kết có thể kiểm chứng.
              </p>
              <ul>
                <li>
                  <LockKeyhole size={16} />
                  <span>
                    <b>Escrow</b> bảo vệ tín dụng đã đặt.
                  </span>
                  <Check size={14} />
                </li>
                <li>
                  <MapPin size={16} />
                  <span>
                    <b>Safe Zone</b> đưa cuộc hẹn vào khuôn viên.
                  </span>
                  <Check size={14} />
                </li>
                <li>
                  <Scale size={16} />
                  <span>
                    <b>Cộng đồng</b> cùng gìn giữ sự công bằng.
                  </span>
                  <Check size={14} />
                </li>
              </ul>
              <span className="origin-solution-foot">
                Một xã hội học tập, bắt đầu từ hai người.
              </span>
            </article>
          </Reveal>
        </div>
      </section>
      <StepTimeline onOpen={onOpen} />
      <FeatureBento onOpen={onOpen} />
      <section className="story-bridge" aria-labelledby="bridge-title">
        <Reveal>
          <div className="story-eyebrow">
            <span
              className={connected ? "bridge-live-dot" : "bridge-offline-dot"}
            />
            {connected
              ? `${liveCount} PHIÊN ĐANG HOẠT ĐỘNG`
              : "KHÔNG GIAN TRAO ĐỔI KỸ NĂNG"}
          </div>
          <h2 id="bridge-title">
            Câu chuyện hay nhất
            <br />
            là câu chuyện <em>bạn bắt đầu.</em>
          </h2>
          <p>
            Người bạn muốn học cùng có thể đang ở ngay giảng đường bên cạnh.
          </p>
          <div className="bridge-actions portal-actions">
            <button type="button" className="story-dark-pill" onClick={onLogin}>
              Đăng nhập hệ thống SkillBarter <ArrowRight size={18} />
            </button>
          </div>
          <div className="bridge-bottom">
            <span>SKILLBARTER · TRI THỨC LÀ GIÁ TRỊ</span>
            <span>MỘT GIỜ TRAO ĐI. MỘT HÀNH TRÌNH MỞ RA.</span>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
