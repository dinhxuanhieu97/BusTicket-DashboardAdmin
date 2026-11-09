# PNTicket Admin — Next.js

Dashboard Next.js + TypeScript + Tailwind CSS, tiếng Việt. Đợt 2A kết nối API PNTicket cho **OWNER**: tạo chuyến, lưu nháp, mở/đóng bán và xem chi tiết. Các mục khác chỉ đọc. Bản HTML cũ ở `../dashboard/` không thay đổi.

## Chạy local

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Mở http://localhost:3002/login. `npm run build && npm start` chạy bản production local cùng cổng 3002. Backend local có thể tiếp tục dùng 3001; dashboard đang cấu hình API thật `https://api.dienmaykimbien.com.vn`.

Biến môi trường **chỉ dùng ở server**:

- `PNTICKET_API_URL`: origin của NestJS, không kèm `/api/v1`. HTTPS bắt buộc, trừ backend kiểm thử trên loopback.
- `PNTICKET_TRIP_WRITE_OPERATOR_ID`: UUID nhà xe được phép ghi chuyến (local hiện bật cho PN). Để trống để tắt quyền ghi. Chỉ dùng ở server.
- `APP_ORIGIN`: origin của dashboard, mặc định mẫu `http://localhost:3002`. Khi triển khai phải đặt URL HTTPS thật. Local chấp nhận thêm alias `127.0.0.1` cùng cổng.

Không đưa token, mật khẩu hoặc biến trên vào `NEXT_PUBLIC_*`. Không cần khóa ký JWT hay thông tin database của backend trong dashboard. `.env.local` không được commit.

## Đường dẫn và phạm vi

| Đường dẫn           | Chức năng                                                     |
| ------------------- | ------------------------------------------------------------- |
| `/login`            | Đăng nhập bằng SĐT, mật khẩu và OTP khi đã bật MFA            |
| `/mfa`              | Thiết lập Authenticator và xác nhận mã cho OWNER chưa bật MFA |
| `/admin`            | Chuyến trong ngày và số chỗ khả dụng theo API thật            |
| `/admin/payments`   | Sổ thu, lọc kiểm tra, xem phân bổ/chi tiết; VND               |
| `/admin/users`      | Nhân viên của nhà xe, vai trò và tình trạng MFA               |
| `/admin/trips`      | Tạo/lưu nháp, mở/đóng bán, chi tiết; giờ Việt Nam             |
| `/admin/audit-logs` | Nhật ký thao tác                                              |
| `/admin/settings`   | Xem thông tin tài khoản và trạng thái 2FA                     |

Các đường dẫn cũ `/admin/transactions` và `/admin/analytics` chuyển đến sổ thu và tổng quan thật.

Đã gỡ toàn bộ chế độ demo khỏi ứng dụng Next.js; `/demo` và các trang con trả 404. Đăng nhập thất bại hoặc API không truy cập được sẽ hiện lỗi, không sinh dữ liệu mẫu.

## Xác thực và phân quyền

1. Trình duyệt gửi thông tin đăng nhập tới Next.js `/api/auth/login`, Next.js gọi NestJS.
2. `MFA_REQUIRED`: yêu cầu nhập OTP rồi gửi lại thông tin đăng nhập; mật khẩu chỉ ở bộ nhớ form, không lưu localStorage.
3. `scope=mfa_setup`: chỉ được vào thiết lập 2FA, không được gọi dữ liệu quản trị.
4. QR tạo ngay trên server Next.js, không gửi bí mật 2FA ra dịch vụ QR bên ngoài. Không tự tạo lại khóa khi render trang; người dùng chủ động bấm bắt đầu.
5. Chỉ `OWNER` có `operatorId`, `scope=full` và `mfaEnabled=true` được đọc dữ liệu thật. Các vai trò khác bị từ chối trong giai đoạn này.
6. Token chỉ trả qua cookie HttpOnly/SameSite=Strict; Secure khi `APP_ORIGIN` dùng HTTPS. Không trả Bearer token trong JSON cho client.
7. Mỗi lần gọi API dữ liệu, Next.js xác minh lại `/auth/me`, lấy `operatorId` từ phản hồi đã xác thực; không nhận operatorId từ trình duyệt.
8. Logout xóa cookie của dashboard. Backend chưa có endpoint thu hồi riêng từng token; hết hạn/khóa tài khoản/thu hồi backend khiến request tiếp theo bị từ chối. Không có tự động refresh token.

Next.js là lớp trung gian, NestJS vẫn kiểm tra quyền nghiệp vụ và phạm vi nhà xe. Các Route Handler không có proxy tùy ý: GET `payments`, `users`, `trips`, `audit-logs`. Riêng `/api/trip-management`: POST tạo chuyến, PATCH `/:id/status` chỉ OPEN/CLOSED và GET `/options` lấy tuyến/xe/sơ đồ. Mọi thao tác ghi kiểm tra OWNER, MFA, UUID nhà xe được cấu hình, Origin và JSON strict; không nhận tenant từ client. NestJS kiểm tra quyền/tenant, bảng giá theo sơ đồ và ghi audit như API hiện có.

