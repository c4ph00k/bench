import { memo } from "react";

import { caretOffset } from "./caret";

interface Props {
  blockId: string;
  version: number;
  initialText: string;
  className: string;
  placeholder?: string;
  onTextInput: (id: string, text: string, caret: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: string) => void;
  onBlur: (id: string) => void;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Reads the block's plain text, treating <br> as a newline and dropping a trailing one. */
function readText(el: HTMLElement): string {
  // jsdom does not implement innerText, so the runtime can hand back undefined where the DOM
  // types promise a string.
  const innerText: unknown = el.innerText;
  const textContent: unknown = el.textContent;
  const raw = typeof innerText === "string" ? innerText : textContent;
  const text = typeof raw === "string" ? raw : "";
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

/**
 * Uncontrolled contentEditable: renders initialText once and never re-renders on typing,
 * so the caret is left alone. A `version` bump forces a programmatic text reset.
 */
const ContentEditable = memo(
  function ContentEditable({
    blockId,
    initialText,
    className,
    placeholder,
    onTextInput,
    onKeyDown,
    onBlur,
  }: Props) {
    return (
      <div
        className={className}
        contentEditable
        role="textbox"
        tabIndex={0}
        suppressContentEditableWarning
        data-placeholder={placeholder ?? ""}
        onInput={(e) => {
          const el = e.currentTarget;
          const text = readText(el);
          if (text === "" && el.innerHTML !== "") el.innerHTML = "";
          onTextInput(blockId, text, caretOffset(el));
        }}
        onKeyDown={(e) => onKeyDown(e, blockId)}
        onPaste={(e) => {
          e.preventDefault();
          const el = e.currentTarget;
          // execCommand is deprecated, so the plain text is placed at the caret by hand. The
          // browser fires no input event for that, hence the explicit call afterwards.
          const selection = window.getSelection();
          if (!selection?.rangeCount) return;
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const inserted = document.createTextNode(
            e.clipboardData.getData("text/plain"),
          );
          range.insertNode(inserted);
          range.setStartAfter(inserted);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          onTextInput(blockId, readText(el), caretOffset(el));
        }}
        onBlur={() => onBlur(blockId)}
        dangerouslySetInnerHTML={{ __html: esc(initialText) }}
      />
    );
  },
  (prev, next) =>
    prev.blockId === next.blockId &&
    prev.version === next.version &&
    prev.className === next.className &&
    prev.placeholder === next.placeholder,
);

export default ContentEditable;
