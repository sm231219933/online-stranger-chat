import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Remove call UI from the chat page without changing the underlying chat logic.
s = s.replace(/import CallControls from "\.\/CallControls";\n?/, "");
s = s.replace(/\n?\s*<CallControls user=\{user \? \{uid:user\.uid, username:profile\.username\} : null\} selected=\{selected\}\/?>/, "");

// Firestore profile documents use the document ID as the canonical UID.
s = s.replace(
  "s.docs.map(d=>d.data() as Profile)",
  "s.docs.map(d=>({...((d.data() as Profile)),uid:d.id}))"
);

// Never open a chat or write a chat document without a real UID.
s = s.replace(
  "function openChat(p:Profile){setSelected(p);setMessages([]);setScreen(\"chat\")}",
  "function openChat(p:Profile){if(!p?.uid)return;setSelected(p);setMessages([]);setScreen(\"chat\")}"
);
s = s.replace(
  "async function sendMessage(image?:string){const t=text.trim();if(!user||!selected||(!t&&!image)||sending)return;",
  "async function sendMessage(image?:string){const t=text.trim();if(!user?.uid||!selected?.uid||(!t&&!image)||sending)return;"
);

// Use a multiline textarea so long messages can be typed normally.
s = s.replace(
  "<input value={text} placeholder=\"Type a message…\" disabled={sending} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key===\"Enter\"&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/>",
  "<textarea value={text} placeholder=\"Type a message…\" disabled={sending} rows={1} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key===\"Enter\"&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/>"
);

// Keep the production branding consistent.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");

fs.writeFileSync(p, s);
