import { useNavigate } from "react-router";
import type { DbRow, Property } from "../api";
import { Chip } from "./cells";

interface Props {
  rows: DbRow[];
  properties: Property[];
}

export function ValuePreview({ property, value }: { property: Property; value: unknown }) {
  if (value == null || value === "") return null;
  switch (property.type) {
    case "select": {
      const opt = property.options.find((o) => o.id === value);
      return opt ? <Chip option={opt} /> : null;
    }
    case "multi_select": {
      if (!Array.isArray(value)) return null;
      return (
        <span className="preview-chips">
          {value
            .map((id) => property.options.find((o) => o.id === id))
            .filter(Boolean)
            .map((o) => (
              <Chip key={o!.id} option={o!} />
            ))}
        </span>
      );
    }
    case "checkbox":
      return <span className="preview-check">{value ? "✓" : ""}</span>;
    default:
      return <span className="preview-text">{String(value)}</span>;
  }
}

export default function ListView({ rows, properties }: Props) {
  const navigate = useNavigate();
  const shown = properties.slice(0, 2);
  return (
    <div className="list-view">
      {rows.map((row) => (
        <button key={row.id} className="list-row" onClick={() => navigate(`/p/${row.id}`)}>
          <span className="list-title">{row.title || "Untitled"}</span>
          <span className="list-props">
            {shown.map((p) => (
              <ValuePreview key={p.id} property={p} value={row.values[p.id]} />
            ))}
          </span>
        </button>
      ))}
      {rows.length === 0 && <div className="list-empty">No rows match.</div>}
    </div>
  );
}
