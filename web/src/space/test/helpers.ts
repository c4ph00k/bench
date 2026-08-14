import type { Block, PageData, TreeNode } from "../api";

export function node(partial: Partial<TreeNode> & { id: string }): TreeNode {
  return {
    parent_id: null,
    type: "page",
    title: partial.id,
    icon: null,
    position: 0,
    children: [],
    ...partial,
  };
}

export function pageData(partial: Partial<PageData> & { id: string }): PageData {
  return {
    parent_id: null,
    type: "page",
    title: partial.id,
    icon: null,
    blocks: [],
    ...partial,
  };
}

export function block(partial: Partial<Block> & { id: string }): Block {
  return {
    page_id: "p1",
    type: "paragraph",
    content: { text: partial.id },
    position: 0,
    ...partial,
  };
}
