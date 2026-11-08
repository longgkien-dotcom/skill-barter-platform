"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  CircleCheck,
  Clock3,
  Code2,
  GraduationCap,
  Languages,
  LockKeyhole,
  MessageCircle,
  Music2,
  Pin,
  Radio,
  Repeat2,
  Send,
  ShieldCheck,
  Shuffle,
  SkipForward,
  Sparkles,
  Star,
  Video,
  X,
} from "lucide-react";
import type { User } from "../lib/types";
import {
  demoCreditLabel,
  eligibleDemoPartners,
  formatCountdown,
  ONLINE_PLANS,
  ONLINE_ROLES,
  ONLINE_TOPICS,
  pickDemoPartner,
  remainingSeconds,
  validOnlineGoals,
  type OnlineRole,
} from "../lib/online-demo";
import {
  onlineReply,
  onlineTypingDelay,
  pendingOnlineReplies,
  readOnlineRoom,
  readOnlineReviews,
  saveOnlineRoom,
  type OnlineMessage as Message,
  type OnlinePhase as Phase,
  type PendingOnlineReply,
} from "../lib/online-session";
import IdentityChip, { IdentityAvatar } from "./IdentityChip";
import { Modal } from "./ui";
import OnlineVideoStage from "./OnlineVideoStage";

