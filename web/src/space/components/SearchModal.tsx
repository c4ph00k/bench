import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CornerDownLeft,
  FileText,
  Database as DatabaseIcon,
  Rows3,
  Search,
} from "lucide-react";
import { api, type SearchResult } from "../api";

interface Props {
  onClose: () => void;
}

function TypeBadge({ result }: { result: SearchResult }) {
  if (result.type === "database")
    return <DatabaseIcon size={14} aria-label="Database" />;
  if (result.type === "row")
    return <Rows3 size={14} aria-label="Database row" />;
  return <FileText size={14} aria-label="Page" />;
}

export default function SearchModal({ onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      setSelected(0);
      return;
    }
    timer.current = setTimeout(() => {
      void api.search(query.trim()).then((found) => {
        setResults(found);
        setSelected(0);
      });
    }, 120);
    return () => clearTimeout(timer.current);
  }, [query]);

  const open = (result: SearchResult) => {
    onClose();
    void navigate(`/p/${result.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setSelected((s) => (s + 1) % results.length);
    }
    if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setSelected((s) => (s - 1 + results.length) % results.length);
    }
    if (e.key === "Enter" && results[selected]) open(results[selected]);
  };

  return (
    <div
      role="presentation"
      className="overlay search-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-modal" role="dialog" aria-label="Quick find">
        <div className="search-input-row">
          <Search size={17} className="search-glyph" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search pages, databases, rows…"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="search-kbd">esc</kbd>
        </div>
        {query.trim() && (
          <div
            className="search-results"
            role="listbox"
            aria-label="Search results"
          >
            {results.map((r, i) => (
              <button
                key={r.id}
                role="option"
                aria-selected={i === selected}
                className={`search-result${i === selected ? " selected" : ""}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => open(r)}
              >
                <span className="search-icon">
                  {r.icon ?? <TypeBadge result={r} />}
                </span>
                <span className="search-title">{r.title || "Untitled"}</span>
                {r.parent_title && (
                  <span className="search-crumb">{r.parent_title}</span>
                )}
                {i === selected && (
                  <CornerDownLeft size={13} className="search-enter" />
                )}
              </button>
            ))}
            {results.length === 0 && (
              <div className="search-empty">
                No matches for “{query.trim()}”
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
