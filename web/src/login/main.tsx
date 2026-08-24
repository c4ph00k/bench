import { createRoot } from "react-dom/client";
import App from "./App";
import { initTheme } from "../shared/theme";
import "./styles.css";

initTheme();

createRoot(document.getElementById("root")!).render(<App />);
