import { useEffect, useState } from "react";
import { api, type RowData } from "../api";

/**
 * Load a database row as a page. The loaded id is held alongside the row so that "still loading the
 * next one" is derived during render rather than reset by an effect, which would cost a render.
 */
export function useRow(
  rowId: string,
): [RowData | null, (r: RowData | null) => void] {
  const [loaded, setLoaded] = useState<{ id: string; row: RowData | null }>({
    id: "",
    row: null,
  });
  useEffect(() => {
    void api.getRow(rowId).then((row) => setLoaded({ id: rowId, row }));
  }, [rowId]);
  return [
    loaded.id === rowId ? loaded.row : null,
    (row) => setLoaded({ id: rowId, row }),
  ];
}
