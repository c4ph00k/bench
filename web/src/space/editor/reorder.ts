import { arrayMove } from "@dnd-kit/sortable";
import type { Block } from "../api";

/** Move activeId to overId's position; returns a new array (or the same one if a no-op). */
export function applyReorder(
  blocks: Block[],
  activeId: string,
  overId: string,
): Block[] {
  const from = blocks.findIndex((b) => b.id === activeId);
  const to = blocks.findIndex((b) => b.id === overId);
  if (from < 0 || to < 0 || from === to) return blocks;
  return arrayMove(blocks, from, to);
}
