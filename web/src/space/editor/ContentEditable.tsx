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
  const text = el.innerText ?? el.textContent ?? "";
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

/**
 * Uncontrolled contentEditable: renders initialText once and never re-renders on typing,
 * so the caret is left alone. A `version` bump forces a programmatic text reset.
 */
const ContentEditable = memo(
  function ContentEditable({ blockId, initialText, className, placeholder, onTextInput, onKeyDown, onBlur }: Props) {
    return (
      <div
        className={className}
        contentEditable
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
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
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
