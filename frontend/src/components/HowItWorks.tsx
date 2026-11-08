"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  LockKeyhole,
  QrCode,
  Scale,
} from "lucide-react";

// [KIẾN TRÚC & THIẾT KẾ]: Stepper bốn cột trên stone, một thẻ nội dung ivory tránh lặp tiêu đề dài.
// [HIỆU ỨNG CHUYỂN ĐỘNG]: AnimatePresence đổi quy tắc 180ms; reduced-motion bỏ dịch chuyển và height animation.
// [GIAO DIỆN & LUỒNG NGƯỜI DÙNG]: Thu gọn hướng dẫn hoặc chọn bước để đọc quy tắc và xem ví dụ trực quan.
// [KẾT NỐI API]: Nội dung giải thích API xác minh, book, check-in, check-out và votes; module không gửi request.
// [CẨN THẬN KHI SỬA]: Không hứa xác nhận hai phía: backend hiện cho một participant check-in và teacher nghiệm thu.
// [ĐIỂM MỞ RỘNG]: Liên kết từng bước với tác vụ thực và onboarding theo trạng thái hồ sơ.
const steps = [
  {
    title: "Định danh sinh viên",
    subtitle: "Bắt đầu với +1 Credit",
    icon: BadgeCheck,
    rule: "Xác thực email .edu.vn để nhận +1 Standard Credit. Một giờ = một Credit; ví Standard tối đa 20 Credit để chống đầu cơ.",
    visual: "+1",
    unit: "STANDARD CREDIT",
    caption: "Vốn khởi đầu cho tri thức mới",
  },
  {
    title: "Cam kết & Ký quỹ",
    subtitle: "3 mục tiêu, một lời hẹn",
    icon: LockKeyhole,
    rule: "Chọn điểm hẹn, thời gian và ghi rõ 3 mục tiêu trong Micro-Contract. Credit được khóa ngay vào ký quỹ Escrow khi đặt lịch.",
    visual: "03",
    unit: "MỤC TIÊU RÕ RÀNG",
    caption: "Tín dụng an toàn trong ký quỹ",
  },
  {
    title: "Gặp nhau an toàn",
    subtitle: "Safe Zone & QR check-in",
    icon: QrCode,
    rule: "Gặp tại thư viện hoặc căn tin trong trường. Quét QR của Safe Zone để bắt đầu phiên học; báo vắng sau 15 phút nếu người dạy không đến.",
    visual: "QR",
    unit: "CHECK-IN TẠI CHỖ",
    caption: "Một điểm hẹn, nhiều kết nối",
  },
  {
    title: "Nghiệm thu công bằng",
    subtitle: "Bằng chứng & cộng đồng",
    icon: Scale,
    rule: "Người dạy nộp URL ảnh để nghiệm thu và nhận Credit. Nếu có khiếu nại, 3 sinh viên ngoài phiên có Trust Score ≥ 4.5 bỏ phiếu phân xử.",
    visual: "4.5",
    unit: "TRUST SCORE TỐI THIỂU",
    caption: "Cộng đồng gìn giữ sự công bằng",
  },
];
export default function HowItWorks() {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const step = steps[active];
  return (
    <section className="guide" aria-label="Cách nền tảng hoạt động">
      <button
        className="guide-toggle"
        aria-expanded={open}
        aria-controls="guide-content"
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className="guide-symbol">↗</span>
          <strong>Cách nền tảng hoạt động</strong>
          <span className="guide-caption">4 bước để trao đổi tri thức</span>
        </span>
        <ChevronDown size={18} className={open ? "rotated" : ""} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="guide-content"
            initial={{ height: reduced ? "auto" : 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: reduced ? "auto" : 0, opacity: 0 }}
            className="guide-body"
          >
            <div className="steps">
              {steps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    className={`step ${active === index ? "selected" : ""}`}
                    aria-pressed={active === index}
                    onClick={() => setActive(index)}
                  >
                    <span className="step-icon">
                      <Icon size={19} />
                    </span>
                    <span>
                      <small>BƯỚC 0{index + 1}</small>
                      <b>{item.title}</b>
                      <span>{item.subtitle}</span>
                    </span>
                    {index < 3 && (
                      <ArrowRight className="step-arrow" size={16} />
                    )}
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="guide-detail"
                initial={{ opacity: 0, y: reduced ? 0 : 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <div className="guide-visual">
                  <strong>{step.visual}</strong>
                  <span>{step.unit}</span>
                </div>
                <div>
                  <h3>{step.caption}</h3>
                  <p>{step.rule}</p>
                </div>
                <span className="guide-page">0{active + 1} / 04</span>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
