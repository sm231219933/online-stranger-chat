import fs from "node:fs";

const appPath = "src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");

// Chat scroll stability: keep the conversation at the newest message when it is already
// at the bottom, without forcing the user back down when they intentionally scroll up.
if (!app.includes("chatMessagesRef")) {
  app = app.replace(
    'import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";',
    'import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";'
  );
  app = app.replace(
    '[saving,setSaving]=useState(false),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),',
    '[saving,setSaving]=useState(false),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),[chatMessagesRef]=useState(() => ({ current: null as HTMLDivElement | null })),[stickToBottom]=useState(() => ({ current: true })),[lastMessageCount,setLastMessageCount]=useState(0),'
  );
  // The state-object refs above are deliberately stable and avoid another React import path.
  app = app.replace(
    'const [saving,setSaving]=useState(false),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),[chatMessagesRef]=useState(() => ({ current: null as HTMLDivElement | null })),[stickToBottom]=useState(() => ({ current: true })),[lastMessageCount,setLastMessageCount]=useState(0),',
    'const [saving,setSaving]=useState(false),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(""),[search,setSearch]=useState(""),[countryFilter,setCountryFilter]=useState(""),[stateFilter,setStateFilter]=useState(""),[genderFilter,setGenderFilter]=useState(""),[text,setText]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[authMode,setAuthMode]=useState<"signup"|"login">("signup");\n  const chatMessagesRef=useRef<HTMLDivElement|null>(null);\n  const stickToBottom=useRef(true);'
  );
}

// If the source already has the normal state declaration, inject the refs after it.
if (!app.includes('const chatMessagesRef=useRef')) {
  const marker = '[authMode,setAuthMode]=useState<"signup"|"login">("signup");';
  app = app.replace(marker, marker + '\n  const chatMessagesRef=useRef<HTMLDivElement|null>(null);\n  const stickToBottom=useRef(true);');
}

if (!app.includes('function handleMessagesScroll')) {
  app = app.replace(
    '  function changeGender(g:Gender){',
    '  function handleMessagesScroll(e:React.UIEvent<HTMLDivElement>){const el=e.currentTarget;stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<120;}\n  useEffect(()=>{if(!selected)return;stickToBottom.current=true;requestAnimationFrame(()=>{const el=chatMessagesRef.current;if(el)el.scrollTop=el.scrollHeight;});},[selected?.uid]);\n  useEffect(()=>{if(messages.length===0)return;if(messages.length<lastMessageCount)return;setLastMessageCount(messages.length);if(stickToBottom.current)requestAnimationFrame(()=>{const el=chatMessagesRef.current;if(el)el.scrollTop=el.scrollHeight;});},[messages.length,lastMessageCount]);\n  function changeGender(g:Gender){'
  );
}

app = app.replace(
  '<div className="messages">',
  '<div className="messages" ref={chatMessagesRef} onScroll={handleMessagesScroll}>'
);

// Ensure the patched Message type and sendMessage payload never put an undefined image into Firestore.
app = app.replace(
  'type Message = { uid:string; text:string; createdAt:number; image?:string };',
  'type Message = { id:string; uid:string; text:string; createdAt:number; image?:string; status?:"sending"|"sent"|"delivered"|"seen"; sentAt?:number; deliveredAt?:number; seenAt?:number };'
);
app = app.replace(
  'const id=[user.uid,selected.uid].sort().join("_"),m:Message=image?{uid:user.uid,text:t,image,createdAt:Date.now()}:{uid:user.uid,text:t,createdAt:Date.now()};',
  'const id=[user.uid,selected.uid].sort().join("_"),now=Date.now(),base={id:crypto.randomUUID(),uid:user.uid,text:t,createdAt:now,status:"sent" as const,sentAt:now},m:Message=image?{...base,image}:base;'
);

fs.writeFileSync(appPath, app);