API riêng tư dùng `Cache-Control: private, no-store`, và fetch tới NestJS dùng `cache: no-store`. Session lỗi kết nối không bị đổi thành phiên demo. Không truyền IP do client tự khai vào backend; backend hiện sẽ rate-limit đăng nhập theo địa chỉ của Next.js/proxy. Khi triển khai nhiều người dùng cần thống nhất trusted proxy và IP forwarding đáng tin cậy ở tầng hạ tầng.

## Giới hạn API hiện có được thể hiện trên UI

- Sổ thu: tối đa **200 khoản mới nhất** theo bộ lọc review, không có tổng toàn hệ thống. Tìm kiếm/phân trang trong tập đã tải; không suy ra doanh thu tháng/năm. Chi tiết lấy từ bản ghi và allocations trong phản hồi API.
- Nhật ký: tối đa **100 dòng gần nhất**.
- Nhân viên: API không trả `status` hoặc lần đăng nhập cuối, nên không hiển thị số liệu suy đoán.
- Chuyến: lọc theo ngày khởi hành giờ Việt Nam; chỗ khả dụng không đồng nghĩa với vé đã bán.
- Không có API tổng hợp tài chính, analytics thiết bị hoặc thông báo, nên những phần đó không xuất hiện ở chế độ thật.
- Không mở đổi mật khẩu, sửa hồ sơ, tạo/sửa nhân viên, cấu hình nhà xe, ghi nhận tiền, phân bổ hay đối soát trong đợt này.

## Kiểm tra

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Test unit kiểm tra phân quyền, tenant, CSRF, schema dữ liệu, giờ Việt Nam, giá nguyên VND và bảng giá theo sơ đồ. Test E2E khởi chạy API fixture trên 3101 và Next.js trên 3102; chỉ dùng tài khoản kiểm thử, **không đăng nhập hay ghi vào API thật**. Không chạy test này khi các cổng 3101/3102 đang được ứng dụng khác sử dụng.

E2E kiểm tra: login/OTP, thiết lập MFA, chặn setup token, chặn non-OWNER, cookie HttpOnly, từ chối CSRF và thao tác ghi ngoài phạm vi, tenant isolation, API outage/response sai schema, phiên bị thu hồi, đường dẫn demo đã gỡ và mobile.

## Cấu trúc

- `src/lib/server/session.ts`: cookie, phiên, xác thực mỗi request và phản hồi lỗi.
- `src/lib/access-policy.ts`: OWNER policy, allowlist GET, kiểm tra Origin.
- `src/lib/backend-client.ts`: fetch server tới backend, timeout và lỗi có kiểm soát.
- `src/lib/live-contracts.ts`: schema phản hồi API và formatter VND/giờ Việt Nam.
- `src/app/api/`: API trung gian với bề mặt ghi chỉ dành cho quản lý chuyến.
- `src/components/live/`: giao diện thật; không có dữ liệu giả.

Dùng Webpack cho dev/build để tương thích môi trường local. Tài liệu tham chiếu: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend).

## Quy tắc quản lý chuyến đợt 2A

- Tạo chuyến chọn tuyến và xe hoạt động thuộc nhà xe. Bảng giá sinh từ chỗ được bán theo tầng và số người (có xét seatOverrides). Sơ đồ không có trong API danh sách sẽ khóa xe đó, không đoán cấu hình giá.
- Nhập datetime-local luôn được hiểu UTC+7 độc lập múi giờ máy; server nhận ISO UTC. Giá 0–20.000.000 VND, số nguyên. Mở bán < đóng bán ≤ khởi hành.
- Màn hình kiểm tra lại trước khi ghi, khóa nút khi gửi. API hiện chưa hỗ trợ idempotency tạo chuyến: không tự retry; kết quả không xác định yêu cầu làm mới danh sách trước khi tạo lại. Đây chưa phải bảo đảm chống trùng giữa nhiều tab/thiết bị.
- DRAFT → OPEN, OPEN ↔ CLOSED; CANCELLED không có thao tác. Đóng bán không hủy vé. OPEN chỉ nhận đặt vé trong cửa sổ bán.
- Chi tiết gồm mã/tên chuyến, tuyến, xe, liên hệ, lịch bán và chỗ khả dụng theo lần tải danh sách. API quản trị hiện không cung cấp giá/sơ đồ của chuyến nháp; chưa hiển thị giá cũ suy đoán từ xe.
- Chưa mở sửa thông tin, đổi xe, xóa/hủy chuyến. Không sửa backend hoặc triển khai backend trong đợt này.
