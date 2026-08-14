/** Caret helpers for plain-text contentEditable blocks. */

export function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function selectionCollapsed(): boolean {
  return window.getSelection()?.isCollapsed ?? true;
}

export function setCaret(el: HTMLElement, offset: number | "end"): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  if (offset === "end") {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    let remaining = offset;
    let placed = false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        break;
      }
      remaining -= len;
    }
    if (!placed) {
      range.selectNodeContents(el);
      range.collapse(false);
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function focusBlock(blockId: string, offset: number | "end"): void {
  const el = document.querySelector<HTMLElement>(
    `[data-block-id="${CSS.escape(blockId)}"] [contenteditable]`,
  );
  if (el) {
    el.focus();
    setCaret(el, offset);
  }
}
