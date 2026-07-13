import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function masterKey(): Buffer {
  const configured = process.env.VAULT_MASTER_KEY;
  if (!configured) return createHash("sha256").update("snowmountain-ark-development-only-key").digest();
  if (/^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  const decoded = Buffer.from(configured, "base64");
  if (decoded.length !== 32) throw new Error("VAULT_MASTER_KEY must be 32-byte base64 or 64-char hex");
  return decoded;
}

export function sealSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function openSecret(value: string): string {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid sealed secret");
  const [ivValue, tagValue, ciphertextValue] = parts;
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Invalid sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
