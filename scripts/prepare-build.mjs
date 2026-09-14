import fs from "node:fs";
const p="src/App.tsx";let s=fs.readFileSync(p,"utf8");
s=s.replaceAll("ChatOnlineMe","Stranger Chat Now");
s=s.replace('setError(`Chat error: ${e.message}`)},[user,selected]);','setError(`Chat error: ${e.message}`))},[user,selected]);');
s=s.replaceAll('behavior:"smooth"','behavior:"auto"');
if(!s.includes('const chatInputRef=useRef<HTMLInputElement|null>(null);'))s=s.replace('const previousMessageCount=useRef(0);','const previousMessageCount=useRef(0);\n  const chatInputRef=useRef<HTMLInputElement|null>(null);');
s=s.replace('const t=text.trim();if(!user||!selected||(!t&&!image)||sending)return;','const t=(chatInputRef.current?.value||text).trim();if(!user||!selected||(!t&&!image)||sending)return;');
s=s.replace('setText("")}catch(e)','if(chatInputRef.current)chatInputRef.current.value="";setText("")}catch(e)');
s=s.replace('value={text} placeholder="Type a message…" disabled={sending} onChange={e=>setText(e.target.value)}','ref={chatInputRef} defaultValue="" placeholder="Type a message…" disabled={sending}');
s=s.replace('disabled={sending||!text.trim()} onClick={()=>void sendMessage()}','disabled={sending} onClick={()=>void sendMessage()}');
s=s.replace('ms.filter(m=>m.uid!==user.uid&&m.status!=="delivered"&&m.status!=="seen").forEach(m=>void updateMessageStatus(d.id,m.id,"delivered").catch(()=>{}))','');
s=s.replace('ms.filter(m=>m.uid!==user.uid&&m.status!=="seen").forEach(m=>void updateMessageStatus(id,m.id,"seen").catch(()=>{}))','');
// Keep guest username and age outside React state while typing, because ProfileScreen is nested in App and can remount.
s=s.replace('<label>Username<input required value={profile.username} onChange={e=>setProfile({...profile,username:e.target.value})}/></label>','<label>Username<input name="username" required defaultValue={sessionStorage.getItem("guest-profile-username")||profile.username} onInput={e=>sessionStorage.setItem("guest-profile-username",e.currentTarget.value)}/></label>');
s=s.replace('<label>Age<input required type="number" min="13" max="100" value={profile.age} onChange={e=>setProfile({...profile,age:Number(e.target.value)})}/></label>','<label>Age<input name="age" required type="number" min="13" max="100" defaultValue={sessionStorage.getItem("guest-profile-age")||String(profile.age)} onInput={e=>sessionStorage.setItem("guest-profile-age",e.currentTarget.value)}/></label>');
// CRITICAL: read the uncontrolled guest form values at submit. Without this, profile.username stays empty and Continue to chat always fails validation.
s=s.replace('async function saveProfile(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const u=user||(await signInAnonymously(auth)).user,p={...profile,uid:u.uid},name=', 'async function saveProfile(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const fd=new FormData(e.currentTarget as HTMLFormElement),username=String(fd.get("username")||sessionStorage.getItem("guest-profile-username")||profile.username||""),age=Number(fd.get("age")||sessionStorage.getItem("guest-profile-age")||profile.age),u=user||(await signInAnonymously(auth)).user,p={...profile,uid:u.uid,username,age},name=');
s=s.replace('setUser(u);setProfile({...p,username:name});setScreen("room")}catch(e){setError(e instanceof Error?e.message:"Could not save profile.")}', 'setUser(u);setProfile({...p,username:name});try{sessionStorage.removeItem("guest-profile-username");sessionStorage.removeItem("guest-profile-age")}catch{}setScreen("room")}catch(e){setError(e instanceof Error?e.message:"Could not save profile.")}');
// Prevent login/profile trim crashes when an existing Firestore profile has a missing value.
s=s.replace('p.username.trim().toLowerCase()','String(p.username||"").trim().toLowerCase()');
s=s.replace('profile.username.trim()','String(profile.username||"").trim()');
s=s.replace('email.trim()','String(email||"").trim()');
// If a logged-in account has no username in its existing profile, use the email name as a valid username instead of throwing the format error.
s=s.replace('String(p.username||"").trim().toLowerCase()','String(p.username||u.email?.split("@")[0]||"").trim().toLowerCase().replace(/[^a-z0-9_.-]/g,"").slice(0,24)');
fs.writeFileSync(p,s);
