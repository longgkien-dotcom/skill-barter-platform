# Skill Barter frontend

Giao diện Next.js App Router cho nền tảng trao đổi kỹ năng và Time Credits. Frontend gọi trực tiếp REST API NestJS.

## Chạy local

Từ thư mục gốc của repository:

```powershell
docker compose up -d
pnpm --dir backend exec prisma db push
pnpm --dir backend run db:seed
pnpm --dir backend run start
```

Trong một terminal khác, chạy frontend:

```powershell
pnpm --dir frontend run dev
```

Mở [http://localhost:3000](http://localhost:3000). Backend mặc định chạy tại `http://localhost:3001`; có thể đổi URL API bằng cách đặt `NEXT_PUBLIC_API_URL` trong `frontend/.env.local`, ví dụ:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Để chạy trên cổng khác hoặc host `127.0.0.1`, giữ URL đó trong `CORS_ORIGIN` của backend khi cần. Trong chế độ local, NestJS cho phép hai origin mặc định `localhost:3000` và `127.0.0.1:3000`. Production yêu cầu cấu hình `CORS_ORIGIN` rõ ràng.

## Kiểm tra

```powershell
pnpm --dir frontend run lint
pnpm --dir frontend run build
pnpm --dir frontend exec node scripts/verify-support-chatbot.mjs
pnpm --dir frontend exec node scripts/verify-online-session.mjs
pnpm --dir frontend exec node scripts/verify-responsive-layout.mjs
```

## Giới hạn bản demo

User switcher chỉ chọn ID tin cậy từ API, không phải đăng nhập hay cơ chế phân quyền. Xác minh email, nạp Premium và đổi voucher dùng logic demo phía backend; không dùng để xử lý tiền hoặc dữ liệu tài khoản thật. Chỉ triển khai sau khi có xác thực, phân quyền, xác minh OTP và tích hợp thanh toán phù hợp.

## Online Beta

Responsive: dưới 1024px, navigation chuyển thành 4 cột và header có identity/status/refresh ở hàng đầu, 3 KPI ở hàng kế. Menu danh tính được clamp theo visualViewport bằng `src/lib/floating-layout.ts`; form/modal/chatbot dùng vùng cuộn riêng. Phòng Online thường xếp partner và camera cá nhân theo chiều dọc trên mobile/tablet, giữ PiP ở desktop và fullscreen.

`verify-responsive-layout.mjs` kiểm tra các bất biến hình học tại 320/360/390/640/768/1023/1280px, cả màn hình ngắn và offset bàn phím. Test này không thay phép đo DOM trong trình duyệt: cần kiểm tra Landing, 4 tab, menu mở, modal và phòng/chat mở ở 360/390/768/1280px; root không được rộng hơn viewport, ledger chỉ cuộn trong vùng bảng. Khi browser automation không khả dụng, phải ghi rõ phần kiểm tra render còn chưa chạy.

PiP dùng `×` trong card để thu gọn và `+` để mở lại, độc lập với mic/camera. Một ghi chú Beta duy nhất ở đầu Online nêu rõ đối tác tự động, lưu trữ cục bộ và chưa có truyền audio/video hoặc thay đổi ví. Nhãn lặp lại trong room/chat đã được gỡ; receipt `Đã lưu` chỉ xuất hiện sau ghi localStorage thành công.

Journal theo user giữ phòng, deadline, chat/bản nháp, mục tiêu, lựa chọn mic/camera/PiP và đánh giá; dữ liệu đang dùng được khôi phục tối đa 7 ngày. Góp ý hoàn tất được lưu riêng tối đa 20 bản, nên không mất khi bắt đầu phiên mới. Tab/channel workspace cũng được khôi phục sau khi kiểm tra phiên với roster API. Hàng đợi phản hồi tự động có typing và tiếp tục các câu hỏi chưa trả lời sau reload. Timer được dọn khi rời phòng hoặc chuyển user.

Kiểm tra campus thực qua API local (cần backend và database đang chạy cùng cấu hình):

```powershell
pnpm --dir frontend exec node scripts/verify-campus-flows.mjs --run-local-fixtures
```

Script xác nhận API/Prisma dùng chung database, tạo fixture riêng cho verification, escrow, check-in/out, review và tribunal rồi xóa đúng các ID vừa tạo trong transaction. Không reset/seed hoặc cập nhật người dùng có sẵn. Đây là kiểm tra API, không thay kiểm thử trình duyệt, WebRTC hoặc xác thực production.

## Trợ lý hỗ trợ 24/7

Widget chỉ xuất hiện trong Dashboard đã đăng nhập, trả lời tự động bằng knowledge base tiếng Việt tại `src/components/SupportChatbot.tsx`. Landing không có widget hoặc switcher sang Dashboard trong header; CTA tiếp tục qua gate đăng nhập hiện có. Thêm cụm từ/trọng số tại `SUPPORT_RULES`, nội dung tại `supportAnswer` và chip tại `SUPPORT_SUGGESTIONS`. Không cần khóa LLM. Shortcut Online mở thẳng sub-view Online. Hội thoại trong bộ nhớ được reset khi chuyển hồ sơ hoặc đăng xuất.

Backend chưa có endpoint hỗ trợ hoặc dịch vụ email. Chức năng yêu cầu Admin hiện tạo **bản nháp cục bộ, chưa gửi Admin**, lưu tối đa 20 bản theo hồ sơ trên thiết bị và cho phép tải file để gửi qua kênh liên hệ riêng. Không có thông báo giả rằng Admin đã nhận hoặc sẽ phản hồi email. Khi bổ sung endpoint có xác thực, thay `src/lib/support-tickets.ts` bằng adapter gửi/nhận, chỉ hiển thị biên nhận sau response thành công.
