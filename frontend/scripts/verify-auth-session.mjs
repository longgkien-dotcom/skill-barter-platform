// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Test gate phiên độc lập CSS để palette không thể quyết định trạng thái đăng nhập.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Kiểm tra restore chỉ nhận phiên hợp lệ, roster đúng và logout xóa storage hoàn toàn.
// [KẾT NỐI API]: Dữ liệu tổng hợp; không gọi mạng hoặc sửa database/backend.
// [CẨN THẬN KHI SỬA]: Chỉ xác minh gate demo frontend, không phải bài test bảo mật JWT/OTP chưa được triển khai.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(
  new URL("../src/lib/auth-session.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context, { filename: "auth-session.js" });
const auth = context.exports;
const account = {
  id: "student-a",
  email: "student@uni.edu.vn",
  full_name: "Sinh viên A",
  is_verified: true,
};
const other = {
  ...account,
  id: "student-b",
  email: "b@UNI.EDU.VN",
  is_verified: false,
};
const outsider = { ...account, id: "outsider", email: "outside@example.com" };
const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
};
assert.equal(auth.readSession(storage), null);
for (const raw of [
  null,
  "",
  "{",
  "null",
  "[]",
  JSON.stringify({ version: 2, isAuthenticated: true, userId: account.id }),
  JSON.stringify({ version: 1, isAuthenticated: false, userId: account.id }),
  JSON.stringify({ version: 1, isAuthenticated: true, userId: "" }),
])
  assert.equal(auth.parseSession(raw), null);
assert.equal(auth.writeSession(account.id, storage), true);
assert.equal(auth.readSession(storage), account.id);
assert.equal(
  auth.resolveSessionUser([account, other], auth.readSession(storage)).id,
  account.id,
);
assert.equal(auth.resolveSessionUser([account], "removed-account"), null);
assert.equal(auth.resolveSessionUser([outsider], outsider.id), null);
assert.equal(auth.isStudentAccount(other), true);
assert.equal(auth.isStudentAccount(undefined), false);
assert.deepEqual(
  Object.keys(JSON.parse(data.get(auth.AUTH_SESSION_KEY))).sort(),
  ["isAuthenticated", "userId", "version"],
);
assert.equal(auth.writeSession(other.id, storage), true);
assert.equal(auth.readSession(storage), other.id);
auth.clearSession(storage);
assert.equal(data.has(auth.AUTH_SESSION_KEY), false);
assert.equal(auth.readSession(storage), null);
const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};
assert.equal(auth.readSession(blocked), null);
assert.equal(auth.writeSession(account.id, blocked), false);
assert.doesNotThrow(() => auth.clearSession(blocked));
console.log(
  "Auth session checks passed: malformed/forged flags, roster validation, restore, demo switching, logout clearing and blocked storage.",
);
