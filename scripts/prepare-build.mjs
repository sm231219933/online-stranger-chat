import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Only apply deterministic, syntax-safe fixes needed before the production build.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");
s = s.replace(
  'setError(`Chat error: ${e.message}`)},[user,selected]);',
  'setError(`Chat error: ${e.message}`))},[user,selected]);'
);

// Chat should jump directly to the latest message instead of animating on every Firebase update.
s = s.replaceAll('behavior:"smooth"', 'behavior:"auto"');

// Load the requested profile layout/mobile-avatar fixes without changing app behavior.
if (!s.includes('import "./fixes.css";')) {
  s = s.replace('import "./pages.css";', 'import "./pages.css";\nimport "./fixes.css";');
}

// Do not inject a second document-wide focus observer. The dedicated focus-fix module handles profile fields.
// A second MutationObserver was causing unnecessary focus/scroll activity while chat messages changed.

fs.writeFileSync(p, s);
