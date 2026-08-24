/**
 * The company the suite is branded for, in one place. The mark is the Novhora plaque - a tall
 * panel with a divider, drawn from the company logo (jpg/novhora-logo-2.jpeg): every document
 * reads its name and favicon from here, so rebranding for another company means changing this
 * module and the SVG in web/public, nothing else.
 */
import { NovhoraMark } from "./AppIcons";

export const BRAND = {
  name: "Novhora",
  /** The plaque mark, the icon component the nav strip and the login card render. */
  Mark: NovhoraMark,
  /** /novhora.svg in web/public, referenced by every HTML entry point. */
  favicon: "/novhora.svg",
};
