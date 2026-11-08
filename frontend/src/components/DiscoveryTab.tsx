"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Coins,
  Code2,
  Copy,
  Globe2,
  LockKeyhole,
  MapPin,
  Navigation,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import { api } from "../lib/api";
import { LEVELS } from "../lib/constants";
import type {
  Level,
  SafeZone,
  Skill,
  SkillType,
  WorkspaceProps,
  User,
} from "../lib/types";
import { BusyLabel, Empty, Modal, Panel } from "./ui";
import IdentityChip from "./IdentityChip";
import OnlineBarter from "./OnlineBarter";

// [KIẾN TRÚC & THIẾT KẾ]: Grid 2/3 kỹ năng và 1/3 điểm hẹn; thẻ ticket ivory, mép đục lỗ và icon theo danh mục.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Panel reveal và hover nâng nhẹ; modal native không dịch focus theo animation.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Lọc, đăng kỹ năng, đặt lịch ba mốc, tìm gần tọa độ và sao chép QR demo.
// [KẾT NỐI API]: POST /skills, /safe-zones, /sessions; GET /safe-zones/nearby và /:id/qr. Bộ lọc listing ở client.
// [CẨN THẬN KHI SỬA]: NEED không đặt được; OFFER không tự đặt. ID student lấy user hiện tại, teacher do backend suy ra.
// [ĐIỂM MỞ RỘNG]: Thay tọa độ nhập bằng Geolocation; thêm bản đồ và quét QR bằng camera vào nút check-in.
// [BỀ MẶT & DANH TÍNH]: Hai vùng workspace-section là satin navy tầng 2; skill/zone card royal slate tầng 3, dùng chip tên/uy tín chung.
// [GIAO DIỆN HỌC ONLINE OMEGLE]: Sub-view campus/online dùng chung Discovery; phòng mock nhận roster nhưng không chạm escrow hoặc Session thật.
// [HỆ THỐNG MÀU LUMINOUS NAVY]: Toolbar tìm kiếm và carousel danh mục có trạng thái active rõ; card sáng hơn container và có giá 1 CR/giờ.
// [SỬA TRÀN MOBILE]: Mode bar dùng grid 1/2 cột, search/filter có min-width:0 và category wrap; không đổi bộ lọc, channel hoặc endpoint hiện có.
const localDate = (value: Date) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
export default function DiscoveryTab({
  skills,
  users,
  zones,
  user,
  busy,
  run,
  onBooked,
  channel,
  onChannelChange,
}: WorkspaceProps & {
  skills: Skill[];
  users: User[];
  zones: SafeZone[];
  onBooked: () => void;
  channel: "campus" | "online";
  onChannelChange: (channel: "campus" | "online") => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [modal, setModal] = useState<"skill" | "zone" | null>(null);
  const [booking, setBooking] = useState<Skill | null>(null);
  const [nearby, setNearby] = useState<SafeZone[] | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [formError, setFormError] = useState("");
  // [TRỢ LÝ CHATBOT 24/7]: Home điều phối channel để shortcut mở thẳng Online; state phòng/escrow và mọi API giữ nguyên.
  function switchChannel(next: "campus" | "online") {
    onChannelChange(next);
    window.requestAnimationFrame(() => {
      const content = document.getElementById("discovery-mode-content");
      content?.focus({ preventScroll: true });
      content?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }
  const filtered = skills.filter(
    (skill) =>
      (!type || skill.skill_type === type) &&
      (!category || skill.category === category) &&
      (!level || skill.proficiency_level === level) &&
      `${skill.title} ${skill.user.full_name} ${skill.category}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const cost =
    start && end
      ? Math.max(
          1,
          Math.ceil(
            (new Date(end).getTime() - new Date(start).getTime()) / 3600000,
          ),
        )
      : 1;
  const balance = user.standard_balance + user.premium_balance;
  function openBooking(skill: Skill, now: number) {
    const next = new Date(now + 86400000);
    next.setMinutes(0, 0, 0);
    setStart(localDate(next));
    setEnd(localDate(new Date(next.getTime() + 3600000)));
    setFormError("");
    setBooking(skill);
  }
  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = field(data, "title"),
      category = field(data, "category");
    if (title.length < 2 || category.length < 2) {
      setFormError("Tiêu đề và danh mục cần ít nhất 2 ký tự.");
      return;
    }
    if (
      await run(
        () =>
          api.createSkill({
            user_id: user.id,
            title,
            category,
            skill_type: field(data, "skill_type") as SkillType,
            proficiency_level: field(data, "proficiency_level") as Level,
          }),
        "Đã đăng kỹ năng của bạn.",
      )
    )
      setModal(null);
  }
  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = field(data, "name"),
      address = field(data, "address"),
      qr_code_hash = field(data, "qr_code_hash");
    if (name.length < 2 || address.length < 5 || qr_code_hash.length < 16) {
      setFormError("Kiểm tra tên, địa chỉ và mã QR (tối thiểu 16 ký tự).");
      return;
    }
    if (
      await run(
        () =>
          api.createZone({
            name,
            address,
            latitude: Number(data.get("latitude")),
            longitude: Number(data.get("longitude")),
            qr_code_hash,
          }),
        "Đã thêm điểm hẹn an toàn.",
      )
    ) {
      setNearby(null);
      setModal(null);
    }
  }
  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!booking) return;
    const data = new FormData(event.currentTarget);
    if (
      new Date(start).getTime() <= Date.now() ||
      new Date(end) <= new Date(start)
    ) {
      setFormError(
        "Giờ bắt đầu cần ở tương lai; giờ kết thúc phải sau giờ bắt đầu.",
      );
      return;
    }
    const milestones = ["goal1", "goal2", "goal3"].map((key) =>
      field(data, key),
    );
    if (milestones.some((item) => item.length < 3)) {
      setFormError("Mỗi mục tiêu cần ít nhất 3 ký tự có nghĩa.");
      return;
    }
    if (
      await run(
        () =>
          api.book({
            student_id: user.id,
            skill_id: booking.id,
            safe_zone_id: field(data, "safe_zone_id"),
            scheduled_start: new Date(start).toISOString(),
            scheduled_end: new Date(end).toISOString(),
            cost_credits: cost,
            micro_contract: { milestones },
          }),
        "Đặt lịch thành công. Credit đã được khóa trong Escrow.",
      )
    ) {
      setBooking(null);
      onBooked();
    }
  }
  return (
    <div className="discovery-workspace">
      <div
        className="discovery-modebar"
        role="group"
        aria-label="Hình thức học tập"
      >
        <button
          type="button"
          aria-pressed={channel === "campus"}
          onClick={() => switchChannel("campus")}
        >
          <MapPin size={18} />
          <span>Gặp mặt Safe Zone tại trường</span>
        </button>
        <button
          type="button"
          aria-pressed={channel === "online"}
          onClick={() => switchChannel("online")}
        >
          <Video size={18} />
          <span>Học trực tuyến 1-on-1</span>
          <small>ONLINE</small>
        </button>
      </div>
      <div
        id="discovery-mode-content"
        className="discovery-mode-content"
        tabIndex={-1}
      >
        {channel === "online" ? (
          <OnlineBarter user={user} users={users} busy={busy} />
        ) : (
          <>
            <section
              className="workspace-section discovery-toolbar"
              aria-label="Tìm và lọc kỹ năng"
            >
              <div className="discovery-search-line">
                <label className="discovery-search">
                  <Search size={19} />
                  <span className="sr-only">Tìm kỹ năng hoặc người dạy</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Bạn muốn học điều gì hôm nay?"
                  />
                </label>
                <div className="discovery-filter-controls">
                  <SlidersHorizontal size={16} />
                  <label>
                    <span className="sr-only">Loại kỹ năng</span>
                    <select
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                    >
                      <option value="">Tất cả loại</option>
                      <option value="OFFER">Đang dạy · OFFER</option>
                      <option value="NEED">Cần học · NEED</option>
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Trình độ</span>
                    <select
                      value={level}
                      onChange={(event) => setLevel(event.target.value)}
                    >
                      <option value="">Mọi trình độ</option>
                      {Object.entries(LEVELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div
                className="discovery-category-pills"
                role="group"
                aria-label="Danh mục kỹ năng"
              >
                {["", ...new Set(skills.map((skill) => skill.category))].map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {value || "Tất cả kỹ năng"}
                    </button>
                  ),
                )}
              </div>
            </section>
            <div className="discovery-grid">
              <div className="skills-column workspace-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      Danh mục kỹ năng{" "}
                      <span className="count">{skills.length}</span>
                    </h2>
                    <p>Tri thức tốt hơn khi được sẻ chia.</p>
                  </div>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => {
                      setFormError("");
                      setModal("skill");
                    }}
                  >
                    <Plus size={17} /> Đăng kỹ năng
                  </button>
                </div>
                <div className="results-caption">
                  <span>{filtered.length} kỹ năng dành cho bạn</span>
                  <span>
                    <ShieldCheck size={13} /> Kết nối trong khuôn viên
                  </span>
                </div>
                <div className="skill-grid">
                  {filtered.map((skill, index) => {
                    const Icon = /lập|code|program/i.test(skill.category)
                      ? Code2
                      : /ngữ|language/i.test(skill.category)
                        ? Globe2
                        : BookOpen;
                    return (
                      <Panel
                        key={skill.id}
                        className={`skill-card tone-${index % 3}`}
                        hover
                      >
                        <div className="skill-card-top">
                          <span className="skill-icon">
                            <Icon size={24} strokeWidth={1.5} />
                          </span>
                          <span
                            className={`badge ${skill.skill_type === "OFFER" ? "emerald" : "amber"}`}
                          >
                            <span className="badge-dot" />
                            {skill.skill_type === "OFFER"
                              ? "Đang dạy"
                              : "Cần học"}
                          </span>
                        </div>
                        <div className="skill-copy">
                          <div className="skill-category-line">
                            <span className="category-label">
                              {skill.category}
                            </span>
                            <span className="skill-rate">
                              <Coins size={12} />1 CR / Giờ
                            </span>
                          </div>
                          <h3>{skill.title}</h3>
                          <span className="level-label">
                            <span className="level-bars">▂▄▆</span>
                            {LEVELS[skill.proficiency_level]}
                          </span>
                        </div>
                        <div className="ticket-line" />
                        <div className="skill-person">
                          <IdentityChip
                            person={skill.user}
                            role={
                              skill.skill_type === "OFFER"
                                ? "Người dạy"
                                : "Học viên"
                            }
                          />
                        </div>
                        <button
                          className="button skill-book"
                          disabled={
                            busy ||
                            skill.user_id === user.id ||
                            skill.skill_type !== "OFFER"
                          }
                          onClick={() => openBooking(skill, Date.now())}
                        >
                          {skill.user_id === user.id
                            ? "Kỹ năng của bạn"
                            : skill.skill_type === "NEED"
                              ? "Đang tìm người hướng dẫn"
                              : "Đặt lịch học"}
                          <ArrowRight size={16} />
                        </button>
                      </Panel>
                    );
                  })}
                </div>
                {filtered.length === 0 && (
                  <Empty
                    title="Chưa tìm thấy kỹ năng"
                    detail="Thử từ khóa khác hoặc bỏ bớt bộ lọc."
                  />
                )}
                <div className="discovery-note">
                  <span className="note-icon">
                    <BookOpen size={21} />
                  </span>
                  <div>
                    <strong>Ai cũng có điều đáng để chia sẻ.</strong>
                    <p>Đăng kỹ năng của bạn và bắt đầu vòng tròn tri thức.</p>
                  </div>
                  <ArrowRight size={19} />
                </div>
              </div>
              <aside className="zones-column workspace-section">
                <div className="section-heading">
                  <div>
                    <h2>Điểm hẹn an toàn</h2>
                    <p>Gặp nhau ở một nơi tin cậy.</p>
                  </div>
                  <span className="zone-shield">
                    <ShieldCheck size={22} />
                  </span>
                </div>
                <div className="quick-online-promo">
                  <span>
                    <Video size={20} />
                  </span>
                  <div>
                    <b>Một sprint. Một kết nối mới.</b>
                    <p>
                      Ghép theo chủ đề, luyện tập và ghi lại mục tiêu của bạn.
                    </p>
                  </div>
                  <button type="button" onClick={() => switchChannel("online")}>
                    Tham gia Phòng Ghép Đôi Online ngay <ArrowRight size={15} />
                  </button>
                </div>
                <Panel className="nearby-panel">
                  <div className="nearby-label">
                    <Navigation size={15} />
                    <b>Tìm điểm hẹn gần bạn</b>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(async () => {
                        const result = await api.nearby(
                          Number(data.get("lat")),
                          Number(data.get("lng")),
                          Number(data.get("radius")),
                        );
                        setNearby(result);
                      }, "Đã cập nhật điểm hẹn trong bán kính.");
                    }}
                  >
                    <div className="coordinates">
                      <label>
                        Vĩ độ
                        <input
                          name="lat"
                          type="number"
                          step="any"
                          min={-90}
                          max={90}
                          required
                          defaultValue={10.8702}
                        />
                      </label>
                      <label>
                        Kinh độ
                        <input
                          name="lng"
                          type="number"
                          step="any"
                          min={-180}
                          max={180}
                          required
                          defaultValue={106.8031}
                        />
                      </label>
                    </div>
                    <div className="radius-row">
                      <label>
                        <span className="sr-only">Tìm bán kính gần (km)</span>
                        <input
                          name="radius"
                          type="number"
                          min={0.01}
                          max={1000}
                          step="any"
                          defaultValue={5}
                          required
                        />
                        <span>km</span>
                      </label>
                      <button className="button secondary" disabled={busy}>
                        Tìm gần đây <Search size={14} />
                      </button>
                    </div>
                  </form>
                  <small>Tọa độ mặc định: khu vực ĐHQG TP.HCM.</small>
                  {nearby !== null && (
                    <button
                      className="text-button"
                      onClick={() => setNearby(null)}
                    >
                      Hiện tất cả điểm hẹn
                    </button>
                  )}
                </Panel>
                <div className="zones-list">
                  {(nearby ?? zones).map((zone, index) => (
                    <Panel className="zone-card" key={zone.id} hover>
                      <div className={`zone-art zone-art-${index % 3}`}>
                        <MapPin size={27} strokeWidth={1.25} />
                        <span className="zone-map-line" />
                        <span className="badge emerald">
                          <span className="status-dot" /> Safe Zone
                        </span>
                      </div>
                      <div className="zone-content">
                        <h3>{zone.name}</h3>
                        <p>{zone.address}</p>
                        <div className="zone-coordinates">
                          <Navigation size={12} />
                          {zone.latitude.toFixed(4)},{" "}
                          {zone.longitude.toFixed(4)}
                          {zone.distance_km !== undefined && (
                            <b>{zone.distance_km.toFixed(2)} km</b>
                          )}
                        </div>
                        <button
                          className="copy-qr"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const qr = await api.qr(zone.id);
                              if (!navigator.clipboard)
                                throw new Error(
                                  "Trình duyệt chưa hỗ trợ clipboard. Hãy mở bằng localhost hoặc HTTPS.",
                                );
                              await navigator.clipboard.writeText(
                                qr.qr_code_hash,
                              );
                            }, "Đã sao chép mã QR điểm hẹn.")
                          }
                        >
                          <Copy size={14} /> Sao chép mã QR
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </Panel>
                  ))}
                </div>
                {(nearby ?? zones).length === 0 && (
                  <Empty
                    title="Chưa có điểm hẹn"
                    detail="Thử tăng bán kính hoặc thêm địa điểm mới."
                  />
                )}
                <button
                  className="add-zone"
                  disabled={busy}
                  onClick={() => {
                    setFormError("");
                    setModal("zone");
                  }}
                >
                  <Plus size={16} /> Thêm điểm hẹn
                </button>
                <div className="safety-note">
                  <ShieldCheck size={17} />
                  <p>
                    Check-in bằng QR tại điểm hẹn giúp bảo vệ cam kết của cả
                    hai.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
      {modal === "skill" && (
        <Modal
          title="Chia sẻ kỹ năng"
          subtitle="Một điều bạn biết có thể là điều ai đó đang cần."
          onClose={() => setModal(null)}
          busy={busy}
        >
          <form className="form" onSubmit={createSkill}>
            <label>
              Tên kỹ năng
              <input
                name="title"
                minLength={2}
                maxLength={160}
                required
                placeholder="Ví dụ: Nhập môn thiết kế Figma"
              />
            </label>
            <div className="form-grid">
              <label>
                Loại
                <select name="skill_type">
                  <option value="OFFER">Đang dạy · OFFER</option>
                  <option value="NEED">Cần học · NEED</option>
                </select>
              </label>
              <label>
                Trình độ
                <select name="proficiency_level">
                  {Object.entries(LEVELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Danh mục
              <input
                name="category"
                minLength={2}
                maxLength={80}
                list="categories"
                required
                placeholder="Thiết kế, Lập trình, Ngoại ngữ…"
              />
              <datalist id="categories">
                {[...new Set(skills.map((item) => item.category))].map(
                  (item) => (
                    <option key={item} value={item} />
                  ),
                )}
              </datalist>
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Để sau
              </button>
              <button className="button primary" disabled={busy}>
                <BusyLabel busy={busy}>
                  Đăng kỹ năng <Plus size={16} />
                </BusyLabel>
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "zone" && (
        <Modal
          title="Thêm điểm hẹn"
          subtitle="Chọn địa điểm công cộng, an toàn trong khuôn viên."
          onClose={() => setModal(null)}
          busy={busy}
        >
          <form className="form" onSubmit={createZone}>
            <label>
              Tên điểm hẹn
              <input name="name" minLength={2} maxLength={120} required />
            </label>
            <label>
              Địa chỉ
              <input name="address" minLength={5} maxLength={240} required />
            </label>
            <div className="form-grid">
              <label>
                Vĩ độ
                <input
                  name="latitude"
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  required
                  defaultValue={10.8702}
                />
              </label>
              <label>
                Kinh độ
                <input
                  name="longitude"
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  required
                  defaultValue={106.8031}
                />
              </label>
            </div>
            <label>
              Mã QR điểm hẹn
              <input
                name="qr_code_hash"
                minLength={16}
                maxLength={256}
                required
                placeholder="Tối thiểu 16 ký tự"
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                <BusyLabel busy={busy}>
                  Lưu điểm hẹn <Check size={16} />
                </BusyLabel>
              </button>
            </div>
          </form>
        </Modal>
      )}
      {booking && (
        <Modal
          title="Đặt lịch học"
          subtitle={booking.title + " · " + booking.user.full_name}
          onClose={() => setBooking(null)}
          busy={busy}
        >
          <form className="form" onSubmit={book}>
            <label>
              Điểm hẹn an toàn
              <select
                name="safe_zone_id"
                required
                defaultValue={zones[0]?.id ?? ""}
              >
                <option value="" disabled>
                  Chọn Safe Zone
                </option>
                {zones.map((zone) => (
                  <option value={zone.id} key={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Bắt đầu
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label>
                Kết thúc
                <input
                  type="datetime-local"
                  required
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>
            <fieldset>
              <legend>Micro-Contract · 3 mục tiêu</legend>
              {[1, 2, 3].map((index) => (
                <label key={index}>
                  Mục tiêu 0{index}
                  <input
                    name={`goal${index}`}
                    required
                    minLength={3}
                    maxLength={300}
                    placeholder={
                      index === 1
                        ? "Hiểu và giải thích được kiến thức nền"
                        : index === 2
                          ? "Hoàn thành một bài tập thực hành"
                          : "Tự áp dụng vào một ví dụ mới"
                    }
                  />
                </label>
              ))}
            </fieldset>
            <div className="escrow-summary">
              <LockKeyhole size={20} />
              <div>
                <strong>Khóa {cost} Credit vào Escrow</strong>
                <small>
                  1 giờ = 1 Credit · Làm tròn lên theo giờ · Số dư: {balance}
                </small>
              </div>
            </div>
            {!user.is_verified && (
              <p className="form-error">
                Hãy xác minh email .edu.vn trong Ví trước khi đặt lịch.
              </p>
            )}
            {cost > balance && (
              <p className="form-error">
                Số dư chưa đủ. Hãy nạp thêm trong Ví.
              </p>
            )}
            {zones.length === 0 && (
              <p className="form-error">
                Cần thêm điểm hẹn trước khi đặt lịch.
              </p>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setBooking(null)}
              >
                Để sau
              </button>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !user.is_verified ||
                  zones.length === 0 ||
                  cost > balance
                }
              >
                <BusyLabel busy={busy}>
                  <LockKeyhole size={15} /> Xác nhận & Khóa cọc
                </BusyLabel>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
