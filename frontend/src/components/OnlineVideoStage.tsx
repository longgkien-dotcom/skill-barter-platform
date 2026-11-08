"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  GraduationCap,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Plus,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import type { User } from "../lib/types";
import IdentityChip, { IdentityAvatar } from "./IdentityChip";

// [BỐ CỤC VIDEO PIP]: Đối tác là sân khấu chính toàn chiều rộng; camera người dùng là thumbnail nổi góc phải dưới, không còn grid 50/50.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Ẩn/hiện preview độc lập camera và micro; nút khôi phục luôn còn trên sân khấu khi thumbnail bị ẩn.
// [KẾT NỐI API]: Chỉ nhận hồ sơ và state media mô phỏng từ OnlineBarter, không gọi getUserMedia hoặc thay escrow/chat/countdown.
// [CẨN THẬN KHI SỬA]: Ẩn preview không có nghĩa tắt camera; giữ nhãn riêng. Fullscreen chỉ được gọi từ click người dùng và đồng bộ khi Escape.
// [KIẾN TRÚC & THIẾT KẾ]: Fullscreen API ưu tiên; nếu trình duyệt từ chối, portal tạo chế độ phóng to có khóa cuộn và vòng focus bàn phím.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Giữ waveform mô phỏng hiện có; CSS reduced-motion tắt animation, không tự yêu cầu fullscreen lúc mount.
// [ĐIỂM MỞ RỘNG]: Có thể thay avatar bằng stream thật sau này; layout, trạng thái preview và điều khiển truy cập vẫn dùng chung.
// [SỬA TRÀN MOBILE]: Dưới 1024px phòng thường xếp partner/self theo chiều dọc; desktop và fullscreen vẫn dùng PiP. Nút ×/+ giữ nguyên trạng thái đã lưu.
const waveHeights = [12, 20, 32, 18, 42, 27, 48, 24, 36, 20, 31, 16, 10];

