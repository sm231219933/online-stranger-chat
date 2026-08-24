import fs from "node:fs";

const appPath = "src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");

if (!app.includes("useRef") && app.includes('from "react"')) {
  app = app.replace(
    'import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";',
    'import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";'
  );
}

if (!app.includes("const chatMessagesRef=useRef")) {
  const marker = '[authMode,setAuthMode]=useState<"signup"|"login">("signup");';
  app = app.replace(marker, marker + '\n  const chatMessagesRef=useRef<HTMLDivElement|null>(null);\n  const stickToBottom=useRef(true);\n  const previousMessageCount=useRef(0);');
}

if (!app.includes("function handleMessagesScroll")) {
  app = app.replace(
    '  function changeGender(g:Gender){',
    '  function handleMessagesScroll(e:{currentTarget:HTMLDivElement}){const el=e.currentTarget;stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<120;}\n  useEffect(()=>{if(!selected)return;stickToBottom.current=true;previousMessageCount.current=0;requestAnimationFrame(()=>{const el=chatMessagesRef.current;if(el)el.scrollTop=el.scrollHeight;});},[selected?.uid]);\n  useEffect(()=>{if(messages.length===0)return;const grew=messages.length>=previousMessageCount.current;previousMessageCount.current=messages.length;if(grew&&stickToBottom.current)requestAnimationFrame(()=>{const el=chatMessagesRef.current;if(el)el.scrollTop=el.scrollHeight;});},[messages.length]);\n  function changeGender(g:Gender){'
  );
}

app = app.replace(
  '<div className="messages">',
  '<div className="messages" ref={chatMessagesRef} onScroll={handleMessagesScroll}>'
);

app = app.replace(
  'type Message = { uid:string; text:string; createdAt:number; image?:string };',
  'type Message = { id:string; uid:string; text:string; createdAt:number; image?:string; status?:"sending"|"sent"|"delivered"|"seen"; sentAt?:number; deliveredAt?:number; seenAt?:number };'
);
app = app.replace(
  'const id=[user.uid,selected.uid].sort().join("_"),m:Message=image?{uid:user.uid,text:t,image,createdAt:Date.now()}:{uid:user.uid,text:t,createdAt:Date.now()};',
  'const id=[user.uid,selected.uid].sort().join("_"),now=Date.now(),base={id:crypto.randomUUID(),uid:user.uid,text:t,createdAt:now,status:"sent" as const,sentAt:now},m:Message=image?{...base,image}:base;'
);

fs.writeFileSync(appPath, app);
