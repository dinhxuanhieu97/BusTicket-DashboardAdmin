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
];
let permissions = OWNER_PERMISSIONS;
let createdTrips = [];
let idempotent = {};
let statusOverrides = {};
let revoked = false,
  down = false,
  malformed = false,
  setupStarted = false,
  confirmed = false,
  requests = [];
// Phiên refresh giả lập API thật: access token dạng JWT có `exp`, refresh token xoay vòng, ân hạn 30 giây.
let accessTtlMs = 3600000,
  refreshDown = false,
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
  sessions.set(sid, { remember, expiresAt, revoked: false, current: null });
  const access = mintAccess(sid, expiresAt);
  return {
    accessToken: access.token,
    scope,
    expiresAt: new Date(access.exp).toISOString(),
    refreshToken: mintRefresh(sid),
    sessionExpiresAt: new Date(expiresAt).toISOString(),
    remember,
    user: u,
  };
};
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return fail(res, 400, "BAD_JSON", "JSON không hợp lệ");
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const path = url.pathname;
    if (path === "/__test/reset") {
      revoked = false;
      permissions = OWNER_PERMISSIONS;
      createdTrips = [];
      idempotent = {};
      statusOverrides = {};
      down = false;
      malformed = false;
      setupStarted = false;
      confirmed = false;
      requests = [];
      accessTtlMs = 3600000;
      refreshDown = false;
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
      ...(path.includes("/trips") ? { body } : {}),
    });
    if (down) return fail(res, 503, "SERVICE_UNAVAILABLE", "Test outage");
    if (path === "/api/v1/auth/login" && req.method === "POST") {
      if (body.phone === "0900000004")
        return fail(res, 429, "TOO_MANY_ATTEMPTS", "Thử lại sau.");
      if (body.password !== "Test-only-Password!")
        return fail(
          res,
          401,
          "INVALID_CREDENTIALS",
          "Thông tin đăng nhập không đúng.",
        );
      if (body.phone === "0900000003")
        return send(res, 200, issued("full", { ...user, role: "ACCOUNTANT" }));
      if (body.phone === "0900000002" && !confirmed)
        return send(
          res,
          200,
          issued("mfa_setup", { ...user, mfaEnabled: false }),
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
      const entry = refreshIndex.get(body.refreshToken);
      const sess = entry && sessions.get(entry.sid);
      if (!sess || sess.revoked || sess.expiresAt <= Date.now())
        return fail(res, 401, "UNAUTHENTICATED", "Phiên đã hết hạn.");
      let refreshToken = null;
      if (sess.current === body.refreshToken) {
        entry.rotatedAt = Date.now();
        refreshToken = mintRefresh(entry.sid);
      } else if (!entry.rotatedAt || Date.now() - entry.rotatedAt > 30000) {
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
        user,
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
    if (path === "/api/v1/auth/me")
      return send(res, 200, {
        user: kind === "setup" ? { ...user, mfaEnabled: false } : user,
        scope: kind === "setup" ? "mfa_setup" : "full",
        ...(permissions === null
          ? {}
          : { permissions: kind === "setup" ? [] : permissions }),
      });
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
      return send(res, 200, issued("full", user));
    }
    if (kind !== "full")
      return fail(res, 403, "MFA_SETUP_REQUIRED", "Cần 2FA.");
    const tripBase = `/api/v1/admin/operators/${op}/`;
    const routeId = "66666666-6666-4666-8666-666666666666",
      vehicleId = "77777777-7777-4777-8777-777777777777",
      layoutId = "88888888-8888-4888-8888-888888888888",
      oldVehicleId = "99999999-9999-4999-8999-999999999999",
      oldLayoutId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    if (path === tripBase + "routes")
      return send(res, 200, {
        routes: [
          {
            id: routeId,
            code: "TEST",
            origin: "TP. Hồ Chí Minh",
            destination: "Đà Lạt",
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
        ],
      });
    if (resource === "users") return send(res, 200, { users: [user] });
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
        summary: { capacity: 4, available: 1, held: 1, booked: 1, blocked: 1 },
        fetchedAt: when,
      });
    }
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
