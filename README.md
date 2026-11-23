# PNTicket Admin — Trang quản trị cho nhà xe

Dashboard web cho nhà xe dùng nền tảng đặt vé PNTicket: quản lý chuyến, hành khách, tiền thu, nhân viên và cấu hình nhà xe. Giao diện tiếng Việt, giờ Việt Nam, tiền VND.

Dashboard chỉ là lớp giao diện + Backend-for-Frontend; dữ liệu, quyền và nghiệp vụ nằm ở API trong repo [BusTicket-App](https://github.com/dinhxuanhieu97/BusTicket-App) (cùng Zalo Mini App cho khách).

```
Trình duyệt ──► Next.js (trang + Route Handler /api/*) ──► API NestJS ──► PostgreSQL
                cookie HttpOnly, kiểm tra Origin/schema       kiểm tra quyền, nhà xe, ghi audit
```

## Tính năng

| Đường dẫn                                                | Chức năng                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/login`, `/mfa`, `/forgot-password`, `/change-password` | Đăng nhập bằng SĐT + mật khẩu (+ OTP nếu bật 2FA), ghi nhớ đăng nhập 30 ngày, thiết lập 2FA, quên/đổi mật khẩu |
| `/admin`                                                 | Tổng quan chuyến và chỗ trong ngày                                                                             |
| `/admin/trips`                                           | Tạo/lưu nháp chuyến, mở/đóng bán, chi tiết, sơ đồ chỗ, bán vé tại quầy, giao phụ xe                            |
| `/admin/passengers`                                      | Hành khách theo chuyến: lọc/tìm, lên xe, sửa đơn (thông tin, thu tiền, lên xe), hủy đơn, nhập/xuất Excel, CSV  |
| `/admin/assigned-trips`                                  | Phụ xe xem chuyến được giao và đánh dấu khách lên xe                                                           |
| `/admin/payments`                                        | Sổ thu: khoản chuyển khoản/tiền mặt, phân bổ vào đơn, xử lý tiền về trễ và hoàn tiền                           |
| `/admin/users`                                           | Nhân viên, vai trò, tình trạng 2FA                                                                             |
| `/admin/audit-logs`                                      | Nhật ký thao tác                                                                                               |
| `/admin/schedules`                                       | Lịch chạy tự động sinh chuyến                                                                                  |
| `/admin/settings`                                        | Thông tin nhà xe, thương hiệu, tài khoản nhận tiền, điểm đón/trả theo tuyến, tài khoản và 2FA                  |
| `/platform`                                              | Quản trị nền tảng: danh sách nhà xe, đặt mật khẩu tạm cho chủ xe                                               |

Mỗi mục chỉ hiện khi tài khoản có quyền tương ứng (Chủ xe, Điều phối, Bán vé, Kế toán, Phụ xe, Quản trị nền tảng); API vẫn kiểm tra lại mọi quyền.

## Công nghệ

Next.js 16 (App Router, build bằng Webpack), React 19, TypeScript, Tailwind CSS 4, Zod, lucide-react, ExcelJS. Test: `node:test` (unit) và Playwright (E2E với API giả).

## Chạy local

Yêu cầu Node.js 22+ và một API PNTicket đang chạy (local hoặc môi trường thử nghiệm).

```sh
npm ci
```

```sh
cp .env.example .env.local
```

```sh
npm run dev
```

Mở http://localhost:3002/login. Bản production local: `npm run build && npm start` (cùng cổng 3002, hoặc `PORT`).

### Biến môi trường (chỉ dùng ở server)

| Biến                                                            | Ý nghĩa                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PNTICKET_API_URL`                                              | Origin của API, không kèm `/api/v1`. Bắt buộc HTTPS, trừ API kiểm thử trên loopback      |
| `APP_ORIGIN`                                                    | Origin của dashboard (URL HTTPS thật khi triển khai); dùng để kiểm tra Origin chống CSRF |
| `PNTICKET_TRIP_WRITE_OPERATOR_ID`                               | UUID nhà xe được phép ghi chuyến; để trống để tắt thao tác ghi chuyến                    |
| `PNTICKET_BRAND_OPERATOR_CODE`                                  | Mã nhà xe để hiện tên/logo trên trang đăng nhập                                          |
| `PNTICKET_TRUSTED_CLIENT_IP_HEADER`, `PNTICKET_LOGIN_PROXY_KEY` | Chỉ bật khi ingress tin cậy ghi đè header IP khách; khóa dùng chung với API (≥ 32 ký tự) |

Không đặt các biến này với tiền tố `NEXT_PUBLIC_*` và không commit `.env.local`. Dashboard không cần khóa ký token hay thông tin database của API.

## Bảo mật

- Token chỉ nằm trong cookie `HttpOnly`, `SameSite=Strict` (`Secure` khi chạy HTTPS); không trả token trong JSON cho trình duyệt.
- Mỗi request dữ liệu xác minh lại phiên với API và lấy nhà xe từ phiên đã xác thực, không nhận từ trình duyệt.
- Route Handler `/api/*` là danh sách đường dẫn cố định, không có proxy tùy ý. Thao tác ghi kiểm tra quyền, Origin và JSON theo schema strict; ghi tiền gửi `Idempotency-Key`.
- Phản hồi riêng tư dùng `Cache-Control: private, no-store`. Mã QR 2FA tạo ngay trên server, không gửi bí mật ra dịch vụ ngoài.

## Màu

Mọi màu nằm ở đầu `src/app/globals.css`, chia hai lớp biến:

| Lớp               | Biến                                                                                                                                                                                         | Đổi khi nào                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Bảng màu gốc      | `--white`, `--black`, `--gray-25` … `--gray-900`, `--green-300/700`, `--amber-300/700`, `--red-300/700`, `--blue-300/700`                                                                    | Muốn đổi cả bảng màu: sửa mã hex ở đây, mọi trang đổi theo.                                                                                 |
| Biến theo vai trò | `--bg`, `--panel`, `--surface`, `--surface-hover`, `--border`, `--text`, `--muted`, `--faint`, `--success`, `--warning`, `--danger`, `--info` (và `-bg`), `--booked-bg`, `--scrim`, bóng đổ… | Muốn đổi một vai trò (ví dụ chữ phụ đậm hơn): trỏ sang bậc khác của bảng gốc. Theme tối ở `:root`, theme sáng ở `html[data-theme="light"]`. |
| Màu thương hiệu   | `--brand-*`, `--accent`, `--primary*`, `--on-primary`, `--accent-glow`, `--bg-glow-*`                                                                                                        | Nhà xe chọn trong Cài đặt › Màu giao diện; mặc định chàm → lơ lấy từ `DEFAULT_BRAND_COLORS` trong `src/lib/brand-palette.ts`.               |

Quy tắc dùng màu:

1. **Neutral là chính** (nền, thẻ, viền, chữ): chỉ thang xám.
2. **Màu thương hiệu** chỉ cho nút chính, mục đang chọn, focus, liên kết, số liệu chính trên biểu đồ và logo. Dải màu chỉ ở logo và nút chính.
3. **Màu báo nghĩa** (success / warning / danger / info) chỉ khi có ý nghĩa trạng thái; không dùng để trang trí hay phân biệt mục menu.
4. **Số đếm, badge** mặc định trung tính; số "cần xử lý" (chuông) dùng màu thương hiệu.
5. **Không viết mã màu trong component**: dùng `var(--…)`, class `text-muted`/`bg-panel`… hoặc `data-tone="warning"` với `.pn-tone`. Test `src/lib/color-tokens.test.ts` báo lỗi nếu có `#hex`, `rgb()` hay class kiểu `bg-amber-500` ngoài vùng biến.

## Kiểm tra

```sh
npm run format:check
```

```sh
npm run typecheck
```

```sh
npm test
```

```sh
npm run build && npx playwright install chromium && npm run test:e2e
```

E2E chạy API giả (`tests/fixture-api.mjs`) ở cổng 3101 và Next.js ở 3102, chỉ dùng tài khoản kiểm thử, **không gọi API thật**. Không chạy khi hai cổng này đang bận.

## Cấu trúc

- `src/app/` — trang (`admin/*`, `platform`, đăng nhập) và Route Handler `api/*`.
- `src/components/live/` — giao diện từng màn, chỉ dùng dữ liệu thật từ API.
- `src/lib/server/` — phiên/cookie, gọi API, xuất/nhập Excel, thương hiệu.
- `src/lib/` — schema phản hồi API, quyền, định dạng VND/giờ Việt Nam.
- `tests/` — API giả và test Playwright.

## Triển khai

- Mọi thay đổi đi qua PR từ nhánh `hieufeature_<tên>`. CI (`.github/workflows/ci.yml`): Prettier, typecheck, unit test, build, rồi E2E Playwright và Claude review cho PR. Gõ `@claude` trong issue/PR để giao việc (`claude.yml`).
- Railway tự deploy khi `main` đổi. Khi một tính năng cần API mới, merge và deploy API trước, dashboard sau.
- Thiết lập secret cho Claude review và bảo vệ nhánh: mục CI/CD trong [DEPLOY.md của BusTicket-App](https://github.com/dinhxuanhieu97/BusTicket-App/blob/main/DEPLOY.md).

## Giấy phép

Bản quyền © 2026 Hieu Dinh. Bảo lưu mọi quyền: không được sao chép, sửa đổi hay sử dụng lại mã nguồn khi chưa có sự đồng ý bằng văn bản. Xem [LICENSE](LICENSE).
