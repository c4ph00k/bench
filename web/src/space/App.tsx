import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import { api, type TreeNode } from "./api";
import Sidebar from "./components/Sidebar";
import PageView from "./components/PageView";
import SearchModal from "./components/SearchModal";

export default function App() {
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const reloadTree = useCallback(async () => {
    setTree(await api.tree());
  }, []);
  useEffect(() => {
    void reloadTree();
  }, [reloadTree]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <Sidebar tree={tree ?? []} onChange={reloadTree} onSearch={() => setSearchOpen(true)} />
      <main className="main">
        <Routes>
          <Route
            path="/"
            element={tree && tree.length > 0 ? <Navigate to={`/p/${tree[0].id}`} replace /> : null}
          />
          <Route path="/p/:pageId" element={<PageView onTreeChange={reloadTree} />} />
        </Routes>
      </main>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
