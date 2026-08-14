import type { TreeNode } from "./api";

/** Whether `id` is this node or anywhere beneath it. */
export function subtreeContains(node: TreeNode, id: string): boolean {
  if (node.id === id) return true;
  return node.children.some((c) => subtreeContains(c, id));
}
