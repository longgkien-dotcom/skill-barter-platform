"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Inbox, LoaderCircle, X } from "lucide-react";

// [KIẾN TRÚC & THIẾT KẾ]: Thành phần nền dùng chung: card kính navy bo 16px, border slate và khoảng cách theo nhịp 4px.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: Card reveal một lần và nâng 3px khi hover; tắt dịch chuyển khi reduced-motion.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Dialog native giữ focus, hỗ trợ Escape và trả focus về nút mở.
// [KẾT NỐI API]: Không gọi endpoint; busy truyền từ lớp điều phối để chặn gửi form hai lần.
// [CẨN THẬN KHI SỬA]: Không lồng dialog/form; onClose không được bỏ qua trạng thái đang ghi dữ liệu.
// [ĐIỂM MỞ RỘNG]: Có thể gắn uploader hoặc camera trong Modal mà giữ nguyên cơ chế focus.
// [SỬA TRÀN MOBILE]: Dialog dùng native focus trap và vùng cuộn giới hạn 90dvh; form/grid/buttons co về một cột qua responsive.css, không thay submit/API.
export const ActionErrorContext = createContext("");
export function Panel({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      className={`panel ${className}`}
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      whileHover={hover && !reduced ? { y: -3 } : undefined}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.section>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const apiError = useContext(ActionErrorContext);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      aria-describedby={subtitle ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p id={`${id}-description`}>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng hộp thoại"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {apiError && (
        <p role="alert" className="form-error modal-error">
          {apiError}
        </p>
      )}
      {children}
    </dialog>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <Inbox size={30} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function BusyLabel({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {busy && <LoaderCircle className="spin" size={16} />} {children}
    </>
  );
}
export function Milestones({ items }: { items: string[] }) {
  return (
    <ol className="milestones">
      {items.map((item, index) => (
        <li key={index}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          {item}
        </li>
      ))}
    </ol>
  );
}
