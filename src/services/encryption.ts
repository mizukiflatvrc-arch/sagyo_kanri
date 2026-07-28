import { httpsCallable } from "firebase/functions";
import { requireFunctions } from "../lib/firebase";

export const ENCRYPTION_VERSION = 1;

const CIPHERTEXT_PREFIX = "hibi:e1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface DataKeyResponse {
  key: string;
  version: number;
}

export class DecryptionError extends Error {
  constructor() {
    super("暗号化された自由記述を復号できませんでした。");
    this.name = "DecryptionError";
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

export function isEncryptedText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(`${CIPHERTEXT_PREFIX}:`) &&
    value.split(":").length === 4
  );
}

export async function loadUserDataKey(): Promise<CryptoKey> {
  const getDataKey = httpsCallable<void, DataKeyResponse>(
    requireFunctions(),
    "getDataKey",
  );
  const response = await getDataKey();
  if (
    response.data.version !== ENCRYPTION_VERSION ||
    typeof response.data.key !== "string"
  ) {
    throw new Error("暗号鍵の形式を確認できませんでした。");
  }
  const rawKey = base64ToBytes(response.data.key);
  if (rawKey.byteLength !== 32) {
    throw new Error("暗号鍵の形式を確認できませんでした。");
  }
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(
  value: string,
  key: CryptoKey,
  context: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(context),
      tagLength: 128,
    },
    key,
    encoder.encode(value),
  );
  return `${CIPHERTEXT_PREFIX}:${bytesToBase64Url(iv)}:${bytesToBase64Url(
    new Uint8Array(encrypted),
  )}`;
}

export async function decryptText(
  value: string,
  key: CryptoKey,
  context: string,
): Promise<string> {
  if (!isEncryptedText(value)) return value;
  const [, , encodedIv, encodedCiphertext] = value.split(":");
  if (!encodedIv || !encodedCiphertext) throw new DecryptionError();
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(encodedIv),
        additionalData: encoder.encode(context),
        tagLength: 128,
      },
      key,
      base64UrlToBytes(encodedCiphertext),
    );
    return decoder.decode(decrypted);
  } catch {
    throw new DecryptionError();
  }
}

export function sensitiveFieldContext(userId: string, field: string): string {
  return `hibi|${userId}|${field}|v1`;
}
