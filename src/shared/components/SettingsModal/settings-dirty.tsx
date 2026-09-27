import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface SettingsDirtyContextValue {
  registerDirty: (key: string, dirty: boolean) => void;
  isDirty: boolean;
}

const SettingsDirtyContext = createContext<SettingsDirtyContextValue | null>(null);

/** Tracks dirty flags from settings panels so the modal can confirm before closing. */
export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});

  const registerDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyMap((prev) => {
      if (!dirty) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key]) return prev;
      return { ...prev, [key]: true };
    });
  }, []);

  const isDirty = useMemo(() => Object.values(dirtyMap).some(Boolean), [dirtyMap]);

  const value = useMemo(() => ({ registerDirty, isDirty }), [registerDirty, isDirty]);

  return (
    <SettingsDirtyContext.Provider value={value}>
      {children}
    </SettingsDirtyContext.Provider>
  );
}

/** Register a panel's dirty state while mounted (cleared on unmount). */
// eslint-disable-next-line react-refresh/only-export-components -- context hook colocated with its provider
export function useRegisterSettingsDirty(key: string, dirty: boolean) {
  const ctx = useContext(SettingsDirtyContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.registerDirty(key, dirty);
    return () => ctx.registerDirty(key, false);
  }, [ctx, key, dirty]);
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook colocated with its provider
export function useSettingsDirty() {
  return useContext(SettingsDirtyContext);
}
