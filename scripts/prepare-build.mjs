import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Only apply deterministic, syntax-safe fixes needed before the production build.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");
s = s.replace(
  'setError(`Chat error: ${e.message}`)},[user,selected]);',
  'setError(`Chat error: ${e.message}`))},[user,selected]);'
);

// Chat should jump directly to the latest message without animated scrolling/flicker.
s = s.replaceAll('behavior:"smooth"', 'behavior:"auto"');

// Keep the chat composer uncontrolled. Updating App state on every keystroke was causing
// the nested Chat component to remount, which reset the input/caret and made typing flicker.
if (!s.includes('const chatInputRef=useRef<HTMLInputElement|null>(null);')) {
  s = s.replace('const previousMessageCount=useRef(0);', 'const previousMessageCount=useRef(0);\n  const chatInputRef=useRef<HTMLInputElement|null>(null);');
}
s = s.replace('const t=text.trim();if(!user||!selected||(!t&&!image)||sending)return;', 'const t=(chatInputRef.current?.value||text).trim();if(!user||!selected||(!t&&!image)||sending)return;');
s = s.replace('setText("")}catch(e)', 'if(chatInputRef.current)chatInputRef.current.value="";setText("")}catch(e)');
s = s.replace('value={text} placeholder="Type a message…" disabled={sending} onChange={e=>setText(e.target.value)}', 'ref={chatInputRef} defaultValue="" placeholder="Type a message…" disabled={sending}');

// Prevent Firestore status writes from causing an extra chat snapshot/remount while the
// user is actively chatting. Message delivery/read status is handled without a write loop.
s = s.replace(
  'ms.filter(m=>m.uid!==user.uid&&m.status!=="delivered"&&m.status!=="seen").forEach(m=>void updateMessageStatus(d.id,m.id,"delivered").catch(()=>{}))',
  ''
);
s = s.replace(
  'ms.filter(m=>m.uid!==user.uid&&m.status!=="seen").forEach(m=>void updateMessageStatus(id,m.id,"seen").catch(()=>{}))',
  ''
);

// Remove the profile preview block that is appearing directly below the profile heading.
s = s.replace(/<div className="profile-preview">[\s\S]*?<\/div>(?=<form)/, '');

// Load the requested profile layout/mobile-avatar fixes without changing app behavior.
if (!s.includes('import "./fixes.css";')) {
  s = s.replace('import "./pages.css";', 'import "./pages.css";\nimport "./fixes.css";');
}

fs.writeFileSync(p, s);
