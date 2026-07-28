import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const missingFirebaseEnv = Object.entries(envConfig)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseEnv.length === 0;

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let functionsInstance: Functions | null = null;
let persistenceReady: Promise<void> = Promise.resolve();

if (isFirebaseConfigured) {
  const app = getApps().length > 0 ? getApp() : initializeApp(envConfig as FirebaseOptions);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  functionsInstance = getFunctions(app, "asia-northeast1");
  // A library may be a shared environment. Keep the login only for the
  // current browser session instead of Firebase Auth's local default.
  persistenceReady = setPersistence(authInstance, browserSessionPersistence);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
    // ViteのHMR中もモジュールは一度だけ評価されるため、二重接続を避けられます。
    connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
    connectFunctionsEmulator(functionsInstance, "127.0.0.1", 5001);
  }
}

export const auth = authInstance;
export const db = dbInstance;
export const functions = functionsInstance;
export const authPersistenceReady = persistenceReady;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function requireFirestore(): Firestore {
  if (!db) {
    throw new Error("Firebaseの設定が完了していません。");
  }
  return db;
}

export function requireFunctions(): Functions {
  if (!functions) {
    throw new Error("Firebaseの設定が完了していません。");
  }
  return functions;
}
