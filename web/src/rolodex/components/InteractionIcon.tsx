import {
  Coffee,
  Mail,
  MessageSquare,
  PhoneCall,
  UserRound,
} from "lucide-react";
import type { InteractionType } from "../types";

const GLYPH = {
  call: PhoneCall,
  message: MessageSquare,
  email: Mail,
  met: Coffee,
  other: UserRound,
};

/** The glyph for a kind of contact, in the log form and beside every entry in a timeline. */
export default function InteractionIcon({
  type,
}: {
  type: InteractionType | null;
}) {
  const Glyph = type ? GLYPH[type] : UserRound;
  return <Glyph size={15} />;
}
