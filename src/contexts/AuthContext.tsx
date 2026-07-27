import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  allowedUid,
  auth,
  authPersistenceReady,
  googleProvider,
  isFirebaseConfigured,
  missingFirebaseEnv,
} from "../lib/firebase";
import { toUserMessage } from "../utils/errors";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAllowed: boolean;
  isConfigured: boolean;
  configurationMessage: string;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const configuredAuth = auth;
    if (!configuredAuth) {
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let isActive = true;
    void authPersistenceReady
      .then(() => {
        if (!isActive) return;
        unsubscribe = onAuthStateChanged(
          configuredAuth,
          (nextUser) => {
            setUser(nextUser);
            setIsLoading(false);
          },
          (authError) => {
            setError(toUserMessage(authError));
            setIsLoading(false);
          },
        );
      })
      .catch((persistenceError: unknown) => {
        if (!isActive) return;
        setError(toUserMessage(persistenceError));
        setIsLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) {
      setError("Firebaseの設定が完了していません。");
      return;
    }

    setError(null);
    try {
      await authPersistenceReady;
      await signInWithPopup(auth, googleProvider);
    } catch (signInError) {
      setError(toUserMessage(signInError));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (signOutError) {
      setError(toUserMessage(signOutError));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAllowed: Boolean(user && allowedUid && user.uid === allowedUid),
      isConfigured: isFirebaseConfigured,
      configurationMessage:
        missingFirebaseEnv.length > 0
          ? `.env のFirebase設定（${missingFirebaseEnv.join(", ")}）が不足しています。`
          : "VITE_ALLOWED_UID が設定されていません。",
      error,
      signIn,
      signOut,
    }),
    [error, isLoading, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
