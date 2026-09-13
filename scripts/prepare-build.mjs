import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Only apply deterministic, syntax-safe fixes needed before the production build.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");
s = s.replace(
  'setError(`Chat error: ${e.message}`)},[user,selected]);',
  'setError(`Chat error: ${e.message}`))},[user,selected]);'
);

fs.writeFileSync(p, s);
