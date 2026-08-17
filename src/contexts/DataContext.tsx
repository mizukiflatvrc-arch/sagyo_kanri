import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Library, LibrarySession } from "../types";
import type { ActiveSession } from "../types/activeSession";
import { useAuth } from "./AuthContext";
import { subscribeLibraries } from "../services/libraries";
import { subscribeSessions } from "../services/sessions";
import { subscribeActiveSession } from "../services/activeSessions";
import { toUserMessage } from "../utils/errors";

interface DataContextValue {
  libraries: Library[];
  sessions: LibrarySession[];
  activeSession: ActiveSession | null;
  isLoading: boolean;
  error: string | null;
  isActiveSessionLoading: boolean;
  activeSessionError: string | null;
  libraryById: Map<string, Library>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [allLibraries, setAllLibraries] = useState<Library[]>([]);
  const [sessions, setSessions] = useState<LibrarySession[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null,
  );
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeSessionLoaded, setActiveSessionLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionError, setActiveSessionError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!user) {
      setAllLibraries([]);
      setSessions([]);
      setActiveSession(null);
      setLibrariesLoaded(false);
      setSessionsLoaded(false);
      setActiveSessionLoaded(false);
      setError(null);
      setActiveSessionError(null);
      return;
    }

    setLibrariesLoaded(false);
    setSessionsLoaded(false);
    setActiveSessionLoaded(false);
    setError(null);
    setActiveSessionError(null);

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
      (nextSessions) => {
        setSessions(nextSessions);
        setSessionsLoaded(true);
      },
      (subscriptionError) => {
        setError(toUserMessage(subscriptionError));
        setSessionsLoaded(true);
      },
    );
    const stopActiveSession = subscribeActiveSession(
      user.uid,
      (nextActiveSession) => {
        setActiveSession(nextActiveSession);
        setActiveSessionError(null);
        setActiveSessionLoaded(true);
      },
      (subscriptionError) => {
        setActiveSession(null);
        setActiveSessionError(toUserMessage(subscriptionError));
        setActiveSessionLoaded(true);
      },
    );

    return () => {
      stopLibraries();
      stopSessions();
      stopActiveSession();
    };
  }, [user]);

  const value = useMemo<DataContextValue>(
    () => {
      const activeLibraries = allLibraries.filter(
        (library) => library.archivedAt === undefined,
      );
      return {
        libraries: activeLibraries,
        sessions,
        activeSession,
        isLoading: !librariesLoaded || !sessionsLoaded,
        error,
        isActiveSessionLoading: !activeSessionLoaded,
        activeSessionError,
        libraryById: new Map(
          allLibraries.map((library) => [library.id, library]),
        ),
      };
    },
    [
      activeSession,
      activeSessionError,
      activeSessionLoaded,
      allLibraries,
      error,
      librariesLoaded,
      sessions,
      sessionsLoaded,
    ],
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
