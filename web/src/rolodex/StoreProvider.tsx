import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { StoreContext, ToastContext, type Store } from "./store";
import type { PersonComputed } from "./types";

interface Toast {
  id: number;
  text: string;
}

let nextToastId = 0;

/** Holds the people list once for the whole app, and the toasts stacked in the corner. */
export default function StoreProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<PersonComputed[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refresh = useCallback(async () => {
    const [nextPeople, nextTags] = await Promise.all([
      api.listPeople(),
      api.tags(),
    ]);
    setPeople(nextPeople);
    setTags(nextTags);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.listPeople(), api.tags()]).then(
      ([nextPeople, nextTags]) => {
        if (cancelled) return;
        setPeople(nextPeople);
        setTags(nextTags);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (text: string) => {
      const id = nextToastId++;
      setToasts((current) => [...current, { id, text }]);
      setTimeout(() => {
        dismiss(id);
      }, 3200);
    },
    [dismiss],
  );

  const store: Store = { people, tags, loaded, refresh };
  return (
    <StoreContext.Provider value={store}>
      <ToastContext.Provider value={push}>
        {children}
        <div className="toast-region">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.text}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </StoreContext.Provider>
  );
}
