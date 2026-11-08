// [KẾT NỐI API]: Kiểm tra REST thật trên localhost:3001 với fixture riêng: verify, booking/escrow, QR, checkout, review, dispute và 3 phiếu.
// [CẨN THẬN KHI SỬA]: Chỉ sửa/xóa ID do lượt test này tạo, không reset/seed hoặc thay dữ liệu người dùng có sẵn. Cleanup nằm trong transaction.
// [BETA & KIỂM THỬ]: Cần flag --run-local-fixtures để tránh chạy nhầm; không gửi email, gọi media hoặc tạo thanh toán.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
assert.ok(
  process.argv.includes("--run-local-fixtures"),
  "Use --run-local-fixtures to authorize isolated local fixtures.",
);
const requireBackend = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
requireBackend("dotenv").config({
  path: fileURLToPath(new URL("../../backend/.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireBackend("@prisma/client");
const db = new PrismaClient();
const ids = { users: [], sessions: [], skills: [], zones: [], disputes: [] };
const prefix = `beta-${randomUUID()}`;
async function api(path, method = "GET", body, expectedError = false) {
  const response = await fetch(`http://localhost:3001${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (expectedError) {
    assert.ok(
      response.status >= 400 && response.status < 500,
      `Expected a rejected ${method} ${path}`,
    );
    return data;
  }
  assert.ok(
    response.ok,
    `${method} ${path} returned ${response.status}: ${data.message ?? ""}`,
  );
  return data;
}
async function createUser(role) {
  const user = await api("/users", "POST", {
    full_name: `Beta flow ${role}`,
    email: `${prefix}-${role}@test.edu.vn`,
  });
  ids.users.push(user.id);
  await api(`/users/${user.id}/verify-email`, "POST");
  assert.equal((await api(`/users/${user.id}`)).standard_balance, 1);
  return user;
}
let passed = false;
try {
  await db.$connect();
  const baseline = await api("/users");
  assert.ok(
    baseline.length &&
      (await db.user.findUnique({ where: { id: baseline[0].id } })),
    "Verify the API and Prisma share this local database before creating fixtures.",
  );
  const teacher = await createUser("teacher"),
    student = await createUser("student");
  const jurors = [];
  for (let index = 0; index < 3; index++)
    jurors.push(await createUser(`juror${index}`));
  assert.ok(ids.users.every((id) => !baseline.some((user) => user.id === id)));
  await db.user.update({
    where: { id: student.id },
    data: { standard_balance: 6 },
  });
  await db.user.update({
    where: { id: teacher.id },
    data: { trust_score: 3.8 },
  });
  const qr = `beta-qr-${randomUUID()}`;
  const zone = await api("/safe-zones", "POST", {
    name: `Beta zone ${prefix}`,
    address: "Isolated local API verification",
    latitude: 10.87,
    longitude: 106.8,
    qr_code_hash: qr,
  });
  ids.zones.push(zone.id);
  const skill = await api("/skills", "POST", {
    user_id: teacher.id,
    skill_type: "OFFER",
    category: "Beta verification",
    title: `Beta skill ${prefix}`,
    proficiency_level: "BEGINNER",
  });
  ids.skills.push(skill.id);
  async function book() {
    const start = Date.now() + 86400000;
    const session = await api("/sessions", "POST", {
      student_id: student.id,
      skill_id: skill.id,
      safe_zone_id: zone.id,
      scheduled_start: new Date(start).toISOString(),
      scheduled_end: new Date(start + 3600000).toISOString(),
      cost_credits: 1,
      micro_contract: {
        milestones: [
          "First learning goal",
          "Second learning goal",
          "Third learning goal",
        ],
      },
    });
    ids.sessions.push(session.id);
    assert.equal(session.status, "ESCROWED");
    return session;
  }
  const first = await book();
  assert.equal((await api(`/users/${student.id}`)).standard_balance, 5);
  assert.ok(
    (await api(`/users/${student.id}/transactions`)).some(
      (row) =>
        row.session_id === first.id && row.transaction_type === "ESCROW_LOCK",
    ),
  );
  await api(
    `/sessions/${first.id}/check-in`,
    "POST",
    { user_id: student.id, qr_code_hash: "incorrect-qr-value" },
    true,
  );
  assert.equal(
    (
      await api(`/sessions/${first.id}/check-in`, "POST", {
        user_id: student.id,
        qr_code_hash: qr,
      })
    ).status,
    "IN_PROGRESS",
  );
  await api(
    `/sessions/${first.id}/check-out`,
    "POST",
    {
      teacher_id: student.id,
      proof_image_url: "https://example.com/beta-proof.jpg",
    },
    true,
  );
  assert.equal(
    (
      await api(`/sessions/${first.id}/check-out`, "POST", {
        teacher_id: teacher.id,
        proof_image_url: "https://example.com/beta-proof.jpg",
      })
    ).status,
    "COMPLETED",
  );
  assert.equal((await api(`/users/${teacher.id}`)).standard_balance, 2);
  await api(`/sessions/${first.id}/reviews`, "POST", {
    reviewer_id: student.id,
    reviewee_id: teacher.id,
    prep_score: 5,
    attitude_score: 4,
    knowledge_score: 5,
    comment: "Isolated beta verification review.",
  });
  assert.equal(
    (await api(`/users/${teacher.id}`)).trust_score,
    Number((3.8 * 0.8 + (14 / 3) * 0.2).toFixed(2)),
  );
  const second = await book();
  await api(`/sessions/${second.id}/check-in`, "POST", {
    user_id: student.id,
    qr_code_hash: qr,
  });
  const dispute = await api("/disputes", "POST", {
    session_id: second.id,
    complainant_id: student.id,
    reason: "Isolated beta verification dispute for the test fixture.",
  });
  ids.disputes.push(dispute.id);
  await api(
    `/disputes/${dispute.id}/votes`,
    "POST",
    { voter_id: student.id, choice: "STUDENT" },
    true,
  );
  let result;
  for (const juror of jurors)
    result = await api(`/disputes/${dispute.id}/votes`, "POST", {
      voter_id: juror.id,
      choice: "STUDENT",
    });
  assert.equal(result.status, "RESOLVED_STUDENT_WINS");
  assert.equal((await api(`/users/${student.id}`)).standard_balance, 5);
  assert.ok(
    (await api(`/users/${student.id}/transactions`)).some(
      (row) =>
        row.session_id === second.id &&
        row.transaction_type === "ESCROW_REFUND",
    ),
  );
  const third = await book();
  assert.equal(
    (await api(`/sessions/${third.id}/cancel`, "POST", { user_id: student.id }))
      .status,
    "CANCELLED",
  );
  assert.equal((await api(`/users/${student.id}`)).standard_balance, 5);
  passed = true;
} finally {
  if (ids.users.length)
    await db.$transaction(async (tx) => {
      await tx.tribunalVote.deleteMany({
        where: { dispute_id: { in: ids.disputes } },
      });
      await tx.review.deleteMany({
        where: { session_id: { in: ids.sessions } },
      });
      await tx.transaction.deleteMany({
        where: { user_id: { in: ids.users } },
      });
      await tx.dispute.deleteMany({ where: { id: { in: ids.disputes } } });
      await tx.session.deleteMany({ where: { id: { in: ids.sessions } } });
      await tx.skill.deleteMany({ where: { id: { in: ids.skills } } });
      await tx.safeZone.deleteMany({ where: { id: { in: ids.zones } } });
      await tx.user.deleteMany({ where: { id: { in: ids.users } } });
    });
  assert.equal(
    await db.user.count({ where: { id: { in: ids.users } } }),
    0,
    "All test accounts are removed.",
  );
  await db.$disconnect();
}
if (passed)
  console.log(
    "Campus API checks passed: verification bonus, booking/escrow deduction, invalid QR rejection, check-in, teacher-only checkout/payout, review/Trust update, tribunal voting/refund and cancellation. Isolated fixtures cleaned up.",
  );
