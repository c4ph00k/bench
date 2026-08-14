import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Fetches JSON from the API; refetches when the url changes or reload() is called. */
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api.get<T>(url).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, reload };
}
