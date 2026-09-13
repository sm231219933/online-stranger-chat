import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

s = s.replace(/import CallControls from "\.\/CallControls";\n?/, "");
s = s.replace(/\n?\s*<CallControls user=\{user \? \{uid:user\.uid, username:profile\.username\} : null\} selected=\{selected\}\/?>/, "");

s = s.replace(
  "s.docs.map(d=>d.data() as Profile)",
  "s.docs.map(d=>Object.assign({}, d.data() as Profile, {uid:d.id}))"
);

s = s.replace(
  "function openChat(p:Profile){setSelected(p);setMessages([]);setScreen(\"chat\")}",
  "function openChat(p:Profile){if(!p?.uid)return;setSelected(p);setMessages([]);setScreen(\"chat\")}"
);
s = s.replace(
  "async function sendMessage(image?:string){const t=text.trim();if(!user||!selected||(!t&&!image)||sending)return;",
  "async function sendMessage(image?:string){const t=text.trim();if(!user?.uid||!selected?.uid||(!t&&!image)||sending)return;"
);

s = s.replace(
  "<input value={text} placeholder=\"Type a message…\" disabled={sending} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key===\"Enter\"&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/>",
  "<textarea value={text} placeholder=\"Type a message…\" disabled={sending} rows={1} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key===\"Enter\"&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/>"
);

s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");

fs.writeFileSync(p, s);
