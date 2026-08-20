import { useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, createUserWithEmailAndPassword, linkWithCredential, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, type User } from "firebase/auth";
import { arrayUnion, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import "./styles.css";

type Profile = { uid: string; username: string; country: string; state: string; age: number; gender: "Male" | "Female" | "Neutral"; avatar?: string; online?: boolean; emailAccount?: boolean };
type Message = { uid: string; text: string; image?: string; createdAt: number };

const CLOUD_NAME = "miglsezs";
const UPLOAD_PRESET = "stranger_chat";
const countries = ["India", "United States", "United Kingdom", "Canada", "Australia", "Other"];
const genders = ["All", "Male", "Female", "Neutral"];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("All");
  const [gender, setGender] = useState("All");
  const [stateFilter, setStateFilter] = useState("");
  const [screen, setScreen] = useState<"profile" | "room" | "auth">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          await signInAnonymously(auth);
          return;
        }
        if (!active) return;
        setUser(firebaseUser);
        const snap = await getDocs(query(collection(db, "matches"), where("uid", "==", firebaseUser.uid)));
        if (!snap.empty) {
          setProfile(snap.docs[0].data() as Profile);
          setScreen("room");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Firebase connection failed");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "matches"), snap => {
      setProfiles(snap.docs.map(d => d.data() as Profile).filter(p => p.uid !== user.uid));
    }, () => setError("Could not load users. Check Firestore rules."));
  }, [user]);

  useEffect(() => {
    if (!selected || !user) return;
    const chatId = [user.uid, selected.uid].sort().join("_");
    return onSnapshot(doc(db, "chats", chatId), snap => {
      setMessages((snap.data()?.messages || []) as Message[]);
    });
  }, [selected, user]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const currentUser = user;
    if (!currentUser || !profile) return;
    setSaving(true); setError("");
    try {
      const username = profile.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,24}$/.test(username)) throw new Error("Username must be 3-24 characters.");
      const existing = await getDocs(query(collection(db, "matches"), where("username", "==", username)));
      if (existing.docs.some(d => d.data().uid !== currentUser.uid)) throw new Error("This username is already taken.");
      await setDoc(doc(db, "matches", currentUser.uid), { ...profile, uid: currentUser.uid, username, online: true, updatedAt: serverTimestamp(), emailAccount: !!currentUser.email }, { merge: true });
      setProfile({ ...profile, uid: currentUser.uid, username, online: true, emailAccount: !!currentUser.email });
      setScreen("room");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save profile"); }
    finally { setSaving(false); }
  }

  async function uploadImage(file: File, onUploaded: (url: string) => Promise<void> | void) {
    try {
      const body = new FormData(); body.append("file", file); body.append("upload_preset", UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body });
      if (!response.ok) throw new Error("Cloudinary upload failed");
      const data = await response.json();
      await onUploaded(data.secure_url);
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed"); }
  }

  async function sendMessage(image?: string) {
    const currentUser = user;
    if (!currentUser || !selected || (!text.trim() && !image)) return;
    const chatId = [currentUser.uid, selected.uid].sort().join("_");
    const message: Message = { uid: currentUser.uid, text: text.trim(), image, createdAt: Date.now() };
    await setDoc(doc(db, "chats", chatId), { participants: [currentUser.uid, selected.uid], messages: arrayUnion(message), updatedAt: serverTimestamp() }, { merge: true });
    setText("");
  }

  async function accountAction() {
    setError("");
    try {
      if (authMode === "signup") {
        if (user?.isAnonymous) await linkWithCredential(user, EmailAuthProvider.credential(email, password));
        else await createUserWithEmailAndPassword(auth, email, password);
      } else await signInWithEmailAndPassword(auth, email, password);
      setScreen("profile");
    } catch (e) { setError(e instanceof Error ? e.message.replace("Firebase: ", "") : "Authentication failed"); }
  }

  const filtered = useMemo(() => profiles.filter(p =>
    (!search || p.username.includes(search.toLowerCase())) &&
    (country === "All" || p.country === country) &&
    (gender === "All" || p.gender === gender) &&
    (!stateFilter || p.state.toLowerCase().includes(stateFilter.toLowerCase()))
  ), [profiles, search, country, gender, stateFilter]);

  if (loading) return <div className="loading">Loading Stranger Chat…</div>;

  if (screen === "auth") return <main className="app"><section className="auth card"><div className="logo">💬</div><h1>{authMode === "signup" ? "Create your account" : "Welcome back"}</h1><p>Keep your unique username and profile.</p><input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} /><input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={accountAction}>{authMode === "signup" ? "Sign up" : "Log in"}</button><button className="ghost" onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Already have an account? Log in" : "New here? Create account"}</button>{error && <div className="error">{error}</div>}<button className="link" onClick={() => setScreen("profile")}>Back</button></section></main>;

  if (screen === "profile" || !profile) return <main className="app"><section className="card profile-card"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Meet people worldwide</small></div></div><h1>Set up your profile</h1><p className="muted">No phone number required.</p><form onSubmit={saveProfile}><div className="avatar-row"><div className="avatar large">{profile?.avatar ? <img src={profile.avatar} /> : "👤"}</div><label className="upload">Upload photo<input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], url => setProfile(p => p ? { ...p, avatar: url } : p))} /></label></div><input required placeholder="Unique username" value={profile?.username || ""} onChange={e => setProfile({ uid: user?.uid || "", username: e.target.value, country: profile?.country || "India", state: profile?.state || "", age: profile?.age || 18, gender: profile?.gender || "Neutral", avatar: profile?.avatar })} /><select value={profile?.country || "India"} onChange={e => setProfile({ ...profile!, country: e.target.value })}>{countries.map(c => <option key={c}>{c}</option>)}</select><input required placeholder="State / Province" value={profile?.state || ""} onChange={e => setProfile({ ...profile!, state: e.target.value })} /><div className="two"><input required type="number" min="13" max="100" placeholder="Age" value={profile?.age || ""} onChange={e => setProfile({ ...profile!, age: Number(e.target.value) })} /><select value={profile?.gender || "Neutral"} onChange={e => setProfile({ ...profile!, gender: e.target.value as Profile["gender"] })}><option>Male</option><option>Female</option><option>Neutral</option></select></div><button disabled={saving}>{saving ? "Saving…" : "Enter Chat Room →"}</button></form><button className="ghost" onClick={() => setScreen("auth")}>🔐 Sign up / Log in</button>{error && <div className="error">{error}</div>}</section></main>;

  const currentUser = user;
  if (!currentUser) return null;
  return <main className="app room"><aside className="sidebar"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>{profiles.length} people</small></div></div><div className="me"><div className="avatar">{profile.avatar ? <img src={profile.avatar} /> : "👤"}</div><div><b>@{profile.username}</b><small>{profile.country} · {profile.gender}</small></div></div><button className="primary" onClick={() => setScreen("profile")}>✏️ Edit profile</button><button className="ghost" onClick={() => setScreen("auth")}>🔐 Account</button></aside><section className="people"><div className="room-head"><h2>People</h2><small>Find someone to chat with</small></div><div className="search"><span>⌕</span><input placeholder="Search username…" value={search} onChange={e => setSearch(e.target.value.toLowerCase())} /></div><div className="filters"><select value={country} onChange={e => setCountry(e.target.value)}>{countries.map(c => <option key={c}>{c}</option>)}</select><select value={gender} onChange={e => setGender(e.target.value)}>{genders.map(g => <option key={g}>{g}</option>)}</select><input placeholder="State" value={stateFilter} onChange={e => setStateFilter(e.target.value)} /></div><div className="list">{filtered.map(p => <button className="person" key={p.uid} onClick={() => setSelected(p)}><div className="avatar">{p.avatar ? <img src={p.avatar} /> : "👤"}<i /></div><div><b>@{p.username}</b><small>{p.country} · {p.state} · {p.age}</small></div><span>›</span></button>)}{filtered.length === 0 && <div className="empty">No people found.</div>}</div></section><section className="chat">{selected ? <><header><button className="back" onClick={() => setSelected(null)}>‹</button><div className="avatar">{selected.avatar ? <img src={selected.avatar} /> : "👤"}</div><div><b>@{selected.username}</b><small>{selected.country} · {selected.state}</small></div></header><div className="messages">{messages.map((m, i) => <div key={i} className={`bubble ${m.uid === currentUser.uid ? "mine" : ""}`}>{m.image && <img src={m.image} />}{m.text && <div>{m.text}</div>}</div>)}{messages.length === 0 && <div className="empty">Say hello 👋</div>}</div><footer><label className="attach">＋<input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], sendMessage)} /></label><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Write a message… 😊" /><button onClick={() => sendMessage()}>➤</button></footer></> : <div className="welcome"><div>💬</div><h2>Choose someone to chat</h2><p>Search the people list and tap a profile to start a private conversation.</p></div>}</section>{error && <div className="toast error">{error}</div>}</main>;
}

export default App;
