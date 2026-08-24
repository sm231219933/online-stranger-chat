import fs from "node:fs";

const path="src/App.tsx";
let s=fs.readFileSync(path,"utf8");

// The original App contains placeholder mailto call buttons. Remove them so the
// real WebRTC controls below are the only call buttons shown in the chat header.
s=s.replace(/<div className=\"call-actions\"><button title=\"Voice call\"[\s\S]*?<\/div><button className=\"more\"/, '<button className="more"');

if(!s.includes('from "./CallControls"')) s=s.replace('import "./responsive.css";','import "./responsive.css";\nimport CallControls from "./CallControls";');
if(!s.includes("<CallControls user={user} selected={selected}/>") && s.includes('<header className="chat-top">')) s=s.replace('</header><div className="messages">','<CallControls user={user ? {uid:user.uid, username:profile.username} : null} selected={selected}/></header><div className="messages">');
if(!s.includes('signOut, type User')) s=s.replace('signInWithEmailAndPassword, type User','signInWithEmailAndPassword, signOut, type User');
if(!s.includes('deleteField')) s=s.replace('serverTimestamp, setDoc, where } from "firebase/firestore";','deleteDoc, deleteField, serverTimestamp, setDoc, where } from "firebase/firestore";');

// Keep the source type declarations compatible with the status/presence features injected below.
s=s.replace('type Profile = { uid:string; username:string; country:string; countryCode:string; state:string; stateCode:string; age:number; gender:Gender|""; avatar:string; online?:boolean; emailAccount?:boolean; photoURL?:string };','type Profile = { uid:string; username:string; country:string; countryCode:string; state:string; stateCode:string; age:number; gender:Gender|""; avatar:string; online?:boolean; lastSeen?:number; logoutAt?:number; emailAccount?:boolean; photoURL?:string };');
s=s.replace('type Message = { uid:string; text:string; createdAt:number; image?:string };','type Message = { id:string; uid:string; text:string; createdAt:number; image?:string; status?:"sending"|"sent"|"delivered"|"seen"; sentAt?:number; deliveredAt?:number; seenAt?:number };');
s=s.replace('type Profile={uid:string;username:string;country:string;countryCode:string;state:string;stateCode:string;age:number;gender:Gender|"";avatar:string;online?:boolean;emailAccount?:boolean;photoURL?:string};','type Profile={uid:string;username:string;country:string;countryCode:string;state:string;stateCode:string;age:number;gender:Gender|"";avatar:string;online?:boolean;lastSeen?:number;logoutAt?:number;emailAccount?:boolean;photoURL?:string};');
s=s.replace('type Message={uid:string;text:string;createdAt:number;image?:string};','type Message={id:string;uid:string;text:string;createdAt:number;image?:string;status?:"sending"|"sent"|"delivered"|"seen";sentAt?:number;deliveredAt?:number;seenAt?:number};');

if(!s.includes('const isActuallyOnline=')) s=s.replace('export default function App(){','const isActuallyOnline=(p?:Profile|null)=>!!p&&p.online===true&&typeof p.lastSeen==="number"&&Date.now()-p.lastSeen<90000;\nexport default function App(){');
if(!s.includes('[presenceTick')) s=s.replace('[error,setError]=useState("")','[error,setError]=useState(""),[presenceTick,setPresenceTick]=useState(0)');

s=s.replace('useEffect(()=>onAuthStateChanged(auth,async u=>{if(!u)return;setUser(u);try{const s=await getDoc(doc(db,"matches",u.uid));if(s.exists())setProfile(s.data() as Profile)}catch(e){setError(e instanceof Error?e.message:"Could not connect to Firebase.")}}),[]);','useEffect(()=>onAuthStateChanged(auth,async u=>{if(!u){setUser(null);setProfile(emptyProfile());setSelected(null);setMessages([]);setScreen("home");return;}setUser(u);try{const ref=doc(db,"matches",u.uid),snap=await getDoc(ref);if(snap.exists()){const p=snap.data() as Profile;setProfile(p);await setDoc(ref,{online:true,lastSeen:Date.now(),updatedAt:serverTimestamp(),logoutAt:deleteField()},{merge:true});}}catch(e){setError(e instanceof Error?e.message:"Could not connect to Firebase.")}}),[]);\n\nuseEffect(()=>{if(!user)return;const ref=doc(db,"matches",user.uid);const beat=()=>{setPresenceTick(x=>x+1);void setDoc(ref,{online:true,lastSeen:Date.now(),updatedAt:serverTimestamp(),logoutAt:deleteField()},{merge:true}).catch(()=>{})};beat();const timer=window.setInterval(beat,30000);return()=>window.clearInterval(timer)},[user]);');

s=s.replace('const filtered=useMemo(()=>profiles.filter(p=>(!search||p.username.toLowerCase().includes(search.toLowerCase()))&&(!countryFilter||p.country===countryFilter)&&(!stateFilter||p.state===stateFilter)&&(!genderFilter||p.gender===genderFilter)),[profiles,search,countryFilter,stateFilter,genderFilter]);','const filtered=useMemo(()=>{void presenceTick;return profiles.filter(p=>isActuallyOnline(p)&&(!search||p.username.toLowerCase().includes(search.toLowerCase()))&&(!countryFilter||p.country===countryFilter)&&(!stateFilter||p.state===stateFilter)&&(!genderFilter||p.gender===genderFilter))},[profiles,search,countryFilter,stateFilter,genderFilter,presenceTick]);');

s=s.replace('onChange={e=>setProfile({...profile,username:e.target.value})}','onChange={e=>setProfile(p=>({...p,username:e.target.value}))}');
s=s.replace('onChange={e=>setProfile({...profile,avatar:a,photoURL:""})}','onChange={()=>setProfile(p=>({...p,avatar:a,photoURL:""}))}');
s=s.replace('onChange={e=>setProfile({...profile,age:Number(e.target.value)})}','onChange={e=>setProfile(p=>({...p,age:Number(e.target.value)}))}');
s=s.replace('onChange={e=>{const c=countries.find(x=>x.name===e.target.value);setProfile({...profile,country:e.target.value,countryCode:c?.isoCode||"",state:"",stateCode:""})}}','onChange={e=>{const value=e.target.value,c=countries.find(x=>x.name===value);setProfile(p=>({...p,country:value,countryCode:c?.isoCode||"",state:"",stateCode:""}))}}');
s=s.replace('onChange={e=>{const s=profileStates.find(x=>x.name===e.target.value);setProfile({...profile,state:e.target.value,stateCode:s?.isoCode||""})}}','onChange={e=>{const value=e.target.value,s=profileStates.find(x=>x.name===value);setProfile(p=>({...p,state:value,stateCode:s?.isoCode||""}))}}');

s=s.replace('{...p,username:name,online:true,emailAccount:!u.isAnonymous,updatedAt:serverTimestamp()}','{...p,username:name,online:true,lastSeen:Date.now(),emailAccount:!u.isAnonymous,updatedAt:serverTimestamp()}');
s=s.replace('{...p,updatedAt:serverTimestamp()},{merge:true});setUser(account)','{...p,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true});setUser(account)');
s=s.replace('const r=await signInWithEmailAndPassword(auth,email.trim(),password),s=await getDoc(doc(db,"matches",r.user.uid));setUser(r.user);','const r=await signInWithEmailAndPassword(auth,email.trim(),password),s=await getDoc(doc(db,"matches",r.user.uid));setUser(r.user);await setDoc(doc(db,"matches",r.user.uid),{online:true,lastSeen:Date.now(),logoutAt:deleteField(),updatedAt:serverTimestamp()},{merge:true});');

if(!s.includes('async function logout()')) s=s.replace('async function sendMessage(image?:string){','async function logout(){if(!user)return;try{const chats=await getDocs(query(collection(db,"chats"),where("participants","array-contains",user.uid)));const expiresAt=Date.now()+600000;await Promise.all(chats.docs.map(d=>setDoc(d.ref,{expiresAt,updatedAt:serverTimestamp()},{merge:true})));await setDoc(doc(db,"matches",user.uid),{online:false,lastSeen:Date.now(),logoutAt:Date.now(),updatedAt:serverTimestamp()},{merge:true});}catch{}finally{await signOut(auth);setScreen("home")}}\nasync function sendMessage(image?:string){');

// Never put an undefined image field into Firestore. Build the text-only message without an image property.
s=s.replace('const id=[user.uid,selected.uid].sort().join("_"),m:Message=image?{uid:user.uid,text:t,image,createdAt:Date.now()}:{uid:user.uid,text:t,createdAt:Date.now()};','const id=[user.uid,selected.uid].sort().join("_"),now=Date.now(),base={id:crypto.randomUUID(),uid:user.uid,text:t,createdAt:now,status:"sent" as const,sentAt:now},m:Message=image?{...base,image}:base;');

if(!s.includes('async function updateMessageStatus')) s=s.replace('useEffect(()=>{if(!user||!selected)return;','async function updateMessageStatus(chatId:string,messageId:string,status:"delivered"|"seen"){const ref=doc(db,"chats",chatId);const snap=await getDoc(ref);if(!snap.exists())return;const data=snap.data(),ms=(data.messages||[]) as Message[],now=Date.now(),next=ms.map(m=>m.id===messageId?{...m,status,...(status==="delivered"?{deliveredAt:m.deliveredAt||now}:{deliveredAt:m.deliveredAt||now,seenAt:m.seenAt||now})}:m);await setDoc(ref,{messages:next,updatedAt:serverTimestamp()},{merge:true})}\n\nuseEffect(()=>{if(!user)return;const q=query(collection(db,"chats"),where("participants","array-contains",user.uid));return onSnapshot(q,snap=>{snap.docs.forEach(d=>{const ms=(d.data().messages||[]) as Message[];ms.filter(m=>m.uid!==user.uid&&m.status!=="delivered"&&m.status!=="seen").forEach(m=>void updateMessageStatus(d.id,m.id,"delivered").catch(()=>{}))})},e=>setError(`Delivery error: ${e.message}`))},[user]);\n\nuseEffect(()=>{if(!user||!selected)return;');
s=s.replace('useEffect(()=>{if(!user||!selected)return;const id=[user.uid,selected.uid].sort().join("_");return onSnapshot(doc(db,"chats",id),s=>setMessages((s.data()?.messages||[]) as Message[]),e=>setError(`Chat error: ${e.message}`))},[user,selected]);','useEffect(()=>{if(!user||!selected)return;const id=[user.uid,selected.uid].sort().join("_");return onSnapshot(doc(db,"chats",id),snap=>{const ms=(snap.data()?.messages||[]) as Message[];setMessages(ms);ms.filter(m=>m.uid!==user.uid&&m.status!=="seen").forEach(m=>void updateMessageStatus(id,m.id,"seen").catch(()=>{}))},e=>setError(`Chat error: ${e.message}`))},[user,selected]);');

s=s.replace('unread:last.uid!==user.uid','unread:last.uid!==user.uid&&last.status!=="seen"');
s=s.replace('className={p.online?"online":"offline"}','className={isActuallyOnline(p)?"online":"offline"}');
s=s.replace('{selected?.online?"● Online":"Offline"}','{isActuallyOnline(selected)?"● Online":"Offline"}');
s=s.replace('<small>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>','<small>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}{m.uid===user?.uid&&<span className="message-status"> {m.status==="seen"?"🔵✓✓":m.status==="delivered"?"✓✓":m.status==="sent"?"✓":"🕐"}</span>}</small>');

// Guest profile screen should stay focused: no duplicate guide/footer content is injected into the form.
s=s.replace('<aside className="join-guide">','<aside className="join-guide" style={{display:"none"}}>');
s=s.replace('<button className="ghost" onClick={()=>{setAuthMode("signup");setScreen("auth")}}>🔐 Sign up & add profile photo</button>','');

fs.writeFileSync(path,s);
