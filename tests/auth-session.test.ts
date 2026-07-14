import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionCookieValue,
  hashPassword,
  sanitizeReturnPath,
  verifyPassword,
  verifySessionCookieValue,
} from "../src/auth/session.js";

test("password hashes verify only the original password", () => {
  const hash = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("correct horse battery staple", hash), true);
  assert.equal(verifyPassword("wrong password", hash), false);
  assert.equal(verifyPassword("correct horse battery staple", undefined), false);
});

test("session cookies reject tampering and expiration", () => {
  const secret = "test-secret";
  const now = new Date("2026-07-13T12:00:00.000Z").getTime();
  const cookie = createSessionCookieValue(secret, 60, now);

  assert.equal(verifySessionCookieValue(cookie, secret, now + 30_000), true);
  assert.equal(verifySessionCookieValue(`${cookie}x`, secret, now + 30_000), false);
  assert.equal(verifySessionCookieValue(cookie, "other-secret", now + 30_000), false);
  assert.equal(verifySessionCookieValue(cookie, secret, now + 61_000), false);
});

test("return paths stay internal and avoid api/login loops", () => {
  assert.equal(sanitizeReturnPath("/habits?week=now"), "/habits?week=now");
  assert.equal(sanitizeReturnPath("https://example.com"), "/habits");
  assert.equal(sanitizeReturnPath("//example.com"), "/habits");
  assert.equal(sanitizeReturnPath("/api/habits"), "/habits");
  assert.equal(sanitizeReturnPath("/login"), "/habits");
});
