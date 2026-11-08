"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Download,
  LifeBuoy,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import type { Tab, User } from "../lib/types";
import {
  createSupportDraft,
  readSupportDrafts,
  saveSupportDraft,
  supportDraftText,
  validateSupportIssue,
  type SupportTicketDraft,
} from "../lib/support-tickets";

// [TRỢ LÝ CHATBOT 24/7]: Trợ lý tự động chỉ mount trong Dashboard đã đăng nhập; Landing/RootLayout không render widget. Không gọi LLM hoặc tự mutation tài chính.
// [BỘ CÂU HỎI & TRẢ LỜI TỰ ĐỘNG]: Thêm intent/terms tại SUPPORT_RULES và câu trả lời tại supportAnswer; ưu tiên cụm từ có trọng số, hỗ trợ gõ không dấu.
// [GIAO DIỆN HEADER & SIDEBAR MỚI]: Orb navy/sky và cửa sổ trắng dùng chung ngôn ngữ pearl; action chuyển tab qua Home để sidebar/header cập nhật đồng bộ.
// [KIẾN TRÚC & THIẾT KẾ]: Knowledge base trong file này là hàm thuần để kiểm thử; ticket storage tách lib; hội thoại reset theo key activeUser ở Home.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: AnimatePresence mở/đóng cửa sổ, reduced-motion bỏ scale/y; cuộn chỉ trong log, Escape trả focus về launcher.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Gợi ý một chạm, nhập tự do, lịch sử bản nháp và tải phiếu; shortcut gọi Home, không tự tạo hoặc thay phiên đăng nhập.
// [KẾT NỐI API]: Số dư/Trust lấy activeUser thực; rule đối chiếu users/sessions/reviews/disputes backend, không thêm route hoặc sửa API adapter.
// [CẨN THẬN KHI SỬA]: Không giả Admin đã nhận ticket, camera online thật hoặc OTP thật. Hiện chỉ lưu local draft, luôn nói rõ chưa gửi và không hứa email.
// [ĐIỂM MỞ RỘNG]: Khi có ticket endpoint có xác thực, nối trạng thái sending/sent/error và chỉ phát biên nhận sau response máy chủ thành công.
// [SỬA TRÀN MOBILE]: visualViewport cập nhật kích thước/đáy cửa sổ chat khi bàn phím mở; responsive.css giữ mép 12px và chỉ log cuộn bên trong.
export type SupportDestination = Tab | "online";
type Intent =
  | "bonus"
  | "qr"
  | "proof"
  | "dispute"
  | "online"
  | "admin"
  | "credits"
  | "trust"
  | "voucher"
  | "skills"
  | "login"
  | "fallback";
type ChatAction =
  | { label: string; destination: SupportDestination }
  | { label: string; ticket: true };
