import { useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, linkWithCredential, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, type User } from "firebase/auth";
import { arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Country, State } from "country-state-city";
import { auth, db } from "./firebase";
import "./styles.css";

type Gender = "Male" | "Female" | "Neutral";
type Screen = "profile" | "room" | "chat" | "auth";
type Profile = { uid: string; username: string; country: string; countryCode: string; state: string; stateCode: string; age: number; gender: Gender | ""; avatar: string; online?: boolean; emailAccount?: boolean; photoURL?: string };
type Message = { uid: string; text: string; image?: string; createdAt: number };

const genders: Gender[] = ["Male", "Female", "Neutral"];
const avatars = ["😀", "😎", "🤩", "🥳", "🙂", "😊", "😇", "🤠", "🧑", "👩", "👨", "🧔", "👩‍🦱", "👨‍🦱", "🧑‍🎨", "🧑‍💻"];
const countries = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));
const emptyProfile = (uid = ""): Profile => ({ uid, username: "", country: "", countryCode: "", state: "", stateCode: "", age: 18, gender: "", avatar: "😀", online: true, emailAccount: false });

function Avatar({ profile, large = false }: { profile?: Profile | null; large?: boolean }) {
  const value = profile?.photoURL || profile?.avatar || "😀";
  return <div className={`avatar ${large ? "large" : ""}`}>{value.startsWith("http") ? <img src={value} alt="" /> : value}</div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(emptyProfile());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [screen, setScreen] = useState<Screen>("profile");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) return;
      setUser(firebaseUser);
      try {
        const snap = await getDoc(doc(db, "matches", firebaseUser.uid));
        if (snap.exists()) {
          const saved = snap.data() as Profile;
          setProfile(saved);
          setScreen("room");
        } else {
          setProfile(p => ({ ...(p || emptyProfile()), uid: firebaseUser.uid }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not connect to Firebase.");
      }
    });
    // Do not block the first screen while Firebase auth starts.
    signInAnonymously(auth).catch(() => {
      // Anonymous auth may be disabled; the profile screen still opens.
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "matches"), snap => {
      setProfiles(snap.docs.map(d => d.data() as Profile).filter(p => p.uid !== user.uid));
    }, e => setError(`Could not load users: ${e.message}`));
  }, [user]);

  useEffect(() => {
    if (!user || !selected) return;
    const chatId = [user.uid, selected.uid].sort().join("_");
    return onSnapshot(doc(db, "chats", chatId), snap => {
      setMessages((snap.data()?.messages || []) as Message[]);
    }, e => setError(`Chat error: ${e.message}`));
  }, [user, selected]);

  const profileCountry = countries.find(c => c.name === profile?.country);
  const profileStates = profileCountry ? State.getStatesOfCountry(profileCountry.isoCode) : [];
  const filterCountry = countries.find(c => c.name === countryFilter);
  const filterStates = filterCountry ? State.getStatesOfCountry(filterCountry.isoCode) : [];
  const filteredProfiles = useMemo(() => profiles.filter(p => (!search || p.username.toLowerCase().includes(search.toLowerCase())) && (!countryFilter || p.country === countryFilter) && (!stateFilter || p.state === stateFilter) && (!genderFilter || p.gender === genderFilter)), [profiles, search, countryFilter, stateFilter, genderFilter]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true); setError("");
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await signInAnonymously(auth).then(r => r.user);
        setUser(activeUser);
      }
      const current = { ...profile, uid: activeUser.uid };
      const username = current.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,24}$/.test(username)) throw new Error("Username must be 3-24 letters, numbers, dot, dash or underscore.");
      if (!current.country || !current.state || !current.gender) throw new Error("Please select country, state and gender.");
      const existing = await getDocs(query(collection(db, "matches"), where("username", "==", username)));
      if (existing.docs.some(d => d.id !== activeUser.uid)) throw new Error("This username is already taken. Choose another one.");
      await setDoc(doc(db, "matches", activeUser.uid), { ...current, username, online: true, emailAccount: !activeUser.isAnonymous, updatedAt: serverTimestamp() }, { merge: true });
      setProfile({ ...current, username, online: true, emailAccount: !activeUser.isAnonymous });
      setScreen("room");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save profile."); }
    finally { setSaving(false); }
  }

  async function uploadImage(file: File, callback: (url: string) => void) {
    setError("");
    try {
      const form = new FormData(); form.append("file", file); form.append("upload_preset", "stranger_chat");
      const response = await fetch("https://api.cloudinary.com/v1_1/miglsezs/image/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Cloudinary upload failed. Check your unsigned upload preset name.");
      const data = await response.json(); callback(data.secure_url);
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
  }

  async function sendMessage(image?: string) {
    if (!user || !selected || (!text.trim() && !image)) return;
    const chatId = [user.uid, selected.uid].sort().join("_");
    const message: Message = { uid: user.uid, text: text.trim(), image, createdAt: Date.now() };
    await setDoc(doc(db, "chats", chatId), { participants: [user.uid, selected.uid], messages: arrayUnion(message), updatedAt: serverTimestamp() }, { merge: true });
    setText("");
  }

  async function accountAction() {
    setError("");
    try {
      if (authMode === "signup" && user?.isAnonymous) {
        await linkWithCredential(user, EmailAuthProvider.credential(email, password));
        setProfile(p => p ? { ...p, emailAccount: true } : p); setScreen("profile");
      } else if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password); setScreen("profile");
      } else throw new Error("Please use the current guest session to create an account, or log in to an existing account.");
    } catch (e) { setError(e instanceof Error ? e.message.replace("Firebase: ", "") : "Authentication failed."); }
  }

  if (screen === "auth") return <main className="app center"><section className="card auth-card"><div className="logo">💬</div><h1>{authMode === "signup" ? "Create your account" : "Log in"}</h1><p>Keep your username and profile permanently.</p><input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={accountAction}>{authMode === "signup" ? "Create account" : "Log in"}</button><button className="ghost" onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Already have an account? Log in" : "Create a new account"}</button><button className="link" onClick={() => setScreen("profile")}>Back to profile</button>{error && <div className="error">{error}</div>}</section></main>;

  if (screen === "profile") return <main className="app center"><section className="card profile-card"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Meet people worldwide</small></div></div><h1>{profile?.username ? "Edit your profile" : "Create your profile"}</h1><p className="muted">Choose your details before entering the room.</p><form onSubmit={saveProfile}>
    <div className="avatar-control"><Avatar profile={profile} large /><div><label>Choose your avatar</label><select value={profile?.photoURL ? "" : profile?.avatar || ""} onChange={e => setProfile(p => p ? { ...p, avatar: e.target.value } : p)}><option value="" disabled>Select avatar</option>{avatars.map(a => <option value={a} key={a}>{a}</option>)}</select>{user && !user.isAnonymous ? <label className="upload">📷 Add profile photo<input type="file" accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(f) uploadImage(f,url=>setProfile(p=>p?{...p,photoURL:url}:p)); }} /></label> : <small>Guest: avatar only. Sign up to add a profile photo.</small>}</div></div>
    <input required placeholder="Unique username" value={profile?.username || ""} onChange={e => setProfile(p => p ? { ...p, username: e.target.value } : p)} />
    <select required value={profile?.country || ""} onChange={e => { const c=countries.find(x=>x.name===e.target.value); setProfile(p=>p?{...p,country:e.target.value,countryCode:c?.isoCode||"",state:"",stateCode:""}:p); }}><option value="" disabled>Select country</option>{countries.map(c=><option key={c.isoCode}>{c.name}</option>)}</select>
    <select required disabled={!profile?.country} value={profile?.state || ""} onChange={e=>{const s=profileStates.find(x=>x.name===e.target.value);setProfile(p=>p?{...p,state:e.target.value,stateCode:s?.isoCode||""}:p)}}><option value="" disabled>{profile?.country?"Select state / province":"Select country first"}</option>{profileStates.map(s=><option key={`${s.isoCode}-${s.name}`}>{s.name}</option>)}</select>
    <div className="two"><input required type="number" min="13" max="100" value={profile?.age || ""} placeholder="Age" onChange={e=>setProfile(p=>p?{...p,age:Number(e.target.value)}:p)} /><select required value={profile?.gender || ""} onChange={e=>setProfile(p=>p?{...p,gender:e.target.value as Gender}:p)}><option value="" disabled>Gender</option>{genders.map(g=><option key={g}>{g}</option>)}</select></div>
    <button disabled={saving}>{saving?"Saving…":"Enter Chat Room →"}</button></form><button className="ghost" onClick={()=>setScreen("auth")}>🔐 Sign up / Log in</button>{error&&<div className="error">{error}</div>}</section></main>;

  if (screen === "room") return <main className="app room-page"><header className="topbar"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>{profiles.length} people online</small></div></div><div className="top-actions"><button className="ghost" onClick={()=>setScreen("profile")}>✏️ Profile</button><button className="ghost" onClick={()=>setScreen("auth")}>🔐 Account</button></div></header><div className="room-layout"><section className="people-panel"><div className="room-title"><div><h2>Discover people</h2><p>Search someone and start a private chat.</p></div><div className="my-mini"><Avatar profile={profile}/><span>@{profile?.username}</span></div></div><div className="search-box">🔎<input placeholder="Search username…" value={search} onChange={e=>setSearch(e.target.value)} /></div><div className="filters"><select value={countryFilter} onChange={e=>{setCountryFilter(e.target.value);setStateFilter("")}}><option value="">🌍 Country</option>{countries.map(c=><option key={c.isoCode}>{c.name}</option>)}</select><select value={genderFilter} onChange={e=>setGenderFilter(e.target.value)}><option value="">🚻 Gender</option>{genders.map(g=><option key={g}>{g}</option>)}</select><select disabled={!countryFilter} value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="">📍 State</option>{filterStates.map(s=><option key={`${s.isoCode}-${s.name}`}>{s.name}</option>)}</select></div><div className="people-list">{filteredProfiles.map(p=><button className="person" key={p.uid} onClick={()=>{setSelected(p);setMessages([]);setScreen("chat")}}><div className="person-avatar"><Avatar profile={p}/><i/></div><div className="person-info"><b>@{p.username}</b><span>{p.age} · {p.gender}</span><small>{p.country} · {p.state}</small></div><span className="arrow">›</span></button>)}{filteredProfiles.length===0&&<div className="empty">No users found. Try a different search or filter.</div>}</div></section><section className="room-preview"><div className="preview-icon">💬</div><h2>Choose someone to chat</h2><p>Tap any person from the list to open a private conversation.</p></section></div></main>;

  return <main className="app chat-page"><header className="chat-top"><button className="back" onClick={()=>setScreen("room")}>‹</button><Avatar profile={selected}/><div><b>@{selected?.username}</b><small>{selected?.online?"● Online":"Offline"} · {selected?.country}</small></div><button className="more">⋯</button></header><div className="messages">{messages.length===0&&<div className="empty chat-empty">👋 Say hello to @{selected?.username}</div>}{messages.map((m,i)=><div className={`bubble ${m.uid===user?.uid?"mine":""}`} key={`${m.createdAt}-${i}`}>{m.image&&<img src={m.image} alt="sent"/>}{m.text&&<span>{m.text}</span>}</div>)}</div><footer className="composer"><label className="icon-btn">📷<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)uploadImage(f,sendMessage)}}/></label><button className="icon-btn" onClick={()=>setText(t=>`${t} 😊`)}>😊</button><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendMessage()}} placeholder="Write a message…"/><button className="send" onClick={()=>sendMessage()}>➤</button></footer>{error&&<div className="toast error">{error}</div>}</main>;
}
