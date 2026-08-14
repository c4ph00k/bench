import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CornerUpLeft } from "lucide-react";
import { api, type RowData } from "../api";
import Cell, { nextColor } from "./cells";
import { PROPERTY_TYPE_LABELS } from "./TableView";

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

export function RowBreadcrumb({ row }: { row: RowData }) {
  return (
    <Link className="row-breadcrumb" to={`/p/${row.database_id}`}>
      <CornerUpLeft size={13} />
      {row.database_title || "Untitled database"}
    </Link>
  );
}

export function RowPropsGrid({
  row,
  onRowChange,
}: {
  row: RowData;
  onRowChange: (row: RowData) => void;
}) {
  const setValue = (propertyId: string, value: unknown) => {
    onRowChange({ ...row, values: { ...row.values, [propertyId]: value } });
    void api.setRowValue(row.id, propertyId, value);
  };

  const createOption = async (propertyId: string, name: string) => {
    const prop = row.properties.find((p) => p.id === propertyId);
    const option = await api.addOption(propertyId, {
      name,
      color: nextColor(prop?.options ?? []),
    });
    onRowChange({
      ...row,
      properties: row.properties.map((p) =>
        p.id === propertyId ? { ...p, options: [...p.options, option] } : p,
      ),
    });
    return option;
  };

  return (
    <div className="row-props">
      <dl className="props-grid">
        {row.properties.map((p) => (
          <div className="props-row" key={p.id}>
            <dt title={PROPERTY_TYPE_LABELS[p.type]}>{p.name}</dt>
            <dd>
              <Cell
                property={p}
                value={row.values[p.id]}
                rowLabel={row.title || "Untitled"}
                onChange={(v) => setValue(p.id, v)}
                onCreateOption={(name) => createOption(p.id, name)}
              />
            </dd>
          </div>
        ))}
      </dl>
      <hr className="props-divider" />
    </div>
  );
}
