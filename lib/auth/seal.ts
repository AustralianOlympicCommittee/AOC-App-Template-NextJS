import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { base64UrlDecode, base64UrlEncode } from "./encoding";

type SealedPayload<T> = {
  sealed_at: number;
  value: T;
};

const VERSION = "v1";

export function sealJson<T>(value: T, secret: string) {
  const iv = randomBytes(12);
  const key = keyFromSecret(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(
    JSON.stringify({
      sealed_at: Math.floor(Date.now() / 1000),
      value
    } satisfies SealedPayload<T>),
    "utf8"
  );

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(ciphertext)].join(".");
}

export function unsealJson<T>(sealed: string, secret: string, maxAgeSeconds: number): T | null {
  const [version, encodedIv, encodedTag, encodedCiphertext] = sealed.split(".");
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFromSecret(secret),
      base64UrlDecode(encodedIv)
    );
    decipher.setAuthTag(base64UrlDecode(encodedTag));

    const plaintext = Buffer.concat([
      decipher.update(base64UrlDecode(encodedCiphertext)),
      decipher.final()
    ]);
    const payload = JSON.parse(plaintext.toString("utf8")) as SealedPayload<T>;
    const age = Math.floor(Date.now() / 1000) - payload.sealed_at;
    if (age < 0 || age > maxAgeSeconds) {
      return null;
    }
    return payload.value;
  } catch {
    return null;
  }
}

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

