// [SỬA TRÀN MOBILE]: Kiểm tra bất biến geometry của menu ở các viewport yêu cầu, gồm trigger lệch mép, màn hình ngắn và visualViewport khi bàn phím mở.
// [CẨN THẬN KHI SỬA]: Đây là kiểm tra hình học thuần, không thay phép đo DOM/rendered overflow trong trình duyệt thật.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = fs.readFileSync(
  new URL("../src/lib/floating-layout.ts", import.meta.url),
  "utf8",
);
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  context,
);
const { mobilePopoverLayout } = context.exports;
const widths = [320, 360, 390, 640, 768, 1023, 1280];
let cases = 0;
for (const width of widths)
  for (const height of [240, 320, 568, 800, 1024])
    for (const offset of [0, 36])
      for (const anchorLeft of [-100, 12, width - 220, width - 20])
        for (const anchorTop of [-80, 80, height / 2, height - 50]) {
          const anchor = {
            left: anchorLeft,
            top: anchorTop,
            bottom: anchorTop + 54,
          };
          const viewport = { width, height, left: offset, top: offset };
          const layout = mobilePopoverLayout(anchor, viewport);
          const x = anchor.left + layout.left,
            y = anchor.top + layout.top;
          assert.ok(
            x >= offset + 12 - 0.01,
            "Left edge stays inside the viewport",
          );
          assert.ok(
            x + layout.width <= offset + width - 12 + 0.01,
            "Right edge stays inside the viewport",
          );
          assert.ok(y >= offset + 12 - 0.01, "Top edge stays visible");
          assert.ok(
            y + layout.maxHeight <= offset + height - 12 + 0.01,
            "Bottom edge stays visible on short screens/keyboard viewports",
          );
          assert.ok(layout.width <= 340 && layout.maxHeight <= 460);
          assert.ok(
            [layout.left, layout.top, layout.width, layout.maxHeight].every(
              Number.isFinite,
            ),
          );
          cases++;
        }
const narrow = mobilePopoverLayout(
  { left: 12, top: 85, bottom: 140 },
  { width: 320, height: 800 },
);
assert.equal(narrow.width, 296);
assert.equal(
  narrow.left,
  0,
  "Left-aligned mobile capsule does not create a negative menu offset",
);
console.log(
  `Responsive geometry checks passed: ${cases} cases at 320/360/390/640/768/1023/1280px, including short screens, edge anchors and keyboard offsets. Browser DOM overflow still requires a connected browser.`,
);
