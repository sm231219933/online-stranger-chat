import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Only apply deterministic, syntax-safe fixes needed before the production build.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");
s = s.replace(
  'setError(`Chat error: ${e.message}`)},[user,selected]);',
  'setError(`Chat error: ${e.message}`))},[user,selected]);'
);

// Chat must never animate-scroll while the user is typing.
s = s.replaceAll('behavior:"smooth"', 'behavior:"auto"');

// -----------------------------------------------------------------------------
// 1) Keep the chat composer completely outside App state while typing.
//    The old controlled input called setText() on every character. Because Chat
//    is currently declared inside App(), that could recreate the Chat component
//    and replace the input DOM/caret. Use the DOM value until Send instead.
// -----------------------------------------------------------------------------
if (!s.includes('const chatInputRef=useRef<HTMLInputElement|null>(null);')) {
  s = s.replace(
    'const previousMessageCount=useRef(0);',
    'const previousMessageCount=useRef(0);\n  const chatInputRef=useRef<HTMLInputElement|null>(null);'
  );
}
s = s.replace(
  'const t=text.trim();if(!user||!selected||(!t&&!image)||sending)return;',
  'const t=(chatInputRef.current?.value||text).trim();if(!user||!selected||(!t&&!image)||sending)return;'
);
s = s.replace(
  'setText("")}catch(e)',
  'if(chatInputRef.current)chatInputRef.current.value="";setText("")}catch(e)'
);
s = s.replace(
  'value={text} placeholder="Type a message…" disabled={sending} onChange={e=>setText(e.target.value)}',
  'ref={chatInputRef} defaultValue="" placeholder="Type a message…" disabled={sending}'
);
s = s.replace(
  'disabled={sending||!text.trim()} onClick={()=>void sendMessage()}',
  'disabled={sending} onClick={()=>void sendMessage()}'
);

// Prevent Firestore status writes from creating extra App renders while chatting.
s = s.replace(
  'ms.filter(m=>m.uid!==user.uid&&m.status!=="delivered"&&m.status!=="seen").forEach(m=>void updateMessageStatus(d.id,m.id,"delivered").catch(()=>{}))',
  ''
);
s = s.replace(
  'ms.filter(m=>m.uid!==user.uid&&m.status!=="seen").forEach(m=>void updateMessageStatus(id,m.id,"seen").catch(()=>{}))',
  ''
);

// -----------------------------------------------------------------------------
// 2) Guest profile text fields must not update App state per character.
//    They are submitted through FormData instead. This prevents the profile card
//    from being recreated on every alphabet/number and losing focus/caret.
// -----------------------------------------------------------------------------
s = s.replace(
  '<label>Username<input required value={profile.username} onChange={e=>setProfile({...profile,username:e.target.value})}/></label>',
  '<label>Username<input name="username" required defaultValue={profile.username}/></label>'
);
s = s.replace(
  '<label>Age<input required type="number" min="13" max="100" value={profile.age} onChange={e=>setProfile({...profile,age:Number(e.target.value)})}/></label>',
  '<label>Age<input name="age" required type="number" min="13" max="100" defaultValue={profile.age}/></label>'
);
s = s.replace(
  'async function saveProfile(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const u=user||(await signInAnonymously(auth)).user,p={...profile,uid:u.uid},name=p.username.trim().toLowerCase();',
  'async function saveProfile(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const form=e.currentTarget,fd=new FormData(form),username=String(fd.get("username")||profile.username),age=Number(fd.get("age")||profile.age),u=user||(await signInAnonymously(auth)).user,p={...profile,uid:u.uid,username,age},name=p.username.trim().toLowerCase();'
);

// -----------------------------------------------------------------------------
// 3) Preserve the current page across browser refreshes.
//    Use the existing hash (#profile, #room, #chat, etc.) as the source of truth.
//    Also preserve the selected chat profile in sessionStorage so #chat can reopen.
// -----------------------------------------------------------------------------
s = s.replace(
  'const [saving,setSaving]=useState(false),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(""),[presenceTick,setPresenceTick]=useState(0);',
  'const [saving,setSaving]=useState(false),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(""),[presenceTick,setPresenceTick]=useState(0);\n  const setScreenStateRef=useRef<((next:Screen)=>void)|null>(null);'
);
s = s.replace(
  'const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile>(emptyProfile()),[profiles,setProfiles]=useState<Profile[]>([]),[selected,setSelected]=useState<Profile|null>(null),[messages,setMessages]=useState<Message[]>([]),[inbox,setInbox]=useState<InboxItem[]>([]),[screen,setScreen]=useState<Screen>("home");',
  'const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile>(emptyProfile()),[profiles,setProfiles]=useState<Profile[]>([]),[selected,setSelected]=useState<Profile|null>(null),[messages,setMessages]=useState<Message[]>([]),[inbox,setInbox]=useState<InboxItem[]>([]),[screen,setScreenState]=useState<Screen>(()=>{const h=window.location.hash.replace(/^#/ ,"") as Screen;return ["home","profile","room","chat","auth","inbox","safety","tips","faq","privacy","terms","support","feedback"].includes(h)?h:"home"});\n  const setScreen=(next:Screen)=>{setScreenState(next);if(window.location.hash!==`#${next}`)window.history.replaceState(null,"",`#${next}`);};'
);

// Keep the selected chat target when refreshing #chat.
if (!s.includes('sessionStorage.getItem("stranger-chat-selected")')) {
  s = s.replace(
    'function openChat(p:Profile){setSelected(p);setMessages([]);setScreen("chat")}',
    'function openChat(p:Profile){setSelected(p);try{sessionStorage.setItem("stranger-chat-selected",JSON.stringify(p))}catch{}setMessages([]);setScreen("chat")}\n  useEffect(()=>{if(window.location.hash==="#chat"&&!selected){try{const raw=sessionStorage.getItem("stranger-chat-selected");if(raw)setSelected(JSON.parse(raw) as Profile)}catch{}}},[]);'
  );
}

// Do not force every refresh without authentication back to Home when a valid
// informational/profile hash is already present.
s = s.replace(
  'if(!u){setUser(null);setProfile(emptyProfile());setSelected(null);setMessages([]);setScreen("home");return;}',
  'if(!u){setUser(null);setProfile(emptyProfile());setSelected(null);setMessages([]);if(!window.location.hash)setScreen("home");return;}'
);

// Load the profile CSS fixes.
if (!s.includes('import "./fixes.css";')) {
  s = s.replace('import "./pages.css";', 'import "./pages.css";\nimport "./fixes.css";');
}

fs.writeFileSync(p, s);
