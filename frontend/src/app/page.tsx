"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import Dashboard from "./Dashboard";
import SiteNavbar from "../components/SiteNavbar";
import StoryLanding from "../components/StoryLanding";
import StudentLogin from "../components/StudentLogin";
import type { SupportDestination } from "../components/SupportChatbot";
import { ActionErrorContext } from "../components/ui";
import {
  api,
  getApiStatus,
  getServerApiStatus,
  subscribeApiStatus,
} from "../lib/api";
import { readWorkspaceView, writeWorkspaceView } from "../lib/workspace-view";
import {
  AUTH_SESSION_KEY,
  clearSession,
  isStudentAccount,
  readSession,
  resolveSessionUser,
  writeSession,
} from "../lib/auth-session";
import type {
  Dispute,
  SafeZone,
  Session,
  Skill,
  Tab,
  Transaction,
  User,
} from "../lib/types";

// [KIẾN TRÚC & THIẾT KẾ]: App shell giữ snapshot chung; Story và Dashboard là hai cây giao diện riêng, theme sáng/tối được giới hạn theo từng vùng.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: AnimatePresence chuyển tab, MotionConfig tôn trọng giảm chuyển động; card tự reveal theo scroll.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Giữ hồ sơ đã chọn, hiển thị tải/lỗi/thành công, đồng bộ ví sau mỗi mutation.
// [KẾT NỐI API]: GET users/skills/safe-zones/sessions/disputes theo snapshot; ledger tải riêng theo user với AbortController.
// [CẨN THẬN KHI SỬA]: Mutex chặn double-submit; generation chặn response cũ; không tự retry mutation khi mất mạng.
// [ĐIỂM MỞ RỘNG]: Có thể thay snapshot bằng query cache/SSE và URL tab; giữ ranh giới actor qua toàn bộ mutation.
// [THIẾT KẾ BESIDE HERO & LANDING]: Story chỉ có navbar/hero/câu chuyện/portal; dashboard không xuất hiện dưới cuối trang giới thiệu.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: requestAnimationFrame chờ React hiện/ẩn Story trước khi đo điểm cuộn; reduced-motion dùng behavior:auto.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Nội dung thuyết trình ở StoryLanding; điểm uy tín trung bình và badge lấy từ snapshot thực.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Render theo phiên hợp lệ; Home giữ snapshot và tab, logout xóa ID/tab và unmount toàn bộ workspace; chặn logout trong mutation.
// [GIAO DIỆN HỌC ONLINE OMEGLE]: Discovery nhận roster để minh họa ghép đôi; không thêm endpoint hay chuyển credit lẻ tới API.
// [HỆ THỐNG MÀU LUMINOUS NAVY]: dashboard.css định nghĩa surface trắng; tritone.css giới hạn chrome đen và phối Story sáng/tối, không ảnh hưởng dữ liệu.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Dashboard dùng canvas trắng trung tính trong frame navigation đen; navy chỉ cho hành động và trạng thái chọn.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: mode suy ra từ phiên và activeUser hợp lệ, không có setMode bypass; mọi CTA mở modal, chỉ logout trở về Landing.
// [TRỢ LÝ CHATBOT 24/7]: Home chỉ truyền callback; widget mount bên trong Dashboard đã xác thực, Landing không có orb hay hội thoại ẩn.
// [GIAO DIỆN HEADER & SIDEBAR MỚI]: Header nhận nhãn tab/kết nối thực, metric và rail chỉ đổi CSS; không thay payload hay thứ tự mutation.
type Snapshot = {
  users: User[];
  skills: Skill[];
  zones: SafeZone[];
  sessions: Session[];
  disputes: Dispute[];
};
const emptySnapshot: Snapshot = {
  users: [],
  skills: [],
  zones: [],
  sessions: [],
  disputes: [],
};
async function fetchSnapshot(): Promise<Snapshot> {
  // [NGUỒN DỮ LIỆU]: Transport đọc lại toàn bộ khi chuyển sang kho trình duyệt, tránh trộn actor/ví giữa hai nguồn.
  return api.snapshot();
}
export default function Home() {
  const apiStatus = useSyncExternalStore(
    subscribeApiStatus,
    getApiStatus,
    getServerApiStatus,
  );
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [dataMode, setDataMode] = useState(getServerApiStatus().mode);
  const previousApiMode = useRef(apiStatus.mode);
  const [authenticatedId, setAuthenticatedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("discovery");
  const [requestedTab, setRequestedTab] = useState<Tab>("discovery");
  const [discoveryChannel, setDiscoveryChannel] = useState<"campus" | "online">(
    "campus",
  );
  const [loginOpen, setLoginOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerOwner, setLedgerOwner] = useState("");
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const mutex = useRef(false);
  const generation = useRef(0);
  const authRef = useRef<string | null>(null);
  const restorePending = useRef(true);
  const reduced = useReducedMotion();
  const activeId = authenticatedId ?? "";
  const user = data.users.find((item) => item.id === activeId);
  const isAuthenticated = authenticatedId !== null && isStudentAccount(user);
  const mode = isAuthenticated ? "app" : "story";
  const liveCount = data.sessions.filter(
    (item) => item.status === "ESCROWED" || item.status === "IN_PROGRESS",
  ).length;
  const averageTrust =
    online && data.users.length
      ? data.users.reduce((sum, person) => sum + person.trust_score, 0) /
        data.users.length
      : null;
  const applySnapshot = useCallback((snapshot: Snapshot) => {
    setData(snapshot);
    setDataMode(getApiStatus().mode);
    let id = authRef.current;
    const restoring = restorePending.current;
    if (restorePending.current) {
      restorePending.current = false;
      id ??= readSession();
    }
    const activeUser = resolveSessionUser(snapshot.users, id);
    authRef.current = activeUser?.id ?? null;
    setAuthenticatedId(activeUser?.id ?? null);
    if (activeUser && restoring) {
      const view = readWorkspaceView(activeUser.id);
      if (view) {
        setTab(view.tab);
        setDiscoveryChannel(view.channel);
      }
    }
    if (id && !activeUser) {
      clearSession();
      setTransactions([]);
      setLedgerOwner("");
    }
    setOnline(true);
    setLoadError("");
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (isAuthenticated && authRef.current === activeId)
      writeWorkspaceView(activeId, { tab, channel: discoveryChannel });
  }, [isAuthenticated, activeId, tab, discoveryChannel]);
  const resetAuthentication = useCallback(() => {
    restorePending.current = false;
    authRef.current = null;
    clearSession();
    setAuthenticatedId(null);
    setTab("discovery");
    setRequestedTab("discovery");
    setDiscoveryChannel("campus");
    setLoginOpen(false);
    setToast(null);
    setTransactions([]);
    setLedgerOwner("");
    setLedgerError("");
    setLedgerLoading(false);
  }, []);
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        (event.key === AUTH_SESSION_KEY && event.newValue === null) ||
        event.key === null
      )
        resetAuthentication();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [resetAuthentication]);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const snapshot = await fetchSnapshot();
      if (current !== generation.current) return false;
      applySnapshot(snapshot);
      return true;
    } catch (error) {
      if (current === generation.current) {
        setOnline(false);
        setLoadError(
          error instanceof Error ? error.message : "Không tải được dữ liệu.",
        );
      }
      return false;
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [applySnapshot]);
  useEffect(() => {
    const previous = previousApiMode.current;
    previousApiMode.current = apiStatus.mode;
    // [ĐỔI NGUỒN]: Ledger mất mạng cũng phải làm mới roster; không để actor NestJS thao tác trên kho trình duyệt.
    if (previous === "backend" && apiStatus.mode === "demo") void refresh();
  }, [apiStatus.mode, refresh]);
  useEffect(() => {
    let active = true;
    const initialGeneration = ++generation.current;
    // [KẾT NỐI API]: Chỉ cập nhật state sau response I/O; cleanup loại response của lần mount cũ trong StrictMode.
    void fetchSnapshot()
      .then((snapshot) => {
        if (active && generation.current === initialGeneration)
          applySnapshot(snapshot);
      })
      .catch((error) => {
        if (active && generation.current === initialGeneration) {
          setOnline(false);
          setLoadError(
            error instanceof Error ? error.message : "Không tải được dữ liệu.",
          );
        }
      })
      .finally(() => {
        if (active && generation.current === initialGeneration)
          setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applySnapshot]);
  useEffect(() => {
    if (!activeId) return;
    const controller = new AbortController();
    async function loadLedger() {
      setLedgerLoading(true);
      setLedgerError("");
      try {
        const result = await api.transactions(activeId, controller.signal);
        if (!controller.signal.aborted) {
          setTransactions(result);
          setLedgerOwner(activeId);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setTransactions([]);
          setLedgerOwner(activeId);
          setLedgerError(
            error instanceof Error ? error.message : "Không tải được sổ cái.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLedgerLoading(false);
      }
    }
    void loadLedger();
    return () => controller.abort();
  }, [activeId, revision]);
  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const switchUser = (id: string) => {
    if (
      mutex.current ||
      !authRef.current ||
      !isStudentAccount(data.users.find((person) => person.id === id))
    )
      return;
    authRef.current = id;
    setAuthenticatedId(id);
    writeSession(id);
    setToast(null);
    void refresh();
    setDiscoveryChannel("campus");
  };
  const run = async (
    work: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    if (mutex.current || !authRef.current) return false;
    if (getApiStatus().mode !== dataMode) {
      await refresh();
      return false;
    }
    if (loadError) {
      setToast({
        kind: "error",
        message:
          "Dữ liệu chưa đồng bộ. Đóng hộp thoại và nhấn Tải lại dữ liệu trước khi thao tác.",
      });
      return false;
    }
    mutex.current = true;
    setBusy(true);
    setToast(null);
    try {
      await work();
      const synced = await refresh();
      setToast({
        kind: synced ? "success" : "error",
        message: synced
          ? success
          : `${success} Dữ liệu chưa đồng bộ; hãy tải lại trước khi thao tác tiếp.`,
      });
      return true;
    } catch (error) {
      setToast({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Thao tác chưa hoàn tất.",
      });
      await refresh();
      return false;
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  };
  function showStorySection(id: string) {
    if (mutex.current || authRef.current) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (id === "story-main") target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
  }
  function requestLogin(
    nextTab: Tab = "discovery",
    channel: "campus" | "online" = "campus",
  ) {
    if (mutex.current || authRef.current) return;
    setRequestedTab(nextTab);
    if (nextTab === "discovery") setDiscoveryChannel(channel);
    setToast(null);
    setLoginOpen(true);
  }
  function navigateFromSupport(destination: SupportDestination) {
    if (mutex.current || !authRef.current) return;
    const nextTab = destination === "online" ? "discovery" : destination;
    const channel = destination === "online" ? "online" : "campus";
    if (nextTab === "discovery") setDiscoveryChannel(channel);
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const main = document.getElementById("main");
      main?.focus({ preventScroll: true });
      main?.scrollIntoView({
        block: "start",
        behavior: reduced ? "auto" : "smooth",
      });
    });
  }
  function enterStudent(id: string) {
    const student = data.users.find((person) => person.id === id);
    if (mutex.current || !isStudentAccount(student)) return;
    restorePending.current = false;
    authRef.current = id;
    setAuthenticatedId(id);
    writeSession(id);
    setToast(null);
    setLoginOpen(false);
    setTab(requestedTab);
    window.requestAnimationFrame(() => {
      const target = document.getElementById("main");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
    void refresh();
  }
  function logout() {
    if (mutex.current) return;
    resetAuthentication();
    window.requestAnimationFrame(() => {
      document.getElementById("story-main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
  }
  return (
    <ActionErrorContext.Provider
      value={toast?.kind === "error" ? toast.message : ""}
    >
      <MotionConfig reducedMotion="user">
        <div className={`site-experience mode-${mode}`}>
          <a
            className="skip-link"
            href={mode === "story" ? "#story-main" : "#main"}
          >
            Đến nội dung chính
          </a>
          {mode === "story" && (
            <>
              <SiteNavbar
                onSection={showStorySection}
                onStart={() => requestLogin()}
                busy={busy}
              />
              <StoryLanding
                onOpen={requestLogin}
                onSection={showStorySection}
                averageTrust={averageTrust}
                liveCount={liveCount}
                connected={online}
                onLogin={() => requestLogin()}
              />
            </>
          )}
          {isAuthenticated && user && (
            <Dashboard
              key={user.id}
              data={data}
              user={user}
              tab={tab}
              onTabChange={setTab}
              online={online}
              apiStatus={apiStatus}
              loading={loading}
              busy={busy}
              loadError={loadError}
              onRefresh={() => void refresh()}
              onLogout={logout}
              onSwitchUser={switchUser}
              run={run}
              discoveryChannel={discoveryChannel}
              onDiscoveryChannelChange={setDiscoveryChannel}
              transactions={transactions}
              ledgerOwner={ledgerOwner}
              ledgerLoading={ledgerLoading}
              ledgerError={ledgerError}
              onSupportNavigate={navigateFromSupport}
            />
          )}
          {loginOpen && mode === "story" && (
            <StudentLogin
              users={data.users}
              loading={loading}
              error={loadError}
              onSelect={enterStudent}
              onClose={() => setLoginOpen(false)}
              onRetry={() => void refresh()}
            />
          )}
          <AnimatePresence>
            {toast && (
              <motion.div
                className={`toast ${toast.kind}`}
                role={toast.kind === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {toast.kind === "success" ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                <p>{toast.message}</p>
                <button
                  className="icon-button"
                  aria-label="Đóng thông báo"
                  onClick={() => setToast(null)}
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </ActionErrorContext.Provider>
  );
}
