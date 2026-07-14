import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run auth:hash -- \"your password\"");
  process.exit(1);
}

function base64UrlEncode(value) {
  return value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

const iterations = 210_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");

console.log(
  `ARES_AUTH_PASSWORD_HASH=pbkdf2-sha256:${iterations}:${base64UrlEncode(salt)}:${base64UrlEncode(hash)}`,
);
