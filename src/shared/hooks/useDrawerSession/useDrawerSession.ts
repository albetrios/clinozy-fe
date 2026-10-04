import { useCallback, useState } from 'react';

/** What {@link useDrawerSession} hands a record drawer's screen. */
export interface DrawerSession {
  /** Changes on every opening (and every restart): key the drawer's form on it. */
  session: number;
  /** The drawer restarted after "Create & add another" — drop the opening's prefill. */
  fresh: boolean;
  /** Start again, blank: "Create & add another" saved. */
  restart: () => void;
}

/**
 * One opening of a record drawer at a time (KICKOFF §3.5): every time `open`
 * turns true the session moves on, so a form keyed on it starts fresh — no
 * draft carried from the last record — and `restart` begins a blank one after
 * "Create & add another" (§7.3), marking it `fresh` so the opening's prefill
 * is not applied again. Uses the stored-previous-value pattern, not an effect:
 * the new session is there on the render that opens the drawer.
 */
export function useDrawerSession(open: boolean): DrawerSession {
  const [session, setSession] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSession((current) => current + 1);
      setFresh(false);
    }
  }
  const restart = useCallback(() => {
    setSession((current) => current + 1);
    setFresh(true);
  }, []);
  return { session, fresh, restart };
}
