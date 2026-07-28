import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Library, LibrarySession } from "../types";
import { useAuth } from "./AuthContext";
import { subscribeLibraries } from "../services/libraries";
import { subscribeSessions } from "../services/sessions";
import { toUserMessage } from "../utils/errors";
import { useEncryption } from "./EncryptionContext";

interface DataContextValue {
  libraries: Library[];
  sessions: LibrarySession[];
  isLoading: boolean;
  error: string | null;
  libraryById: Map<string, Library>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { key } = useEncryption();
  const [allLibraries, setAllLibraries] = useState<Library[]>([]);
  const [sessions, setSessions] = useState<LibrarySession[]>([]);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !key) return;

    setLibrariesLoaded(false);
    setSessionsLoaded(false);
    setError(null);

    const stopLibraries = subscribeLibraries(
      user.uid,
      (nextLibraries) => {
        setAllLibraries(nextLibraries);
        setLibrariesLoaded(true);
      },
      (subscriptionError) => {
        setError(toUserMessage(subscriptionError));
        setLibrariesLoaded(true);
      },
    );
    const stopSessions = subscribeSessions(
      user.uid,
      key,
      (nextSessions) => {
        setSessions(nextSessions);
        setSessionsLoaded(true);
      },
      (subscriptionError) => {
        setError(toUserMessage(subscriptionError));
        setSessionsLoaded(true);
      },
    );

    return () => {
      stopLibraries();
      stopSessions();
    };
  }, [key, user]);

  const value = useMemo<DataContextValue>(
    () => {
      const activeLibraries = allLibraries.filter(
        (library) => library.archivedAt === undefined,
      );
      return {
        libraries: activeLibraries,
        sessions,
        isLoading: !librariesLoaded || !sessionsLoaded,
        error,
        libraryById: new Map(
          allLibraries.map((library) => [library.id, library]),
        ),
      };
    },
    [allLibraries, error, librariesLoaded, sessions, sessionsLoaded],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within DataProvider");
  }
  return context;
}