type Answer = { title: string; text: string; actions: ChatAction[] };
type ChatMessage =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; answer: Answer };
export const SUPPORT_SUGGESTIONS: {
  intent: Intent;
  label: string;
  short: string;
}[] = [
  {
    intent: "bonus",
    label: "Làm sao nhận +1 Credit khởi đầu?",
    short: "+1 Credit khởi đầu",
  },
  {
    intent: "qr",
    label: "Cách quét mã QR tại Safe Zone?",
    short: "QR & Safe Zone",
  },
  {
    intent: "proof",
    label: "Nghiệm thu ảnh & mở khóa Escrow thế nào?",
    short: "Ảnh & Escrow",
  },
  {
    intent: "dispute",
    label: "Bị bùng lịch hoặc muốn khiếu nại Tòa án?",
    short: "Bùng lịch & khiếu nại",
  },
  {
    intent: "online",
    label: "Cách ghép đôi học Online 1-on-1?",
    short: "Học Online 1-on-1",
  },
  {
    intent: "admin",
    label: "Liên hệ Admin / Báo lỗi khẩn cấp",
    short: "Liên hệ Admin",
  },
];
const SUPPORT_RULES: { intent: Intent; terms: [string, number][] }[] = [
  {
    intent: "admin",
    terms: [
      ["admin", 15],
      ["bao loi", 15],
      ["khan cap", 15],
      ["loi he thong", 12],
      ["khong hoat dong", 12],
      ["credit bi mat", 12],
      ["khong nhan duoc", 12],
      ["ho tro truc tiep", 12],
    ],
  },
  {
    intent: "bonus",
    terms: [
      ["khoi dau", 10],
      ["xac minh", 9],
      ["xac thuc", 9],
      ["edu vn", 6],
      ["verify", 8],
      ["thuong dau", 8],
    ],
  },
  {
    intent: "trust",
    terms: [
      ["trust", 10],
      ["tin cay", 10],
      ["uy tin", 10],
      ["80 cu", 9],
      ["20 moi", 9],
      ["review", 7],
      ["danh gia", 7],
    ],
  },
  {
    intent: "voucher",
    terms: [
      ["voucher", 10],
      ["doi qua", 10],
      ["doi thuong", 10],
      ["nap", 7],
      ["top up", 9],
    ],
  },
  {
    intent: "dispute",
    terms: [
      ["bung lich", 12],
      ["khieu nai", 12],
      ["toa an", 12],
      ["tranh chap", 12],
      ["no show", 10],
      ["vang mat", 10],
      ["huy lich", 10],
      ["huy phien", 10],
      ["bo phieu", 12],
      ["boi tham", 12],
    ],
  },
  {
    intent: "proof",
    terms: [
      ["nghiem thu", 10],
      ["check out", 10],
      ["checkout", 10],
      ["anh", 5],
      ["proof", 9],
      ["mo khoa", 8],
      ["giai ngan", 9],
      ["escrow", 3],
    ],
  },
  {
    intent: "qr",
    terms: [
      ["qr", 10],
      ["safe zone", 8],
      ["check in", 10],
      ["checkin", 10],
      ["diem hen", 8],
      ["quet ma", 10],
    ],
  },
  {
    intent: "online",
    terms: [
      ["online", 10],
      ["1 on 1", 8],
      ["1 1", 5],
      ["ghep doi", 10],
      ["omegle", 10],
      ["micro", 6],
      ["camera", 6],
      ["mic", 6],
    ],
  },
  {
    intent: "login",
    terms: [
      ["dang nhap", 10],
      ["dang xuat", 10],
      ["tai khoan", 7],
      ["mat khau", 10],
      ["otp", 10],
    ],
  },
  {
    intent: "credits",
    terms: [
      ["credit", 4],
      ["credits", 4],
      ["tin dung", 5],
      ["standard", 5],
      ["premium", 5],
      ["20 credit", 10],
      ["gioi han", 7],
      ["so du", 7],
      ["han dung", 7],
      ["het han", 7],
    ],
  },
  {
    intent: "skills",
    terms: [
      ["ky nang", 10],
      ["dat lich", 9],
      ["offer", 7],
      ["need", 7],
      ["nguoi day", 6],
    ],
  },
];
export function normalizeSupportQuestion(text: string): string {
  return text
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function matchSupportIntent(question: string): Intent {
  const normalized = ` ${normalizeSupportQuestion(question)} `;
  let intent: Intent = "fallback",
    best = 0;
  for (const rule of SUPPORT_RULES) {
    const score = rule.terms.reduce(
      (sum, [term, weight]) =>
        sum + (normalized.includes(` ${term} `) ? weight : 0),
      0,
    );
    if (score > best) {
      best = score;
      intent = rule.intent;
    }
  }
  return intent;
}
export function supportGreeting(user?: User): string {
  return user
    ? `Chào ${user.full_name}! Hiện hồ sơ của bạn có ${user.standard_balance} Standard Credit, ${user.premium_balance} Premium Credit và điểm tin cậy ${user.trust_score.toFixed(1)}★. Mình có thể giúp gì cho bạn?`
    : "Chào bạn! Mình là trợ lý tự động SkillBarter. Chọn một chủ đề hoặc đặt câu hỏi; mình sẽ hướng dẫn bạn từng bước. Bạn cần đăng nhập để mở các công cụ học tập.";
}
export function supportAnswer(intent: Intent, user?: User): Answer {
  const wallet: ChatAction = {
    label: "Mở Ví & Đổi quà →",
    destination: "wallet",
  };
  const sessions: ChatAction = {
    label: "Đi tới Phiên học & Ký quỹ →",
    destination: "sessions",
  };
  const tribunal: ChatAction = {
    label: "Mở Tòa án cộng đồng →",
    destination: "tribunal",
  };
  const ticket: ChatAction = { label: "Soạn yêu cầu cho Admin", ticket: true };
  switch (intent) {
    case "bonus":
      return {
        title: "+1 Credit để bắt đầu",
        text: `${user?.is_verified ? "Hồ sơ hiện tại đã xác minh; phần thưởng chỉ được nhận một lần.\n\n" : ""}Mở Ví & Đổi quà, chọn xác minh email .edu.vn. Backend cấp tối đa +1 Standard Credit khi ví còn chỗ dưới mốc 20; phần thưởng có hạn 7 ngày.\n\nĐây là xác minh miền email trong bản Beta; chưa gửi OTP tới hộp thư. Trợ lý chỉ hướng dẫn, không tự xác minh hoặc cộng Credit.`,
        actions: [
          { label: "Mở Ví để xác thực .edu.vn →", destination: "wallet" },
        ],
      };
    case "qr":
      return {
        title: "Có mặt tại đúng Safe Zone",
        text: "1. Mở Khám phá & Điểm hẹn để chọn địa điểm và lấy/sao chép mã QR của điểm hẹn.\n2. Vào Phiên học & Ký quỹ, chọn phiên đang ký quỹ rồi Check-in bằng mã của đúng Safe Zone.\n3. Chỉ người dạy hoặc người học của phiên được Check-in. Mã hợp lệ chuyển phiên sang Đang học.\n\nGiao diện hiện nhập mã QR, chưa quét bằng camera hay xác minh GPS; không chia sẻ mã cho người ngoài phiên.",
        actions: [
          sessions,
          { label: "Xem Safe Zones →", destination: "discovery" },
        ],
      };
    case "proof":
      return {
        title: "Nghiệm thu & mở ký quỹ",
        text: "Sau Check-in, người dạy mở phiên Đang học, chọn Nghiệm thu và nhập URL ảnh minh chứng theo hướng dẫn. Backend đánh dấu Hoàn tất và giải ngân Escrow cho người dạy trong cùng giao dịch.\n\nChỉ người dạy của phiên được checkout. Phiên đang tranh chấp không thể nghiệm thu theo luồng này. Ảnh là URL minh chứng, chưa có AI kiểm duyệt ảnh hoặc bước xác nhận hai phía. Có vấn đề? Mở khiếu nại tại phiên thay vì gửi lại giao dịch nhiều lần.",
        actions: [sessions, tribunal],
      };
    case "dispute":
      return {
        title: "Bùng lịch, hủy hẹn & phân xử",
        text: "Nếu cần hủy trước giờ hẹn, mở phiên đang ký quỹ. Backend hoàn Credit cho người học; người dạy hủy sẽ bị trừ 0.2 Trust. Nếu người dạy không đến, chỉ người học được Báo vắng mặt sau ít nhất 15 phút kể từ giờ hẹn, khi phiên vẫn đang ký quỹ. Backend hoàn ký quỹ và trừ người dạy 0.2 Trust.\n\nVới tranh chấp, người tham gia mở khiếu nại từ Phiên học & Ký quỹ và mô tả rõ vấn đề. Thành viên ngoài phiên có Trust ≥ 4.5 được bỏ một phiếu; đủ 3 phiếu hợp lệ, đa số quyết định giải ngân hoặc hoàn ký quỹ. Trợ lý không thể tự hoàn Credit hay quyết định kết quả.",
        actions: [sessions, tribunal],
      };
    case "online":
      return {
        title: "Ghép đôi học Online 1-on-1",
        text: "Mở Khám phá → Học Online 1-on-1. Chọn chủ đề, vai trò và thời lượng, rồi Bắt đầu ghép đôi. Trong phòng có Next, thu gọn/mở PiP, chọn trạng thái micro/camera, chat, ghim 3 mục tiêu và đánh giá cuối phiên.\n\nOnline Beta dùng đối tác tự động, tin nhắn và đánh giá lưu trên thiết bị; không truyền video/audio thật và không trừ Credit trong ví. Các mức 15/30/45 phút tương ứng 0.25/0.5/1 Credit chỉ minh họa; Escrow campus vẫn dùng API hiện có.",
        actions: [{ label: "Mở Học Online 1-on-1 →", destination: "online" }],
      };
    case "credits":
      return {
        title: "Time Credits hoạt động thế nào?",
        text: `${user ? `Số dư hồ sơ: ${user.standard_balance}/20 Standard và ${user.premium_balance} Premium.\n\n` : ""}1 giờ trao đổi tương ứng 1 Credit. Standard có giới hạn số dư 20; ký quỹ dùng Standard trước rồi Premium nếu cần. Người dạy nhận giải ngân sau nghiệm thu. Khi giải ngân hoặc hoàn ký quỹ, phần Standard vượt trần 20 được chuyển sang Premium để giữ nguyên tổng giá trị.\n\nThưởng xác minh có hạn 7 ngày; tín dụng Standard nhận từ phiên có hạn 90 ngày trong ledger. Xem sổ cái để biết số lượng, loại và ngày hết hạn. Cộng Premium thử nghiệm không phát sinh thanh toán.`,
        actions: [wallet, sessions],
      };
    case "trust":
      return {
        title: "Điểm tin cậy & quyền bồi thẩm",
        text: `${user ? `Trust Score hiện tại của ${user.full_name}: ${user.trust_score.toFixed(1)}★.\n\n` : ""}Sau phiên hoàn tất, đánh giá gồm Chuẩn bị, Thái độ và Kiến thức. Điểm phiên là trung bình 3 tiêu chí; Trust mới = 80% điểm cũ + 20% điểm phiên, làm tròn 2 chữ số.\n\nTrust ≥ 4.5 cho phép tham gia bỏ phiếu nếu bạn không thuộc phiên tranh chấp và chưa bỏ phiếu. Hủy hoặc vắng mặt có chính sách phạt riêng; badge bồi thẩm không thay kiểm tra quyền phía backend.`,
        actions: [sessions, tribunal],
      };
    case "voucher":
      return {
        title: "Ví, Premium & đổi quà",
        text: "Mở Ví & Đổi quà để xem số dư, nạp thử Premium và đổi tín dụng theo lựa chọn. Kiểm tra loại Standard/Premium và số dư trước khi xác nhận.\n\nCộng Premium thử nghiệm chỉ hoạt động ở môi trường phát triển, không phát sinh thanh toán. Đổi quà ghi nhận trừ tín dụng và giao dịch REDEEM_VOUCHER; backend chưa phát hành mã voucher hay bảo đảm nhận quà từ đối tác thật.",
        actions: [wallet],
      };
    case "skills":
      return {
        title: "Đăng kỹ năng & đặt lịch",
        text: "Trong Khám phá & Điểm hẹn, lọc theo danh mục, cấp độ và Dạy/Học. Đăng kỹ năng với mô tả rõ điều bạn có thể trao đổi.\n\nChỉ kỹ năng OFFER của người khác có thể đặt lịch. Chọn Safe Zone, thời gian ở tương lai và 3 mục tiêu cụ thể. Kiểm tra đủ Credit trước khi xác nhận ký quỹ; bạn không thể tự đặt kỹ năng của mình.",
        actions: [
          { label: "Mở Khám phá & Điểm hẹn →", destination: "discovery" },
        ],
      };
    case "login":
      return {
        title: "Đăng nhập & chuyển tài khoản",
        text: "Từ Trang giới thiệu, bấm CTA để mở Đăng nhập hệ thống SkillBarter, chọn hồ sơ .edu.vn rồi xác nhận Đăng nhập vào Không gian Học tập. Phiên được lưu trên thiết bị.\n\nTrong Dashboard, menu hồ sơ cho phép chuyển tài khoản. Muốn trở lại Trang giới thiệu, chọn Đăng xuất tài khoản ở menu hoặc cuối sidebar. Backend hiện chưa hỗ trợ mật khẩu/OTP; đừng gửi mật khẩu vào chat.",
        actions: [wallet],
      };
    case "admin":
      return {
        title: "Để lại yêu cầu hỗ trợ",
        text: "Mô tả lỗi, các bước đã làm và mã phiên (nếu có). Mình có thể tạo bản nháp #SB-… gắn với email .edu.vn của hồ sơ đang đăng nhập để bạn tải và gửi qua kênh Admin của mình.\n\nHiện chưa có dịch vụ tiếp nhận ticket hoặc gửi email: bản nháp chỉ lưu trên thiết bị, chưa gửi Admin và chưa có lịch phản hồi. Nếu đang gặp nguy hiểm tại điểm hẹn, hãy liên hệ trực tiếp bảo vệ trường hoặc người phụ trách tại chỗ.",
        actions: [ticket],
      };
    default:
      return {
        title: "Mình cần thêm một chút thông tin",
        text: "Mình hỗ trợ các quy tắc SkillBarter về Credit, QR, Escrow, Trust, Tòa án, Ví và Online. Bạn có thể nêu rõ đang ở bước nào hoặc chọn chủ đề gợi ý bên dưới.\n\nVới lỗi riêng của tài khoản hoặc yêu cầu phức tạp, hãy soạn bản nháp gửi Admin. Mình không xem được ảnh, chẩn đoán tài khoản hay sửa giao dịch thay Admin.",
        actions: [ticket],
      };
  }
}

export default function SupportChatbot({
  user,
  busy,
  onNavigate,
}: {
  user?: User;
  busy: boolean;
  onNavigate: (destination: SupportDestination) => void;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState(true);
  const [ticketMode, setTicketMode] = useState(false);
  const [issue, setIssue] = useState("");
  const [reference, setReference] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [receipt, setReceipt] = useState<{
    draft: SupportTicketDraft;
    saved: boolean;
  } | null>(null);
  const [drafts, setDrafts] = useState<SupportTicketDraft[]>([]);
  const [history, setHistory] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const widget = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const issueInput = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const lastReply = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const titleId = useId();
  const windowId = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    function resize() {
      const height = viewport?.height ?? window.innerHeight;
      const offset = Math.max(
        0,
        window.innerHeight - height - (viewport?.offsetTop ?? 0),
      );
      widget.current?.style.setProperty(
        "--support-viewport-height",
        `${height}px`,
      );
      widget.current?.style.setProperty(
        "--support-keyboard-offset",
        `${offset}px`,
      );
    }
    resize();
    window.addEventListener("resize", resize);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("resize", resize);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (ticketMode) issueInput.current?.focus({ preventScroll: true });
  }, [ticketMode]);
  useEffect(() => {
    if (!open || !log.current) return;
    log.current.scrollTop =
      ticketMode || receipt || history || (suggestions && messages.length)
        ? log.current.scrollHeight
        : messages.length
          ? Math.max(0, (lastReply.current?.offsetTop ?? 12) - 12)
          : 0;
  }, [open, messages, ticketMode, receipt, history, suggestions]);
  function close() {
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }
  function ask(text: string, intent = matchSupportIntent(text)) {
    const value = text.trim().slice(0, 500);
    if (!value) return;
    setMessages((current) => [
      ...current.slice(-38),
      { id: ++sequence.current, from: "user", text: value },
      {
        id: ++sequence.current,
        from: "bot",
        answer: supportAnswer(intent, user),
      },
    ]);
    setQuestion("");
    setSuggestions(false);
    setHistory(false);
    setReceipt(null);
    setTicketMode(intent === "admin");
    if (intent === "admin" || intent === "fallback")
      setIssue(intent === "fallback" ? value : "");
  }
  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }
  function act(action: ChatAction) {
    if ("ticket" in action) {
      setTicketMode(true);
      setHistory(false);
      setReceipt(null);
      setTicketError("");
      return;
    }
    if (busy) return;
    onNavigate(action.destination);
    setOpen(false);
  }
  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const error = validateSupportIssue(issue);
    if (error) {
      setTicketError(error);
      return;
    }
    const suffix = (
      globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2, 10)
    )
      .slice(0, 8)
      .toUpperCase();
    const draft = createSupportDraft(
      user,
      issue,
      reference,
      `SB-${Date.now().toString(36).toUpperCase()}-${suffix}`,
      Date.now(),
    );
    const saved = saveSupportDraft(draft);
    setDrafts((current) => [draft, ...current].slice(0, 20));
    setReceipt({ draft, saved });
    setTicketMode(false);
    setTicketError("");
    setIssue("");
    setReference("");
  }
  function download(draft: SupportTicketDraft) {
    const url = URL.createObjectURL(
      new Blob([supportDraftText(draft)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.id}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function reset() {
    setMessages([]);
    setQuestion("");
    setSuggestions(true);
    setTicketMode(false);
    setTicketError("");
    setIssue("");
    setReference("");
    setReceipt(null);
    setHistory(false);
    input.current?.focus();
  }
  return (
    <aside
      className="support-widget"
      ref={widget}
      aria-label="Hỗ trợ SkillBarter"
    >
      <AnimatePresence>
        {open && (
          <motion.section
            id={windowId}
            className="support-window"
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            initial={{
              opacity: 0,
              y: reduced ? 0 : 16,
              scale: reduced ? 1 : 0.97,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: reduced ? 0 : 12,
              scale: reduced ? 1 : 0.98,
            }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
          >
            <header className="support-header">
              <span className="support-avatar">
                <Bot size={22} />
                <Sparkles size={9} />
              </span>
              <div>
                <h2 id={titleId}>Trợ Lý SkillBarter 24/7</h2>
                <p>Hỗ trợ tự động thay Admin • Phản hồi tức thì</p>
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label="Đặt lại hội thoại"
                title="Đặt lại hội thoại"
              >
                <RotateCcw size={15} />
              </button>
              <button type="button" onClick={close} aria-label="Đóng trợ lý">
                <X size={18} />
              </button>
            </header>
            <div className="support-service-note">
              <span /> Trực tuyến 24/7{" "}
              <span className="support-note-divider">/</span> Trả lời từ bộ
              hướng dẫn SkillBarter
            </div>
            <div className="support-log" ref={log}>
              <div className="support-greeting">
                <span className="support-greeting-label">
                  <Sparkles size={12} /> Cùng bạn qua từng bước
                </span>
                <p>{supportGreeting(user)}</p>
              </div>
              <div
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label="Hội thoại hỗ trợ"
              >
                {messages.map((message, index) => (
                  <div
                    className={`support-message from-${message.from}`}
                    key={message.id}
                    ref={index === messages.length - 1 ? lastReply : undefined}
                  >
                    {message.from === "user" ? (
                      <p>{message.text}</p>
                    ) : (
                      <>
                        <b>{message.answer.title}</b>
                        <p>{message.answer.text}</p>
                        <div className="support-actions">
                          {message.answer.actions.map((action) => (
                            <button
                              type="button"
                              key={action.label}
                              disabled={busy && "destination" in action}
                              onClick={() => act(action)}
                            >
                              {action.label}
                              {"ticket" in action ? (
                                <Ticket size={13} />
                              ) : (
                                <ArrowUpRight size={13} />
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {ticketMode && (
                <section
                  className="support-ticket"
                  aria-label="Soạn yêu cầu hỗ trợ"
                >
                  <h3>
                    <LifeBuoy size={15} /> Yêu cầu cho Admin
                  </h3>
                  <p className="support-ticket-notice">
                    Bản nháp lưu trên thiết bị • Chưa gửi Admin
                  </p>
                  {user ? (
                    <form onSubmit={submitDraft}>
                      <p className="support-ticket-owner">
                        Email liên hệ: <b>{user.email}</b>
                      </p>
                      <label>
                        Mã phiên / mã lỗi (nếu có)
                        <input
                          maxLength={128}
                          value={reference}
                          onChange={(event) => setReference(event.target.value)}
                          placeholder="Ví dụ: mã phiên đang gặp lỗi"
                        />
                      </label>
                      <label>
                        Mô tả vấn đề
                        <textarea
                          ref={issueInput}
                          value={issue}
                          onChange={(event) => setIssue(event.target.value)}
                          minLength={20}
                          maxLength={2000}
                          rows={4}
                          required
                          placeholder="Bạn đang làm gì? Kết quả mong đợi và lỗi gặp phải…"
                        />
                      </label>
                      <small>
                        {issue.length}/2.000 ký tự. Không nhập mật khẩu hoặc
                        OTP.
                      </small>
                      {ticketError && (
                        <p role="alert" className="support-error">
                          {ticketError}
                        </p>
                      )}
                      <div className="support-ticket-buttons">
                        <button className="support-primary" type="submit">
                          <Ticket size={14} /> Lưu bản nháp #SB
                        </button>
                        <button
                          type="button"
                          onClick={() => setTicketMode(false)}
                        >
                          Đóng
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p>
                        Đăng nhập hồ sơ .edu.vn, sau đó mở lại trợ lý và chọn
                        Liên hệ Admin để soạn bản nháp gắn với email của bạn.
                      </p>
                      <button
                        className="support-primary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          act({ label: "Đăng nhập", destination: "wallet" })
                        }
                      >
                        Đăng nhập hồ sơ .edu.vn <ArrowUpRight size={13} />
                      </button>
                    </>
                  )}
                </section>
              )}
              {receipt && (
                <section className="support-receipt" role="status">
                  <span>
                    <Check size={16} /> Đã tạo bản nháp {receipt.draft.id}
                  </span>
                  <p>
                    {receipt.saved
                      ? "Đã lưu trên thiết bị này."
                      : "Trình duyệt chặn lưu trữ. Hãy tải bản nháp trước khi đóng trang."}{" "}
                    Chưa gửi Admin; chưa có dịch vụ gửi email. Tải bản nháp để
                    gửi qua kênh liên hệ của bạn.
                  </p>
                  <button type="button" onClick={() => download(receipt.draft)}>
                    <Download size={14} /> Tải yêu cầu hỗ trợ
                  </button>
                </section>
              )}
              {history && (
                <section className="support-draft-history">
                  <h3>Bản nháp trên thiết bị</h3>
                  <p>
                    Chưa gửi Admin. Chỉ hiển thị bản nháp của hồ sơ hiện tại.
                  </p>
                  {drafts.length ? (
                    drafts.map((draft) => (
                      <button
                        type="button"
                        key={draft.id}
                        onClick={() => download(draft)}
                      >
                        <span>
                          <b>{draft.id}</b>
                          <small>
                            {new Date(draft.createdAt).toLocaleString("vi-VN")}
                          </small>
                        </span>
                        <Download size={15} />
                      </button>
                    ))
                  ) : (
                    <p>Chưa có bản nháp nào.</p>
                  )}
                </section>
              )}
              {suggestions && (
                <div
                  className="support-suggestions"
                  aria-label="Chủ đề hỗ trợ nhanh"
                >
                  {SUPPORT_SUGGESTIONS.map((suggestion, index) => (
                    <button
                      type="button"
                      key={suggestion.intent}
                      onClick={() => ask(suggestion.label, suggestion.intent)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {suggestion.label}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="support-tools">
              <button
                type="button"
                aria-expanded={suggestions}
                onClick={() => setSuggestions(!suggestions)}
              >
                <Plus size={12} /> Chủ đề gợi ý
              </button>
              {user && (
                <button
                  type="button"
                  aria-expanded={history}
                  onClick={() => {
                    setHistory(!history);
                    setTicketMode(false);
                  }}
                >
                  <Ticket size={12} /> Bản nháp ({drafts.length})
                </button>
              )}
            </div>
            <form className="support-composer" onSubmit={submitQuestion}>
              <label className="sr-only" htmlFor={`${windowId}-question`}>
                Câu hỏi cho trợ lý SkillBarter
              </label>
              <input
                id={`${windowId}-question`}
                ref={input}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                placeholder="Hỏi về Credit, QR, Escrow…"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!question.trim()}
                aria-label="Gửi câu hỏi"
              >
                <Send size={17} />
              </button>
            </form>
            <p className="support-disclaimer">
              Trợ lý tự động • Không có Admin trực tiếp trong chat
            </p>
          </motion.section>
        )}
      </AnimatePresence>
      <button
        ref={launcher}
        type="button"
        className={`support-launcher ${open ? "is-open" : ""}`}
        aria-label={
          open
            ? "Thu gọn trợ lý SkillBarter"
            : "Mở Trợ Lý Hỗ Trợ SkillBarter 24/7"
        }
        aria-expanded={open}
        aria-controls={open ? windowId : undefined}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setSeen(true);
          setDrafts(user ? readSupportDrafts(user.id) : []);
          setOpen(true);
        }}
      >
        {open ? (
          <ChevronDown size={25} />
        ) : (
          <>
            <MessageCircle size={26} />
            <Sparkles className="support-launcher-sparkle" size={12} />
          </>
        )}
        <i className="support-online-dot" aria-hidden="true" />
        {!seen && (
          <span className="support-unread" aria-hidden="true">
            1
          </span>
        )}
        <span className="support-launcher-tooltip">
          Hỗ trợ tự động · Online 24/7
        </span>
      </button>
    </aside>
  );
}
