import fs from "node:fs";

const path="src/App.tsx";
let s=fs.readFileSync(path,"utf8");
if(!s.includes('from "./CallControls"')){
  s=s.replace('import "./responsive.css";','import "./responsive.css";\nimport CallControls from "./CallControls";');
}
if(!s.includes("<CallControls user={user} selected={selected}/>") && s.includes('<header className="chat-top">')){
  s=s.replace('</header><div className="messages">','</header><CallControls user={user} selected={selected}/><div className="messages">');
}
fs.writeFileSync(path,s);
