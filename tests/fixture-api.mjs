// Isolated contract-test server. Never used by the live dashboard configuration.
import http from "node:http";
const port = Number(process.env.FIXTURE_PORT || 3101);
const op = "11111111-1111-4111-8111-111111111111";
const user = {
  id: "22222222-2222-4222-8222-222222222222",
  operatorId: op,
  fullName: "Test OWNER",
  phone: "+84900000001",
  role: "OWNER",
  mfaEnabled: true,
};
// Quản trị nền tảng (không thuộc nhà xe nào).
const platform = {
  id: "99999999-9999-4999-8999-999999999999",
  operatorId: null,
  fullName: "Test PLATFORM",
  phone: "+84900000003",
  role: "PLATFORM_ADMIN",
  mfaEnabled: false,
};
const otherOp = "66666666-6666-4666-8666-666666666666";
const full = "test-owner-full-token-not-a-real-jwt";
const setup = "test-owner-setup-token-not-a-real-jwt";
const OWNER_PERMISSIONS = [
  "user.manage",
  "policy.read",
  "policy.write",
  "fleet.read",
  "fleet.write",
  "route.read",
  "route.write",
  "trip.read",
  "trip.write",
  "audit.read",
  "payment.configure",
  "payment.read",
  "payment.record",
  "payment.manage",
  "trip.assigned.read",
  "booking.read",
  "booking.export",
  "booking.create",
  "booking.board",
  "booking.cancel",
  "booking.update",
  "trip.assigned.board",
];
const STAFF_PERMISSIONS = {
  PLATFORM_ADMIN: [
    "operator.create",
    "operator.list",
    "layout.library.write",
    "owner.password.reset",
    "user.manage",
  ],
  DISPATCHER: [
    "policy.read",
    "fleet.read",
    "fleet.write",
    "route.read",
    "route.write",
    "trip.read",
    "trip.write",
    "booking.read",
    "booking.export",
    "booking.create",
    "booking.board",
    "booking.cancel",
    "booking.update",
  ],
  ACCOUNTANT: [
    "policy.read",
    "fleet.read",
    "route.read",
    "trip.read",
    "audit.read",
    "payment.read",
    "payment.record",
    "payment.manage",
    "booking.read",
    "booking.export",
  ],
  SELLER: [
    "policy.read",
    "fleet.read",
    "route.read",
    "trip.read",
    "payment.read",
    "payment.record",
    "booking.read",
    "booking.export",
    "booking.create",
    "booking.board",
    "booking.update",
  ],
  ASSISTANT: ["trip.assigned.read", "trip.assigned.board"],
};
const ASSIGNABLE_TRIP = "44444444-4444-4444-8444-444444444444";
const OTHER_TRIP = "55555555-5555-4555-8555-555555555555";
// tripId -> [{ userId, assignedAt }]
let tripAssistants = new Map();
// Nhân viên vừa được OWNER đặt mật khẩu tạm (khớp users.must_change_password).
let mustChange = new Set();
let permissions = OWNER_PERMISSIONS;
let createdTrips = [];
let schedules = [];
const defaultPolicy = () => ({
  operatorId: op,
  version: 1,
  holdMinutes: 10,
  maxUnitsPerBooking: 5,
  childPolicy: {
    freeUnderAge: 2,
    price: 0,
    maxPerUnit: 1,
    countsTowardCapacity: false,
  },
  maxActiveHoldsPerPhone: 2,
  requirePhoneOtp: false,
  depositPercent: 100,
  fixedDeposit: null,
  paymentGraceMinutes: 3,
  autoReinstateLatePayment: true,
});
let policy = null;
let profile = {
  id: op,
  code: "TEST",
  name: "Nhà xe kiểm thử",
  defaultDepartureTime: "17:30",
};
let paymentAccount = null;
// Logo nhà xe (khớp operators.service.ts) và công tắc "chưa cấu hình thương hiệu".
let logo = null; // { data: Buffer, mime, version }
let brandMissing = false;
let staff = [];
const staffPasswords = new Map();
let idempotent = {};
// Idempotency-Key của các lần nhập file đã ghi (để trả replayed).
let importKeys = new Set();
// Vận hành hành khách (D3): "MÃ:CHỖ" -> giờ lên xe; mã -> lý do hủy; mã -> tổng thu trên xe; khoản cần hoàn.
let boardedSeats = new Map();
let cancelledCodes = new Map();
let onboardTotals = new Map();
// Ảnh lệnh chuyển khoản khách gửi (Mini App) cho đơn TESTH1; chỉ dữ liệu giả.
const PROOF_ID = "66666666-6666-4666-8666-666666666666";
const PROOF_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 7),
]);
// Sửa đơn (PATCH bookings/:code) và tiền ghi tay (payments/manual) theo mã đơn.
let bookingEdits = new Map();
let manualPaid = new Map();
let manualKeys = new Map();
let refunds = [];
const TRIP_STOPS = {
  pickup: [
    { name: "Bến xe Miền Đông", time: "17:30", day: 0 },
    { name: "Ngã tư Thủ Đức", time: "18:15", day: 0 },
  ],
  dropoff: [{ name: "Hoài Ân", time: "05:30", day: 1 }],
};
let statusOverrides = {};
let revoked = false,
  down = false,
  malformed = false,
  setupStarted = false,
  confirmed = false,
  requireMfa = false,
  mfaOff = false,
  requests = [];
const currentUser = (id = user.id) =>
  id === user.id
    ? { ...user, mfaEnabled: !mfaOff }
    : id === platform.id
      ? platform
      : staff.find((row) => row.id === id);
const revokeStaff = (id) => {
  for (const session of sessions.values())
    if (session.userId === id) session.revoked = true;
};
// Phiên refresh giả lập API thật: access token dạng JWT có `exp`, refresh token xoay vòng, ân hạn 30 giây.
let accessTtlMs = 3600000,
  refreshDown = false,
  refreshMalformed = false, // refresh trả dữ liệu sai hợp đồng (lỗi cố định, không phải sự cố)
  sessions = new Map(), // sid -> { remember, expiresAt, revoked, current }
  refreshIndex = new Map(), // refresh token -> { sid, rotatedAt? }
  accessIndex = new Map(), // access token -> { sid, exp }
  serial = 0;
