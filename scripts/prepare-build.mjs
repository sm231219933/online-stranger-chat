import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Keep this build-time script deliberately minimal. Do not rewrite JSX/TypeScript here.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");

fs.writeFileSync(p, s);
