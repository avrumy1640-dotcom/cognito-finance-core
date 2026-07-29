import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyMotionPref } from "./hooks/useReducedMotionPref";

// Apply persisted theme before first paint.
(() => {
  const t = (localStorage.getItem("gb_theme") as "light" | "dark" | "system" | null) ?? "system";
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();

// Apply persisted motion preference before first paint.
applyMotionPref();


createRoot(document.getElementById("root")!).render(<App />);
