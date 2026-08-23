import fs from "node:fs";

const path="src/App.tsx";
let s=fs.readFileSync(path,"utf8");

// Existing call-controls patch.
if(!s.includes('from "./CallControls"')){
  s=s.replace('import "./responsive.css";','import "./responsive.css";\nimport CallControls from "./CallControls";');
}
if(!s.includes("<CallControls user={user} selected={selected}/>") && s.includes('<header className="chat-top">')){
  s=s.replace('</header><div className="messages">','</header><CallControls user={user} selected={selected}/><div className="messages">');
}

// Add Firebase sign-out support.
if(!s.includes('signOut, type User')){
  s=s.replace('signInWithEmailAndPassword, type User','signInWithEmailAndPassword, signOut, type User');
}

// Message model: unique id + delivery/read timestamps.
s=s.replace(
  'type Profile={uid:string;username:string;country:string;countryCode:string;state:string;stateCode:string;age:number;gender:Gender|"";avatar:string;online?:boolean;emailAccount?:boolean;photoURL?:string};',
  'type Profile={uid:string;username:string;country:string;countryCode:string;state:string;stateCode:string;age:number;gender:Gender|"";avatar:string;online?:boolean;lastSeen?:number;emailAccount?:boolean;photoURL?:string};'
);
s=s.replace(
  'type Message={uid:string;text:string;createdAt:number;image?:string};',
  'type Message={id:string;uid:string;text:string;createdAt:number;image?:string;status?:"sending"|"sent"|"delivered"|"seen";sentAt?:number;deliveredAt?:number;seenAt?:number};'
);

// Real presence: heartbeat every 30 seconds, and stale users are considered offline after 90 seconds.
const presenceCode = `\nconst isActuallyOnline=(p?:Profile|null)=>!!p&&p.online===true&&typeof p.lastSeen===\"number\"&&Date.now()-p.lastSeen<90000;\n`;
if(!s.includes('const isActuallyOnline=')) s=s.replace('export default function App(){',presenceCode+'export default function App(){');

// Auth listener: clear local state on logout and mark active sessions online immediately.
s=s.replace(
  'useEffect(()=>onAuthStateChanged(auth,async u=>{if(!u)return;setUser(u);try{const s=await getDoc(doc(db,"matches",u.uid));if(s.exists())setProfile(s.data() as Profile)}catch(e){setError(e instanceof Error?e.message:"Could not connect to Firebase.")}}),[]);',
  'useEffect(()=>onAuthStateChanged(auth,async u=>{if(!u){setUser(null);setProfile(emptyProfile());setSelected(null);setMessages([]);setScreen("home");return;}setUser(u);try{const ref=doc(db,"matches",u.uid),snap=await getDoc(ref);if(snap.exists()){const p=snap.data() as Profile;setProfile(p);await setDoc(ref,{online:true,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true});}}catch(e){setError(e instanceof Error?e.message:"Could not connect to Firebase.")}}),[]);\n\nuseEffect(()=>{if(!user)return;const ref=doc(db,"matches",user.uid);const beat=()=>void setDoc(ref,{online:true,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});beat();const timer=window.setInterval(beat,30000);return()=>window.clearInterval(timer)},[user]);'
);

// Store only genuinely active users in the room list.
s=s.replace(
  'const filtered=useMemo(()=>profiles.filter(p=>(!search||p.username.toLowerCase().includes(search.toLowerCase()))&&(!countryFilter||p.country===countryFilter)&&(!stateFilter||p.state===stateFilter)&&(!genderFilter||p.gender===genderFilter)),[profiles,search,countryFilter,stateFilter,genderFilter]);',
  'const filtered=useMemo(()=>profiles.filter(p=>isActuallyOnline(p)&&(!search||p.username.toLowerCase().includes(search.toLowerCase()))&&(!countryFilter||p.country===countryFilter)&&(!stateFilter||p.state===stateFilter)&&(!genderFilter||p.gender===genderFilter)),[profiles,search,countryFilter,stateFilter,genderFilter]);'
);