const mintAccess = (sid, sessionExpiresAt) => {
  const exp = Math.min(Date.now() + accessTtlMs, sessionExpiresAt);
  serial += 1;
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(exp / 1000), sid, n: serial }),
  ).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.fixturesig${serial}`;
  accessIndex.set(token, { sid, exp });
  return { token, exp };
};
const mintRefresh = (sid) => {
  serial += 1;
  const token = `${sid}.fixture-refresh-${serial}-${Math.random().toString(36).slice(2)}`;
  refreshIndex.set(token, { sid });
  sessions.get(sid).current = token;
  return token;
};
const kindOf = (token) => {
  if (token === setup) return "setup";
  if (token === full) return "full";
  const a = accessIndex.get(token);
  if (!a || a.exp <= Date.now()) return null;
  const sess = sessions.get(a.sid);
  return sess && !sess.revoked ? "full" : null;
};
const send = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};
const fail = (res, status, code, message) =>
  send(res, status, { error: { code, message } });
const issued = (scope, u, remember = false) => {
  if (scope !== "full")
    return {
      accessToken: setup,
      scope,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      refreshToken: null,
      sessionExpiresAt: null,
      remember,
      user: u,
    };
  serial += 1;
  const sid = `33333333-3333-4333-8333-${String(serial).padStart(12, "0")}`;
  const expiresAt = Date.now() + (remember ? 30 * 86400000 : 12 * 3600000);
  sessions.set(sid, {
    remember,
    expiresAt,
    revoked: false,
    current: null,
    userId: u.id,
  });
  const access = mintAccess(sid, expiresAt);
  return {
    accessToken: access.token,
    scope,
    expiresAt: new Date(access.exp).toISOString(),
    refreshToken: mintRefresh(sid),
    sessionExpiresAt: new Date(expiresAt).toISOString(),
    remember,
    mustChangePassword: mustChange.has(u.id),
    user: u,
  };
};
http
  .createServer(async (req, res) => {
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    const rawBytes = Buffer.concat(parts);
    const raw = rawBytes.toString("utf8");
    const isImage = /^image\//.test(req.headers["content-type"] || "");
    let body = {};
    try {
      if (!isImage) body = JSON.parse(raw || "{}");
    } catch {
      return fail(res, 400, "BAD_JSON", "JSON không hợp lệ");
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const path = url.pathname;
    if (path === "/__test/reset") {
      revoked = false;
      permissions = OWNER_PERMISSIONS;
      createdTrips = [];
      schedules = [];
      policy = null;
      profile = {
        id: op,
        code: "TEST",
        name: "Nhà xe kiểm thử",
        defaultDepartureTime: "17:30",
      };
      paymentAccount = null;
      logo = null;
      brandMissing = false;
      staff = [];
      tripAssistants = new Map();
      mustChange = new Set();
      staffPasswords.clear();
      idempotent = {};
      importKeys = new Set();
      boardedSeats = new Map();
      cancelledCodes = new Map();
      onboardTotals = new Map();
      bookingEdits = new Map();
      manualPaid = new Map();
      manualKeys = new Map();
      refunds = [];
      statusOverrides = {};
      down = false;
      malformed = false;
      setupStarted = false;
      confirmed = false;
      requireMfa = false;
      mfaOff = false;
      requests = [];
      accessTtlMs = 3600000;
      refreshDown = false;
      refreshMalformed = false;
      sessions = new Map();
      refreshIndex = new Map();
      accessIndex = new Map();
      return send(res, 200, { ok: true });
    }
    if (path === "/__test/state") {
      if (req.method === "POST") {
        revoked = body.revoked ?? revoked;
        down = body.down ?? down;
        malformed = body.malformed ?? malformed;
        if ("permissions" in body) permissions = body.permissions;
        if (body.accessTtlMs) accessTtlMs = body.accessTtlMs;
        refreshDown = body.refreshDown ?? refreshDown;
        refreshMalformed = body.refreshMalformed ?? refreshMalformed;
        brandMissing = body.brandMissing ?? brandMissing;
        requireMfa = body.requireMfa ?? requireMfa;
        if (body.revokeSessions)
          for (const sess of sessions.values()) sess.revoked = true;
      }
      return send(res, 200, {
        requests,
        setupStarted,
        confirmed,
        sessions: [...sessions.values()].map(({ remember, revoked }) => ({
          remember,
          revoked,
        })),
      });
    }
    requests.push({
      method: req.method,
      path: url.pathname,
      query: url.search,
      ...(path.includes("/trips") || path.endsWith("/reinstate")
        ? { body }
        : {}),
    });
    if (down) return fail(res, 503, "SERVICE_UNAVAILABLE", "Test outage");
    // Thương hiệu công khai theo mã nhà xe.
    if (path === `/api/v1/operators/${profile.code}/brand`) {
      if (brandMissing)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy nhà xe.");
      return send(res, 200, {
        code: profile.code,
        name: profile.name,
        logoVersion: logo?.version ?? null,
      });
    }
    if (path === `/api/v1/operators/${profile.code}/logo`) {
      if (!logo) return fail(res, 404, "NOT_FOUND", "Không có logo.");
      res.writeHead(200, { "Content-Type": logo.mime });
      return res.end(logo.data);
    }
    if (path === "/api/v1/auth/password/reset" && req.method === "POST") {
      // Chỉ OWNER kiểm thử có 2FA; mã đúng là 123456.
      if (
        body.phone !== "0900000001" ||
        body.otp !== "123456" ||
        mfaOff ||
        String(body.newPassword ?? "").length < 10
      )
        return fail(res, 401, "INVALID_CREDENTIALS", "Thông tin không đúng.");
      for (const sess of sessions.values())
        if (sess.userId === user.id) sess.revoked = true;
      return send(res, 200, { ok: true });
    }
    if (path === "/api/v1/auth/login" && req.method === "POST") {
      if (body.phone === "0900000004")
        return fail(res, 429, "TOO_MANY_ATTEMPTS", "Thử lại sau.");
      const member = staff.find((row) => row.phone === body.phone);
      if (
        member &&
        member.status === "ACTIVE" &&
        staffPasswords.get(member.id) === body.password
      )
        return send(res, 200, issued("full", member, body.rememberMe === true));
      if (member || body.password !== "Test-only-Password!")
        return fail(
          res,
          401,
          "INVALID_CREDENTIALS",
          "Thông tin đăng nhập không đúng.",
        );
      if (body.phone === "0900000003")
        return send(res, 200, issued("full", platform));
      if (body.phone === "0900000002" && !confirmed) {
        if (requireMfa)
          return send(
            res,
            200,
            issued("mfa_setup", { ...user, mfaEnabled: false }),
          );
        mfaOff = true;
      }
      if (mfaOff)
        return send(
          res,
          200,
          issued("full", currentUser(), body.rememberMe === true),
        );
      if (!body.otp)
        return fail(
          res,
          401,
          "MFA_REQUIRED",
          "Vui lòng nhập mã Authenticator.",
        );
      if (body.otp !== "123456")
        return fail(res, 401, "INVALID_CREDENTIALS", "Mã xác thực không đúng.");
      return send(res, 200, issued("full", user, body.rememberMe === true));
    }
    if (path === "/api/v1/auth/refresh" && req.method === "POST") {
      if (refreshDown)
        return fail(res, 503, "SERVICE_UNAVAILABLE", "Test outage");
      if (refreshMalformed)
        return send(res, 200, { accessToken: 42, scope: "full" });
      const entry = refreshIndex.get(body.refreshToken);
      const sess = entry && sessions.get(entry.sid);
      if (!sess || sess.revoked || sess.expiresAt <= Date.now())
        return fail(res, 401, "UNAUTHENTICATED", "Phiên đã hết hạn.");
      let refreshToken = sess.current;
      if (sess.current === body.refreshToken) {
        entry.rotatedAt = Date.now();
        sess.previous = sess.current;
        refreshToken = mintRefresh(entry.sid);
      } else if (
        sess.previous !== body.refreshToken ||
        !entry.rotatedAt ||
        Date.now() - entry.rotatedAt > 30000
      ) {
        sess.revoked = true; // dùng lại token cũ sau ân hạn
        return fail(res, 401, "UNAUTHENTICATED", "Phiên đã hết hạn.");
      }
      const access = mintAccess(entry.sid, sess.expiresAt);
      return send(res, 200, {
        accessToken: access.token,
        scope: "full",
        expiresAt: new Date(access.exp).toISOString(),
        refreshToken,
        sessionExpiresAt: new Date(sess.expiresAt).toISOString(),
        remember: sess.remember,
        user: currentUser(sess.userId),
      });
    }
    if (path === "/api/v1/auth/logout" && req.method === "POST") {
      const entry = refreshIndex.get(body.refreshToken);
      if (entry) sessions.get(entry.sid).revoked = true;
      const bearer = (req.headers.authorization || "").replace("Bearer ", "");
      const a = accessIndex.get(bearer);
      if (a) sessions.get(a.sid).revoked = true;
      return send(res, 200, { ok: true });
    }
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    const kind = kindOf(token);
    if (revoked || !kind)
      return fail(res, 401, "UNAUTHENTICATED", "Phiên đã hết hạn.");
    const actor = currentUser(
      sessions.get(accessIndex.get(token)?.sid)?.userId,
    );
    const grants =
      actor.role === "OWNER" ? permissions : STAFF_PERMISSIONS[actor.role];
    if (path === "/api/v1/auth/me")
      return send(res, 200, {
        user: kind === "setup" ? { ...user, mfaEnabled: false } : actor,
        scope: kind === "setup" ? "mfa_setup" : "full",
        ...(grants === null
          ? {}
          : { permissions: kind === "setup" ? [] : grants }),
        mustChangePassword: mustChange.has(actor?.id),
      });
    if (path === "/api/v1/auth/password" && req.method === "POST") {
      const currentOk =
        actor.id === user.id
          ? body.currentPassword === "Test-only-Password!"
          : staffPasswords.get(actor.id) === body.currentPassword;
      if (!currentOk)
        return fail(res, 401, "INVALID_CREDENTIALS", "Sai mật khẩu.");
      if (body.newPassword === body.currentPassword)
        return fail(res, 400, "VALIDATION_FAILED", "Mật khẩu mới phải khác.");
      if (actor.id !== user.id) staffPasswords.set(actor.id, body.newPassword);
      mustChange.delete(actor.id);
      const remember =
        sessions.get(accessIndex.get(token)?.sid)?.remember ?? false;
      for (const sess of sessions.values())
        if (sess.userId === actor.id) sess.revoked = true;
      return send(res, 200, issued("full", actor, remember));
    }
    if (mustChange.has(actor?.id) && !path.startsWith("/api/v1/auth/"))
      return fail(
        res,
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Vui lòng đổi mật khẩu tạm trước khi tiếp tục.",
      );
    if (path === "/api/v1/auth/mfa/setup" && req.method === "POST") {
      setupStarted = true;
      return send(res, 200, {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUri:
          "otpauth://totp/PNTicket:Test?secret=JBSWY3DPEHPK3PXP&issuer=PNTicket",
      });
    }
    if (path === "/api/v1/auth/mfa/confirm" && req.method === "POST") {
      if (!setupStarted || body.otp !== "123456")
        return fail(res, 400, "VALIDATION_FAILED", "Mã xác thực không đúng.");
      confirmed = true;
      mfaOff = false;
      return send(res, 200, issued("full", currentUser()));
    }
    if (kind !== "full")
      return fail(res, 403, "MFA_SETUP_REQUIRED", "Cần 2FA.");
    if (path === "/api/v1/auth/mfa/disable" && req.method === "POST") {
      if (mfaOff) return fail(res, 409, "CONFLICT", "Tài khoản chưa bật 2FA.");
      if (requireMfa)
        return fail(res, 403, "FORBIDDEN", "Vai trò này bắt buộc 2FA.");
      if (body.password !== "Test-only-Password!" || body.otp !== "123456")
        return fail(res, 401, "INVALID_CREDENTIALS", "Sai thông tin.");
      const remember =
        sessions.get(accessIndex.get(token)?.sid)?.remember ?? false;
      mfaOff = true;
      for (const session of sessions.values()) session.revoked = true;
      return send(res, 200, issued("full", currentUser(), remember));
    }
    // Quản trị nền tảng: danh sách nhà xe, chủ xe và đặt mật khẩu tạm (khớp admin.controller.ts).
    if (path === "/api/v1/admin/operators" && req.method === "GET") {
      if (!grants?.includes("operator.list"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      return send(res, 200, {
        operators: [
          {
            id: op,
            code: "PN",
            name: "Nhà xe kiểm thử",
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: otherOp,
            code: "QB",
            name: "Nhà xe thứ hai",
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
      });
    }
    const ownerRoute = path.match(
      /^\/api\/v1\/admin\/operators\/([^/]+)\/owners(?:\/([^/]+)\/temporary-password)?$/,
    );
    if (ownerRoute) {
      if (!grants?.includes("owner.password.reset"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const [, opId, ownerId] = ownerRoute;
      if (opId !== op && opId !== otherOp)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy nhà xe.");
      const owners =
        opId === op
          ? [
              { ...currentUser(), status: "ACTIVE" },
              ...staff.filter((m) => m.role === "OWNER"),
            ].map((m) => ({
              ...m,
              mustChangePassword: mustChange.has(m.id),
              lockedUntil: null,
            }))
          : [];
      if (!ownerId && req.method === "GET") return send(res, 200, { owners });
      if (ownerId && req.method === "POST") {
        if (String(body.password ?? "").length < 10)
          return fail(res, 400, "VALIDATION_FAILED", "Mật khẩu quá ngắn.");
        if (body.adminPassword !== "Test-only-Password!")
          return fail(
            res,
            403,
            "FORBIDDEN",
            "Mật khẩu hoặc mã xác thực không đúng, hoặc tài khoản đang tạm khóa.",
          );
        const target = owners.find((m) => m.id === ownerId);
        if (!target)
          return fail(res, 404, "NOT_FOUND", "Không tìm thấy chủ xe.");
        if (target.id !== user.id) staffPasswords.set(target.id, body.password);
        mustChange.add(target.id);
        revokeStaff(target.id);
        return send(res, 200, {
          owner: { ...target, mustChangePassword: true },
        });
      }
    }
    const tripBase = `/api/v1/admin/operators/${op}/`;
    // Tiền về muộn — khớp apps/api/src/payments/payments.service.ts (reinstateContext / reinstateLate).
    const LATE_PAYMENT = "55555555-5555-4555-8555-555555555555";
    if (path === `${tripBase}payments/${LATE_PAYMENT}/reinstate`) {
      if (req.method === "GET")
        return send(res, 200, {
          paymentId: LATE_PAYMENT,
          unallocatedAmount: 380000,
          eligible: true,
          booking: {
            code: "TESTLATE",
            status: "EXPIRED",
            previousTotal: 380000,
            paidAmount: 0,
            pickupStop: null,
            dropoffStop: null,
          },
          legs: [
            {
              tripId: "44444444-4444-4444-8444-444444444444",
              tripName: "Chuyến kiểm thử",
              tripCode: "PN050227-TEST",
              departAt: "2027-02-05T10:30:00.000Z",
              departed: false,
              cancelled: false,
              seats: [
                {
                  seatCode: "A1",
                  occupancy: 1,
                  infantCount: 0,
                  available: true,
                },
              ],
            },
          ],
        });
      if (req.method === "POST") {
        const seats = body.legs?.[0]?.items ?? [];
        if (seats.some((i) => i.seatCode === "B1"))
          return fail(
            res,
            409,
            "SEAT_UNAVAILABLE",
            "Chỗ B1 đã có người giữ hoặc không bán.",
          );
        const total = seats.length * 380000;
        return send(res, 200, {
          booking: {
            code: "TESTLATE",
            status: total > 380000 ? "HOLDING" : "CONFIRMED",
            tripId: body.legs[0].tripId,
            totalAmount: total,
            depositAmount: total,
            paidAmount: Math.min(total, 380000),
            paymentStatus: total > 380000 ? "PARTIAL" : "PAID",
            holdExpiresAt: total > 380000 ? "2027-02-01T03:10:00.000Z" : null,
            items: [],
          },
          payment: {},
        });
      }
    }
    // Phân công phụ xe (khớp apps/api/src/trips/trip-assistants.service.ts).
    const can = (perm) => !grants || grants.includes(perm);
    const assistantRef = (m) => ({
      id: m.id,
      fullName: m.fullName,
      phone: m.phone,
    });
    const assistantUser = (id) => staff.find((m) => m.id === id);
    const activeAssistant = (m) =>
      m && m.role === "ASSISTANT" && m.status === "ACTIVE";
    const tripRef = (id) => ({
      id,
      name: id === ASSIGNABLE_TRIP ? "Chuyến kiểm thử" : "Chuyến khác",
      status: "OPEN",
      departAt: "2027-02-05T10:30:00.000Z",
      contactPhone: "0912000111",
      route: { code: "TEST", origin: "TP.HCM", destination: "Hoài Ân" },
      vehicle: {
        code: "TEST01",
        name: "Xe kiểm thử",
        plateNumber: "77B-000.01",
      },
    });
    if (path === tripBase + "assistants" && req.method === "GET") {
      if (!can("trip.write"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      return send(res, 200, {
        assistants: staff.filter(activeAssistant).map(assistantRef),
      });
    }
    const assignMatch = new RegExp(
      `^${tripBase}trips/([0-9a-f-]{36})/assistants$`,
    ).exec(path);
    if (assignMatch) {
      const tripId = assignMatch[1];
      if (![ASSIGNABLE_TRIP, OTHER_TRIP].includes(tripId))
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      const list = () => ({
        assistants: (tripAssistants.get(tripId) ?? []).map((a) => ({
          ...assistantRef(assistantUser(a.userId)),
          active: activeAssistant(assistantUser(a.userId)),
          assignedAt: a.assignedAt,
        })),
      });
      if (req.method === "GET") {
        if (!can("trip.read"))
          return fail(res, 403, "FORBIDDEN", "Không có quyền.");
        return send(res, 200, list());
      }
      if (req.method === "PUT") {
        if (!can("trip.write"))
          return fail(res, 403, "FORBIDDEN", "Không có quyền.");
        const ids = body.userIds ?? [];
        if (ids.some((id) => !activeAssistant(assistantUser(id))))
          return fail(
            res,
            400,
            "VALIDATION_FAILED",
            "Chỉ phân công được phụ xe đang hoạt động của nhà xe.",
          );
        const prev = tripAssistants.get(tripId) ?? [];
        tripAssistants.set(
          tripId,
          ids.map(
            (userId) =>
              prev.find((a) => a.userId === userId) ?? {
                userId,
                assignedAt: new Date().toISOString(),
              },
          ),
        );
        return send(res, 200, list());
      }
    }
    const assignedTo = (tripId) =>
      activeAssistant(actor) &&
      (tripAssistants.get(tripId) ?? []).some((a) => a.userId === actor.id);
    // ---- Vận hành hành khách (khớp apps/api/src/bookings/passenger-ops.service.ts) ----
    const OPS_BOOKINGS = {
      TESTA1: {
        status: "CONFIRMED",
        name: "Khách Kiểm Thử Một",
        phone: "+84912000001",
        seats: ["A1", "A2"],
        total: 840000,
        paid: 400000,
      },
      TESTB1: {
        status: "CONFIRMED",
        name: "Khách Kiểm Thử Hai",
        phone: "+84912000002",
        seats: ["B1"],
        total: 420000,
        paid: 420000,
      },
      TESTE1: {
        status: "CONFIRMED",
        name: "Khách đã xóa thông tin",
        phone: "",
        seats: ["B1"],
        total: 420000,
        paid: 420000,
      },
      TESTH1: {
        status: "HOLDING",
        name: "Khách Đang Giữ",
        phone: "+84912000003",
        seats: ["A3"],
        total: 420000,
        paid: 0,
      },
    };
    const opsStatus = (code) =>
      cancelledCodes.has(code) ? "CANCELLED" : OPS_BOOKINGS[code]?.status;
    const opsPaid = (code) =>
      (OPS_BOOKINGS[code]?.paid ?? 0) + (onboardTotals.get(code) ?? 0);
    const boardedAt = (code, seat) =>
      boardedSeats.get(`${code}:${seat}`) ?? null;
    const boardingView = (code) => {
      const b = OPS_BOOKINGS[code];
      return {
        code,
        status: opsStatus(code),
        contactName: b.name,
        dueAmount: Math.max(b.total - opsPaid(code), 0),
        seats: b.seats.map((seat) => ({
          code: seat,
          occupancy: 1,
          boardedAt: boardedAt(code, seat),
        })),
      };
    };
    const boardingMatch = new RegExp(
      `^${tripBase}(trips|my-trips)/([0-9a-f-]{36})/boarding$`,
    ).exec(path);
    if (boardingMatch && req.method === "POST") {
      const mine = boardingMatch[1] === "my-trips";
      if (!can(mine ? "trip.assigned.board" : "booking.board"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const tripId = boardingMatch[2];
      if (mine ? !assignedTo(tripId) : tripId !== ASSIGNABLE_TRIP)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      let code = body.bookingCode;
      if (body.qr) {
        const m =
          /\/tickets\/([A-Z0-9]{4,12})\/verify\?proof=([A-Za-z0-9_-]{43})$/.exec(
            body.qr,
          );
        if (!m)
          return fail(
            res,
            400,
            "VALIDATION_FAILED",
            "Mã QR không phải vé của hệ thống.",
          );
        if (m[2].startsWith("bad"))
          return fail(
            res,
            404,
            "NOT_FOUND",
            "Vé không hợp lệ hoặc đã được cấp lại.",
          );
        code = m[1];
      }
      if (!OPS_BOOKINGS[code])
        return fail(
          res,
          404,
          "NOT_FOUND",
          `Vé ${code} không thuộc chuyến này.`,
        );
      const st = opsStatus(code);
      if (st !== "CONFIRMED")
        return fail(
          res,
          409,
          "CONFLICT",
          st === "CANCELLED"
            ? `Đơn ${code} đã hủy.`
            : `Đơn ${code} chưa được xác nhận.`,
        );
      let changed = 0;
      for (const seat of body.seatCodes ?? OPS_BOOKINGS[code].seats) {
        const k = `${code}:${seat}`;
        if (
          body.boarded === false ? boardedSeats.delete(k) : !boardedSeats.has(k)
        ) {
          if (body.boarded !== false)
            boardedSeats.set(k, "2027-02-05T10:30:00.000Z");
          changed += 1;
        }
      }
      return send(res, 200, { booking: boardingView(code), changed });
    }
    const editMatch = new RegExp(`^${tripBase}bookings/([A-Z0-9]{4,12})$`).exec(
      path,
    );
    if (editMatch && req.method === "PATCH") {
      if (!can("booking.update"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const code = editMatch[1];
      if (!OPS_BOOKINGS[code])
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy đơn.");
      if (opsStatus(code) === "CANCELLED" || !OPS_BOOKINGS[code].phone)
        return fail(res, 409, "CONFLICT", "Đơn này không sửa được.");
      const prev = bookingEdits.get(code) ?? {};
      const next = { ...prev };
      if (body.contactName !== undefined) next.contactName = body.contactName;
      if (body.contactPhone !== undefined) {
        const m = /^0([35789]\d{8})$/.exec(
          body.contactPhone.replace(/\s/g, ""),
        );
        if (!m)
          return fail(
            res,
            400,
            "VALIDATION_FAILED",
            "Số điện thoại di động không hợp lệ.",
            {
              field: "contactPhone",
            },
          );
        next.contactPhone = `+84${m[1]}`;
      }
      for (const [field, kind] of [
        ["pickupStop", "pickup"],
        ["dropoffStop", "dropoff"],
      ])
        if (body[field] !== undefined) {
          const stop = body[field]
            ? TRIP_STOPS[kind].find((x) => x.name === body[field])
            : null;
          if (body[field] && !stop)
            return fail(
              res,
              400,
              "VALIDATION_FAILED",
              "Điểm không có trong tuyến.",
            );
          next[field] = stop;
        }
      if (body.note !== undefined) next.note = body.note || null;
      bookingEdits.set(code, next);
      return send(res, 200, {
        booking: {
          code,
          contactName: next.contactName ?? OPS_BOOKINGS[code].name,
          contactPhone: next.contactPhone ?? OPS_BOOKINGS[code].phone,
          note: next.note ?? null,
          pickupStop: next.pickupStop ?? null,
          dropoffStop: next.dropoffStop ?? null,
        },
        changed: Object.keys(body),
      });
    }
    if (path === tripBase + "payments/manual" && req.method === "POST") {
      if (!can("payment.record"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const code = body.bookingCode;
      if (!OPS_BOOKINGS[code])
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy đơn.");
      const key = req.headers["idempotency-key"];
      if (!key)
        return fail(res, 400, "VALIDATION_FAILED", "Thiếu Idempotency-Key.");
      if (manualKeys.has(key))
        return send(res, 200, { ...manualKeys.get(key), replayed: true });
      manualPaid.set(code, (manualPaid.get(code) ?? 0) + body.amount);
      const view = {
        id: crypto.randomUUID(),
        method: body.method,
        amount: body.amount,
        allocatedAmount: body.amount,
      };
      manualKeys.set(key, view);
      return send(res, 200, view);
    }
    const cancelMatch = new RegExp(
      `^${tripBase}bookings/([A-Z0-9]{4,12})/cancel$`,
    ).exec(path);
    if (cancelMatch && req.method === "POST") {
      if (!can("booking.cancel"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const code = cancelMatch[1];
      if (!OPS_BOOKINGS[code])
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy đơn.");
      if (!body.reason || body.reason.trim().length < 3)
        return fail(
          res,
          400,
          "VALIDATION_FAILED",
          "Vui lòng ghi lý do hủy (ít nhất 3 ký tự).",
        );
      const refundOf = () =>
        refunds.find((x) => x.bookingCode === code) ?? null;
      if (cancelledCodes.has(code))
        return send(res, 200, {
          booking: { code, status: "CANCELLED", paidAmount: opsPaid(code) },
          refund: refundOf(),
          alreadyCancelled: true,
        });
      if (OPS_BOOKINGS[code].seats.some((seat) => boardedAt(code, seat)))
        return fail(
          res,
          409,
          "CONFLICT",
          "Khách đã lên xe: bỏ đánh dấu lên xe trước khi hủy.",
        );
      cancelledCodes.set(code, body.reason.trim());
      if (opsPaid(code) > 0)
        refunds.push({
          id: crypto.randomUUID(),
          bookingCode: code,
          amount: opsPaid(code),
          reason: body.reason.trim(),
          status: "OPEN",
          createdAt: "2027-02-05T10:00:00.000Z",
          createdBy: actor?.fullName ?? "Chủ xe kiểm thử",
          resolvedAt: null,
          resolvedBy: null,
          resolveNote: null,
          contactName: OPS_BOOKINGS[code].name,
          contactPhone: OPS_BOOKINGS[code].phone,
          contactErased: !OPS_BOOKINGS[code].phone,
        });
      return send(res, 200, {
        booking: { code, status: "CANCELLED", paidAmount: opsPaid(code) },
        refund: refundOf(),
        alreadyCancelled: false,
      });
    }
    if (path === tripBase + "refunds" && req.method === "GET") {
      if (!can("payment.read"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const all = url.searchParams.get("status") === "ALL";
      return send(res, 200, {
        refunds: refunds.filter((x) => all || x.status === "OPEN"),
      });
    }
    const refundMatch = new RegExp(
      `^${tripBase}refunds/([0-9a-f-]{36})/resolve$`,
    ).exec(path);
    if (refundMatch && req.method === "POST") {
      if (!can("payment.manage"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const item = refunds.find((x) => x.id === refundMatch[1]);
      if (!item)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy khoản cần hoàn.");
      if (item.status !== "OPEN")
        return item.status === body.status
          ? send(res, 200, { refund: item, replayed: true })
          : fail(res, 409, "CONFLICT", "Khoản này đã được xử lý.");
      Object.assign(item, {
        status: body.status,
        resolvedAt: "2027-02-05T11:00:00.000Z",
        resolvedBy: actor?.fullName ?? "Chủ xe kiểm thử",
        resolveNote: body.note ?? null,
      });
      return send(res, 200, { refund: item, replayed: false });
    }
    const boardImportMatch = new RegExp(
      `^${tripBase}trips/([0-9a-f-]{36})/passengers/boarding-import$`,
    ).exec(path);
    if (boardImportMatch && req.method === "POST") {
      if (!can("booking.board"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      if (boardImportMatch[1] !== ASSIGNABLE_TRIP)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      const dryRun = url.searchParams.get("dryRun") === "true";
      const key = req.headers["idempotency-key"];
      if (!dryRun && !key)
        return fail(res, 400, "VALIDATION_FAILED", "Thiếu Idempotency-Key.");
      if (!dryRun && importKeys.has(key))
        return send(res, 200, { ...idempotent[key], replayed: true });
      const issues = [];
      const acc = new Map();
      let unchanged = 0;
      for (const row of body.rows) {
        const code = String(row.code).trim().toUpperCase();
        if (!OPS_BOOKINGS[code]) {
          issues.push({
            rows: [row.row],
            message: `Dòng ${row.row}: mã vé không thuộc chuyến này.`,
          });
          continue;
        }
        if (opsStatus(code) !== "CONFIRMED") {
          if (row.boarded || row.collected)
            issues.push({
              rows: [row.row],
              message: `Dòng ${row.row}: đơn ${code} chưa được xác nhận, không ghi lên xe/thực thu được.`,
            });
          else unchanged += 1;
          continue;
        }
        const a = acc.get(code) ?? {
          rows: [],
          board: new Set(),
          collected: null,
        };
        acc.set(code, a);
        a.rows.push(row.row);
        const yes = /^(x|có|1|true)$/i.test(String(row.boarded ?? "").trim());
        if (yes)
          for (const seat of row.seatCode
            ? [row.seatCode]
            : OPS_BOOKINGS[code].seats)
            a.board.add(seat);
        const money = Number(String(row.collected ?? "").replace(/\D/g, ""));
        if (
          row.collected !== null &&
          row.collected !== "" &&
          Number.isFinite(money)
        )
          a.collected = (a.collected ?? 0) + money;
      }
      const updates = [];
      for (const [code, a] of acc) {
        const boardSeats = [...a.board].filter(
          (seat) => !boardedAt(code, seat),
        );
        const prior = onboardTotals.get(code) ?? 0;
        const collect = a.collected === null ? 0 : a.collected - prior;
        const due = OPS_BOOKINGS[code].total - opsPaid(code);
        if (collect > due) {
          issues.push({
            rows: a.rows,
            message: `Dòng ${a.rows.join(", ")}: thực thu thêm lớn hơn số còn phải thu của đơn ${code}.`,
          });
          continue;
        }
        if (!boardSeats.length && collect <= 0) {
          unchanged += a.rows.length;
          continue;
        }
        updates.push({
          code,
          rows: a.rows,
          boardSeats,
          collectAmount: Math.max(collect, 0),
          dueAfter: due - Math.max(collect, 0),
        });
      }
      const plan = {
        issues,
        updates,
        unchanged,
        totals: {
          bookings: updates.length,
          boardSeats: updates.reduce((n, u) => n + u.boardSeats.length, 0),
          collectAmount: updates.reduce((n, u) => n + u.collectAmount, 0),
        },
      };
      if (dryRun) return send(res, 200, { ok: !issues.length, ...plan });
      if (issues.length)
        return send(res, 400, {
          error: {
            code: "VALIDATION_FAILED",
            message: "File còn dòng lỗi. Chưa cập nhật dòng nào.",
            details: { issues },
          },
        });
      for (const u of updates) {
        for (const seat of u.boardSeats)
          boardedSeats.set(`${u.code}:${seat}`, "2027-02-05T10:30:00.000Z");
        if (u.collectAmount)
          onboardTotals.set(
            u.code,
            (onboardTotals.get(u.code) ?? 0) + u.collectAmount,
          );
      }
      importKeys.add(key);
      idempotent[key] = plan;
      return send(res, 200, { ...plan, replayed: false });
    }
    if (path === tripBase + "my-trips" && req.method === "GET") {
      if (!can("trip.assigned.read"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      return send(res, 200, {
        trips: [ASSIGNABLE_TRIP, OTHER_TRIP].filter(assignedTo).map((id) => ({
          ...tripRef(id),
          bookingCount: id === ASSIGNABLE_TRIP ? 2 : 0,
          seatCount: id === ASSIGNABLE_TRIP ? 3 : 0,
        })),
      });
    }
    const passengerMatch = new RegExp(
      `^${tripBase}my-trips/([0-9a-f-]{36})/passengers$`,
    ).exec(path);
    if (passengerMatch && req.method === "GET") {
      if (!can("trip.assigned.read"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const tripId = passengerMatch[1];
      if (!assignedTo(tripId))
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      const bookings =
        tripId === ASSIGNABLE_TRIP
          ? [
              {
                code: "TESTA1",
                status: "CONFIRMED",
                contactName: "Khách Kiểm Thử Một",
                contactPhone: "+84912000001",
                note: "Đón ở ngã tư",
                totalAmount: 840000,
                paidAmount: 400000,
                dueAmount: 440000,
                paymentStatus: "PARTIAL",
                seats: [
                  { code: "A1", floor: "1", occupancy: 2, infantCount: 0 },
                  { code: "A2", floor: "1", occupancy: 1, infantCount: 1 },
                ],
              },
              {
                code: "TESTB1",
                status: "CONFIRMED",
                contactName: "Khách Kiểm Thử Hai",
                contactPhone: "+84912000002",
                note: null,
                totalAmount: 420000,
                paidAmount: 420000,
                dueAmount: 0,
                paymentStatus: "PAID",
                seats: [
                  { code: "B1", floor: "2", occupancy: 1, infantCount: 0 },
                ],
              },
            ]
          : [];
      for (const b of bookings)
        for (const seat of b.seats)
          seat.boardedAt = boardedAt(b.code, seat.code);
      return send(res, 200, {
        trip: tripRef(tripId),
        bookings,
        summary: {
          bookings: bookings.length,
          seats: bookings.reduce((n, b) => n + b.seats.length, 0),
          people: tripId === ASSIGNABLE_TRIP ? 4 : 0,
          infants: tripId === ASSIGNABLE_TRIP ? 1 : 0,
          dueAmount: bookings.reduce((n, b) => n + b.dueAmount, 0),
          boarded: bookings.reduce(
            (n, b) => n + b.seats.filter((x) => x.boardedAt).length,
            0,
          ),
        },
        fetchedAt: new Date().toISOString(),
      });
    }
    const staffBookingMatch = new RegExp(
      `^${tripBase}trips/([0-9a-f-]{36})/(bookings|passengers/import)$`,
    ).exec(path);
    if (staffBookingMatch && req.method === "POST") {
      if (!can("booking.create"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      if (staffBookingMatch[1] !== ASSIGNABLE_TRIP)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      const dryRun = url.searchParams.get("dryRun") === "true";
      const key = req.headers["idempotency-key"];
      if (!dryRun && !key)
        return fail(res, 400, "VALIDATION_FAILED", "Thiếu Idempotency-Key.");
      const price = (occ) => (occ === 2 ? 700000 : 450000);
      const preview = (rows, b, items) => {
        const total = items.reduce((n, i) => n + price(i.occupancy ?? 1), 0);
        const paid = Number(b.paidAmount ?? 0) || 0;
        return {
          rows,
          contactName: b.contactName,
          contactPhone: "+84" + String(b.contactPhone).replace(/^0/, ""),
          note: b.note ?? null,
          pickupStop:
            TRIP_STOPS.pickup.find((x) => x.name === b.pickupStop) ?? null,
          dropoffStop:
            TRIP_STOPS.dropoff.find((x) => x.name === b.dropoffStop) ?? null,
          seats: items.map((i) => ({
            code: i.seatCode,
            occupancy: i.occupancy ?? 1,
            infantCount: i.infantCount ?? 0,
            lineTotal: price(i.occupancy ?? 1),
          })),
          status:
            b.confirm === false && paid < 200000 ? "HOLDING" : "CONFIRMED",
          totalAmount: total,
          depositAmount: 200000,
          paidAmount: paid,
          dueAmount: total - paid,
          paymentStatus:
            paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
        };
      };
      const summary = (code, p) => ({
        code,
        rows: p.rows,
        status: p.status,
        seats: p.seats.map((x) => x.code),
        totalAmount: p.totalAmount,
        depositAmount: p.depositAmount,
        paidAmount: p.paidAmount,
        dueAmount: p.dueAmount,
        paymentStatus: p.paymentStatus,
        holdUntil: p.status === "HOLDING" ? "2027-02-05T05:00:00.000Z" : null,
      });
      if (staffBookingMatch[2] === "bookings") {
        const taken = body.items.filter((i) => i.seatCode !== "A1");
        const issues = taken.map((i) => ({
          rows: [],
          message: `Chỗ ${i.seatCode} đã có đơn TESTBK1.`,
        }));
        const p = preview([], body, body.items);
        if (dryRun)
          return send(res, 200, {
            ok: !issues.length,
            issues,
            quote: issues.length ? null : p,
          });
        // SĐT này giả lập trường hợp chỗ vừa bị đặt giữa lúc xem giá và lúc bán.
        if (issues.length || body.contactPhone === "0912999999")
          return send(res, 409, {
            error: {
              code: "SEAT_UNAVAILABLE",
              message: "Chỗ vừa được đặt. Vui lòng chọn chỗ khác.",
              details: {
                issues: issues.length
                  ? issues
                  : [{ rows: [], message: "Chỗ A1 đã có đơn TESTZZ." }],
                internal: "không được chuyển ra trình duyệt",
              },
            },
          });
        return send(res, 200, {
          booking: summary("TESTC1", p),
          replayed: false,
        });
      }
      const issues = [];
      const bookings = [];
      for (const r of body.rows) {
        if (r.seatCode === "A2")
          issues.push({
            rows: [r.row],
            message: `Dòng ${r.row}: chỗ A2 đã có đơn TESTBK1.`,
          });
        else
          bookings.push(
            preview([r.row], { ...r, confirm: body.confirm }, [
              { seatCode: r.seatCode, occupancy: Number(r.occupancy ?? 1) },
            ]),
          );
      }
      if (dryRun)
        return send(res, 200, {
          ok: !issues.length,
          issues,
          warnings: [],
          bookings,
          totals: {
            bookings: bookings.length,
            seats: bookings.length,
            totalAmount: bookings.reduce((n, b) => n + b.totalAmount, 0),
            paidAmount: bookings.reduce((n, b) => n + b.paidAmount, 0),
          },
        });
      if (issues.length)
        return send(res, 409, {
          error: {
            code: "SEAT_UNAVAILABLE",
            message: "File còn dòng lỗi. Chưa nhập dòng nào.",
            details: { issues },
          },
        });
      const replayed = importKeys.has(key);
      importKeys.add(key);
      return send(res, 200, {
        bookings: bookings.map((b, i) => summary(`TESTI${i + 1}`, b)),
        replayed,
      });
    }
    const proofListMatch = new RegExp(
      `^${tripBase}bookings/([A-Z0-9]{4,12})/payment-proofs$`,
    ).exec(path);
    if (proofListMatch && req.method === "GET") {
      if (!can("payment.read"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      if (proofListMatch[1] !== "TESTH1")
        return send(res, 200, { transferClaimedAt: null, proofs: [] });
      return send(res, 200, {
        transferClaimedAt: "2027-02-05T03:00:00.000Z",
        proofs: [
          {
            id: PROOF_ID,
            mime: "image/png",
            bytes: PROOF_PNG.length,
            createdAt: "2027-02-05T03:00:00.000Z",
          },
        ],
      });
    }
    const proofImageMatch = new RegExp(
      `^${tripBase}payment-proofs/([0-9a-f-]{36})$`,
    ).exec(path);
    if (proofImageMatch && req.method === "GET") {
      if (!can("payment.read"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      if (proofImageMatch[1] !== PROOF_ID)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy ảnh.");
      res.writeHead(200, { "Content-Type": "image/png" });
      return res.end(PROOF_PNG);
    }
    const adminPassengerMatch = new RegExp(
      `^${tripBase}trips/([0-9a-f-]{36})/passengers(/export)?$`,
    ).exec(path);
    if (adminPassengerMatch && req.method === "GET") {
      const exporting = !!adminPassengerMatch[2];
      if (!can(exporting ? "booking.export" : "booking.read"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      const tripId = adminPassengerMatch[1];
      if (tripId !== ASSIGNABLE_TRIP)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      const status = url.searchParams.get("status") ?? "active";
      if (!["active", "all"].includes(status))
        return fail(res, 400, "VALIDATION_FAILED", "Bộ lọc không hợp lệ.");
      const at = "2027-02-01T03:00:00.000Z";
      const booking = (code, extra) => ({
        code,
        status: "CONFIRMED",
        channel: "ONLINE",
        contactErased: false,
        holdUntil: null,
        createdAt: at,
        note: null,
        ...extra,
      });
      const bookings = [
        booking("TESTA1", {
          contactName: "Khách Kiểm Thử Một",
          contactPhone: "+84912000001",
          note: "=Đón ở ngã tư",
          pickupStop: TRIP_STOPS.pickup[0],
          dropoffStop: TRIP_STOPS.dropoff[0],
          totalAmount: 840000,
          paidAmount: 400000,
          dueAmount: 440000,
          paymentStatus: "PARTIAL",
          seats: [
            { code: "A1", floor: "1", occupancy: 2, infantCount: 0 },
            { code: "A2", floor: "1", occupancy: 1, infantCount: 1 },
          ],
        }),
        booking("TESTH1", {
          status: "HOLDING",
          channel: "STAFF",
          holdUntil: "2027-02-05T05:00:00.000Z",
          transferClaimedAt: "2027-02-05T03:00:00.000Z",
          paymentProofCount: 1,
          createdBy: "Test SELLER",
          contactName: "Khách Đang Giữ",
          contactPhone: "+84912000003",
          totalAmount: 420000,
          paidAmount: 0,
          dueAmount: 420000,
          paymentStatus: "UNPAID",
          seats: [{ code: "A3", floor: "1", occupancy: 1, infantCount: 0 }],
        }),
        booking("TESTE1", {
          contactErased: true,
          contactName: "Khách đã xóa thông tin",
          contactPhone: "",
          totalAmount: 420000,
          paidAmount: 420000,
          dueAmount: 0,
          paymentStatus: "PAID",
          seats: [{ code: "B1", floor: "2", occupancy: 1, infantCount: 0 }],
        }),
        ...(status === "all"
          ? [
              booking("TESTX1", {
                status: "CANCELLED",
                contactName: "Khách Đã Hủy",
                contactPhone: "+84912000004",
                totalAmount: 420000,
                paidAmount: 0,
                dueAmount: 420000,
                paymentStatus: "UNPAID",
                seats: [
                  { code: "B2", floor: "2", occupancy: 1, infantCount: 0 },
                ],
              }),
            ]
          : []),
      ];
      const visible = bookings
        .map((b) => {
          const st = cancelledCodes.has(b.code) ? "CANCELLED" : b.status;
          const extra =
            (onboardTotals.get(b.code) ?? 0) + (manualPaid.get(b.code) ?? 0);
          return {
            ...b,
            ...bookingEdits.get(b.code),
            status: st,
            cancelReason: cancelledCodes.get(b.code) ?? null,
            onboardCollected: onboardTotals.get(b.code) ?? 0,
            paidAmount: b.paidAmount + extra,
            dueAmount: Math.max(b.dueAmount - extra, 0),
            seats: b.seats.map((x) => ({
              ...x,
              boardedAt: boardedAt(b.code, x.code),
            })),
          };
        })
        .filter((b) => status === "all" || b.status !== "CANCELLED");
      return send(res, 200, {
        trip: tripRef(tripId),
        bookings: visible,
        summary: {
          bookings: 2,
          seats: 3,
          people: 4,
          infants: 1,
          dueAmount: 440000,
          boarded: visible
            .filter((b) => b.status === "CONFIRMED")
            .reduce((n, b) => n + b.seats.filter((x) => x.boardedAt).length, 0),
        },
        holding: { bookings: 1, seats: 1 },
        fetchedAt: "2027-02-05T03:00:00.000Z",
      });
    }
    if (path === tripBase + "users" || path.startsWith(tripBase + "users/")) {
      if (grants && !grants.includes("user.manage"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền quản lý nhân viên.");
      if (malformed) return send(res, 200, { wrong: true });
      if (path === tripBase + "users" && req.method === "GET")
        return send(res, 200, {
          users: [{ ...currentUser(), status: "ACTIVE" }, ...staff],
        });
      if (path === tripBase + "users" && req.method === "POST") {
        const row = {
          id: crypto.randomUUID(),
          operatorId: op,
          fullName: body.fullName,
          phone: body.phone,
          role: body.role,
          status: "ACTIVE",
          mfaEnabled: false,
        };
        staff.push(row);
        staffPasswords.set(row.id, body.password);
        return send(res, 201, row);
      }
      const id = path.split("/").at(-1);
      if (id === user.id)
        return fail(
          res,
          403,
          "FORBIDDEN",
          "Không thể thao tác tài khoản đang đăng nhập.",
        );
      const index = staff.findIndex((record) => record.id === id);
      if (index < 0)
        return fail(res, 404, "NOT_FOUND", "Không tìm thấy tài khoản.");
      if (req.method === "PATCH") {
        const record = staff[index];
        if (
          "password" in body ||
          ["phone", "role", "status"].some(
            (key) => key in body && record[key] !== body[key],
          )
        )
          revokeStaff(id);
        if ("password" in body) {
          staffPasswords.set(id, body.password);
          mustChange.add(id);
        }
        for (const field of ["fullName", "phone", "role", "status"]) {
          if (field in body) record[field] = body[field];
        }
        return send(res, 200, staff[index]);
      }
      if (req.method === "DELETE") {
        revokeStaff(id);
        staffPasswords.delete(id);
        staff.splice(index, 1);
        return send(res, 200, { ok: true });
      }
      return fail(res, 405, "METHOD_NOT_ALLOWED", "Thao tác không hỗ trợ.");
    }
    const routeId = "66666666-6666-4666-8666-666666666666",
      vehicleId = "77777777-7777-4777-8777-777777777777",
      layoutId = "88888888-8888-4888-8888-888888888888",
      oldVehicleId = "99999999-9999-4999-8999-999999999999",
      oldLayoutId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const reverseRouteId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    if (path === tripBase + "logo") {
      if (grants && !grants.includes("policy.write"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      if (req.method === "DELETE") logo = null;
      else if (req.method === "PUT") {
        const mime = (req.headers["content-type"] || "").split(";")[0];
        const png = rawBytes
          .subarray(0, 4)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        if (mime !== "image/png" || !png || rawBytes.length > 204800)
          return fail(
            res,
            400,
            "VALIDATION_FAILED",
            "Logo phải là ảnh PNG, JPEG hoặc WebP, tối đa 200 KB.",
          );
        logo = { data: rawBytes, mime, version: String(Date.now()) };
      }
      return send(res, 200, { ...profile, logoVersion: logo?.version ?? null });
    }
    if (path === tripBase + "policy") {
      if (grants && req.method === "PUT" && !grants.includes("policy.write"))
        return fail(res, 403, "FORBIDDEN", "Không có quyền.");
      policy ??= defaultPolicy();
      if (req.method === "PUT")
        policy = { ...policy, ...body, version: policy.version + 1 };
      return send(res, 200, policy);
    }
    if (path === tripBase + "profile") {
      if (req.method === "PUT") profile = { ...profile, ...body };
      return send(res, 200, { ...profile, logoVersion: logo?.version ?? null });
    }
    if (path === tripBase + "payment-account") {
      if (req.method === "PUT") {
        if (
          body.password !== "Test-only-Password!" ||
          (!mfaOff && body.otp !== "123456")
        )
          return fail(
            res,
            403,
            "FORBIDDEN",
            "Mật khẩu hoặc mã xác thực không đúng.",
          );
        paymentAccount = {
          provider: "SEPAY",
          bankCode: body.bankCode.toUpperCase(),
          accountNumber: body.accountNumber,
          accountName: body.accountName,
          reconcileEnabled: Boolean(body.apiToken),
        };
      }
      return send(res, 200, { account: paymentAccount });
    }
    if (path === tripBase + "trip-schedules") {
      if (req.method === "POST") {
        const row = {
          id: crypto.randomUUID(),
          name: body.name,
          config: body,
          enabled: false,
          last_error: null,
          last_success_at: null,
          exception: null,
        };
        schedules.push(row);
        return send(res, 201, row);
      }
      return send(res, 200, { schedules });
    }
    if (path.startsWith(tripBase + "trip-schedules/")) {
      const [id, action] = path
        .slice((tripBase + "trip-schedules/").length)
        .split("/");
      const row = schedules.find((v) => v.id === id);
      if (!row) return fail(res, 404, "NOT_FOUND", "Không tìm thấy lịch.");
      if (action === "preview")
        return send(res, 200, {
          occurrences: row.config.legs.map((leg, i) => ({
            date: row.config.startDate,
            leg: i,
            routeId: leg.routeId,
            vehicleId: leg.vehicles[0].vehicleId,
            departAt: new Date(
              row.config.startDate + "T" + row.config.departTime + ":00+07:00",
            ).toISOString(),
            skipped:
              row.exception?.leg === i && row.exception?.skipped === true,
            existing: !!row.last_success_at,
          })),
        });
      if (action === "generate") {
        row.last_success_at = new Date().toISOString();
        return send(res, 201, { created: 60 });
      }
      if (action === "exception") {
        row.exception = body;
        return send(res, 200, body);
      }
      row.enabled = body.enabled;
      return send(res, 200, row);
    }
    if (path === tripBase + "trips/batch" && req.method === "POST") {
      const rows = body.trips.map((v, i) => ({
        id: crypto.randomUUID(),
        name: v.name,
        code: i ? "PN050227-BACK" : "PN050227-TEST",
        status: v.status,
        depart_at: v.departAt,
        sales_open_at: v.salesOpenAt,
        sales_close_at: v.salesCloseAt,
        contact_phone: null,
        route_code: i ? "BACK" : "TEST",
        vehicle_code: i ? "TEST02" : "TEST01",
        vehicle_name: i ? "Xe sơ đồ cũ" : "Xe kiểm thử",
        available: 2,
        capacity: 2,
      }));
      createdTrips.push(...rows);
      return send(res, 201, { trips: rows });
    }
    if (path === tripBase + "routes")
      return send(res, 200, {
        routes: [
          {
            id: routeId,
            code: "TEST",
            origin: "TP. Hồ Chí Minh",
            destination: "Đà Lạt",
          },
          {
            id: reverseRouteId,
            code: "BACK",
            origin: "Đà Lạt",
            destination: "TP. Hồ Chí Minh",
          },
        ],
      });
    if (path === tripBase + "vehicles")
      return send(res, 200, {
        vehicles: [
          {
            id: vehicleId,
            code: "TEST01",
            name: "Xe kiểm thử",
            seat_layout_id: layoutId,
            status: "ACTIVE",
          },
          {
            id: oldVehicleId,
            code: "TEST02",
            name: "Xe sơ đồ cũ",
            seat_layout_id: oldLayoutId,
            status: "ACTIVE",
          },
        ],
      });
    if (path === tripBase + "seat-layouts/" + oldLayoutId)
      return send(res, 200, {
        layout: {
          id: oldLayoutId,
          name: "Sơ đồ kiểm thử (bản cũ)",
          definition: {
            floors: [{ code: "1", label: "Tầng dưới", rows: ["A1 A2"] }],
            defaultMaxOccupancy: 1,
          },
        },
      });
    if (path === tripBase + "seat-layouts")
      return send(res, 200, {
        layouts: [
          {
            id: layoutId,
            name: "Sơ đồ kiểm thử",
            definition: {
              floors: [{ code: "1", label: "Tầng dưới", rows: ["A1 A2"] }],
              defaultMaxOccupancy: 1,
            },
          },
        ],
      });
    if (path === tripBase + "trips" && req.method === "POST") {
      const key = req.headers["idempotency-key"];
      if (key && idempotent[key])
        return send(res, 201, { ...idempotent[key], replayed: true });
      const t = {
        id: crypto.randomUUID(),
        name: body.name,
        status: body.status,
        depart_at: body.departAt,
        sales_open_at: body.salesOpenAt,
        sales_close_at: body.salesCloseAt,
        contact_phone: body.contactPhone ?? null,
        code: "PN050227-TEST",
        route_code: "TEST",
        vehicle_code: "TEST01",
        vehicle_name: "Xe kiểm thử",
        available: 2,
        capacity: 2,
      };
      createdTrips.push(t);
      if (key) idempotent[key] = t;
      return send(res, 201, t);
    }
    if (
      path.startsWith(tripBase + "trips/") &&
      path.endsWith("/status") &&
      req.method === "PATCH"
    ) {
      const id = path.split("/").at(-2);
      statusOverrides[id] = body.status;
      return send(res, 200, {
        id,
        name: "Chuyến kiểm thử",
        status: body.status,
        depart_at: new Date().toISOString(),
      });
    }
    if (req.method !== "GET")
      return fail(res, 405, "READ_ONLY", "Test expects reads only.");
    const prefix = `/api/v1/admin/operators/${op}/`;
    if (!path.startsWith(prefix))
      return fail(res, 404, "NOT_FOUND", "Sai nhà xe.");
    if (malformed) return send(res, 200, { wrong: true });
    const resource = path.slice(prefix.length);
    const when = new Date().toISOString();
    if (resource === "payments")
      return send(res, 200, {
        payments: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            method: "BANK_TRANSFER",
            amount: 250000,
            allocatedAmount: 200000,
            unallocatedAmount: 50000,
            content: "TEST ONLY",
            bankReference: "TEST-BANK",
            transactionAt: when,
            receivedAt: when,
            matchedBookingCode: "TEST123",
            review: { status: "NEEDS_REVIEW", reason: "OVERPAID", note: null },
            recordedBy: null,
            allocations: [{ bookingCode: "TEST123", amount: 200000, at: when }],
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            method: "BANK_TRANSFER",
            amount: 380000,
            allocatedAmount: 0,
            unallocatedAmount: 380000,
            content: "TESTLATE",
            bankReference: "TEST-LATE",
            transactionAt: when,
            receivedAt: when,
            matchedBookingCode: "TESTLATE",
            review: { status: "NEEDS_REVIEW", reason: "LATE", note: null },
            recordedBy: null,
            allocations: [],
          },
        ],
      });
    const detailMatch = /^trips\/([0-9a-f-]{36})$/.exec(resource);
    if (detailMatch) {
      const id = detailMatch[1];
      const base =
        createdTrips.find((t) => t.id === id) ??
        (id === "44444444-4444-4444-8444-444444444444"
          ? {
              id,
              name: "Chuyến kiểm thử",
              status: "OPEN",
              depart_at: "2027-02-05T10:30:00.000Z",
            }
          : null);
      if (!base) return fail(res, 404, "NOT_FOUND", "Không tìm thấy chuyến.");
      const seats = ["A1", "A2", "B1", "B2"].map((code, i) => ({
        code,
        floor: code[0] === "A" ? "1" : "2",
        row: 1,
        col: (i % 2) * 2,
        maxOccupancy: 2,
        sellable: code !== "B2",
        status: ["AVAILABLE", "HELD", "BOOKED", "BLOCKED"][i],
        bookingCode: i === 1 || i === 2 ? "TESTBK" + i : null,
        holdExpiresAt: i === 1 ? "2027-02-05T03:10:00.000Z" : null,
      }));
      return send(res, 200, {
        trip: {
          id,
          code: "PN050227-TEST",
          name: base.name,
          status: statusOverrides[id] ?? base.status,
          departAt: base.depart_at,
          arriveAt: null,
          salesOpenAt: "2027-01-01T00:00:00.000Z",
          salesCloseAt: base.depart_at,
          contactPhone: null,
          createdAt: "2027-01-01T00:00:00.000Z",
          onSale: false,
        },
        route: {
          id: routeId,
          code: "TEST",
          origin: "TP. Hồ Chí Minh",
          destination: "Đà Lạt",
        },
        vehicle: {
          id: vehicleId,
          code: "TEST01",
          name: "Xe kiểm thử",
          type: "LIMOUSINE",
          plateNumber: null,
          status: "ACTIVE",
          layoutChangedSinceTrip: true,
        },
        layout: {
          id: layoutId,
          code: "TEST4",
          version: 2,
          name: "Sơ đồ kiểm thử",
          unit: "phòng",
          kind: "room",
          floors: [
            { code: "1", label: "Tầng dưới", rows: ["TX . CUA", "A1 . A2"] },
            { code: "2", label: "Tầng trên", rows: ["_ . _", "B1 . B2"] },
          ],
        },
        fares: [
          { floor: "1", floorLabel: "Tầng dưới", occupancy: 1, price: 450000 },
          { floor: "1", floorLabel: "Tầng dưới", occupancy: 2, price: 700000 },
          { floor: "2", floorLabel: "Tầng trên", occupancy: 1, price: 420000 },
          { floor: "2", floorLabel: "Tầng trên", occupancy: 2, price: 650000 },
        ],
        seats,
        stops: TRIP_STOPS,
        summary: { capacity: 4, available: 1, held: 1, booked: 1, blocked: 1 },
        fetchedAt: when,
      });
    }
    // Ngày cố định không có chuyến, để kiểm thử trạng thái rỗng.
    if (resource === "trips" && url.searchParams.get("date") === "2027-03-09")
      return send(res, 200, { trips: [] });
    if (resource === "trips")
      return send(res, 200, {
        trips: [
          ...createdTrips.map((t) => ({
            ...t,
            status: statusOverrides[t.id] ?? t.status,
          })),
          {
            id: "44444444-4444-4444-8444-444444444444",
            name: "Chuyến kiểm thử",
            status:
              statusOverrides["44444444-4444-4444-8444-444444444444"] ?? "OPEN",
            depart_at: when,
            sales_open_at: when,
            sales_close_at: when,
            contact_phone: null,
            code: "PN050227-TEST",
            route_code: "TEST",
            vehicle_code: "TEST01",
            vehicle_name: "Xe kiểm thử",
            available: 8,
            capacity: 24,
          },
        ],
      });
    if (resource === "audit-logs")
      return send(res, 200, {
        entries: [
          {
            id: "1",
            action: "trip.create",
            entity: "trip",
            entity_id: null,
            data: { name: "Chuyến kiểm thử" },
            at: when,
            actor_name: "Test OWNER",
            actor_role: "OWNER",
          },
        ],
      });
    return fail(res, 404, "NOT_FOUND", "Không tồn tại.");
  })
  .listen(port, "127.0.0.1", () => console.log(`Fixture ready: ${port}`));
