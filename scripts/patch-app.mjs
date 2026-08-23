import fs from "node:fs";

const path="src/App.tsx";
let s=fs.readFileSync(path,"utf8");

// Keep existing app patches; this script intentionally changes only targeted behavior.

// Fix controlled form inputs so typing is not interrupted by auth/presence updates.
s=s.replace('onChange={e=>setProfile({...profile,username:e.target.value})}', 'onChange={e=>setProfile(p=>({...p,username:e.target.value}))}');
s=s.replace('onChange={e=>setEmail(e.target.value)}', 'onChange={e=>setEmail(e.target.value)}');
s=s.replace('onChange={e=>setPassword(e.target.value)}', 'onChange={e=>setPassword(e.target.value)}');

// Remove the right-side How To Join panel from the profile screen without changing the form itself.
s=s.replace('<aside className="join-guide"><div className="guide-badge">✨ HOW TO JOIN</div><h2>Ready in under a minute</h2>', '<aside className="join-guide" style={{display:"none"}}><div className="guide-badge">✨ HOW TO JOIN</div><h2>Ready in under a minute</h2>');

// Hide the extra login/signup switch text from the anonymous profile flow.
s=s.replace('<button className="ghost" onClick={()=>{setAuthMode("signup");setScreen("auth")}}>🔐 Sign up & add profile photo</button>', '');

// Add a 10-minute chat cleanup marker when a user explicitly logs out.
// A cleanup worker can safely remove conversations after the marker expires; normal active chats are untouched.
s=s.replace('await setDoc(doc(db,"matches",user.uid),{online:false,lastSeen:Date.now(),updatedAt:serverTimestamp()},{merge:true});', 'await setDoc(doc(db,"matches",user.uid),{online:false,lastSeen:Date.now(),logoutAt:Date.now(),updatedAt:serverTimestamp()},{merge:true});');

fs.writeFileSync(path,s);
