// [BETA & LƯU TRẠNG THÁI]: Kiểm tra resume/receipt/history theo owner và lỗi storage, không mở media hoặc gửi tin nhắn tới người thật.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const modules = new Map();
function loadModule(name) {
  if (modules.has(name)) return modules.get(name);
  const code = ts.transpileModule(
    fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  const context = {
    exports: {},
    require: (path) => loadModule(path.replace("./", "")),
    Date,
    Map,
    Set,
  };
  vm.runInNewContext(code, context);
  modules.set(name, context.exports);
  return context.exports;
}
const model = loadModule("online-session"),
  view = loadModule("workspace-view");
const now = 1_900_000_000_000;
const owner = { id: "owner", email: "owner@uni.edu.vn", is_verified: true };
const partner = {
  id: "partner",
  email: "partner@uni.edu.vn",
  is_verified: true,
};
const users = [owner, partner];
const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
};
const message = (id, from, text, replyTo) => ({
  id,
  from,
  text,
  createdAt: now,
  delivery: "saving",
  ...(replyTo ? { replyTo } : {}),
});
const room = {
  phase: "room",
  topicIndex: 2,
  role: "learn",
  planIndex: 1,
  partnerId: partner.id,
  muted: true,
  camera: false,
  previewVisible: false,
  deadline: now + 1800000,
  seconds: 1800,
  messages: [
    message(1, "self", "Xin chào"),
    message(2, "partner", "Chào bạn", 1),
    message(3, "self", "Mình cần review React"),
  ],
  draft: "Mình muốn gửi tiếp",
  goals: ["Đọc luồng code", "Sửa ví dụ nhỏ", "Chốt cải tiến"],
  pinned: true,
  rating: 4,
  reviewSaved: false,
  reviewComment: "Một buổi học hữu ích",
};
assert.equal(model.readOnlineRoom(owner.id, users, storage, now), null);
assert.equal(model.saveOnlineRoom(owner.id, room, storage, now), true);
const restored = model.readOnlineRoom(owner.id, users, storage, now + 1000);
assert.equal(restored.phase, "room");
assert.equal(restored.deadline, room.deadline);
assert.equal(restored.camera, false);
assert.equal(restored.muted, true);
assert.equal(restored.previewVisible, false);
assert.equal(restored.draft, room.draft);
assert.equal(restored.goals[1], room.goals[1]);
assert.equal(restored.messages[0].delivery, "saved");
assert.equal(model.readOnlineRoom("other-owner", users, storage, now), null);
assert.equal(model.readOnlineRoom(owner.id, [owner], storage, now), null);
assert.equal(
  model.readOnlineRoom(
    owner.id,
    [owner, { ...partner, is_verified: false }],
    storage,
    now,
  ),
  null,
);
assert.equal(
  model.readOnlineRoom(owner.id, users, storage, now + 8 * 86400000),
  null,
);
const pending = model.pendingOnlineReplies(restored.messages, 2, room.goals);
assert.equal(pending.length, 1);
assert.equal(pending[0].replyTo, 3);
assert.match(pending[0].text, /React|state|request/);
assert.match(
  model.onlineReply("Mình chưa hiểu", 2, room.goals, 1),
  /Đọc luồng code/,
);
assert.match(
  model.onlineReply("Không nghe thấy micro", 0, [], 1),
  /chưa truyền âm thanh/,
);
assert.match(model.onlineReply("Cảm ơn bạn", 0, [], 1), /hữu ích/);
assert.notEqual(
  model.onlineReply("Cùng luyện nào", 0, [], 0),
  model.onlineReply("Cùng luyện nào", 2, [], 0),
);
assert.equal(model.onlineTypingDelay("hi"), 850);
assert.equal(model.onlineTypingDelay("a".repeat(500)), 2300);
const finished = { ...room, phase: "finished", reviewSaved: true };
model.saveOnlineRoom(owner.id, finished, storage, now);
model.saveOnlineRoom(owner.id, { ...finished, rating: 5 }, storage, now + 2000);
assert.equal(model.readOnlineReviews(owner.id, storage).length, 1);
assert.equal(model.readOnlineReviews(owner.id, storage)[0].rating, 5);
model.saveOnlineRoom(
  owner.id,
  { ...room, phase: "lobby", partnerId: null, messages: [] },
  storage,
  now + 3000,
);
assert.equal(
  model.readOnlineReviews(owner.id, storage).length,
  1,
  "Leaving the room retains the submitted review",
);
assert.equal(model.readOnlineReviews("another-owner", storage).length, 0);
model.saveOnlineRoom(owner.id, { ...room, phase: "matching" }, storage, now);
assert.equal(
  model.readOnlineRoom(owner.id, users, storage, now).phase,
  "lobby",
);
const key = [...data.keys()].find((item) => !item.endsWith(".reviews"));
const good = JSON.parse(data.get(key));
for (const changes of [
  { ownerId: "forged" },
  { topicIndex: 999 },
  { messages: [message(1, "self", "ok"), message(1, "partner", "duplicate")] },
  { draft: "a".repeat(501) },
  { rating: 8 },
  { pinned: true, goals: ["bad"] },
  { updatedAt: now + 120000 },
]) {
  data.set(key, JSON.stringify({ ...good, ...changes }));
  assert.equal(model.readOnlineRoom(owner.id, users, storage, now), null);
}
data.set(key, "{");
assert.equal(model.readOnlineRoom(owner.id, users, storage, now), null);
const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};
assert.equal(model.saveOnlineRoom(owner.id, room, blocked, now), false);
assert.equal(model.readOnlineRoom(owner.id, users, blocked, now), null);
view.writeWorkspaceView(
  owner.id,
  { tab: "discovery", channel: "online" },
  storage,
);
assert.equal(view.readWorkspaceView(owner.id, storage).channel, "online");
assert.equal(view.readWorkspaceView("another-owner", storage), null);
assert.doesNotThrow(() =>
  view.writeWorkspaceView(
    owner.id,
    { tab: "wallet", channel: "campus" },
    blocked,
  ),
);
console.log(
  "Online session checks passed: contextual replies, typing bounds, resume, per-user isolation, honest saved receipts, review history, invalid snapshots and blocked storage.",
);
