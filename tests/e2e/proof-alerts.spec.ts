import { expect, test, type Page } from "@playwright/test";

// QS01/QS03: chuông + thông báo bật lên khi khách gửi ảnh chuyển khoản; tab "Thông báo email" trong Cài đặt;
// link trong email mở thẳng chi tiết vé.

const fixture = "http://127.0.0.1:3101";
const headers = { Origin: "http://127.0.0.1:3102" };

test.beforeEach(async ({ context, request }) => {
  await request.post(fixture + "/__test/reset");
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.ok()).toBe(true);
});

const setProofs = (page: Page, proofsPending: number) =>
  page.request.post(fixture + "/__test/state", { data: { proofsPending } });
/** Giả lập quay lại tab: Dashboard làm mới chuông ngay (ngoài chu kỳ 30 giây). */
const refreshBell = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test("the bell lists transfer proofs first and opens the ticket in place (QS01)", async ({
  page,
}) => {
  await setProofs(page, 2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  // 2 ảnh chờ kiểm + 5 cần đối soát + 1 cần hoàn + 1 chuyến sắp đóng bán.
  await expect(bell).toHaveAccessibleName("Thông báo: 9 việc mới cần chú ý");
  // Lần tải đầu không bật thông báo cho việc đã có từ trước.
  await expect(page.locator("[data-proof-alert]")).toHaveCount(0);
  await bell.click();
  const panel = page.getByRole("region", { name: "Thông báo" });
  await expect(panel.getByRole("listitem")).toHaveText([
    "2 ảnh chuyển khoản chờ kiểm",
    "5 khoản thu cần đối soát",
    "1 khoản cần hoàn cho khách",
    "1 chuyến đóng bán trong 2 giờ",
  ]);
  await panel
    .getByRole("button", { name: /ảnh chuyển khoản chờ kiểm/ })
    .click();
  const list = page.getByRole("dialog", { name: "Ảnh chuyển khoản chờ kiểm" });
  await expect(list.getByRole("button")).toHaveCount(3); // 2 đơn + nút đóng
  await expect(list.getByRole("button", { name: /TESTA1/ })).toContainText(
    "1 ảnh",
  );
  await list.getByRole("button", { name: /TESTA1/ }).click();
  const ticket = page.getByRole("dialog", { name: "Vé TESTA1" });
  await expect(ticket).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/audit-logs$/);
  await expect(
    ticket.getByRole("link", { name: "Xem cả danh sách chuyến" }),
  ).toHaveAttribute(
    "href",
    "/admin/passengers?date=2027-02-05&trip=44444444-4444-4444-8444-444444444444",
  );
});

test("a new transfer proof pops up a notice with a shortcut to the list (QS01)", async ({
  page,
}) => {
  await setProofs(page, 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  await expect(bell).toHaveAccessibleName("Thông báo: 8 việc mới cần chú ý");

  await setProofs(page, 2);
  await refreshBell(page);
  const alert = page.getByRole("group", {
    name: "Thông báo ảnh chuyển khoản mới",
  });
  await expect(alert).toContainText("Khách vừa gửi ảnh chuyển khoản");
  await expect(
    page.getByRole("status").filter({ hasText: "Khách vừa gửi ảnh" }),
  ).toHaveCount(1);
  await expect(bell).toHaveAccessibleName("Thông báo: 9 việc mới cần chú ý");
  await alert.getByRole("button", { name: "Xem" }).click();
  await expect(alert).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Ảnh chuyển khoản chờ kiểm" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Nhiều ảnh cùng lúc: một thông báo gộp số.
  await setProofs(page, 5);
  await refreshBell(page);
  await expect(alert).toContainText("3 ảnh chuyển khoản mới chờ kiểm");
  await alert.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(alert).toHaveCount(0);

  // Số giảm (đã ghi nhận tiền) thì không báo.
  await setProofs(page, 4);
  await refreshBell(page);
  await expect(bell).toHaveAccessibleName(/còn|việc mới/);
  await expect(alert).toHaveCount(0);
});

test("the bell refreshes on its own every 30 seconds (QS01)", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  await expect(bell).toHaveAccessibleName("Thông báo: 7 việc mới cần chú ý");
  await setProofs(page, 1);
  await page.clock.runFor(31_000);
  await expect(bell).toHaveAccessibleName("Thông báo: 8 việc mới cần chú ý");
  await expect(
    page.getByRole("group", { name: "Thông báo ảnh chuyển khoản mới" }),
  ).toBeVisible();
});

