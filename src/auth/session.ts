import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "ares_session";
export const DEFAULT_SESSION_DAYS = 30;

const HASH_ALGORITHM = "pbkdf2-sha256";
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";
const DEFAULT_HASH_ITERATIONS = 210_000;

export function sessionMaxAgeSeconds(): number {
  const configured = Number(process.env.ARES_SESSION_DAYS);
  const days = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_DAYS;
  return Math.floor(days * 24 * 60 * 60);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(
    password,
    salt,
    DEFAULT_HASH_ITERATIONS,
    HASH_KEY_LENGTH,
    HASH_DIGEST,
  );
  return [
    HASH_ALGORITHM,
    String(DEFAULT_HASH_ITERATIONS),
    base64UrlEncode(salt),
    base64UrlEncode(hash),
  ].join(":");
}

export function verifyPassword(password: string, storedHash: string | undefined): boolean {
  if (!storedHash) return false;
  const [algorithm, iterationsValue, saltValue, hashValue] = storedHash.split(":");
  const iterations = Number(iterationsValue);
  if (
    algorithm !== HASH_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  try {
    const expected = base64UrlDecode(hashValue);
    const actual = pbkdf2Sync(
      password,
      base64UrlDecode(saltValue),
      iterations,
      expected.length,
      HASH_DIGEST,
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createSessionCookieValue(
  secret: string | undefined,
  maxAgeSeconds = sessionMaxAgeSeconds(),
  now = Date.now(),
): string {
  if (!secret) throw new Error("ARES_AUTH_SECRET is required.");
  const payload = base64UrlEncode(
    Buffer.from(JSON.stringify({ v: 1, exp: now + maxAgeSeconds * 1000 })),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionCookieValue(
  cookieValue: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!cookieValue || !secret) return false;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return false;

  try {
    const expected = sign(payload, secret);
    if (!constantTimeEqual(signature, expected)) return false;
    const parsed = JSON.parse(base64UrlDecode(payload).toString("utf8")) as {
      v?: unknown;
      exp?: unknown;
    };
    return parsed.v === 1 && typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}

export function sanitizeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/habits";
  if (value.startsWith("/api/") || value.startsWith("/login")) return "/habits";
  return value;
}

function sign(payload: string, secret: string): string {
  return base64UrlEncode(createHmac("sha256", secret).update(payload).digest());
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: Buffer): string {
  return value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}
