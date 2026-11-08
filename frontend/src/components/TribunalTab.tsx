"use client";

import { useState, type FormEvent } from "react";
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  Plus,
  Scale,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { api } from "../lib/api";
import { dateTime } from "../lib/constants";
import type { Dispute, SafeZone, WorkspaceProps } from "../lib/types";
import { BusyLabel, Empty, Milestones, Modal, Panel } from "./ui";

// [KIẾN TRÚC & THIẾT KẾ]: Panel so sánh hai cột: hợp đồng bên trái, lý do và biểu quyết bên phải; rose cho khiếu nại.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Reveal khi scroll, thanh phiếu chuyển width; luôn kèm số để không phụ thuộc màu.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Banner báo điều kiện Trust; nút chỉ mở cho người ngoài phiên và dispute PENDING.
// [KẾT NỐI API]: GET /disputes thiếu safe_zone nên nối theo ID; POST /:id/votes nhận voter_id/choice; POST /users thêm hồ sơ demo.
// [CẨN THẬN KHI SỬA]: Backend bảo vệ phiếu trùng và quyết định phiếu thứ ba; không suy diễn cử tri từ response đã ẩn danh.
// [ĐIỂM MỞ RỘNG]: API có thể trả has_voted theo principal để giữ trạng thái nút sau khi reload.
// [PHÂN TẦNG BỀ MẶT]: workspace-section dùng satin navy tầng 2; hồ sơ phân xử bên trong nổi rõ bằng royal slate và sheen.
export default function TribunalTab({
  disputes,
  zones,
  user,
  busy,
  run,
}: WorkspaceProps & { disputes: Dispute[]; zones: SafeZone[] }) {
  const [voted, setVoted] = useState<string[]>([]);
  const [profileModal, setProfileModal] = useState(false);
  const [profileError, setProfileError] = useState("");
  const eligible = user.trust_score >= 4.5;
  async function createDemoProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const full_name = String(data.get("full_name") ?? "").trim();
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (full_name.length < 2 || !/^[^@\s]+@[^@\s]+\.edu\.vn$/i.test(email)) {
      setProfileError(
        "Nhập tên ít nhất 2 ký tự và một email trường .edu.vn hợp lệ.",
      );
      return;
    }
    // [CẨN THẬN KHI SỬA]: Tạo hồ sơ riêng để đủ ba cử tri, không nâng Trust hoặc sửa tài khoản seed hiện có.
    if (
      await run(
        () => api.createUser({ full_name, email }),
        "Đã tạo hồ sơ sinh viên. Chọn hồ sơ mới trên thanh tài khoản để tiếp tục.",
      )
    )
      setProfileModal(false);
  }
  return (
    <div className="workspace-section">
      <div className={`eligibility ${eligible ? "eligible" : "ineligible"}`}>
        <span className="eligibility-icon">
          <ShieldCheck size={25} />
        </span>
        <div>
          <h3>
            {eligible
              ? "Bạn đủ uy tín làm bồi thẩm"
              : "Tiếp tục xây dựng sự tin cậy"}
          </h3>
          <p>
            Trust Score của bạn: <b>{user.trust_score.toFixed(1)}/5.0</b> · Cần
            ≥ 4.5 và không tham gia phiên tranh chấp.
          </p>
        </div>
        <span className={`badge ${eligible ? "emerald" : "amber"}`}>
          {eligible ? <BadgeCheck size={14} /> : <Scale size={14} />}{" "}
          {eligible ? "Đủ điều kiện" : "Chưa đủ điều kiện"}
        </span>
      </div>
      <div className="section-heading">
        <div>
          <h2>
            Hội đồng cộng đồng <span className="count">{disputes.length}</span>
          </h2>
          <p>Ba lá phiếu độc lập. Một quyết định công bằng.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setProfileError("");
            setProfileModal(true);
          }}
        >
          <Plus size={15} /> Thêm hồ sơ sinh viên
        </button>
      </div>
      <div className="dispute-list">
        {disputes.map((dispute) => {
          const session = dispute.session;
          const own = [session.teacher_id, session.student_id].includes(
            user.id,
          );
          const total = dispute.votes_for_teacher + dispute.votes_for_student;
          const pending = dispute.status === "PENDING";
          const disabled =
            busy || !eligible || own || !pending || voted.includes(dispute.id);
          const reason = own
            ? "Người tham gia phiên không được làm bồi thẩm."
            : voted.includes(dispute.id)
              ? "Bạn đã gửi phiếu cho tranh chấp này."
              : !pending
                ? "Phân xử hoàn tất. Ký quỹ đã được xử lý."
                : !eligible
                  ? "Cần Trust Score tối thiểu 4.5 để bỏ phiếu."
                  : "Mỗi thành viên chỉ có một phiếu. Kết quả tự chốt ở phiếu thứ ba.";
          const vote = async (choice: "TEACHER" | "STUDENT") => {
            if (
              await run(
                () => api.vote(dispute.id, user.id, choice),
                "Đã ghi nhận phiếu. Kết quả và ký quỹ được cập nhật từ backend.",
              )
            )
              setVoted([...voted, dispute.id]);
          };
          return (
            <Panel className="dispute-card" key={dispute.id} hover>
              <div className="dispute-heading">
                <span>
                  <Scale size={18} /> Hồ sơ #{dispute.id.slice(0, 8)}
                </span>
                <span className={`badge ${pending ? "rose" : "emerald"}`}>
                  {pending
                    ? "Đang phân xử"
                    : dispute.status === "RESOLVED_TEACHER_WINS"
                      ? "Người dạy thắng"
                      : "Người học thắng · Hoàn cọc"}
                </span>
              </div>
              <div className="dispute-columns">
                <div className="dispute-contract">
                  <span className="small-label">CAM KẾT BAN ĐẦU</span>
                  <h3>{session.skill.title}</h3>
                  <p className="meta-line">
                    <CalendarDays size={14} />
                    {dateTime(session.scheduled_start)}
                  </p>
                  <p className="meta-line">
                    <MapPin size={14} />
                    {zones.find((zone) => zone.id === session.safe_zone_id)
                      ?.name ?? "Safe Zone trong trường"}
                  </p>
                  <div className="dispute-parties">
                    <span>
                      Dạy <b>{session.teacher.full_name}</b>
                    </span>
                    <span>
                      Học <b>{session.student.full_name}</b>
                    </span>
                  </div>
                  <Milestones items={session.micro_contract.milestones} />
                  <span className="badge amber">
                    {session.cost_credits} Credit{" "}
                    {pending ? "đang khóa" : "đã xử lý"}
                  </span>
                </div>
                <div className="dispute-vote">
                  <span className="small-label">NỘI DUNG KHIẾU NẠI</span>
                  <h4>
                    {dispute.complainant_id === session.teacher_id
                      ? session.teacher.full_name
                      : session.student.full_name}
                  </h4>
                  <blockquote>{dispute.reason}</blockquote>
                  <div className="vote-title">
                    <b>
                      <UsersRound size={15} /> Tiến độ biểu quyết
                    </b>
                    <span>{total}/3 phiếu</span>
                  </div>
                  <div
                    className="vote-meter"
                    role="img"
                    aria-label={`${dispute.votes_for_teacher} phiếu người dạy, ${dispute.votes_for_student} phiếu người học trên tổng 3 phiếu`}
                  >
                    <span
                      className="teacher-votes"
                      style={{
                        width: `${(dispute.votes_for_teacher / 3) * 100}%`,
                      }}
                    />
                    <span
                      className="student-votes"
                      style={{
                        width: `${(dispute.votes_for_student / 3) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="vote-labels">
                    <span>
                      Người dạy <b>{dispute.votes_for_teacher}</b>
                    </span>
                    <span>
                      Người học <b>{dispute.votes_for_student}</b>
                    </span>
                  </div>
                  <div className="vote-actions">
                    <button
                      className="button primary"
                      disabled={disabled}
                      onClick={() => void vote("TEACHER")}
                    >
                      Người dạy thắng
                    </button>
                    <button
                      className="button secondary"
                      disabled={disabled}
                      onClick={() => void vote("STUDENT")}
                    >
                      Người học thắng · Hoàn cọc
                    </button>
                  </div>
                  <p className="muted small">{reason}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      {disputes.length === 0 && (
        <Panel>
          <Empty
            title="Cộng đồng đang học thật vui"
            detail="Chưa có khiếu nại. Khi một phiên cần phân xử, hồ sơ sẽ xuất hiện tại đây."
          />
        </Panel>
      )}
      {profileModal && (
        <Modal
          title="Thêm hồ sơ sinh viên"
          subtitle="Bổ sung thành viên để thử hội đồng ba lá phiếu."
          busy={busy}
          onClose={() => setProfileModal(false)}
        >
          <form className="form" onSubmit={createDemoProfile}>
            <label>
              Họ và tên
              <input
                name="full_name"
                minLength={2}
                maxLength={120}
                required
                placeholder="Nguyễn Thanh Hà"
              />
            </label>
            <label>
              Email trường
              <input
                name="email"
                type="email"
                maxLength={254}
                required
                placeholder="thanhha@hcmut.edu.vn"
              />
            </label>
            <div className="info-note">
              Hồ sơ mới xuất hiện trong bộ chuyển tài khoản ở đầu trang. Chọn hồ
              sơ đó để xem điều kiện bồi thẩm; mỗi hồ sơ chỉ bỏ một phiếu cho
              mỗi tranh chấp.
            </div>
            {profileError && (
              <p role="alert" className="form-error">
                {profileError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setProfileModal(false)}
              >
                Để sau
              </button>
              <button className="button primary" disabled={busy}>
                <BusyLabel busy={busy}>Tạo hồ sơ</BusyLabel>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
