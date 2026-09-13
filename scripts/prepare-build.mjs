import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Keep the source build-safe without adding call UI to the chat page.
s = s.replace(/import CallControls from "\.\/CallControls";\n?/, "");
s = s.replace(/\n?\s*<CallControls user=\{user \? \{uid:user\.uid, username:profile\.username\} : null\} selected=\{selected\}\/?>/, "");

if (!s.includes('signOut, type User')) {
  s = s.replace('signInWithEmailAndPassword, type User', 'signInWithEmailAndPassword, signOut, type User');
}
if (!s.includes('deleteField')) {
  s = s.replace('serverTimestamp, setDoc, where }', 'deleteField, serverTimestamp, setDoc, where }');
}

// Firestore profile documents use the document ID as the canonical user UID.
// The old code read only document fields, which made selected.uid undefined and
// produced chat paths ending in an underscore (for example chats/uid_).
s = s.replace(
  's.docs.map(d=>d.data() as Profile).filter(p=>p.uid!==user.uid)',
  's.docs.map(d=>({...d.data() as Profile,uid:d.id})).filter(p=>p.uid!==user.uid)'
);

// Never open a chat without a real UID, and never create a Firestore document
// whose participants contain undefined.
s = s.replace(
  'function openChat(p:Profile){setSelected(p);setMessages([]);setScreen("chat")}',
  'function openChat(p:Profile){if(!p?.uid)return;setSelected({...p,uid:p.uid});setMessages([]);setScreen("chat")} '
);
s = s.replace(
  'async function sendMessage(image?:string){const t=text.trim();if(!user||!selected||(!t&&!image)||sending)return;',
  'async function sendMessage(image?:string){const t=text.trim();if(!user?.uid||!selected?.uid||(!t&&!image)||sending)return;'
);

// Use a real multiline textarea. Enter sends, Shift+Enter inserts a newline.
s = s.replace(
  '<input value={text} placeholder="Type a message…" disabled={sending} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/>',
  '<textarea value={text} placeholder="Type a message…" disabled={sending} rows={1} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/>'
);

// Persist the current SPA screen in the URL hash and localStorage so refresh does not
// unexpectedly return to Home. The selected chat profile is persisted separately.
const oldState = 'const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile>(emptyProfile()),[profiles,setProfiles]=useState<Profile[]>([]),[selected,setSelected]=useState<Profile|null>(null),[messages,setMessages]=useState<Message[]>([]),[inbox,setInbox]=useState<InboxItem[]>([]),[screen,setScreen]=useState<Screen>("home");';
const newState = 'const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile>(emptyProfile()),[profiles,setProfiles]=useState<Profile[]>([]),[selected,setSelected]=useState<Profile|null>(null),[messages,setMessages]=useState<Message[]>([]),[inbox,setInbox]=useState<InboxItem[]>([]);\n  const initialScreen=(()=>{const h=window.location.hash.replace(/^#/ ,"") as Screen;const valid:Screen[]=["home","profile","room","chat","auth","inbox","safety","tips","faq","privacy","terms","support","feedback"];return valid.includes(h)?h:(localStorage.getItem("scn-screen") as Screen)||"home"})();\n  const [screenState,setScreenState]=useState<Screen>(initialScreen);\n  const screen=screenState;\n  function setScreen(next:Screen){setScreenState(next);localStorage.setItem("scn-screen",next);window.history.replaceState(null,"",`${window.location.pathname}${window.location.search}#${next}`);}';
if (s.includes(oldState)) s = s.replace(oldState, newState);

if (!s.includes('localStorage.getItem("scn-selected")')) {
  s = s.replace('useEffect(()=>onAuthStateChanged(auth,async u=>{', 'useEffect(()=>{const raw=localStorage.getItem("scn-selected");if(raw){try{setSelected(JSON.parse(raw) as Profile)}catch{localStorage.removeItem("scn-selected")}}},[]);\n  useEffect(()=>{if(selected)localStorage.setItem("scn-selected",JSON.stringify(selected))},[selected]);\n  useEffect(()=>onAuthStateChanged(auth,async u=>{', 1);
}

s = s.replace('function openChat(p:Profile){setSelected(p);setMessages([]);setScreen("chat")}', 'function openChat(p:Profile){if(!p?.uid)return;setSelected({...p,uid:p.uid});setMessages([]);setScreen("chat")}');
s = s.replace('ChatOnlineMe', 'Stranger Chat Now');

fs.writeFileSync(p, s);
