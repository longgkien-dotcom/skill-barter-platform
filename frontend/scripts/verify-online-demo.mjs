// [GIAO DIỆN HỌC ONLINE OMEGLE]: Kiểm tra model phòng mô phỏng bằng dữ liệu tổng hợp, không mở trình duyệt hoặc media.
// [HỆ THỐNG MÀU LUMINOUS NAVY]: Test độc lập CSS; chỉ kiểm tra quy tắc trạng thái và chọn hồ sơ.
// [KẾT NỐI API]: Không gọi network, không ghi dữ liệu backend và không cần database.
// [CẨN THẬN KHI SỬA]: Test các biên tự ghép/Next/deadline/hợp đồng; không coi test này là kiểm thử WebRTC hoặc thanh toán thật.
// [KIẾN TRÚC & THIẾT KẾ]: Dùng TypeScript đã cài để nạp model thuần trong VM, không bổ sung dependency test.
// [ĐIỂM MỞ RỘNG]: Bổ sung kiểm thử queue và server-authoritative timer khi backend có online contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(
  new URL("../src/lib/online-demo.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context, { filename: "online-demo.js" });
const model = context.exports;
const profile = (id, email, is_verified = true) => ({
  id,
  full_name: id,
  email,
  is_verified,
  trust_score: 4.9,
  standard_balance: 5,
  premium_balance: 0,
  avatar_url: null,
});
const roster = [
  profile("self", "self@uni.edu.vn"),
  profile("a", "a@uni.edu.vn"),
  profile("b", "b@UNI.EDU.VN"),
  profile("unverified", "c@uni.edu.vn", false),
  profile("external", "d@example.com"),
];
const pool = model.eligibleDemoPartners(roster, "self");
assert.deepEqual(
  pool.map((person) => person.id),
  ["a", "b"],
);
assert.equal(model.pickDemoPartner(pool, "a", () => 0).id, "b");
assert.equal(model.pickDemoPartner([pool[0]], "a", () => 0.99).id, "a");
assert.equal(model.pickDemoPartner([], null), null);
assert.equal(model.pickDemoPartner(pool, null, () => 1).id, "b");
assert.equal(model.remainingSeconds(61000, 1000), 60);
assert.equal(model.remainingSeconds(61000, 1001), 60);
assert.equal(model.remainingSeconds(61000, 61001), 0);
assert.equal(model.formatCountdown(900), "15:00");
assert.equal(model.formatCountdown(-1), "00:00");
assert.equal(model.formatCountdown(NaN), "00:00");
assert.equal(model.validOnlineGoals(["Học một", "Luyện hai", "Ôn ba"]), true);
assert.equal(model.validOnlineGoals(["   ", "Luyện hai", "Ôn ba"]), false);
assert.equal(model.validOnlineGoals(["Học một", "Luyện hai"]), false);
assert.equal(
  model.validOnlineGoals(["a".repeat(301), "Luyện hai", "Ôn ba"]),
  false,
);
assert.equal(
  model.ONLINE_PLANS.every(
    (plan) => Number.isInteger(plan.credits * 4) && plan.credits > 0,
  ),
  true,
);
console.log(
  "Online demo checks passed: eligible partners, Next fallback, deadline, countdown, three-goal validation and quarter-credit demo plans.",
);
