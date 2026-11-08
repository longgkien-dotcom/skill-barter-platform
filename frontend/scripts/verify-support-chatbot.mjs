// [TRỢ LÝ CHATBOT 24/7]: Kiểm tra rule tiếng Việt/không dấu, shortcut và ticket local bằng dữ liệu tổng hợp; không gọi API hay gửi Admin.
// [BỘ CÂU HỎI & TRẢ LỜI TỰ ĐỘNG]: Tình huống phân biệt Credit/Trust, QR/checkout, lỗi phức tạp và từ khóa không khớp tránh trả lời sai quy tắc.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function loadSource(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const context = { exports: {}, require: () => ({}), Date, Map };
  vm.runInNewContext(compiled, context, { filename: path });
  return context.exports;
}
const bot = loadSource("../src/components/SupportChatbot.tsx");
const tickets = loadSource("../src/lib/support-tickets.ts");
const user = {
  id: "student-one",
  full_name: "Sinh viên kiểm thử",
  email: "test@uni.edu.vn",
  standard_balance: 4,
  premium_balance: 2,
  trust_score: 3.8,
  is_verified: true,
};
for (const [question, expected] of [
  ["Làm sao nhận +1 Credit khởi đầu?", "bonus"],
  ["xac minh email edu.vn", "bonus"],
  ["Cách quét mã QR tại Safe Zone?", "qr"],
  ["checkin o diem hen", "qr"],
  ["Nghiệm thu ảnh & mở khóa Escrow thế nào?", "proof"],
  ["checkout proof", "proof"],
  ["Bị bùng lịch hoặc muốn khiếu nại Tòa án?", "dispute"],
  ["Tôi có được bỏ phiếu không?", "dispute"],
  ["Cách ghép đôi học Online 1-on-1?", "online"],
  ["Liên hệ Admin / Báo lỗi khẩn cấp", "admin"],
  ["Credit bị mất sau buổi học", "admin"],
  ["gioi han 20 credit", "credits"],
  ["80% cũ + 20% mới có nghĩa gì?", "trust"],
  ["Trust Score", "trust"],
  ["Đổi quà voucher bằng Premium", "voucher"],
  ["đăng kỹ năng OFFER", "skills"],
  ["Đăng xuất tài khoản", "login"],
  ["nhanh", "fallback"],
  ["", "fallback"],
  ["một vấn đề rất phức tạp chưa biết nguyên nhân", "fallback"],
])
  assert.equal(bot.matchSupportIntent(question), expected, question);
assert.equal(
  bot.normalizeSupportQuestion("Điểm TÍN CẬY .edu.vn"),
  "diem tin cay edu vn",
);
assert.match(
  bot.supportGreeting(user),
  /4 Standard Credit, 2 Premium Credit.*3.8/,
);
assert.match(bot.supportGreeting(), /đăng nhập/);
assert.match(bot.supportAnswer("bonus", user).text, /đã xác minh/);
assert.match(bot.supportAnswer("bonus").text, /7 ngày/);
assert.match(bot.supportAnswer("proof").text, /Chỉ người dạy/);
assert.match(bot.supportAnswer("credits").text, /90 ngày/);
assert.match(bot.supportAnswer("trust").text, /80%.*20%/);
assert.match(bot.supportAnswer("dispute").text, /Trust ≥ 4.5.*một phiếu/);
assert.match(bot.supportAnswer("dispute").text, /3 phiếu/);
assert.match(
  bot.supportAnswer("online").text,
  /không truyền video\/audio thật/,
);
assert.equal(bot.supportAnswer("online").actions[0].destination, "online");
assert.match(bot.supportAnswer("voucher").text, /chưa phát hành mã voucher/);
assert.match(bot.supportAnswer("admin").text, /chưa gửi Admin/);
for (const suggestion of bot.SUPPORT_SUGGESTIONS)
  assert.equal(bot.matchSupportIntent(suggestion.label), suggestion.intent);
const validDestinations = new Set([
  "discovery",
  "sessions",
  "tribunal",
  "wallet",
  "online",
]);
for (const intent of [
  "bonus",
  "qr",
  "proof",
  "dispute",
  "online",
  "credits",
  "trust",
  "voucher",
  "skills",
  "login",
  "fallback",
])
  for (const action of bot.supportAnswer(intent, user).actions)
    assert.ok(action.ticket || validDestinations.has(action.destination));
const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
};
const issue = "Tôi gặp lỗi khi mở phiên, xin hướng dẫn kiểm tra lại.";
assert.ok(tickets.validateSupportIssue("ngắn"));
assert.ok(tickets.validateSupportIssue("a".repeat(2001)));
assert.equal(tickets.validateSupportIssue(issue), "");
assert.throws(() =>
  tickets.createSupportDraft(user, "ngắn", "", "SB-TEST-1", Date.now()),
);
const draft = tickets.createSupportDraft(
  user,
  `  ${issue}  `,
  "session-123",
  "SB-TEST-12345",
  1_800_000_000_000,
);
assert.equal(draft.message, issue);
assert.equal(draft.delivery, "local-only");
assert.equal(tickets.saveSupportDraft(draft, storage), true);
assert.equal(tickets.readSupportDrafts(user.id, storage)[0].email, user.email);
assert.equal(tickets.readSupportDrafts("another-user", storage).length, 0);
assert.match(tickets.supportDraftText(draft), /CHƯA GỬI ADMIN/);
for (let index = 0; index < 25; index++)
  tickets.saveSupportDraft(
    { ...draft, id: `SB-TEST-${10000 + index}` },
    storage,
  );
assert.equal(tickets.readSupportDrafts(user.id, storage).length, 20);
const corrupt = { getItem: () => "{", setItem: () => {} };
assert.equal(tickets.readSupportDrafts(user.id, corrupt).length, 0);
const forged = {
  getItem: () =>
    JSON.stringify([
      { ...draft, ownerId: "another-user" },
      { ...draft, delivery: "sent" },
    ]),
};
assert.equal(tickets.readSupportDrafts(user.id, forged).length, 0);
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};
assert.equal(tickets.readSupportDrafts(user.id, blocked).length, 0);
assert.equal(tickets.saveSupportDraft(draft, blocked), false);
console.log(
  "Support checks passed: Vietnamese/unaccented intents, backend rules, tab shortcuts, personalized greeting, local draft isolation, bounds and storage failures.",
);
