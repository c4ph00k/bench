import { useEffect, useRef, useState } from "react";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { api, type TreeNode } from "../api";
import ConfirmDialog from "./ConfirmDialog";
import Menu from "./Menu";

interface Props {
  node: TreeNode;
  depth: number;
  activeId?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (node: TreeNode) => void;
  onRenamed: () => Promise<void> | void;
}

export default function TreeItem(props: Props) {
  const {
    node,
    depth,
    activeId,
    expanded,
    onToggle,
    onNavigate,
    onCreateChild,
    onDelete,
    onRenamed,
  } = props;
  const isOpen = expanded.has(node.id);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = async () => {
    setRenaming(false);
    if (draft !== node.title) {
      await api.updatePage(node.id, { title: draft });
      await onRenamed();
    }
  };

  const label = node.title || "Untitled";
  return (
    <div role="none">
      <div
        role="treeitem"
        aria-selected={node.id === activeId}
        aria-expanded={node.children.length > 0 ? isOpen : undefined}
        className={`tree-row${node.id === activeId ? " active" : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onNavigate(node.id)}
      >
        <button
          className={`chevron${isOpen ? " open" : ""}${node.children.length === 0 ? " hidden" : ""}`}
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          <ChevronRight size={14} />
        </button>
        <span className="tree-icon">
          {node.icon ?? (node.type === "database" ? "🗃️" : "📄")}
        </span>
        {renaming ? (
          <input
            ref={inputRef}
            className="tree-rename"
            value={draft}
            aria-label="Rename page"
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(node.title);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="tree-label">{label}</span>
        )}
        <span className="tree-actions">
          <button
            className="icon-btn"
            aria-label={`Page options for ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAt({ x: e.clientX, y: e.clientY });
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          <button
            className="icon-btn"
            aria-label={`Add page inside ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(node.id);
            }}
          >
            <Plus size={15} />
          </button>
        </span>
      </div>
      {menuAt && (
        <Menu
          at={menuAt}
          onClose={() => setMenuAt(null)}
          items={[
            {
              label: "Rename",
              onSelect: () => {
                setDraft(node.title);
                setRenaming(true);
              },
            },
            {
              label: "Delete",
              danger: true,
              onSelect: () => setConfirming(true),
            },
          ]}
        />
      )}
      {confirming && (
        <ConfirmDialog
          title={`Delete “${label}”?`}
          message={
            node.children.length > 0
              ? `“${label}” and everything nested inside it will be deleted permanently.`
              : `“${label}” will be deleted permanently.`
          }
          confirmLabel="Delete"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onDelete(node);
          }}
        />
      )}
      {isOpen &&
        node.children.map((child) => (
          <TreeItem key={child.id} {...props} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}
