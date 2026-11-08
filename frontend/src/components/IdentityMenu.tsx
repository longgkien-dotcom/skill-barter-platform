"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, LogOut } from "lucide-react";
import type { User } from "../lib/types";
import IdentityChip, { identityRole } from "./IdentityChip";
import { mobilePopoverLayout } from "../lib/floating-layout";

// [KIẾN TRÚC & THIẾT KẾ]: Capsule gradient navy và popover trắng 320px thay native select; chữ tương phản riêng cho từng surface.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: AnimatePresence opacity/y8 trong 160ms và chevron xoay 180°; reduced-motion bỏ dịch chuyển.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Click chọn, click ngoài/Escape đóng; ArrowUp/Down/Home/End đổi focus; Tab ra khỏi danh sách.
// [KẾT NỐI API]: onSwitch giữ nguyên luồng Home: đổi ID và đồng bộ snapshot/ledger qua API cũ; menu không tự gửi request.
// [CẨN THẬN KHI SỬA]: Khóa chọn khi busy; đối chiếu ID thực, không dùng tên làm key; role chỉ là nhãn UI, không phải authentication.
// [ĐIỂM MỞ RỘNG]: Thêm tìm kiếm/phân nhóm khi danh sách nhiều; giữ focus management và thông tin active aria-selected.
// [THIẾT KẾ BESIDE HERO & LANDING]: Viền slate/indigo, lõi avatar hai vòng, check emerald và credit amber giữ vẻ sang nhẹ.
// [HIỆU ỨNG CUỘN CHUỘT - SCROLL MOTION]: Menu có vùng cuộn riêng và scrollIntoView nearest khi dùng bàn phím, không cuộn lại toàn trang.
// [NỘI DUNG & Ý TƯỞNG HÌNH THÀNH]: Tên, Trust và tổng Credit đều từ hồ sơ API, không tạo số minh họa trong menu thật.
// [CHUYỂN ĐỔI LANDING <-> DASHBOARD]: Menu chỉ có trong Header Dashboard; đổi hồ sơ giữ phiên, logout xóa state tài khoản tại Home trước khi hiển thị Story.
// [PHỐI MÀU TRẮNG - ĐEN - XANH NAVY]: Capsule navy trên pearl header, menu trắng và nút logout rose; focus/keyboard giữ nguyên.
// [LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT BẮT BUỘC]: Đổi Demo account giữ phiên; logout ở footer xóa phiên qua Home, không phải chỉ đóng popover.
// [SỬA TRÀN MOBILE]: Đo capsule/visualViewport trước paint để clamp menu; theo resize/scroll/bàn phím, giữ hành vi focus/listbox và desktop right-aligned cũ.
export default function IdentityMenu({
  users,
  user,
  teacherIds,
  busy,
  onSwitch,
  onLogout,
}: {
  users: User[];
  user?: User;
  teacherIds: readonly string[];
  busy: boolean;
  onSwitch: (id: string) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (!open || !root.current || !popover.current) return;
    const anchor = root.current,
      menu = popover.current;
    let frame = 0;
    function place() {
      if (window.innerWidth >= 1024) {
        for (const property of ["left", "right", "top", "width", "max-height"])
          menu.style.removeProperty(property);
        return;
      }
      const viewport = window.visualViewport;
      const layout = mobilePopoverLayout(anchor.getBoundingClientRect(), {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        left: viewport?.offsetLeft,
        top: viewport?.offsetTop,
      });
      Object.assign(menu.style, {
        left: `${layout.left}px`,
        right: "auto",
        top: `${layout.top}px`,
        width: `${layout.width}px`,
        maxHeight: `${layout.maxHeight}px`,
      });
    }
    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(place);
    }
    place();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(anchor);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function focusOption(index: number) {
    const option = options.current[index];
    option?.focus({ preventScroll: true });
    option?.scrollIntoView({ block: "nearest" });
  }
  function showMenu(last = false) {
    if (busy || !users.length) return;
    setOpen(true);
    const selected = users.findIndex((person) => person.id === user?.id);
    window.requestAnimationFrame(() =>
      focusOption(last ? users.length - 1 : Math.max(0, selected)),
    );
  }
  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.current.findIndex(
      (option) => option === document.activeElement,
    );
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(
        (index + (event.key === "ArrowDown" ? 1 : -1) + users.length) %
          users.length,
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusOption(event.key === "Home" ? 0 : users.length - 1);
    }
  }
  return (
    <div
      className="identity-switcher"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="identity-capsule"
        aria-label={`Chuyển tài khoản${user ? `: ${user.full_name}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={busy || !users.length}
        onClick={() => (open ? setOpen(false) : showMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            showMenu(event.key === "ArrowUp");
          }
        }}
      >
        {user ? (
          <IdentityChip
            person={user}
            role={identityRole(user, teacherIds)}
            size="medium"
          />
        ) : (
          <span className="identity-empty">Chưa có tài khoản</span>
        )}
        <motion.span
          className="identity-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <ChevronDown size={15} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popover}
            className="identity-popover"
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 6 }}
            transition={{ duration: reduced ? 0 : 0.16 }}
          >
            <div className="identity-popover-heading">
              <b>Chuyển tài khoản</b>
              <span>{users.length} hồ sơ</span>
            </div>
            <div
              id={id}
              role="listbox"
              aria-label="Tài khoản sinh viên"
              className="identity-options"
              onKeyDown={menuKeys}
            >
              {users.map((person, index) => (
                <button
                  ref={(node) => {
                    options.current[index] = node;
                  }}
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={person.id === user?.id}
                  className="identity-option"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    if (person.id !== user?.id) onSwitch(person.id);
                    trigger.current?.focus();
                  }}
                >
                  <IdentityChip
                    person={person}
                    role={identityRole(person, teacherIds)}
                  />
                  <span className="identity-option-credit">
                    {person.standard_balance + person.premium_balance}
                    <small> CR</small>
                  </span>
                  <span className="identity-option-check" aria-hidden="true">
                    {person.id === user?.id && <Check size={15} />}
                  </span>
                </button>
              ))}
            </div>
            <div className="identity-popover-foot">
              <button
                type="button"
                className="profile-logout"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={16} /> Đăng xuất tài khoản
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
