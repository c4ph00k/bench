import { useEffect, useState } from "react";
import { api, type RowData } from "../api";

/** Load a database row as a page, clearing it while the next one is in flight. */
export function useRow(
  rowId: string,
): [RowData | null, (r: RowData | null) => void] {
  const [row, setRow] = useState<RowData | null>(null);
  useEffect(() => {
    setRow(null);
    void api.getRow(rowId).then(setRow);
  }, [rowId]);
  return [row, setRow];
}