// Save/profile/login/account creation now update lastSeen too.
s=s.replace('{...p,username:name,online:true,emailAccount:!u.isAnonymous,updatedAt:serverTimestamp()}', '{...p,username:name,online:true,lastSeen:Date.now(),emailAccount:!u.isAnonymous,updatedAt:serverTimestamp()}');
s=s.replace('{...p,updatedAt:serverTimestamp()},{merge:true});setUser(account)', '{...p,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true});setUser(account)');
s=s.replace('const r=await signInWithEmailAndPassword(auth,email.trim(),password),s=await getDoc(doc(db,"matches",r.user.uid));setUser(r.user);', 'const r=await signInWithEmailAndPassword(auth,email.trim(),password),s=await getDoc(doc(db,"matches",r.user.uid));setUser(r.user);await setDoc(doc(db,"matches",r.user.uid),{online:true,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true});');

// Robust logout: explicitly clear presence before Firebase sign-out.
if(!s.includes('async function logout()')){
  s=s.replace('async function sendMessage(image?:string){', 'async function logout(){if(!user)return;try{await setDoc(doc(db,"matches",user.uid),{online:false,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true});}catch{}finally{await signOut(auth);setScreen("home")}}\nasync function sendMessage(image?:string){');
}

// Replace message creation with WhatsApp-style lifecycle.
s=s.replace(
  'const id=[user.uid,selected.uid].sort().join("_"),m:Message=image?{uid:user.uid,text:t,image,createdAt:Date.now()}:{uid:user.uid,text:t,createdAt:Date.now()};',
  'const id=[user.uid,selected.uid].sort().join("_"),now=Date.now(),m:Message={id:crypto.randomUUID(),uid:user.uid,text:t,createdAt:now,image,status:"sent",sentAt:now};'
);

// On chat snapshot: mark incoming messages delivered, then seen because this chat is open.
s=s.replace(
  'useEffect(()=>{if(!user||!selected)return;const id=[user.uid,selected.uid].sort().join("_");return onSnapshot(doc(db,"chats",id),s=>setMessages((s.data()?.messages||[]) as Message[]),e=>setError(`Chat error: ${e.message}`))},[user,selected]);',
  'async function updateMessageStatus(chatId:string,messageId:string,status:"delivered"|"seen"){const ref=doc(db,"chats",chatId);const snap=await getDoc(ref);if(!snap.exists())return;const data=snap.data(),ms=(data.messages||[]) as Message[],now=Date.now(),next=ms.map(m=>m.id===messageId?{...m,status,...(status==="delivered"?{deliveredAt:now}:{deliveredAt:m.deliveredAt||now,seenAt:now})}:m);await setDoc(ref,{messages:next,updatedAt:serverTimestamp()},{merge:true})}\nuseEffect(()=>{if(!user||!selected)return;const id=[user.uid,selected.uid].sort().join("_");return onSnapshot(doc(db,"chats",id),snap=>{const ms=(snap.data()?.messages||[]) as Message[];setMessages(ms);void Promise.all(ms.filter(m=>m.uid!==user.uid&&m.status!=="seen").map(m=>updateMessageStatus(id,m.id,"seen").catch(()=>{})))} ,e=>setError(`Chat error: ${e.message}`))},[user,selected]);'
);

// Add logout to the room header and make online labels use lastSeen.
s=s.replace('<button className="ghost" onClick={()=>setScreen("profile")}>My Profile</button>', '<button className="ghost" onClick={()=>setScreen("profile")}>My Profile</button><button className="ghost" onClick={()=>void logout()}>Logout</button>');
s=s.replace('className={p.online?"online":"offline"}', 'className={isActuallyOnline(p)?"online":"offline"}');
s=s.replace('{selected?.online?"● Online":"Offline"}', '{isActuallyOnline(selected)?"● Online":"Offline"}');

// Show WhatsApp-style status and sent/seen time under every own message.
s=s.replace(
  '<small>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>',
  '<small>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}{m.uid===user?.uid&&<span className="message-status"> {m.status==="seen"?"🔵✓✓":m.status==="delivered"?"✓✓":m.status==="sent"?"✓":"🕐"}</span>}</small>'
);

fs.writeFileSync(path,s);
