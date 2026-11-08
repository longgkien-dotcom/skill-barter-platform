// [KIỂM THỬ CLOUD]: Chạy cùng API facade với storage riêng; không ghi database, không gọi thanh toán.
// [CẨN THẬN KHI SỬA]: Kiểm tra cả lỗi nghiệp vụ và mất response để không bao giờ replay credit sang nguồn khác.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

function loadModules(extra = {}) {
  const cache = new Map();
  const context = vm.createContext({
    URL,
    URLSearchParams,
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
    crypto: webcrypto,
    process: { env: {} },
    ...extra,
  });
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const filename = new URL(`../src/lib/${name}.ts`, import.meta.url);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const compiledModule = { exports: {} };
    cache.set(name, compiledModule.exports);
    const run = vm.runInContext(
      `(function(require,module,exports){${compiled}\n})`,
      context,
      { filename: filename.pathname },
    );
    run(
      (path) => load(path.replace(/^\.\//, "")),
      compiledModule,
      compiledModule.exports,
    );
    return compiledModule.exports;
  }
  return load;
}
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
let time = Date.parse("2026-11-10T08:00:00Z");
const load = loadModules();
const { createDemoApi, DEMO_STORAGE_KEY } = load("demo-api");
const { createApiTransport } = load("api-transport");
const engine = createDemoApi({ storage: () => storage, now: () => time });
const get = (path) => engine.request(path);
const post = (path, body) => engine.request(path, "POST", body);
const error = (work) => assert.rejects(work);
const user = (id) => get(`/users/${id}`);
const balance = async (id) => {
  const u = await user(id);
  return u.standard_balance + u.premium_balance;
};
const initial = await engine.snapshot();
assert.equal(initial.users.length, 7);
assert.ok(initial.skills.length >= 8 && initial.zones.length >= 3);
assert.ok(initial.sessions.some((s) => s.status === "IN_PROGRESS"));
assert.ok(initial.disputes.some((d) => d.status === "PENDING"));
assert.ok(initial.zones.every((z) => !("qr_code_hash" in z)));
const [duy, chi, an, binh, ha, linh, khue] = initial.users;
// Response objects must not mutate stored balances by reference.
initial.users[0].standard_balance = 999;
assert.equal((await user(duy.id)).standard_balance, 4);
const seedNoShow = initial.sessions.find(
  (s) =>
    s.student_id === duy.id &&
    Date.parse(s.scheduled_start) < time &&
    s.status === "ESCROWED",
);
const oldTrust = (await user(chi.id)).trust_score;
await error(() =>
  post(`/sessions/${seedNoShow.id}/no-show`, { user_id: chi.id }),
);
await post(`/sessions/${seedNoShow.id}/no-show`, { user_id: duy.id });
assert.equal((await user(duy.id)).standard_balance, 5);
assert.equal(
  (await user(chi.id)).trust_score,
  Number((oldTrust - 0.2).toFixed(2)),
);
await post(`/users/${khue.id}/verify-email`);
assert.equal((await user(khue.id)).standard_balance, 1);
await error(() => post(`/users/${khue.id}/verify-email`));
const created = await post("/users", {
  full_name: "Sinh viên Cloud",
  email: "CLOUD@test.edu.vn",
});
assert.equal(created.email, "cloud@test.edu.vn");
assert.equal(created.standard_balance, 0);
await error(() =>
  post("/users", { full_name: "Trùng email", email: "cloud@TEST.edu.vn" }),
);
await post(`/users/${created.id}/verify-email`);
await post(`/users/${created.id}/top-up`, { amount: 12 });
await error(() => post(`/users/${created.id}/top-up`, { amount: -1 }));
assert.equal(await balance(created.id), 13);
const outsider = await post("/users", {
  full_name: "Ngoài trường",
  email: "outside@example.com",
});
await error(() => post(`/users/${outsider.id}/verify-email`));
const skill = await post("/skills", {
  user_id: an.id,
  skill_type: "OFFER",
  category: "Lập trình",
  title: "TypeScript thực hành",
  proficiency_level: "ADVANCED",
});
const need = await post("/skills", {
  user_id: created.id,
  skill_type: "NEED",
  category: "Ngoại ngữ",
  title: "Cần luyện tiếng Anh",
  proficiency_level: "BEGINNER",
});
assert.ok(
  (
    await get(
      "/skills?skill_type=OFFER&category=L%E1%BA%ADp%20tr%C3%ACnh&proficiency_level=ADVANCED",
    )
  ).some((s) => s.id === skill.id),
);
assert.ok(
  !(await get("/skills?skill_type=OFFER")).some((s) => s.id === need.id),
);
const zone = await post("/safe-zones", {
  name: "Phòng học Cloud",
  address: "Khu học tập sinh viên",
  latitude: 10.87,
  longitude: 106.8,
  qr_code_hash: "cloud-safe-zone-qr-123456",
});
assert.ok(!("qr_code_hash" in zone));
assert.equal(
  (await get(`/safe-zones/${zone.id}/qr`)).qr_code_hash,
  "cloud-safe-zone-qr-123456",
);
assert.ok(
  (
    await get("/safe-zones/nearby?latitude=10.87&longitude=106.8&radiusKm=1")
  ).some((z) => z.id === zone.id && z.distance_km === 0),
);
await error(() =>
  post("/safe-zones", {
    ...zone,
    latitude: 91,
    qr_code_hash: "invalid-cloud-qr-123456",
  }),
);
function booking(overrides = {}) {
  return {
    student_id: created.id,
    skill_id: skill.id,
    safe_zone_id: zone.id,
    cost_credits: 2,
    scheduled_start: new Date(time + 3600000).toISOString(),
    scheduled_end: new Date(time + 10800000).toISOString(),
    micro_contract: {
      milestones: [
        "Ôn lại kiến thức nền",
        "Luyện tập có hướng dẫn",
        "Tổng kết kết quả học",
      ],
    },
    ...overrides,
  };
}
async function unchanged(work) {
  const before = values.get(DEMO_STORAGE_KEY);
  await error(work);
  assert.equal(
    values.get(DEMO_STORAGE_KEY),
    before,
    "Failed mutations must not write partial state",
  );
}
await unchanged(() => post("/sessions", booking({ student_id: outsider.id })));
await unchanged(() => post("/sessions", booking({ student_id: an.id })));
await unchanged(() => post("/sessions", booking({ skill_id: need.id })));
await unchanged(() => post("/sessions", booking({ cost_credits: 500 })));
await unchanged(() =>
  post("/sessions", booking({ micro_contract: { milestones: ["Only one"] } })),
);
await unchanged(() =>
  post(
    "/sessions",
    booking({ scheduled_start: new Date(time - 1000).toISOString() }),
  ),
);
const session = await post("/sessions", booking());
assert.equal(session.status, "ESCROWED");
assert.equal((await user(created.id)).standard_balance, 0);
assert.equal((await user(created.id)).premium_balance, 11);
let ledger = await get(`/users/${created.id}/transactions`);
assert.equal(
  ledger.filter(
    (t) => t.session_id === session.id && t.transaction_type === "ESCROW_LOCK",
  ).length,
  2,
);
await unchanged(() =>
  post(`/sessions/${session.id}/check-in`, {
    user_id: created.id,
    qr_code_hash: "wrong",
  }),
);
await unchanged(() =>
  post(`/sessions/${session.id}/check-in`, {
    user_id: binh.id,
    qr_code_hash: "cloud-safe-zone-qr-123456",
  }),
);
await post(`/sessions/${session.id}/check-in`, {
  user_id: created.id,
  qr_code_hash: "cloud-safe-zone-qr-123456",
});
await unchanged(() =>
  post(`/sessions/${session.id}/check-out`, {
    teacher_id: created.id,
    proof_image_url: "https://example.com/proof.jpg",
  }),
);
await unchanged(() =>
  post(`/sessions/${session.id}/check-out`, {
    teacher_id: an.id,
    proof_image_url: "javascript:alert(1)",
  }),
);
const teacherBefore = await balance(an.id);
await post(`/sessions/${session.id}/check-out`, {
  teacher_id: an.id,
  proof_image_url: "https://example.com/proof.jpg",
});
assert.equal(await balance(an.id), teacherBefore + 2);
await unchanged(() =>
  post(`/sessions/${session.id}/check-out`, {
    teacher_id: an.id,
    proof_image_url: "https://example.com/proof.jpg",
  }),
);
const review = {
  reviewer_id: created.id,
  reviewee_id: an.id,
  prep_score: 5,
  attitude_score: 4,
  knowledge_score: 3,
  comment: "Nội dung rõ ràng, có bài tập thực hành.",
};
const trustBefore = (await user(an.id)).trust_score;
await unchanged(() =>
  post(`/sessions/${session.id}/reviews`, { ...review, knowledge_score: 6 }),
);
await post(`/sessions/${session.id}/reviews`, review);
assert.equal(
  (await user(an.id)).trust_score,
  Number((trustBefore * 0.8 + 4 * 0.2).toFixed(2)),
);
await unchanged(() => post(`/sessions/${session.id}/reviews`, review));
await post(`/sessions/${session.id}/reviews`, {
  ...review,
  reviewer_id: an.id,
  reviewee_id: created.id,
});
// Cancel/refund respects original credit types; teacher cancellation changes Trust once.
const cancelSession = await post("/sessions", booking());
const beforeCancel = await balance(created.id);
const beforeCancelTrust = (await user(an.id)).trust_score;
await post(`/sessions/${cancelSession.id}/cancel`, { user_id: an.id });
assert.equal(await balance(created.id), beforeCancel + 2);
assert.equal(
  (await user(an.id)).trust_score,
  Number((beforeCancelTrust - 0.2).toFixed(2)),
);
await unchanged(() =>
  post(`/sessions/${cancelSession.id}/cancel`, { user_id: an.id }),
);
// Two outcomes of the tribunal, with all actor/Trust/duplicate guards.
async function tribunal(teacherWins) {
  const s = await post("/sessions", booking());
  const d = await post("/disputes", {
    session_id: s.id,
    complainant_id: created.id,
    reason: "Cần xem xét lại mục tiêu thực hành theo hợp đồng.",
  });
  await unchanged(() =>
    post(`/sessions/${s.id}/check-in`, {
      user_id: created.id,
      qr_code_hash: "cloud-safe-zone-qr-123456",
    }),
  );
  await unchanged(() =>
    post(`/disputes/${d.id}/votes`, { voter_id: an.id, choice: "TEACHER" }),
  );
  await unchanged(() =>
    post(`/disputes/${d.id}/votes`, { voter_id: duy.id, choice: "STUDENT" }),
  );
  const studentBefore = await balance(created.id),
    teacherBefore = await balance(an.id);
  const vote = teacherWins ? "TEACHER" : "STUDENT";
  await post(`/disputes/${d.id}/votes`, { voter_id: ha.id, choice: vote });
  await unchanged(() =>
    post(`/disputes/${d.id}/votes`, { voter_id: ha.id, choice: vote }),
  );
  await post(`/disputes/${d.id}/votes`, { voter_id: linh.id, choice: vote });
  const resolved = await post(`/disputes/${d.id}/votes`, {
    voter_id: chi.id,
    choice: teacherWins ? "STUDENT" : "TEACHER",
  });
  assert.equal(
    resolved.status,
    teacherWins ? "RESOLVED_TEACHER_WINS" : "RESOLVED_STUDENT_WINS",
  );
  assert.equal(
    resolved.session.status,
    teacherWins ? "COMPLETED" : "CANCELLED",
  );
  assert.equal(
    await balance(created.id),
    studentBefore + (teacherWins ? 0 : 2),
  );
  assert.equal(await balance(an.id), teacherBefore + (teacherWins ? 2 : 0));
  await unchanged(() =>
    post(`/disputes/${d.id}/votes`, { voter_id: binh.id, choice: vote }),
  );
}
await tribunal(false);
await tribunal(true);
const beforeRedeem = await balance(created.id);
await post(`/users/${created.id}/vouchers/redeem`, {
  amount: 1,
  credit_type: "PREMIUM",
});
assert.equal(await balance(created.id), beforeRedeem - 1);
await unchanged(() =>
  post(`/users/${created.id}/vouchers/redeem`, {
    amount: 999,
    credit_type: "PREMIUM",
  }),
);
// Reload persists all state; queued concurrent deductions cannot overdraw a wallet.
const reloaded = createDemoApi({ storage: () => storage, now: () => time });
assert.equal(
  (await reloaded.request(`/users/${created.id}`)).premium_balance,
  (await user(created.id)).premium_balance,
);
assert.equal(
  (await reloaded.snapshot()).disputes.length,
  (await engine.snapshot()).disputes.length,
);
const concurrent = await Promise.allSettled(
  Array.from({ length: 20 }, () =>
    post(`/users/${created.id}/vouchers/redeem`, {
      amount: 1,
      credit_type: "PREMIUM",
    }),
  ),
);
assert.ok(concurrent.some((r) => r.status === "rejected"));
assert.equal((await user(created.id)).premium_balance, 0);
// Private browsing/quota failures keep working in memory and honestly report persistence.
const blocked = createDemoApi({
  storage: () => {
    throw new Error("Storage denied");
  },
});
const blockedUser = (await blocked.snapshot()).users[0];
await blocked.request(`/users/${blockedUser.id}/top-up`, "POST", { amount: 3 });
assert.equal(
  (await blocked.request(`/users/${blockedUser.id}`)).premium_balance,
  blockedUser.premium_balance + 3,
);
assert.equal(blocked.isPersistent(), false);
const quotaValues = new Map();
let quotaFull = false;
const quotaStorage = {
  getItem: (k) => quotaValues.get(k) ?? null,
  setItem: (k, v) => {
    if (quotaFull) throw new Error("Quota exceeded");
    quotaValues.set(k, v);
  },
};
const quota = createDemoApi({ storage: () => quotaStorage });
const quotaUser = (await quota.snapshot()).users[0];
quotaFull = true;
await quota.request(`/users/${quotaUser.id}/top-up`, "POST", { amount: 7 });
assert.equal(
  (await quota.request(`/users/${quotaUser.id}`)).premium_balance,
  7,
);
assert.equal(
  quota.isPersistent(),
  false,
  "Failed writes must latch memory mode instead of reloading stale storage",
);
const corruptValues = new Map([[DEMO_STORAGE_KEY, "{broken-json"]]);
const corrupt = createDemoApi({
  storage: () => ({
    getItem: (k) => corruptValues.get(k) ?? null,
    setItem: (k, v) => corruptValues.set(k, v),
  }),
});
assert.equal((await corrupt.snapshot()).users.length, 7);
assert.doesNotThrow(() => JSON.parse(corruptValues.get(DEMO_STORAGE_KEY)));
const aborted = new AbortController();
aborted.abort();
await assert.rejects(() =>
  engine.request("/users", "GET", undefined, aborted.signal),
);

// Standard cap/overflow and expiry metadata remain consistent with NestJS wallet rules.
const capValues = new Map();
const capStorage = {
  getItem: (k) => capValues.get(k) ?? null,
  setItem: (k, v) => capValues.set(k, v),
};
const capEngine = createDemoApi({ storage: () => capStorage, now: () => time });
const capSnapshot = await capEngine.snapshot();
const capStudent = capSnapshot.users[0],
  capTeacher = capSnapshot.users[2];
await capEngine.request(`/users/${capStudent.id}/top-up`, "POST", {
  amount: 30,
});
const capSkill = capSnapshot.skills.find(
  (s) => s.user_id === capTeacher.id && s.skill_type === "OFFER",
);
const capSession = await capEngine.request(
  "/sessions",
  "POST",
  booking({
    student_id: capStudent.id,
    skill_id: capSkill.id,
    safe_zone_id: capSnapshot.zones[0].id,
    cost_credits: 12,
  }),
);
const capQr = await capEngine.request(
  `/safe-zones/${capSnapshot.zones[0].id}/qr`,
);
await capEngine.request(`/sessions/${capSession.id}/check-in`, "POST", {
  user_id: capStudent.id,
  qr_code_hash: capQr.qr_code_hash,
});
await capEngine.request(`/sessions/${capSession.id}/check-out`, "POST", {
  teacher_id: capTeacher.id,
  proof_image_url: "https://example.com/proof.jpg",
});
const capped = await capEngine.request(`/users/${capTeacher.id}`);
assert.equal(capped.standard_balance, 20);
assert.equal(capped.premium_balance, capTeacher.premium_balance + 4);
const payoutLedger = await capEngine.request(
  `/users/${capTeacher.id}/transactions`,
);
assert.equal(
  payoutLedger.find(
    (t) => t.session_id === capSession.id && t.credit_type === "STANDARD",
  ).expires_at,
  new Date(time + 90 * 86400000).toISOString(),
);
const grace = await capEngine.request(
  "/sessions",
  "POST",
  booking({
    student_id: capStudent.id,
    skill_id: capSkill.id,
    safe_zone_id: capSnapshot.zones[0].id,
    cost_credits: 1,
  }),
);
await assert.rejects(() =>
  capEngine.request(`/sessions/${grace.id}/no-show`, "POST", {
    user_id: capStudent.id,
  }),
);
time += 2 * 3600000;
await capEngine.request(`/sessions/${grace.id}/no-show`, "POST", {
  user_id: capStudent.id,
});
assert.equal(
  (await capEngine.snapshot()).sessions.find((s) => s.id === grace.id).status,
  "CANCELLED",
);
// Separate tab engines share a Web Locks equivalent around the complete read-modify-write.
let sharedQueue = Promise.resolve();
const sharedLock = (work) => {
  const result = sharedQueue.then(work, work);
  sharedQueue = result.catch(() => undefined);
  return result;
};
const tabOne = createDemoApi({ storage: () => capStorage, lock: sharedLock });
const tabTwo = createDemoApi({ storage: () => capStorage, lock: sharedLock });
const beforeTabs = (await tabOne.request(`/users/${capStudent.id}`))
  .premium_balance;
await Promise.all([
  tabOne.request(`/users/${capStudent.id}/top-up`, "POST", { amount: 2 }),
  tabTwo.request(`/users/${capStudent.id}/top-up`, "POST", { amount: 3 }),
]);
assert.equal(
  (await tabOne.request(`/users/${capStudent.id}`)).premium_balance,
  beforeTabs + 5,
);

// Transport contract: reachable NestJS, HTTP errors, shared probe, public loopback skip, abort and no POST replay.
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const opts = {
  baseUrl: "http://localhost:3001",
  browser: () => true,
  hostname: () => "localhost",
  demo: { storage: () => storage },
  probeTimeout: 20,
  requestTimeout: 30,
};
let calls = [];
const real = createApiTransport({
  ...opts,
  fetcher: async (url, init) => {
    calls.push({ url, init });
    return response([{ id: "real-api" }]);
  },
});
await Promise.all(Array.from({ length: 5 }, () => real.request("/users")));
assert.equal(calls.length, 6, "Five reads should share one availability probe");
assert.equal(real.getStatus().mode, "backend");
await real.request("/users/test/top-up", "POST", { amount: 5 });
assert.equal(JSON.parse(calls.at(-1).init.body).amount, 5);
let httpCalls = 0;
const validation = createApiTransport({
  ...opts,
  fetcher: async () => {
    httpCalls++;
    return response({ message: ["Validation refused"] }, 400);
  },
});
await assert.rejects(
  () => validation.request("/skills", "POST", {}),
  /Validation refused/,
);
assert.equal(validation.getStatus().mode, "backend");
assert.equal(httpCalls, 2);
const offline = createApiTransport({
  ...opts,
  fetcher: async () => {
    throw new TypeError("Offline");
  },
});
assert.equal((await offline.snapshot()).users.length, 8 + 1); // Seven seed profiles + created student + outsider.
assert.equal(offline.getStatus().mode, "demo");
let publicCalls = 0;
const publicDemo = createApiTransport({
  ...opts,
  hostname: () => "friends.vercel.app",
  fetcher: async () => {
    publicCalls++;
    throw new Error("Must not call a phone's localhost");
  },
});
await publicDemo.request("/users");
assert.equal(publicCalls, 0);
let cloudCalls = 0;
const cloud = createApiTransport({
  ...opts,
  baseUrl: "https://api.example.com",
  hostname: () => "friends.vercel.app",
  fetcher: async () => {
    cloudCalls++;
    return response([]);
  },
});
await cloud.request("/users");
assert.equal(cloud.getStatus().mode, "backend");
assert.equal(cloudCalls, 2);
let mutations = 0;
const uncertain = createApiTransport({
  ...opts,
  fetcher: async (url, init) => {
    if (init.method === "POST") {
      mutations++;
      throw new TypeError("Lost response after commit");
    }
    return response([]);
  },
});
await uncertain.ready();
const persistedBefore = values.get(DEMO_STORAGE_KEY);
await assert.rejects(
  () =>
    uncertain.request(`/users/${created.id}/top-up`, "POST", { amount: 100 }),
  /chưa được xác nhận/,
);
assert.equal(mutations, 1);
assert.equal(
  values.get(DEMO_STORAGE_KEY),
  persistedBefore,
  "An uncertain live POST must never mutate demo state",
);
assert.equal(uncertain.getStatus().mode, "backend");
const changing = createApiTransport({
  ...opts,
  fetcher: async (url) => {
    if (url.endsWith("/skills")) throw new TypeError("Backend disappeared");
    return response([{ id: "only-real-source" }]);
  },
});
const consistent = await changing.snapshot();
assert.equal(changing.getStatus().mode, "demo");
assert.ok(consistent.users.every((u) => u.id !== "only-real-source"));
assert.ok(
  consistent.skills.every((s) =>
    consistent.users.some((u) => u.id === s.user_id),
  ),
);
let abortCalls = 0;
const cancellable = createApiTransport({
  ...opts,
  fetcher: async (_url, init) => {
    abortCalls++;
    if (abortCalls === 1) return response([]);
    return new Promise((_resolve, reject) =>
      init.signal.addEventListener("abort", () => reject(init.signal.reason), {
        once: true,
      }),
    );
  },
});
await cancellable.ready();
const controller = new AbortController();
const cancelled = cancellable.request(
  "/users",
  "GET",
  undefined,
  controller.signal,
);
setTimeout(() => controller.abort(), 1);
await assert.rejects(() => cancelled);
assert.equal(
  cancellable.getStatus().mode,
  "backend",
  "User cancellation is not an outage",
);
const timeout = createApiTransport({
  ...opts,
  fetcher: async (_url, init) =>
    new Promise((_resolve, reject) =>
      init.signal.addEventListener("abort", () => reject(init.signal.reason), {
        once: true,
      }),
    ),
});
await timeout.request("/users");
assert.equal(timeout.getStatus().mode, "demo");
// Actual exported facade uses the same browser fallback without Next.js or a running server.
const facadeLoad = loadModules({
  window: {
    location: { hostname: "friends.vercel.app" },
    localStorage: storage,
  },
});
const { api, API_URL, getApiStatus } = facadeLoad("api");
assert.equal(API_URL, "http://localhost:3001");
assert.equal((await api.snapshot()).users.length, 9);
assert.equal(getApiStatus().mode, "demo");
assert.ok((await api.transactions(duy.id)).length);
assert.equal((await api.qr(zone.id)).qr_code_hash, "cloud-safe-zone-qr-123456");
const blankEnv = loadModules({ process: { env: { NEXT_PUBLIC_API_URL: "" } } })(
  "api",
);
assert.equal(blankEnv.API_URL, "http://localhost:3001");
if (process.argv.includes("--check-local-api")) {
  const realFacade = loadModules({
    fetch,
    window: { location: { hostname: "localhost" }, localStorage: storage },
  })("api");
  const actual = await realFacade.api.snapshot();
  assert.equal(realFacade.getApiStatus().mode, "backend");
  assert.ok(
    Array.isArray(actual.users) &&
      Array.isArray(actual.skills) &&
      Array.isArray(actual.zones) &&
      Array.isArray(actual.sessions) &&
      Array.isArray(actual.disputes),
  );
  console.log(
    "Local NestJS read-only integration passed; no database mutations.",
  );
}
console.log(
  "Cloud fallback passed: all campus routes, atomic escrow/ledger, review/tribunal guards, reload persistence, offline transport, aborts and no mutation replay.",
);
