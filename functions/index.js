"use strict";

const { randomBytes } = require("node:crypto");
const { KeyManagementServiceClient } = require("@google-cloud/kms");
const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");

initializeApp();
setGlobalOptions({
  region: "asia-northeast1",
  maxInstances: 10,
  timeoutSeconds: 30,
  memory: "256MiB",
});

const kmsKeyName = defineString("KMS_KEY_NAME", {
  description:
    "Cloud KMS CryptoKey resource name used to wrap per-user data keys",
});
const kms = new KeyManagementServiceClient();
const firestore = getFirestore();
const DATA_KEY_VERSION = 1;
const DATA_KEY_BYTES = 32;

function keyDocument(uid) {
  return firestore.collection("_encryptionKeys").doc(uid);
}

function aadFor(uid) {
  return Buffer.from(`hibi|${uid}|dek|v${DATA_KEY_VERSION}`, "utf8");
}

function validateStoredKey(data) {
  if (
    !data ||
    data.version !== DATA_KEY_VERSION ||
    typeof data.wrappedKey !== "string" ||
    typeof data.kmsKeyName !== "string"
  ) {
    throw new HttpsError("data-loss", "暗号鍵の保存形式が不正です。");
  }
  return data;
}

async function createWrappedDataKey(uid) {
  const plaintextKey = randomBytes(DATA_KEY_BYTES);
  try {
    const [response] = await kms.encrypt({
      name: kmsKeyName.value(),
      plaintext: plaintextKey,
      additionalAuthenticatedData: aadFor(uid),
    });
    if (!response.ciphertext) {
      throw new Error("Cloud KMS returned no ciphertext.");
    }
    const stored = {
      version: DATA_KEY_VERSION,
      wrappedKey: Buffer.from(response.ciphertext).toString("base64"),
      kmsKeyName: kmsKeyName.value(),
      createdAt: FieldValue.serverTimestamp(),
    };
    await keyDocument(uid).create(stored);
    logger.info("Created wrapped user data key", {
      uid,
      dataKeyVersion: DATA_KEY_VERSION,
    });
    return { ...stored, createdAt: null };
  } finally {
    plaintextKey.fill(0);
  }
}

async function getOrCreateStoredKey(uid) {
  const reference = keyDocument(uid);
  const snapshot = await reference.get();
  if (snapshot.exists) return validateStoredKey(snapshot.data());

  try {
    return await createWrappedDataKey(uid);
  } catch (error) {
    // Two first requests can race. The losing create reads the key that won.
    const racedSnapshot = await reference.get();
    if (racedSnapshot.exists) {
      return validateStoredKey(racedSnapshot.data());
    }
    throw error;
  }
}

exports.getDataKey = onCall(
  {
    cors: true,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Googleログインが必要です。");
    }

    const uid = request.auth.uid;
    try {
      const stored = await getOrCreateStoredKey(uid);
      const [response] = await kms.decrypt({
        name: stored.kmsKeyName,
        ciphertext: Buffer.from(stored.wrappedKey, "base64"),
        additionalAuthenticatedData: aadFor(uid),
      });
      if (!response.plaintext) {
        throw new Error("Cloud KMS returned no plaintext.");
      }
      const plaintextKey = Buffer.from(response.plaintext);
      if (plaintextKey.byteLength !== DATA_KEY_BYTES) {
        plaintextKey.fill(0);
        throw new Error("Invalid data key length.");
      }
      const encodedKey = plaintextKey.toString("base64");
      plaintextKey.fill(0);
      logger.info("Unwrapped user data key", {
        uid,
        dataKeyVersion: stored.version,
      });
      return {
        key: encodedKey,
        version: stored.version,
      };
    } catch (error) {
      logger.error("Failed to provide user data key", { uid, error });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        "暗号鍵を準備できませんでした。",
      );
    }
  },
);
