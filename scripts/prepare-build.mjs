import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

if (!s.includes('from "./CallControls"')) {
  s = s.replace('import "./responsive.css";', 'import "./responsive.css";\nimport CallControls from "./CallControls";');
}
if (!s.includes('signOut, type User')) {
  s = s.replace('signInWithEmailAndPassword, type User', 'signInWithEmailAndPassword, signOut, type User');
}
if (!s.includes('deleteField')) {
  s = s.replace('serverTimestamp, setDoc, where }', 'deleteField, serverTimestamp, setDoc, where }');
}

// Restore the real WebRTC call controls and remove the old placeholder mail buttons.
s = s.replace(/<div className="call-actions"><button title="Voice call"[\s\S]*?<\/div><button className="more"/, '<button className="more"');
if (!s.includes('<CallControls user=')) {
  s = s.replace('</header><div className="messages">', '</header><CallControls user={user ? {uid:user.uid, username:profile.username} : null} selected={selected}/><div className="messages">');
}
if (!s.includes('async function logout()')) {
  s = s.replace('async function sendMessage(image?:string){', 'async function logout(){try{if(user)await setDoc(doc(db,"matches",user.uid),{online:false,logoutAt:Date.now(),updatedAt:serverTimestamp()},{merge:true});}catch{}finally{await signOut(auth);setScreen("home")}}\n  async function sendMessage(image?:string){');
}

// Persist the current SPA screen in the URL hash and localStorage so refresh does not
// unexpectedly return to Home. The selected chat profile is persisted separately.
const oldState = 'const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile>(emptyProfile()),[profiles,setProfiles]=useState<Profile[]>([]),[selected,setSelected]=useState<Profile|null>(null),[messages,setMessages]=useState<Message[]>([]),[inbox,setInbox]=useState<InboxItem[]>([]),[screen,setScreen]=useState<Screen>("home");';
const newState = 'const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile>(emptyProfile()),[profiles,setProfiles]=useState<Profile[]>([]),[selected,setSelected]=useState<Profile|null>(null),[messages,setMessages]=useState<Message[]>([]),[inbox,setInbox]=useState<InboxItem[]>([]);\n  const initialScreen=(()=>{const h=window.location.hash.replace(/^#/ ,"") as Screen;const valid:Screen[]=["home","profile","room","chat","auth","inbox","safety","tips","faq","privacy","terms","support","feedback"];return valid.includes(h)?h:(localStorage.getItem("scn-screen") as Screen)||"home"})();\n  const [screenState,setScreenState]=useState<Screen>(initialScreen);\n  const screen=screenState;\n  function setScreen(next:Screen){setScreenState(next);localStorage.setItem("scn-screen",next);window.history.replaceState(null,"",`${window.location.pathname}${window.location.search}#${next}`);}';
if (s.includes(oldState)) s = s.replace(oldState, newState);

if (!s.includes('localStorage.getItem("scn-selected")')) {
  s = s.replace('useEffect(()=>onAuthStateChanged(auth,async u=>{', 'useEffect(()=>{const raw=localStorage.getItem("scn-selected");if(raw){try{setSelected(JSON.parse(raw) as Profile)}catch{localStorage.removeItem("scn-selected")}}},[]);\n  useEffect(()=>{if(selected)localStorage.setItem("scn-selected",JSON.stringify(selected))},[selected]);\n  useEffect(()=>onAuthStateChanged(auth,async u=>{', 1);
}
s = s.replace('function openChat(p:Profile){setSelected(p);setMessages([]);setScreen("chat")}', 'function openChat(p:Profile){setSelected(p);localStorage.setItem("scn-selected",JSON.stringify(p));setMessages([]);setScreen("chat")}');
s = s.replace('ChatOnlineMe', 'Stranger Chat Now');

fs.writeFileSync(p, s);
