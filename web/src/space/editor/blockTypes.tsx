import type { ReactNode } from "react";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Quote,
  SquareCheck,
  Type,
} from "lucide-react";

export interface BlockTypeDef {
  type: string;
  label: string;
  keywords: string[];
  icon: ReactNode;
}

export const BLOCK_TYPE_DEFS: BlockTypeDef[] = [
  { type: "paragraph", label: "Text", keywords: ["text", "paragraph", "plain"], icon: <Type size={16} /> },
  { type: "heading1", label: "Heading 1", keywords: ["h1", "heading", "title"], icon: <Heading1 size={16} /> },
  { type: "heading2", label: "Heading 2", keywords: ["h2", "heading", "subtitle"], icon: <Heading2 size={16} /> },
  { type: "heading3", label: "Heading 3", keywords: ["h3", "heading"], icon: <Heading3 size={16} /> },
  { type: "bulleted", label: "Bulleted list", keywords: ["bullet", "list", "ul"], icon: <List size={16} /> },
  { type: "numbered", label: "Numbered list", keywords: ["number", "list", "ol"], icon: <ListOrdered size={16} /> },
  { type: "todo", label: "To-do", keywords: ["todo", "task", "checkbox"], icon: <SquareCheck size={16} /> },
  { type: "quote", label: "Quote", keywords: ["quote", "blockquote"], icon: <Quote size={16} /> },
  { type: "divider", label: "Divider", keywords: ["divider", "hr", "rule", "separator"], icon: <Minus size={16} /> },
  { type: "code", label: "Code", keywords: ["code", "snippet", "monospace"], icon: <Code size={16} /> },
  { type: "callout", label: "Callout", keywords: ["callout", "info", "note"], icon: <Lightbulb size={16} /> },
];

export function filterBlockTypes(query: string): BlockTypeDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCK_TYPE_DEFS;
  return BLOCK_TYPE_DEFS.filter(
    (d) => d.label.toLowerCase().includes(q) || d.keywords.some((k) => k.startsWith(q)),
  );
}
