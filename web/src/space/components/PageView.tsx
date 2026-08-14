import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { api, type PageData } from "../api";
import EmojiPicker from "./EmojiPicker";
import Editor from "../editor/Editor";
import DatabaseView from "../database/DatabaseView";
import { RowBreadcrumb, RowPropsGrid, useRow } from "../database/RowProperties";

interface Props {
  onTreeChange: () => Promise<void> | void;
}

export default function PageView({ onTreeChange }: Props) {
  const { pageId } = useParams<{ pageId: string }>();
  const location = useLocation();
  const [page, setPage] = useState<PageData | null>(null);
  const [missing, setMissing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMissing(false);
    setPage(null);
    if (!pageId) return;
    api
      .getPage(pageId)
      .then((p) => {
        setPage(p);
        if ((location.state as { isNew?: boolean } | null)?.isNew)
          titleRef.current?.focus();
      })
      .catch(() => setMissing(true));
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = useCallback(
    (title: string) => {
      if (!pageId) return;
      setPage((p) => (p ? { ...p, title } : p));
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void api.updatePage(pageId, { title }).then(onTreeChange);
      }, 350);
    },
    [pageId, onTreeChange],
  );

  const setIcon = async (icon: string | null) => {
    if (!pageId) return;
    setPickerOpen(false);
    setPage((p) => (p ? { ...p, icon } : p));
    await api.updatePage(pageId, { icon });
    await onTreeChange();
  };

  if (missing) {
    return (
      <div className="page">
        <div className="page-missing">This page does not exist anymore.</div>
      </div>
    );
  }
  if (!page) return <div className="page" aria-busy="true" />;

  const header = (
    <header className="page-header">
      <div className="page-icon-wrap">
        <button
          className="page-icon"
          aria-label="Change icon"
          onClick={() => setPickerOpen((v) => !v)}
        >
          {page.icon ?? (page.type === "database" ? "🗃️" : "📄")}
        </button>
        {pickerOpen && (
          <EmojiPicker
            onPick={(icon) => void setIcon(icon)}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
      <input
        ref={titleRef}
        className="page-title"
        value={page.title}
        placeholder="Untitled"
        aria-label="Page title"
        onChange={(e) => saveTitle(e.target.value)}
      />
    </header>
  );

  if (page.type === "row") {
    return <RowPageBody page={page} header={header} />;
  }

  return (
    <div className={`page${page.type === "database" ? " page-wide" : ""}`}>
      {header}
      {page.type === "database" ? (
        <DatabaseView key={page.id} databaseId={page.id} />
      ) : (
        <Editor key={page.id} pageId={page.id} initialBlocks={page.blocks} />
      )}
    </div>
  );
}

function RowPageBody({
  page,
  header,
}: {
  page: PageData;
  header: React.ReactNode;
}) {
  const [row, setRow] = useRow(page.id);
  return (
    <div className="page">
      {row && <RowBreadcrumb row={row} />}
      {header}
      {row && <RowPropsGrid row={row} onRowChange={(r) => setRow(r)} />}
      <Editor key={page.id} pageId={page.id} initialBlocks={page.blocks} />
    </div>
  );
}