// [GIAO DIỆN HỌC ONLINE OMEGLE]: Bốn trạng thái lobby → matching → room → finished; một ghi chú Beta nêu rõ đối tác tự động, phạm vi media và ví.
// [HỆ THỐNG MÀU LUMINOUS NAVY]: Partner chiếm sân khấu lớn, camera cá nhân PiP nổi góc phải; panel sáng, escrow emerald và credit amber giữ màu ngữ nghĩa.
// [KẾT NỐI API]: Chỉ đọc user/roster đã tải từ Home. Không gọi getUserMedia, signaling, POST Session, payout hoặc Review của backend.
// [CẨN THẬN KHI SỬA]: Không gửi credit lẻ tới API Int hoặc giả người thật đã nhận tin. Receipt chỉ xác nhận lưu cục bộ; phản hồi sinh từ quy tắc theo ngữ cảnh.
// [KIẾN TRÚC & THIẾT KẾ]: online-demo.ts giữ quy tắc sprint, online-session.ts giữ journal/reply/history; deadline độc lập snapshot ví thật.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Radar/waveform nhẹ; reduced-motion bỏ loop và dịch chuyển. Countdown dựa deadline thay vì trừ tích lũy.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Chọn chủ đề/vai trò, chat có hàng đợi/typing, ghim mục tiêu và đánh giá; reload khôi phục đúng user và giữ lịch sử góp ý.
// [ĐIỂM MỞ RỘNG]: Nối media stream, signaling xác thực và hợp đồng tín dụng online khi backend có API tương ứng.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Component chỉ mount trong nhánh online của Discovery; cleanup hủy mọi timer khi đổi tài khoản/tab/view.
// [BETA & LƯU TRẠNG THÁI]: Journal khôi phục theo user; deadline là nguồn thời gian, snapshot không lưu số dư hay gửi review Online vào Session campus.
// [TRÒ CHUYỆN TƯƠNG TÁC]: Hàng đợi phản hồi theo ngữ cảnh có pause/typing, receipt chỉ báo lưu cục bộ; cleanup chặn tin nhắn lọt sang phiên khác.
const topicIcons = {
  language: Languages,
  code: Code2,
  cube: Shuffle,
  music: Music2,
  math: BookOpen,
};
export default function OnlineBarter({
  user,
  users,
  busy,
}: {
  user: User;
  users: User[];
  busy: boolean;
}) {
  const [restored] = useState(() => readOnlineRoom(user.id, users));
  const [phase, setPhase] = useState<Phase>(restored?.phase ?? "lobby");
  const [topicIndex, setTopicIndex] = useState(restored?.topicIndex ?? 0);
  const [role, setRole] = useState<OnlineRole>(restored?.role ?? "learn");
  const [planIndex, setPlanIndex] = useState(restored?.planIndex ?? 1);
  const [partner, setPartner] = useState<User | null>(
    () => users.find((person) => person.id === restored?.partnerId) ?? null,
  );
  const [muted, setMuted] = useState(restored?.muted ?? false);
  const [camera, setCamera] = useState(restored?.camera ?? true);
  const [previewVisible, setPreviewVisible] = useState(
    restored?.previewVisible ?? true,
  );
  const [seconds, setSeconds] = useState(() =>
    restored?.phase === "room"
      ? remainingSeconds(restored.deadline, Date.now())
      : (restored?.seconds ?? 1800),
  );
  const [messages, setMessages] = useState<Message[]>(restored?.messages ?? []);
  const [draft, setDraft] = useState(restored?.draft ?? "");
  const [goals, setGoals] = useState<string[]>(restored?.goals ?? []);
  const [pinned, setPinned] = useState(restored?.pinned ?? false);
  const [goalModal, setGoalModal] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [reviewModal, setReviewModal] = useState(false);
  const [rating, setRating] = useState(restored?.rating ?? 5);
  const [reviewSaved, setReviewSaved] = useState(
    restored?.reviewSaved ?? false,
  );
  const [reviewComment, setReviewComment] = useState(
    restored?.reviewComment ?? "",
  );
  const [replyQueue, setReplyQueue] = useState<PendingOnlineReply[]>(() =>
    restored?.phase === "room"
      ? pendingOnlineReplies(
          restored.messages,
          restored.topicIndex,
          restored.goals,
        )
      : [],
  );
  const [typing, setTyping] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [recentReviews, setRecentReviews] = useState(() =>
    readOnlineReviews(user.id),
  );
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [matchError, setMatchError] = useState("");
  const matchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPartner = useRef<string | null>(restored?.partnerId ?? null);
  const deadline = useRef(restored?.deadline ?? 0);
  const messageId = useRef(
    Math.max(0, ...(restored?.messages.map((message) => message.id) ?? [])),
  );
  const chatScroll = useRef<HTMLDivElement>(null);
  const topic = ONLINE_TOPICS[topicIndex];
  const plan = ONLINE_PLANS[planIndex];
  const pool = eligibleDemoPartners(users, user.id);
  const reduced = useReducedMotion();
  useEffect(() => {
    return () => {
      if (matchTimer.current) clearTimeout(matchTimer.current);
    };
  }, []);
  useEffect(() => {
    if (phase !== "room") return;
    const timer = setInterval(
      () => setSeconds(remainingSeconds(deadline.current, Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    const chat = chatScroll.current;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, [messages, typing]);
  const persistedSeconds = phase === "finished" ? seconds : 0;
  useEffect(() => {
    let active = true;
    // [BETA & LƯU TRẠNG THÁI]: Kết quả I/O quyết định receipt; bỏ snapshot đã cleanup để không ghi đè phiên mới hoặc user khác.
    void Promise.resolve().then(() => {
      if (!active) return;
      const saved = saveOnlineRoom(user.id, {
        phase,
        topicIndex,
        role,
        planIndex,
        partnerId: partner?.id ?? null,
        muted,
        camera,
        previewVisible,
        deadline: deadline.current,
        seconds:
          phase === "room"
            ? remainingSeconds(deadline.current, Date.now())
            : phase === "finished"
              ? persistedSeconds
              : ONLINE_PLANS[planIndex].minutes * 60,
        messages,
        draft,
        goals,
        pinned,
        rating,
        reviewSaved,
        reviewComment,
      });
      if (!active) return;
      setStorageError(!saved);
      if (saved && phase === "finished" && reviewSaved)
        setRecentReviews(readOnlineReviews(user.id));
      setMessages((current) =>
        current.some(
          (message) =>
            message.from === "self" &&
            message.delivery !== (saved ? "saved" : "failed"),
        )
          ? current.map((message) =>
              message.from === "self"
                ? { ...message, delivery: saved ? "saved" : "failed" }
                : message,
            )
          : current,
      );
    });
    return () => {
      active = false;
    };
  }, [
    user.id,
    phase,
    topicIndex,
    role,
    planIndex,
    partner?.id,
    muted,
    camera,
    previewVisible,
    persistedSeconds,
    messages,
    draft,
    goals,
    pinned,
    rating,
    reviewSaved,
    reviewComment,
    saveAttempt,
  ]);
  const appendMessage = useCallback(
    (from: Message["from"], text: string, replyTo?: number) => {
      const id = ++messageId.current;
      setMessages((previous) => [
        ...previous.slice(-79),
        {
          id,
          from,
          text,
          createdAt: Date.now(),
          delivery: from === "self" ? "saving" : "saved",
          ...(replyTo === undefined ? {} : { replyTo }),
        },
      ]);
      return id;
    },
    [],
  );
  const nextReply = replyQueue[0];
  useEffect(() => {
    if (phase !== "room" || !nextReply) return;
    let active = true;
    const typingTimer = setTimeout(() => {
      if (active) setTyping(true);
    }, 450);
    const answerTimer = setTimeout(
      () => {
        if (!active) return;
        appendMessage("partner", nextReply.text, nextReply.replyTo);
        setTyping(false);
        setReplyQueue((current) => current.slice(1));
      },
      450 + onlineTypingDelay(nextReply.text),
    );
    return () => {
      active = false;
      clearTimeout(typingTimer);
      clearTimeout(answerTimer);
    };
  }, [phase, nextReply, appendMessage]);
  function clearReplies() {
    setReplyQueue([]);
    setTyping(false);
  }
  function match() {
    if (busy) return;
    const selected = pickDemoPartner(pool, previousPartner.current);
    if (!selected) {
      setMatchError(
        "Chưa có hồ sơ .edu.vn khác đã xác minh. Chọn tài khoản khác hoặc thêm hồ sơ sinh viên ở Tòa án cộng đồng.",
      );
      return;
    }
    if (matchTimer.current) clearTimeout(matchTimer.current);
    clearReplies();
    setMatchError("");
    setPhase("matching");
    setPartner(null);
    setMessages([]);
    setDraft("");
    setPinned(false);
    setGoals([...topic.goals]);
    setRating(5);
    setReviewComment("");
    setReviewSaved(false);
    setSeconds(plan.minutes * 60);
    setGoalModal(false);
    setReviewModal(false);
    matchTimer.current = setTimeout(() => {
      matchTimer.current = null;
      previousPartner.current = selected.id;
      setPartner(selected);
      deadline.current = Date.now() + plan.minutes * 60000;
      setPhase("room");
      setReplyQueue([
        {
          text: `Chào ${user.full_name.split(" ").at(-1)}! Cùng bắt đầu với chủ đề “${topic.label}” nhé. Bạn muốn luyện phần nào trước?`,
        },
      ]);
    }, 1600);
  }
  function lobby() {
    if (matchTimer.current) clearTimeout(matchTimer.current);
    matchTimer.current = null;
    clearReplies();
    setPhase("lobby");
    setPartner(null);
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || phase !== "room" || replyQueue.length >= 5) return;
    const id = appendMessage("self", text.slice(0, 500));
    setDraft("");
    setReplyQueue((current) => [
      ...current,
      {
        replyTo: id,
        text: onlineReply(
          text,
          topicIndex,
          goals,
          messages.filter((message) => message.from === "self").length + 1,
        ),
      },
    ]);
  }
  function pinGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = [1, 2, 3].map((index) =>
      String(data.get(`goal${index}`) ?? "").trim(),
    );
    if (!validOnlineGoals(next)) {
      setGoalError("Cần đúng 3 mục tiêu, mỗi mục từ 3 đến 300 ký tự.");
      return;
    }
    setGoals(next);
    setPinned(true);
    setGoalModal(false);
    setGoalError("");
    appendMessage("system", "Đã ghim 3 mục tiêu vào phòng.");
  }
  function finish() {
    clearReplies();
    setPhase("finished");
    setReviewModal(true);
  }
  const localRole =
    role === "teach"
      ? "Người dạy"
      : role === "learn"
        ? "Học viên"
        : "Trao đổi song phương";
  const partnerRole =
    role === "teach"
      ? "Học viên"
      : role === "learn"
        ? "Người dạy"
        : "Trao đổi song phương";

  return (
    <div className="online-barter">
      <div className="online-demo-note">
        <Sparkles size={15} />
        <span>
          Online Beta · Đối tác tự động. Chat và đánh giá lưu trên thiết bị;
          chưa truyền âm thanh, video hoặc thay đổi số dư ví.
        </span>
      </div>
      {storageError && (
        <div className="online-storage-error" role="alert">
          Chưa lưu được phiên trên thiết bị. Giữ trang mở để tránh mất nội dung.
          <button
            type="button"
            onClick={() => setSaveAttempt((attempt) => attempt + 1)}
          >
            Thử lưu lại
          </button>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {phase === "lobby" && (
          <motion.div
            key="lobby"
            className="online-lobby-grid"
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <section className="workspace-section online-lobby">
              <div className="online-title-row">
                <span className="online-eyebrow">
                  <Radio size={14} /> ONLINE SPEED BARTER
                </span>
                <span className="badge indigo">1-ON-1</span>
              </div>
              <h2>
                Trạm Ghép Đôi Kỹ Năng<span>.</span>
              </h2>
              <p className="online-lead">
                Chọn một chủ đề. Gặp một góc nhìn mới.
              </p>
              <fieldset className="online-topics">
                <legend>Hôm nay, bạn muốn cùng luyện điều gì?</legend>
                <div>
                  {ONLINE_TOPICS.map((item, index) => {
                    const Icon = topicIcons[item.icon];
                    return (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={topicIndex === index}
                        onClick={() => setTopicIndex(index)}
                      >
                        <Icon size={16} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="online-role-picker">
                <legend>Vai trò của bạn</legend>
                <div>
                  {ONLINE_ROLES.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={role === item.id}
                      onClick={() => {
                        setRole(item.id);
                        if (item.id === "exchange") setPlanIndex(1);
                      }}
                    >
                      <span>
                        {item.id === "teach" ? (
                          <GraduationCap size={19} />
                        ) : item.id === "learn" ? (
                          <BookOpen size={19} />
                        ) : (
                          <Repeat2 size={19} />
                        )}
                      </span>
                      <b>{item.label}</b>
                      <small>{item.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="online-duration">
                <legend>Thời lượng sprint</legend>
                <div>
                  {ONLINE_PLANS.map((item, index) => (
                    <button
                      type="button"
                      key={item.minutes}
                      aria-pressed={planIndex === index}
                      disabled={role === "exchange" && index !== 1}
                      onClick={() => setPlanIndex(index)}
                    >
                      <Clock3 size={14} />
                      <b>{item.minutes} phút</b>
                      <span>
                        {demoCreditLabel(item.credits)} Credit dự kiến
                      </span>
                    </button>
                  ))}
                </div>
                {role === "exchange" && (
                  <p>
                    Phiên song phương gồm hai lượt 15 phút, mỗi người lần lượt
                    chia sẻ.
                  </p>
                )}
              </fieldset>
              {matchError && (
                <p className="form-error" role="alert">
                  {matchError}
                </p>
              )}
              <motion.button
                type="button"
                className="online-match-button"
                disabled={busy || !pool.length}
                onClick={match}
                whileHover={reduced ? undefined : { y: -2 }}
                whileTap={reduced ? undefined : { scale: 0.99 }}
              >
                <span className="online-radar-icon">
                  <Shuffle size={20} />
                </span>
                <span>
                  <b>Bắt đầu Ghép Đôi Ngẫu Nhiên</b>
                  <small>Tìm bạn học ngay</small>
                </span>
                <ArrowRight size={21} />
              </motion.button>
              {!pool.length && (
                <p className="online-pool-note">
                  Chưa có hồ sơ .edu.vn khác đã xác minh để ghép trong phòng
                  học.
                </p>
              )}
            </section>
            <aside className="workspace-section online-lobby-aside">
              <span className="online-eyebrow">
                MỘT KẾT NỐI MỚI, MỖI LƯỢT GHÉP
              </span>
              <div className="online-orbit-preview" aria-hidden="true">
                <i />
                <i />
                <span className="online-orbit-you">
                  <IdentityAvatar person={user} size="medium" />
                </span>
                <span className="online-orbit-partner">
                  <Shuffle size={26} />
                </span>
                <span className="online-orbit-center">
                  <Video size={27} />
                </span>
              </div>
              <h3>
                Đổi một góc nhìn.
                <br />
                Mở một khả năng.
              </h3>
              <p>
                Chọn mục tiêu vừa sức, luyện tập từng bước và lưu lại điều bạn
                đã học.
              </p>
              <ul>
                <li>
                  <BadgeCheck size={17} />
                  <span>Hồ sơ đối tác .edu.vn đã xác minh</span>
                </li>
                <li>
                  <Pin size={17} />
                  <span>Ghim 3 mục tiêu ngay trong phòng</span>
                </li>
                <li>
                  <MessageCircle size={17} />
                  <span>Trò chuyện theo chủ đề trong phòng 1-on-1</span>
                </li>
                <li>
                  <ShieldCheck size={17} />
                  <span>Lưu mục tiêu và đánh giá sau buổi học</span>
                </li>
              </ul>
              <div className="online-aside-foot">
                <span>{pool.length}</span> hồ sơ phù hợp với chủ đề ghép đôi
              </div>
            </aside>
          </motion.div>
        )}
        {phase === "matching" && (
          <motion.section
            key="matching"
            className="workspace-section online-matching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-live="polite"
          >
            <div className="online-radar-scan" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>
                <Shuffle size={32} />
              </span>
            </div>
            <span className="online-eyebrow">ĐANG GHÉP ĐÔI</span>
            <h2>Đang tìm một góc nhìn mới…</h2>
            <p>
              {topic.label} · {plan.minutes} phút ·{" "}
              {ONLINE_ROLES.find((item) => item.id === role)?.label}
            </p>
            <button className="button secondary" type="button" onClick={lobby}>
              <X size={15} /> Hủy tìm kiếm
            </button>
          </motion.section>
        )}
        {phase === "room" && partner && (
          <motion.section
            key="room"
            className="workspace-section online-room"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="online-room-heading">
              <div>
                <span className="online-eyebrow">
                  <Video size={14} /> PHÒNG HỌC TRỰC TUYẾN
                </span>
                <h2>{topic.label}</h2>
                <p>
                  {ONLINE_ROLES.find((item) => item.id === role)?.label}
                  {role === "exchange" && " · Hai lượt 15 phút"}
                </p>
              </div>
              <button type="button" className="text-button" onClick={lobby}>
                <ArrowLeft size={14} /> Về sảnh
              </button>
            </div>
            <div className="online-hud">
              <span
                className={`online-clock ${seconds <= 60 ? "ending" : ""}`}
                role="timer"
                aria-label="Thời gian còn lại"
              >
                <Clock3 size={17} />
                <b>{formatCountdown(seconds)}</b>
                <small>/ {plan.minutes} phút</small>
              </span>
              <span className="online-escrow">
                <LockKeyhole size={15} />
                Dự kiến {demoCreditLabel(plan.credits)} Credit
              </span>
              <span className="online-connection">
                <span /> Trong phiên
              </span>
              {role === "exchange" && (
                <span className="online-exchange-turn">
                  {plan.minutes * 60 - seconds < 900
                    ? "Lượt 1 · Bạn chia sẻ"
                    : "Lượt 2 · Bạn học"}
                </span>
              )}
            </div>
            {seconds === 0 && (
              <p className="online-time-ended" role="status">
                Sprint đã hết giờ. Bạn có thể hoàn tất hoặc ghép người tiếp
                theo.
              </p>
            )}
            <div className="online-room-grid">
              <div className="online-room-main">
                <OnlineVideoStage
                  user={user}
                  partner={partner}
                  localRole={localRole}
                  partnerRole={partnerRole}
                  muted={muted}
                  camera={camera}
                  previewVisible={previewVisible}
                  onTogglePreview={() =>
                    setPreviewVisible((visible) => !visible)
                  }
                  onToggleMute={() => setMuted((value) => !value)}
                  onToggleCamera={() => setCamera((value) => !value)}
                />
                <div
                  className={`online-contract-strip ${pinned ? "is-pinned" : ""}`}
                >
                  <Pin size={17} />
                  <div>
                    <b>
                      {pinned
                        ? "Đã ghim 3 mục tiêu"
                        : "Cùng chốt mục tiêu trước khi bắt đầu"}
                    </b>
                    <p>
                      {pinned
                        ? goals.join(" · ")
                        : "Micro-Contract giúp cuộc trao đổi ngắn đi đúng hướng."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setGoalError("");
                      setGoalModal(true);
                    }}
                  >
                    {pinned ? "Chỉnh sửa" : "Ghim ngay"}
                  </button>
                </div>
                <div className="online-room-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={match}
                  >
                    <SkipForward size={16} /> Bỏ qua / Ghép người tiếp theo
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setGoalError("");
                      setGoalModal(true);
                    }}
                  >
                    <Pin size={15} /> Ghim Hợp Đồng 3 Mục Tiêu
                  </button>
                  <button
                    type="button"
                    className="button primary online-finish"
                    onClick={finish}
                  >
                    <Check size={16} /> Kết thúc phiên
                  </button>
                </div>
              </div>
              <aside className="online-chat">
                <div className="online-chat-heading">
                  <h3>
                    <MessageCircle size={16} /> Trò chuyện
                  </h3>
                  <span>Đối tác tự động</span>
                </div>
                <div
                  className="online-chat-messages"
                  ref={chatScroll}
                  role="log"
                  aria-label="Tin nhắn trong phiên học"
                  aria-live="polite"
                >
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`online-message from-${message.from}`}
                    >
                      {message.from !== "system" && (
                        <small>
                          {message.from === "self" ? "Bạn" : partner.full_name}
                        </small>
                      )}
                      <p>{message.text}</p>
                      {message.from === "self" && (
                        <small
                          className={`online-delivery is-${message.delivery}`}
                        >
                          {message.delivery === "saving" ? (
                            "Đang lưu…"
                          ) : message.delivery === "saved" ? (
                            <>
                              <Check size={11} /> Đã lưu
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setSaveAttempt((attempt) => attempt + 1)
                              }
                            >
                              Chưa lưu · Thử lại
                            </button>
                          )}
                        </small>
                      )}
                    </div>
                  ))}
                  {typing && (
                    <div className="online-typing" role="status">
                      <span aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <small>
                        {partner.full_name.split(" ").at(-1)} đang gõ…
                      </small>
                    </div>
                  )}
                </div>
                <form className="online-chat-form" onSubmit={send}>
                  <label className="sr-only" htmlFor="online-message">
                    Tin nhắn
                  </label>
                  <input
                    id="online-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={500}
                    placeholder="Nhắn một lời chào…"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    aria-label="Gửi tin nhắn"
                    disabled={!draft.trim() || replyQueue.length >= 5}
                  >
                    <Send size={17} />
                  </button>
                </form>
              </aside>
            </div>
          </motion.section>
        )}
        {phase === "finished" && partner && (
          <motion.section
            key="finished"
            className="workspace-section online-finished"
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="online-finished-icon">
              <CircleCheck size={38} />
            </span>
            <span className="online-eyebrow">PHIÊN HỌC ĐÃ HOÀN TẤT</span>
            <h2>
              Một cuộc trao đổi.
              <br />
              Một điều mới mang về.
            </h2>
            <div className="online-finished-partner">
              <IdentityChip person={partner} role={partnerRole} size="medium" />
            </div>
            <div className="online-finished-stats">
              <span>
                <b>{formatCountdown(plan.minutes * 60 - seconds)}</b>
                <small>Thời gian học</small>
              </span>
              <span>
                <b>{demoCreditLabel(plan.credits)} CR</b>
                <small>Credit theo thời lượng</small>
              </span>
              <span>
                <b>{reviewSaved ? `${rating}/5` : "—"}</b>
                <small>
                  {reviewSaved
                    ? "Đánh giá đã lưu trong phòng"
                    : "Chưa lưu đánh giá"}
                </small>
              </span>
            </div>
            <p className="online-finished-note">
              Bạn có thể xem lại mục tiêu và đánh giá khi quay lại phiên này.
            </p>
            <div className="online-finished-actions">
              <button type="button" className="button primary" onClick={match}>
                <Shuffle size={16} /> Ghép phiên tiếp theo
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setReviewModal(true)}
              >
                <Star size={15} />
                {reviewSaved ? "Xem đánh giá" : "Đánh giá ngay"}
              </button>
              <button type="button" className="text-button" onClick={lobby}>
                Quay lại sảnh <ArrowRight size={15} />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      {phase === "lobby" && recentReviews.length > 0 && (
        <section className="workspace-section online-review-history">
          <div className="section-heading">
            <div>
              <h3>Những buổi học đã ghi lại</h3>
              <p>Đánh giá gần đây của bạn trên thiết bị này.</p>
            </div>
          </div>
          <div>
            {recentReviews.slice(0, 3).map((review) => (
              <article key={review.id}>
                <b>{ONLINE_TOPICS[review.topicIndex].label}</b>
                <span>
                  <Star size={13} /> {review.rating}/5
                </span>
                {review.comment && <p>{review.comment}</p>}
                <small>
                  {new Date(review.finishedAt).toLocaleDateString("vi-VN")}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
      {goalModal && (
        <Modal
          title="Ghim Hợp Đồng 3 Mục Tiêu"
          subtitle="Chốt 3 mục tiêu cụ thể cho buổi học."
          onClose={() => setGoalModal(false)}
        >
          <form className="form" onSubmit={pinGoals}>
            {[1, 2, 3].map((number, index) => (
              <label key={number}>
                Mục tiêu 0{number}
                <input
                  name={`goal${number}`}
                  defaultValue={goals[index] ?? ""}
                  minLength={3}
                  maxLength={300}
                  required
                />
              </label>
            ))}
            {goalError && (
              <p className="form-error" role="alert">
                {goalError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setGoalModal(false)}
              >
                Để sau
              </button>
              <button className="button primary">
                <Pin size={15} /> Ghim 3 mục tiêu
              </button>
            </div>
          </form>
        </Modal>
      )}
      {reviewModal && (
        <Modal
          title="Bạn thấy phiên học thế nào?"
          subtitle="Góp ý của bạn được lưu cùng phiên trên thiết bị này."
          onClose={() => setReviewModal(false)}
        >
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              setReviewSaved(true);
              setReviewModal(false);
            }}
          >
            <div
              className="online-rating"
              role="group"
              aria-label="Đánh giá từ 1 đến 5 sao"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} sao`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  <Star
                    size={33}
                    fill={value <= rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <p className="online-rating-label">
              {rating}/5 ·{" "}
              {rating >= 4 ? "Một kết nối đáng nhớ" : "Cảm ơn góp ý của bạn"}
            </p>
            <label>
              Góp ý cho buổi học
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Điều gì giúp buổi học sau tốt hơn?"
              />
            </label>
            <div className="form-actions">
              <button className="button primary">
                <Check size={15} /> Lưu đánh giá
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
