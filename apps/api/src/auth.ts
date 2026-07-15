import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { AuthStatus } from "@snowmountain/contracts";
import { Store, type AuthSessionRow } from "./db.js";

interface LoginResult {
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
  role: "admin" | "user";
  tenantId: string;
}

interface AttemptWindow {
  count: number;
  resetAt: number;
}

export class LoginRateLimitError extends Error {}

export function passwordDigest(password: string, salt = randomBytes(16).toString("hex")): { salt: string; hash: string } {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function equalSecret(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function cookieValue(header: string | undefined, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export class AuthManager {
  private readonly attempts = new Map<string, AttemptWindow>();
  readonly enabled: boolean;

  constructor(
    private readonly store: Store,
    private readonly options: {
      username: string;
      password: string;
      sessionHours: number;
      cookieSecure: boolean;
      cookiePath: string;
    }
  ) {
    this.enabled = options.password.length > 0;
    this.store.pruneAuthSessions();
  }

  login(username: string, password: string, ip: string): LoginResult | undefined {
    if (!this.enabled) return undefined;
    this.enforceRate(ip);
    let principal: { role: "admin" | "user"; tenantId: string } | undefined;
    if (equalSecret(username, this.options.username) && equalSecret(password, this.options.password)) {
      principal = { role: "admin", tenantId: "system" };
    } else {
      const user = this.store.getUserByUsername(username);
      if (user?.enabled && equalSecret(passwordDigest(password, user.password_salt).hash, user.password_hash)) {
        principal = { role: user.role, tenantId: user.tenant_id };
      }
    }
    if (!principal) {
      this.recordFailure(ip);
      return undefined;
    }
    this.attempts.delete(ip);
    const sessionToken = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + this.options.sessionHours * 60 * 60 * 1000).toISOString();
    this.store.createAuthSession(digest(sessionToken), username, principal.role, principal.tenantId, digest(csrfToken), expiresAt);
    return { sessionToken, csrfToken, expiresAt, ...principal };
  }

  session(request: FastifyRequest): AuthSessionRow | undefined {
    if (!this.enabled) return undefined;
    const token = cookieValue(request.headers.cookie, "sm_ark_session");
    return token ? this.store.getAuthSession(digest(token)) : undefined;
  }

  status(request: FastifyRequest): AuthStatus {
    if (!this.enabled) return { enabled: false, authenticated: true, user: "local-admin", role: "admin", tenantId: "system" };
    const session = this.session(request);
    return session
      ? { enabled: true, authenticated: true, user: session.username, role: session.role, tenantId: session.tenant_id, expiresAt: session.expires_at }
      : { enabled: true, authenticated: false };
  }

  verifyCsrf(request: FastifyRequest, session: AuthSessionRow): boolean {
    const header = String(request.headers["x-csrf-token"] ?? "");
    const cookie = cookieValue(request.headers.cookie, "sm_ark_csrf");
    return Boolean(header && cookie && equalSecret(header, cookie) && equalSecret(digest(header), session.csrf_hash));
  }

  logout(request: FastifyRequest): void {
    const token = cookieValue(request.headers.cookie, "sm_ark_session");
    if (token) this.store.deleteAuthSession(digest(token));
  }

  loginCookies(result: LoginResult): string[] {
    const maxAge = Math.max(1, Math.floor((Date.parse(result.expiresAt) - Date.now()) / 1000));
    const common = `Path=${this.options.cookiePath}; SameSite=Strict; Max-Age=${maxAge}${this.options.cookieSecure ? "; Secure" : ""}`;
    return [
      `sm_ark_session=${encodeURIComponent(result.sessionToken)}; ${common}; HttpOnly`,
      `sm_ark_csrf=${encodeURIComponent(result.csrfToken)}; ${common}`
    ];
  }

  clearCookies(): string[] {
    const common = `Path=${this.options.cookiePath}; SameSite=Strict; Max-Age=0${this.options.cookieSecure ? "; Secure" : ""}`;
    return [`sm_ark_session=; ${common}; HttpOnly`, `sm_ark_csrf=; ${common}`];
  }

  private enforceRate(ip: string): void {
    const current = this.attempts.get(ip);
    if (!current || current.resetAt <= Date.now()) return;
    if (current.count >= 5) throw new LoginRateLimitError("Too many login attempts");
  }

  private recordFailure(ip: string): void {
    const current = this.attempts.get(ip);
    if (!current || current.resetAt <= Date.now()) {
      this.attempts.set(ip, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
    } else {
      current.count += 1;
    }
  }
}
