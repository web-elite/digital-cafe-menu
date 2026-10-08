import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  const salt = bcrypt.genSaltSync(SALT_ROUNDS);
  return {
    hash: bcrypt.hashSync(password, salt),
    salt,
  };
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

export function generateSessionToken() {
  return crypto.randomBytes(40).toString("hex");
}
