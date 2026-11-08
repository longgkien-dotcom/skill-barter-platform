import type { User } from "./types";
import {
  eligibleDemoPartners,
  ONLINE_PLANS,
  ONLINE_TOPICS,
  validOnlineGoals,
  type OnlineRole,
} from "./online-demo";

// [BETA & LƯU TRẠNG THÁI]: Journal riêng từng user lưu phòng, bản nháp chat, media, mục tiêu và đánh giá trên thiết bị; không thay Session/ledger backend.
// [TRÒ CHUYỆN TƯƠNG TÁC]: Phản hồi tự động theo chủ đề/ý định; receipt chỉ xác nhận lưu cục bộ, không giả người thật đã nhận hoặc đọc.
// [CẨN THẬN KHI SỬA]: Kiểm tra owner, roster, thời hạn, ID và độ dài trước khi restore. Không tin số dư/Trust trong localStorage.
// [ĐIỂM MỞ RỘNG]: Thay journal bằng chat/signaling service có xác thực; chỉ thêm receipt delivered/read sau xác nhận thực từ dịch vụ.
export type OnlinePhase = "lobby" | "matching" | "room" | "finished";
export interface OnlineMessage {
  id: number;
  from: "self" | "partner" | "system";
  text: string;
  createdAt: number;
  delivery: "saving" | "saved" | "failed";
  replyTo?: number;
}
export interface OnlineRoomState {
  phase: OnlinePhase;
  topicIndex: number;
  role: OnlineRole;
  planIndex: number;
  partnerId: string | null;
  muted: boolean;
  camera: boolean;
  previewVisible: boolean;
  deadline: number;
  seconds: number;
  messages: OnlineMessage[];
  draft: string;
  goals: string[];
  pinned: boolean;
  rating: number;
  reviewSaved: boolean;
  reviewComment: string;
}
export interface PendingOnlineReply {
  replyTo?: number;
  text: string;
}
export interface OnlineReviewRecord {
  id: string;
  topicIndex: number;
  partnerId: string;
  rating: number;
  comment: string;
  finishedAt: number;
}
type RoomStorage = Pick<Storage, "getItem" | "setItem">;
const keyFor = (ownerId: string) => `skillbarter.online-room.v1.${ownerId}`;
export function readOnlineReviews(
  ownerId: string,
  storage = browserStorage(),
): OnlineReviewRecord[] {
  try {
    const value = JSON.parse(
      storage?.getItem(`${keyFor(ownerId)}.reviews`) ?? "null",
    );
    if (!value || value.ownerId !== ownerId || !Array.isArray(value.items))
      return [];
    return value.items
      .filter(
        (item: OnlineReviewRecord) =>
          item &&
          typeof item.id === "string" &&
          item.id.length <= 150 &&
          Number.isInteger(item.topicIndex) &&
          !!ONLINE_TOPICS[item.topicIndex] &&
          typeof item.partnerId === "string" &&
          Number.isInteger(item.rating) &&
          item.rating >= 1 &&
          item.rating <= 5 &&
          typeof item.comment === "string" &&
          item.comment.length <= 1000 &&
          Number.isFinite(item.finishedAt),
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}
function browserStorage(): RoomStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
export function readOnlineRoom(
  ownerId: string,
  users: User[],
  storage = browserStorage(),
  now = Date.now(),
): OnlineRoomState | null {
  try {
    const value = JSON.parse(storage?.getItem(keyFor(ownerId)) ?? "null");
    if (
      !value ||
      value.version !== 1 ||
      value.ownerId !== ownerId ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt > now + 60000 ||
      now - value.updatedAt > 7 * 86400000
    )
      return null;
    if (
      !["lobby", "room", "finished"].includes(value.phase) ||
      !Number.isInteger(value.topicIndex) ||
      !ONLINE_TOPICS[value.topicIndex] ||
      !["learn", "teach", "exchange"].includes(value.role) ||
      !Number.isInteger(value.planIndex) ||
      !ONLINE_PLANS[value.planIndex]
    )
      return null;
    if (
      !["muted", "camera", "previewVisible", "pinned", "reviewSaved"].every(
        (key) => typeof value[key] === "boolean",
      ) ||
      !Number.isInteger(value.rating) ||
      value.rating < 1 ||
      value.rating > 5 ||
      typeof value.reviewComment !== "string" ||
      value.reviewComment.length > 1000 ||
      typeof value.draft !== "string" ||
      value.draft.length > 500
    )
      return null;
    if (
      !Number.isFinite(value.deadline) ||
      value.deadline < 0 ||
      value.deadline > now + 86400000 ||
      !Number.isInteger(value.seconds) ||
      value.seconds < 0 ||
      value.seconds > 2700
    )
      return null;
    if (
      !Array.isArray(value.goals) ||
      value.goals.length > 3 ||
      value.goals.some(
        (goal: unknown) => typeof goal !== "string" || goal.length > 300,
      ) ||
      (value.pinned && !validOnlineGoals(value.goals))
    )
      return null;
    if (!Array.isArray(value.messages) || value.messages.length > 80)
      return null;
    const ids = new Set<number>();
    for (const message of value.messages) {
      if (
        !message ||
        !Number.isSafeInteger(message.id) ||
        message.id <= 0 ||
        ids.has(message.id) ||
        !["self", "partner", "system"].includes(message.from) ||
        typeof message.text !== "string" ||
        !message.text.trim() ||
        message.text.length > 1200 ||
        !Number.isFinite(message.createdAt) ||
        message.createdAt < 0 ||
        message.createdAt > now + 60000 ||
        !["saving", "saved", "failed"].includes(message.delivery) ||
        (message.replyTo !== undefined &&
          (!Number.isSafeInteger(message.replyTo) || message.replyTo <= 0))
      )
        return null;
      ids.add(message.id);
    }
    const partner = eligibleDemoPartners(users, ownerId).find(
      (person) => person.id === value.partnerId,
    );
    if (value.phase !== "lobby" && !partner) return null;
    return {
      phase: value.phase,
      topicIndex: value.topicIndex,
      role: value.role,
      planIndex: value.role === "exchange" ? 1 : value.planIndex,
      partnerId: partner?.id ?? null,
      muted: value.muted,
      camera: value.camera,
      previewVisible: value.previewVisible,
      deadline: value.deadline,
      seconds: value.seconds,
      messages: value.messages.map((message: OnlineMessage) => ({
        id: message.id,
        from: message.from,
        text: message.text,
        createdAt: message.createdAt,
        delivery: "saved",
        ...(message.replyTo === undefined ? {} : { replyTo: message.replyTo }),
      })),
      draft: value.draft,
      goals: [...value.goals],
      pinned: value.pinned,
      rating: value.rating,
      reviewSaved: value.reviewSaved,
      reviewComment: value.reviewComment,
    };
  } catch {
    return null;
  }
}
export function saveOnlineRoom(
  ownerId: string,
  room: OnlineRoomState,
  storage = browserStorage(),
  now = Date.now(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(
      keyFor(ownerId),
      JSON.stringify({
        ...room,
        phase: room.phase === "matching" ? "lobby" : room.phase,
        messages: room.messages
          .slice(-80)
          .map((message) => ({ ...message, delivery: "saved" })),
        version: 1,
        ownerId,
        updatedAt: now,
      }),
    );
    if (room.phase === "finished" && room.reviewSaved && room.partnerId) {
      const items = readOnlineReviews(ownerId, storage);
      const id = `${ownerId}:${room.deadline}`;
      const previous = items.find((item) => item.id === id);
      storage.setItem(
        `${keyFor(ownerId)}.reviews`,
        JSON.stringify({
          ownerId,
          items: [
            {
              id,
              topicIndex: room.topicIndex,
              partnerId: room.partnerId,
              rating: room.rating,
              comment: room.reviewComment,
              finishedAt: previous?.finishedAt ?? now,
            },
            ...items.filter((item) => item.id !== id),
          ].slice(0, 20),
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}
const normalize = (value: string) =>
  value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d");
export function onlineReply(
  text: string,
  topicIndex: number,
  goals: string[],
  turn: number,
): string {
  const question = normalize(text),
    topic = ONLINE_TOPICS[topicIndex] ?? ONLINE_TOPICS[0];
  const goal = goals[0]?.trim() || topic.goals[0];
  if (/camera|micro|nghe thay|am thanh|video|mic\b/.test(question))
    return "Online Beta hiện trao đổi bằng tin nhắn với đối tác tự động, chưa truyền âm thanh hoặc video. Bạn gửi phần muốn luyện vào chat nhé; nút camera và micro lưu lựa chọn giao diện của bạn.";
  if (/muc tieu|hop dong|bat dau tu dau/.test(question))
    return `Mình đề xuất bắt đầu với “${goal}”. Bạn muốn giữ mục tiêu này hay chỉnh lại trước khi thực hành?`;
  if (/cam on|thank|hay qua|tuyet/.test(question))
    return turn % 2
      ? "Rất vui vì phần đó hữu ích! Bạn muốn thử thêm một ví dụ hay chuyển sang mục tiêu tiếp theo?"
      : "Cảm ơn bạn! Mình cùng chốt một điều vừa học được rồi thử áp dụng nhé.";
  if (/tam biet|ket thuc|bye|hen gap/.test(question))
    return "Cảm ơn bạn đã cùng luyện tập! Bạn có thể bấm Kết thúc phiên để lưu buổi học và để lại đánh giá.";
  if (/chua hieu|khong hieu|kho qua|cham lai|giai thich/.test(question))
    return `Mình chia nhỏ nhé: trước hết, bạn nói rõ phần đang vướng trong “${goal}”. Mình sẽ gợi ý một bước ngắn, rồi bạn thử lại bằng lời của mình.`;
  if (/xin chao|\bhello\b|\bhi\b|chao ban/.test(question))
    return `Chào bạn! Hôm nay mình cùng luyện ${topic.label.toLocaleLowerCase("vi")}. Bạn đã học tới đâu và muốn cải thiện điều gì nhất?`;
  const responses: Record<string, string[]> = {
    english: [
      "Ta thử một phần giới thiệu ngắn nhé: ‘I’m a student. I’m learning English to communicate more confidently.’ Bạn viết tiếp 2 câu về mục tiêu của mình được không?",
      "Mình cùng luyện một tình huống cụ thể nhé. Bạn muốn giới thiệu bản thân, hỏi đường hay trao đổi trong lớp? Gửi một câu tiếng Anh để bắt đầu.",
    ],
    chinese: [
      "Mình đề xuất luyện từng cụm ngắn trước. Bạn gửi pinyin hoặc câu HSK đang học, rồi đánh dấu âm hay thanh điệu khiến bạn thấy khó nhé.",
      "Bạn đang luyện bài HSK nào? Chọn một câu ngắn, ghi pinyin và cách bạn phân biệt thanh điệu; mình cùng chia thành từng phần để ôn.",
    ],
    code: [
      "Bạn gửi đoạn React/NestJS đang vướng cùng kết quả mong đợi nhé. Ta lần lượt kiểm tra đầu vào, luồng xử lý và đầu ra trước khi sửa code.",
      "Ta thử khoanh vùng vấn đề: state hoặc request nào thay đổi, đoạn nào chạy lại, và kết quả thực tế là gì? Một ví dụ nhỏ sẽ giúp buổi review rõ hơn.",
    ],
    rubik: [
      "Bạn đang vướng ở F2L, OLL hay PLL? Chọn một bước và mô tả tình huống hiện tại; ta tập trung vào nhận diện trước khi luyện tốc độ.",
      "Mình đề xuất luyện chậm một nhóm tình huống CFOP. Bạn đang dùng công thức nào và bước nào khiến bạn phải dừng lại để suy nghĩ?",
    ],
    music: [
      "Bạn chọn hai hợp âm đang tập nhé. Ta bắt đầu bằng chuyển hợp âm chậm, đếm nhịp đều và ghi lại chỗ hay bị ngắt.",
      "Bạn muốn luyện guitar hay nhạc lý trước? Gửi tên hợp âm, nhịp hoặc đoạn nhạc ngắn để mình cùng đặt một bài luyện vừa sức.",
    ],
    math: [
      "Bạn gửi đề bài và bước giải đang vướng nhé. Ta xác định giả thiết, khái niệm cần dùng rồi mới đi vào phép tính.",
      "Ta bắt đầu bằng một ví dụ nhỏ: đạo hàm của x² là 2x. Bạn đang học đạo hàm, tích phân hay phần khác để mình chọn câu hỏi phù hợp?",
    ],
  };
  return responses[topic.id][turn % 2];
}
export const onlineTypingDelay = (text: string) =>
  Math.min(2300, Math.max(850, text.length * 15));
export function pendingOnlineReplies(
  messages: OnlineMessage[],
  topicIndex: number,
  goals: string[],
): PendingOnlineReply[] {
  const replied = new Set(
    messages
      .filter((message) => message.from === "partner")
      .map((message) => message.replyTo),
  );
  let turn = 0;
  const pending: PendingOnlineReply[] = [];
  for (const message of messages) {
    if (message.from !== "self") continue;
    turn++;
    if (!replied.has(message.id))
      pending.push({
        replyTo: message.id,
        text: onlineReply(message.text, topicIndex, goals, turn),
      });
  }
  return pending;
}