export default function OnlineVideoStage({
  user,
  partner,
  localRole,
  partnerRole,
  muted,
  camera,
  onToggleMute,
  onToggleCamera,
  previewVisible,
  onTogglePreview,
}: {
  user: User;
  partner: User;
  localRole: string;
  partnerRole: string;
  muted: boolean;
  camera: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  previewVisible: boolean;
  onTogglePreview: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const previewId = useId();
  const reduced = useReducedMotion();
  function togglePreview() {
    onTogglePreview();
    window.requestAnimationFrame(() =>
      (previewVisible ? restoreButton : closeButton).current?.focus({
        preventScroll: true,
      }),
    );
  }
  useEffect(() => {
    function syncFullscreen() {
      const active =
        stage.current !== null && document.fullscreenElement === stage.current;
      if (wasFullscreen.current && !active)
        expandButton.current?.focus({ preventScroll: true });
      wasFullscreen.current = active;
      setFullscreen(active);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stage.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);
  function exitExpanded() {
    setExpanded(false);
    window.requestAnimationFrame(() =>
      expandButton.current?.focus({ preventScroll: true }),
    );
  }
  async function toggleExpand() {
    if (pending) return;
    if (expanded) {
      exitExpanded();
      return;
    }
    const element = stage.current;
    if (!element) return;
    setPending(true);
    try {
      if (document.fullscreenElement === element)
        await document.exitFullscreen();
      else if (document.fullscreenEnabled && element.requestFullscreen)
        await element.requestFullscreen();
      else setExpanded(true);
    } catch {
      // [CẨN THẬN KHI SỬA]: Iframe/trình duyệt có thể chặn fullscreen; phóng to bằng portal thay vì để nút không có tác dụng.
      if (element.isConnected && document.fullscreenElement !== element)
        setExpanded(true);
    } finally {
      setPending(false);
    }
  }
  function expandedKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!expanded) return;
    if (event.key === "Escape") {
      event.preventDefault();
      exitExpanded();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = stage.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    if (!buttons?.length) return;
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === stage.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  const active = fullscreen || expanded;
  const content = (
    <div
      ref={stage}
      className={`online-video-stage ${active ? "is-expanded" : ""}`}
      role={expanded ? "dialog" : "region"}
      aria-modal={expanded || undefined}
      aria-label={`Sân khấu học cùng ${partner.full_name}`}
      data-preview-visible={previewVisible}
      tabIndex={-1}
      onKeyDown={expandedKeys}
    >
      <div className="online-video remote-video">
        <div className="online-video-top">
          <span>
            <span className="online-status-dot" /> Đối tác
          </span>
          <Video size={14} />
        </div>
        <div className="online-video-center">
          <div className="online-video-avatar">
            <IdentityAvatar person={partner} size="medium" />
          </div>
          <div className="online-waveform" aria-hidden="true">
            {waveHeights.map((height, index) => (
              <i
                key={index}
                style={{ height, animationDelay: `${index * 0.07}s` }}
              />
            ))}
          </div>
        </div>
        <div className="online-video-identity">
          <IdentityChip person={partner} role={partnerRole} />
          <span className="online-school">
            <GraduationCap size={12} /> Cộng đồng đại học ·{" "}
            {partner.email.split("@")[1]}
          </span>
        </div>
      </div>
      <button
        ref={expandButton}
        type="button"
        className="online-stage-expand"
        disabled={pending}
        aria-label={
          active
            ? "Thu nhỏ khung hình đối tác"
            : "Toàn màn hình khung hình đối tác"
        }
        title={active ? "Thu nhỏ · Escape" : "Phóng to khung hình đối tác"}
        aria-pressed={active}
        onClick={() => void toggleExpand()}
      >
        {active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      {!previewVisible && (
        <button
          ref={restoreButton}
          type="button"
          className="online-preview-restore"
          aria-label="Hiện lại hình xem trước của tôi"
          aria-expanded={false}
          title="Hiện hình xem trước"
          onClick={togglePreview}
        >
          <Plus size={19} />
        </button>
      )}
      {previewVisible && (
        <motion.div
          className="online-local-wrapper"
          id={previewId}
          aria-label="Camera cá nhân dạng Picture-in-Picture"
          initial={{
            opacity: reduced ? 1 : 0,
            scale: reduced ? 1 : 0.96,
            y: reduced ? 0 : 6,
          }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <button
            ref={closeButton}
            type="button"
            className="online-preview-close"
            aria-label="Ẩn hình xem trước của tôi"
            aria-expanded={true}
            aria-controls={previewId}
            title="Ẩn hình xem trước"
            onClick={togglePreview}
          >
            <X size={14} />
          </button>
          <div className="online-video local-video">
            <div className="online-self-caption">
              <b>{user.full_name}</b>
              <span>Bạn · {localRole}</span>
            </div>
            <div className="online-self-camera">
              {camera ? (
                <IdentityAvatar person={user} size="medium" />
              ) : (
                <span className="online-self-camera-off">
                  <VideoOff size={22} />
                  <small>Camera đã tắt</small>
                </span>
              )}
            </div>
          </div>
          <div className="online-media-controls">
            <button
              type="button"
              aria-label={muted ? "Bật micro" : "Tắt micro"}
              aria-pressed={!muted}
              onClick={onToggleMute}
            >
              {muted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
            <button
              type="button"
              aria-label={camera ? "Tắt camera" : "Bật camera"}
              aria-pressed={camera}
              onClick={onToggleCamera}
            >
              {camera ? <Video size={17} /> : <VideoOff size={17} />}
            </button>
          </div>
        </motion.div>
      )}
      <span className="sr-only" role="status">
        {previewVisible
          ? "Hình xem trước cá nhân đang hiển thị."
          : "Đã ẩn hình xem trước cá nhân. Micro và camera không thay đổi."}
        {active ? " Khung đối tác đang phóng to. Nhấn Escape để thoát." : ""}
      </span>
    </div>
  );
  return expanded
    ? createPortal(
        <div className="mode-app online-stage-overlay">{content}</div>,
        document.body,
      )
    : content;
}
