// [SỬA TRÀN MOBILE]: Hình học thuần giữ popover trong visualViewport kể cả khi bàn phím mở; tọa độ trả về tương đối với trigger.
// [CẨN THẬN KHI SỬA]: Dùng mép viewport thực thay vì right:0 theo capsule; khi thiếu chiều cao cho cả trên/dưới, menu phủ trong viewport và tự cuộn.
export function mobilePopoverLayout(
  anchor: { left: number; top: number; bottom: number },
  viewport: { width: number; height: number; left?: number; top?: number },
) {
  const gutter = Math.min(12, viewport.width / 4),
    gap = 8;
  const originX = viewport.left ?? 0,
    originY = viewport.top ?? 0;
  const width = Math.min(340, Math.max(0, viewport.width - gutter * 2));
  const left = Math.max(
    originX + gutter,
    Math.min(anchor.left, originX + viewport.width - gutter - width),
  );
  const below = originY + viewport.height - gutter - anchor.bottom - gap;
  const above = anchor.top - originY - gutter - gap;
  const available = Math.max(below, above);
  const overlay = available < 160;
  const useBelow = below >= 200 || below >= above;
  const height = Math.max(
    0,
    Math.min(
      460,
      viewport.height - gutter * 2,
      overlay ? viewport.height - gutter * 2 : useBelow ? below : above,
    ),
  );
  const preferredTop = overlay
    ? originY + gutter
    : useBelow
      ? anchor.bottom + gap
      : anchor.top - gap - height;
  const top = Math.max(
    originY + gutter,
    Math.min(preferredTop, originY + viewport.height - gutter - height),
  );
  return {
    left: left - anchor.left,
    top: top - anchor.top,
    width,
    maxHeight: height,
  };
}
