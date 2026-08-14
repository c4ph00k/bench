import { useState } from "react";
import { useMatch, useNavigate } from "react-router";
import { Database, Home, Moon, Plus, Search, Sun } from "lucide-react";
import { api, type TreeNode } from "../api";
import { currentTheme, toggleTheme, type Theme } from "../theme";
import TreeItem from "./TreeItem";

interface Props {
  tree: TreeNode[];
  onChange: () => Promise<void> | void;
  onSearch: () => void;
}

export function subtreeContains(node: TreeNode, id: string): boolean {
  if (node.id === id) return true;
  return node.children.some((c) => subtreeContains(c, id));
}

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("ps.expanded") ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export default function Sidebar({ tree, onChange, onSearch }: Props) {
  const navigate = useNavigate();
  const pageId = useMatch("/p/:pageId")?.params.pageId;
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
    localStorage.setItem("ps.expanded", JSON.stringify([...next]));
  };

  const createPage = async (parentId: string | null, type: "page" | "database" = "page") => {
    const page = await api.createPage({ parentId, title: "", type });
    if (parentId && !expanded.has(parentId)) toggle(parentId);
    await onChange();
    navigate(`/p/${page.id}`, { state: { isNew: true } });
  };

  const deletePage = async (node: TreeNode) => {
    await api.deletePage(node.id);
    await onChange();
    if (pageId && subtreeContains(node, pageId)) navigate("/");
  };

  return (
    <nav className="sidebar">
      <a className="home-link" href="/" aria-label="Home">
        <Home size={14} />
        Home
      </a>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Personal Space</span>
      </div>
      <div className="sidebar-top">
        <button className="sidebar-action" onClick={onSearch}>
          <Search size={15} />
          Search
          <kbd className="sidebar-kbd">⌘K</kbd>
        </button>
      </div>
      <div className="tree" role="tree" aria-label="Pages">
        {tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            activeId={pageId}
            expanded={expanded}
            onToggle={toggle}
            onNavigate={(id) => navigate(`/p/${id}`)}
            onCreateChild={createPage}
            onDelete={deletePage}
            onRenamed={onChange}
          />
        ))}
      </div>
      <div className="sidebar-footer">
        <button className="sidebar-action" onClick={() => createPage(null)}>
          <Plus size={16} />
          New page
        </button>
        <button className="sidebar-action" onClick={() => createPage(null, "database")}>
          <Database size={15} />
          New database
        </button>
        <button
          className="sidebar-action"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(toggleTheme())}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </nav>
  );
}