test("phones reach the proof list from the Thêm drawer (QS01)", async ({
  page,
}) => {
  await setProofs(page, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/audit-logs");
  const bar = page.getByRole("navigation", { name: "Điều hướng nhanh" });
  await bar.getByRole("button", { name: /^Thêm, 8 việc mới/ }).click();
  const drawer = page.getByRole("dialog", { name: "Điều hướng" });
  await drawer
    .getByRole("region", { name: "Cần chú ý" })
    .getByRole("button", { name: "1 ảnh chuyển khoản chờ kiểm" })
    .click();
  await expect(drawer).toHaveCount(0);
  const list = page.getByRole("dialog", { name: "Ảnh chuyển khoản chờ kiểm" });
  await expect(list.getByRole("button", { name: /TESTA1/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the email link opens the ticket on the passengers page and clears itself on close (QS03)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    "/admin/passengers?date=2027-02-05&trip=44444444-4444-4444-8444-444444444444&booking=TESTA1",
  );
  const ticket = page.getByRole("dialog", { name: "Vé TESTA1" });
  await expect(ticket).toBeVisible();
  await expect(ticket.getByText("Khách Kiểm Thử Một")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ticket).toHaveCount(0);
  await expect(page).not.toHaveURL(/booking=/);
  await expect(page).toHaveURL(/trip=44444444/);
});

test("owner sets up Gmail alerts in Cài đặt › Thông báo email and sends a test (QS03)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/settings");
  await page.getByRole("link", { name: "Thông báo email" }).click();
  await expect(page).toHaveURL(/tab=alerts/);
  const form = page.getByRole("region", { name: /Thông báo email/ });
  await expect(form.getByText("Chưa cấu hình")).toBeVisible();
  await expect(form.getByRole("button", { name: "Gửi thư thử" })).toHaveCount(
    0,
  );
  await expect(
    form.getByRole("link", { name: "mật khẩu ứng dụng" }),
  ).toHaveAttribute("href", "https://myaccount.google.com/apppasswords");
  await form.getByLabel("Email gửi").fill("nhaxe.thongbao@gmail.com");
  await form.getByLabel("Mật khẩu ứng dụng").fill("abcd efgh ijkl mnop");
  await form
    .getByLabel(/Email nhận/)
    .fill("dieuhanh@nhaxe.vn\nketoan@nhaxe.vn, dieuhanh@nhaxe.vn");
  await form.getByLabel("Khách đặt vé mới trên Mini App").check();
  await form.getByLabel("Mật khẩu đăng nhập Dashboard").fill("wrong");
  await form.getByLabel("Mã Authenticator").fill("123456");
  await form.getByRole("button", { name: "Lưu cấu hình" }).click();
  await expect(
    form.getByText("Mật khẩu hoặc mã xác thực không đúng."),
  ).toBeVisible();
  await expect(form.getByLabel("Mật khẩu đăng nhập Dashboard")).toHaveValue("");

  await form.getByLabel("Mật khẩu ứng dụng").fill("abcd efgh ijkl mnop");
  await form
    .getByLabel("Mật khẩu đăng nhập Dashboard")
    .fill("Test-only-Password!");
  await form.getByLabel("Mã Authenticator").fill("123456");
  await form.getByRole("button", { name: "Lưu cấu hình" }).click();
  await expect(form.getByText(/Đã lưu\. Bấm “Gửi thư thử”/)).toBeVisible();
  await expect(form.getByText("Đang bật")).toBeVisible();
  const state = await (await request.get(fixture + "/__test/state")).json();
  expect(state.alertSettings).toMatchObject({
    enabled: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpUser: "nhaxe.thongbao@gmail.com",
    recipients: ["dieuhanh@nhaxe.vn", "ketoan@nhaxe.vn"],
    onBookingHeld: true,
    onPaymentProof: true,
    smtpLoginChanged: true,
  });
  // Mật khẩu SMTP không hiện lại; để trống là giữ mật khẩu đã lưu.
  await expect(form.getByLabel("Mật khẩu ứng dụng")).toHaveValue("");
  await expect(form.getByLabel("Mật khẩu ứng dụng")).toHaveAttribute(
    "placeholder",
    "Đã lưu — để trống nếu không đổi",
  );
  await form.getByRole("button", { name: "Gửi thư thử" }).click();
  await expect(
    form.getByText("Đã gửi thư thử tới dieuhanh@nhaxe.vn, ketoan@nhaxe.vn."),
  ).toBeVisible();

  // Máy chủ khác: hiện ô máy chủ và cổng.
  await form.getByLabel("Nhà cung cấp").selectOption("custom");
  await expect(form.getByLabel("Máy chủ SMTP")).toBeVisible();
  await expect(form.getByLabel("Cổng")).toBeVisible();
  await expect(form.getByLabel("Mật khẩu email")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("staff without alert.configure do not see the email tab or its API (QS03)", async ({
  page,
  request,
  context,
}) => {
  await request.post(fixture + "/__test/state", {
    data: {
      permissions: ["policy.read", "policy.write", "trip.read", "payment.read"],
    },
  });
  await page.goto("/admin/settings");
  await expect(
    page.getByRole("link", { name: "Thông tin chung" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Thông báo email" })).toHaveCount(
    0,
  );
  await page.goto("/admin/settings?tab=alerts");
  await expect(
    page.getByRole("region", { name: /Thông báo email/ }),
  ).toHaveCount(0);
  const r = await context.request.get("/api/operations/alert-settings");
  expect(r.status()).toBe(403);
});
