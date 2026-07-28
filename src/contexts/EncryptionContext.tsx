import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "./AuthContext";
import { loadUserDataKey } from "../services/encryption";

type EncryptionStatus = "idle" | "loading" | "ready" | "error";

interface EncryptionContextValue {
  status: EncryptionStatus;
  key: CryptoKey | null;
  retry: () => void;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [status, setStatus] = useState<EncryptionStatus>("idle");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setKey(null);
    if (!user) {
      setStatus("idle");
      return () => {
        active = false;
      };
    }

    setStatus("loading");
    void loadUserDataKey()
      .then((nextKey) => {
        if (!active) return;
        setKey(nextKey);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [attempt, user]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const value = useMemo<EncryptionContextValue>(
    () => ({ status, key, retry }),
    [key, retry, status],
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption(): EncryptionContextValue {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within EncryptionProvider");
  }
  return context;
}
