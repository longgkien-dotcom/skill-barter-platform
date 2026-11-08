"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowUpRight, RefreshCw } from "lucide-react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DiscoveryTab from "../components/DiscoveryTab";
import SessionsTab from "../components/SessionsTab";
import TribunalTab from "../components/TribunalTab";
import WalletTab from "../components/WalletTab";
import SupportChatbot, {
  type SupportDestination,
} from "../components/SupportChatbot";
import { isStudentAccount } from "../lib/auth-session";
import { TABS } from "../lib/constants";
import type { ApiStatus } from "../lib/api-transport";
import type {
  Dispute,
  RunAction,
  SafeZone,
  Session,
  Skill,
  Tab,
  Transaction,
  User,
} from "../lib/types";

// [KIẾN TRÚC & THIẾT KẾ]: Workspace độc lập chỉ nhận user đã đăng nhập từ Home; dữ liệu, mutex và phiên vẫn do page điều phối.
// [TRỢ LÝ CHATBOT 24/7]: Chỉ mount tại Dashboard, không nằm trong RootLayout hay Landing; đổi user/logout unmount toàn bộ hội thoại.
// [GIAO DIỆN HEADER & SIDEBAR MỚI]: Giữ header pearl, rail satin và bốn tab hiện có; header marketing không có công tắc Dashboard.
// [GIAO DIỆN HỌC ONLINE OMEGLE]: Discovery chứa phòng OnlineBarter với sân khấu đối tác toàn chiều rộng và thumbnail PiP của người dùng.
// [BETA & LƯU TRẠNG THÁI]: Home khôi phục tab/channel sau khi xác nhận phiên; journal Online riêng từng user giữ chat, PiP, mục tiêu và đánh giá, không thay ledger API.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Chuyển tab bằng AnimatePresence, reduced-motion giữ nguyên; không thêm hiệu ứng vào chuỗi tiếng Việt.
// [KẾT NỐI API]: Callback run/onRefresh/onSwitchUser nối về Home như trước; không thay endpoint, payload, ledger hoặc quyền xác thực.
// [CẨN THẬN KHI SỬA]: Không mount component này khi chưa có phiên; giữ key user và lọc ledger theo owner để tránh trộn tài khoản.
// [ĐIỂM MỞ RỘNG]: Có thể tách tab thành route con sau này; gate xác thực và phạm vi chatbot phải giữ ở ranh giới workspace.
interface DashboardProps {
  data: {
    users: User[];
    skills: Skill[];
    zones: SafeZone[];
    sessions: Session[];
    disputes: Dispute[];
  };
  user: User;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  online: boolean;
  apiStatus: ApiStatus;
  loading: boolean;
  busy: boolean;
  loadError: string;
  onRefresh: () => void;
  onLogout: () => void;
  onSwitchUser: (id: string) => void;
  run: RunAction;
  discoveryChannel: "campus" | "online";
  onDiscoveryChannelChange: (channel: "campus" | "online") => void;
  transactions: Transaction[];
  ledgerOwner: string;
  ledgerLoading: boolean;
  ledgerError: string;
  onSupportNavigate: (destination: SupportDestination) => void;
}
export default function Dashboard({
  data,
  user,
  tab,
  onTabChange,
  online,
  apiStatus,
  loading,
  busy,
  loadError,
  onRefresh,
  onLogout,
  onSwitchUser,
  run,
  discoveryChannel,
  onDiscoveryChannelChange,
  transactions,
  ledgerOwner,
  ledgerLoading,
  ledgerError,
  onSupportNavigate,
}: DashboardProps) {
  const reduced = useReducedMotion();
  const currentTab = TABS.find((item) => item.id === tab)!;
  return (
    <>
      <section
        id="live-workspace"
        className="live-workspace"
        aria-label="Bảng điều khiển tương tác"
      >
        <div className="app-shell">
          <Sidebar
            tab={tab}
            onChange={onTabChange}
            online={online}
            demoMode={apiStatus.mode === "demo"}
            onLogout={onLogout}
            busy={busy}
            sessionCount={
              data.sessions.filter(
                (item) =>
                  [item.teacher_id, item.student_id].includes(user.id) &&
                  ["ESCROWED", "IN_PROGRESS"].includes(item.status),
              ).length
            }
            disputeCount={
              data.disputes.filter((item) => item.status === "PENDING").length
            }
          />
          <div className="app-body">
            <Header
              users={data.users.filter(isStudentAccount)}
              user={user}
              onSwitch={onSwitchUser}
              onRefresh={onRefresh}
              loading={loading}
              busy={busy}
              onLogout={onLogout}
              workspace={currentTab.short}
              connected={online}
              teacherIds={data.skills
                .filter((skill) => skill.skill_type === "OFFER")
                .map((skill) => skill.user_id)}
            />
            <section
              id="main"
              className="dashboard-main"
              role="main"
              tabIndex={-1}
              aria-label="Không gian làm việc"
            >
              {apiStatus.mode === "demo" && (
                <p className="api-mode-notice" role="status">
                  <b>Chế độ trải nghiệm</b>
                  {apiStatus.persistent
                    ? " · Dữ liệu và Credit lưu riêng trên trình duyệt này."
                    : " · Trình duyệt chặn lưu trữ; dữ liệu chỉ giữ trong lần mở trang này."}
                </p>
              )}
              <div className="page-heading">
                <div>
                  <div className="breadcrumb">
                    Không gian của bạn <span>/</span>
                    <b>{currentTab.short}</b>
                  </div>
                  <h1>
                    {currentTab.label}
                    <span className="heading-period">.</span>
                  </h1>
                  <p>{currentTab.description}</p>
                </div>
                <div className="campus-badge">
                  <span className="campus-emblem">ĐH</span>
                  <span>
                    Cộng đồng sinh viên
                    <b>
                      ĐHQG TP. Hồ Chí Minh <ArrowUpRight size={13} />
                    </b>
                  </span>
                </div>
              </div>
              {loadError && (
                <div className="error-banner" role="alert">
                  <AlertCircle size={20} />
                  <div>
                    <b>Chưa thể đồng bộ dữ liệu</b>
                    <p>{loadError}</p>
                  </div>
                  <button
                    className="button secondary"
                    disabled={loading || busy}
                    onClick={onRefresh}
                  >
                    Thử lại <RefreshCw size={14} />
                  </button>
                </div>
              )}
              {loading && !user && (
                <div className="loading-state" role="status">
                  <RefreshCw className="spin" size={23} />
                  <p>Đang kết nối không gian học tập…</p>
                </div>
              )}
              {!loading && !loadError && !user && (
                <div className="empty">
                  <h2>Chưa có hồ sơ sinh viên</h2>
                  <p>
                    Chạy dữ liệu seed của backend để bắt đầu sử dụng bộ chuyển
                    tài khoản demo.
                  </p>
                </div>
              )}
              {user && (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    aria-busy={busy || loading}
                    className={loadError ? "workspace-stale" : "workspace"}
                  >
                    <fieldset className="workspace-fieldset" disabled={busy}>
                      <div key={user.id}>
                        {tab === "discovery" && (
                          <DiscoveryTab
                            channel={discoveryChannel}
                            onChannelChange={onDiscoveryChannelChange}
                            users={data.users}
                            skills={data.skills}
                            zones={data.zones}
                            user={user}
                            busy={busy}
                            run={run}
                            onBooked={() => onTabChange("sessions")}
                          />
                        )}
                        {tab === "sessions" && (
                          <SessionsTab
                            users={data.users}
                            sessions={data.sessions}
                            user={user}
                            busy={busy}
                            run={run}
                            onSwitch={onSwitchUser}
                          />
                        )}
                        {tab === "tribunal" && (
                          <TribunalTab
                            disputes={data.disputes}
                            zones={data.zones}
                            user={user}
                            busy={busy}
                            run={run}
                          />
                        )}
                        {tab === "wallet" && (
                          <WalletTab
                            transactions={
                              ledgerOwner === user.id ? transactions : []
                            }
                            ledgerLoading={
                              ledgerLoading || ledgerOwner !== user.id
                            }
                            ledgerError={
                              ledgerOwner === user.id ? ledgerError : ""
                            }
                            user={user}
                            busy={busy}
                            run={run}
                          />
                        )}
                      </div>
                    </fieldset>
                  </motion.div>
                </AnimatePresence>
              )}
              <footer className="page-footer">
                <span>SkillBarter · Trao tri thức, nhận tương lai.</span>
                <span>
                  1 giờ = 1 Credit <span className="footer-dot">·</span> Công
                  bằng từ những điều nhỏ.
                </span>
              </footer>
            </section>
          </div>
        </div>
      </section>
      <SupportChatbot
        key={user.id}
        user={user}
        busy={busy}
        onNavigate={onSupportNavigate}
      />
    </>
  );
}
