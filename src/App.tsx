import { useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, createUserWithEmailAndPassword, linkWithCredential, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, type User } from "firebase/auth";
import { arrayUnion, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Country, State } from "country-state-city";
import { auth, db } from "./firebase";
import "./styles.css";

type Gender = "Male" | "Female" | "Neutral";
type Profile = { uid: string; username: string; country: string; countryCode: string; state: string; stateCode: string; age: number; gender: Gender; avatar?: string; avatarId?: string; online?: boolean; emailAccount?: boolean };
type Message = { uid: string; text: string; image?: string; createdAt: number };

const CLOUD_NAME = "miglsezs";
const UPLOAD_PRESET = "stranger_chat";
const allCountries = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));
const genders = ["Male", "Female", "Neutral"];
const avatars = ["😀", "😎", "🤩", "🥳", "🙂", "😊", "😇", "🤠", "🧑", "👩", "👨", "🧔", "👩‍🦱", "👨‍🦱", "🧑‍🎨", "🧑‍💻"];
const emptyProfile = (uid = ""): Profile => ({ uid, username: "", country: "India", countryCode: "IN", state: "", stateCode: "", age: 18, gender: "Neutral", avatar: "😀", avatarId: "😀" });

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
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
        if (!firebaseUser) { await signInAnonymously(auth); return; }
        if (!active) return;
        setUser(firebaseUser);
        const snap = await getDocs(query(collection(db, "matches"), where("uid", "==", firebaseUser.uid)));
        if (!snap.empty) { setProfile(snap.docs[0].data() as Profile); setScreen("room"); }
        else setProfile(emptyProfile(firebaseUser.uid));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Firebase connection failed");
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "matches"), snap => {
      setProfiles(snap.docs.map(d => d.data() as Profile).filter(p => p.uid !== user.uid));
      setError("");
    }, err => setError(`Could not load users (${err.code}). Check Firebase Firestore rules.`));
  }, [user]);

  useEffect(() => {
    if (!selected || !user) return;
    const chatId = [user.uid, selected.uid].sort().join("_");
    return onSnapshot(doc(db, "chats", chatId), snap => setMessages((snap.data()?.messages || []) as Message[]));
  }, [selected, user]);

  const selectedCountry = allCountries.find(c => c.name === profile?.country) || allCountries.find(c => c.isoCode === profile?.countryCode) || allCountries.find(c => c.isoCode === "IN");
  const profileStates = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];
  const filterCountry = allCountries.find(c => c.name === countryFilter);
  const filterStates = filterCountry ? State.getStatesOfCountry(filterCountry.isoCode) : [];

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const currentUser = user;
    if (!currentUser || !profile) return;
    setSaving(true); setError("");
    try {
      const username = profile.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,24}$/.test(username)) throw new Error("Username must be 3-24 letters, numbers, _ . or -.");
      if (!profile.country || !profile.state || !profile.gender) throw new Error("Please select country, state and gender.");
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
      const data = await response.json(); await onUploaded(data.secure_url);
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

  function changeProfileCountry(name: string) {
    const c = allCountries.find(x => x.name === name);
    setProfile(p => p ? { ...p, country: name, countryCode: c?.isoCode || "", state: "", stateCode: "" } : p);
  }

  const filtered = useMemo(() => profiles.filter(p =>
    (!search || p.username.toLowerCase().includes(search.toLowerCase())) &&
    (countryFilter === "All" || p.country === countryFilter) &&
    (genderFilter === "All" || p.gender === genderFilter) &&
    (!stateFilter || p.state.toLowerCase().includes(stateFilter.toLowerCase()))
  ), [profiles, search, countryFilter, genderFilter, stateFilter]);

  if (loading) return <div className="loading">Loading Stranger Chat…</div>;

  if (screen === "auth") return <main className="app"><section className="auth card"><div className="logo">💬</div><h1>{authMode === "signup" ? "Create your account" : "Welcome back"}</h1><p>Keep your unique username and profile forever.</p><input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} /><input placeholder="Password (6+ characters)" type="password" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={accountAction}>{authMode === "signup" ? "Sign up" : "Log in"}</button><button className="ghost" onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Already have an account? Log in" : "New here? Create account"}</button>{error && <div className="error">{error}</div>}<button className="link" onClick={() => setScreen("profile")}>Back</button></section></main>;

  if (screen === "profile" || !profile) {
    const p = profile || emptyProfile(user?.uid || "");
    const anonymous = !!user?.isAnonymous;
    return <main className="app"><section className="card profile-card"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Meet people worldwide</small></div></div><h1>Create your profile</h1><p className="muted">Choose your unique username and details.</p><form onSubmit={saveProfile}>
      <div className="avatar-section"><div className="avatar large">{p.avatar || "😀"}</div><div><b>Choose your avatar</b><div className="avatar-grid">{avatars.map(a => <button type="button" className={`avatar-choice ${p.avatar === a ? "selected" : ""}`} key={a} onClick={() => setProfile({ ...p, avatar: a, avatarId: a })}>{a}</button>)}</div>{!anonymous && <label className="upload">Upload profile photo<input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], url => setProfile(x => ({ ...(x || p), avatar: url })))} /></label>} {anonymous && <small className="muted">Guest users use avatars. Sign up to add a profile photo.</small>}</div></div>
      <input required placeholder="Unique username" value={p.username} onChange={e => setProfile({ ...p, username: e.target.value })} />
      <select required value={p.country} onChange={e => changeProfileCountry(e.target.value)}><option value="">Select country</option>{allCountries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}</select>
      <select required value={p.state} onChange={e => { const s = profileStates.find(x => x.name === e.target.value); setProfile({ ...p, state: e.target.value, stateCode: s?.isoCode || "" }); }}><option value="">Select state / province</option>{profileStates.map(s => <option key={`${s.countryCode}-${s.isoCode}-${s.name}`} value={s.name}>{s.name}</option>)}</select>
      <div className="two"><input required type="number" min="13" max="100" placeholder="Age" value={p.age || ""} onChange={e => setProfile({ ...p, age: Number(e.target.value) })} /><select required value={p.gender} onChange={e => setProfile({ ...p, gender: e.target.value as Gender })}><option value="" disabled>Gender</option><option>Male</option><option>Female</option><option>Neutral</option></select></div>
      <button disabled={saving}>{saving ? "Saving…" : "Enter Chat Room →"}</button></form><button className="ghost" onClick={() => setScreen("auth")}>🔐 Sign up / Log in</button>{error && <div className="error">{error}</div>}</section></main>;
  }

  const currentUser = user;
  if (!currentUser) return null;
  return <main className="app room"><aside className="sidebar"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>{profiles.length} people</small></div></div><div className="me"><div className="avatar">{profile.avatar || "😀"}</div><div><b>@{profile.username}</b><small>{profile.country} · {profile.gender}</small></div></div><button className="primary" onClick={() => setScreen("profile")}>✏️ Edit profile</button><button className="ghost" onClick={() => setScreen("auth")}>🔐 Account</button></aside><section className="people"><div className="room-head"><div><h2>People</h2><small>Find someone to chat with</small></div></div><div className="search"><span>⌕</span><input placeholder="Search username…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filters"><select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setStateFilter(""); }}><option value="All">Country</option>{allCountries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}</select><select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}><option value="All">Gender</option>{genders.map(g => <option key={g}>{g}</option>)}</select>{countryFilter !== "All" ? <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}><option value="">State</option>{filterStates.map(s => <option key={`${s.isoCode}-${s.name}`} value={s.name}>{s.name}</option>)}</select> : <input placeholder="State" value={stateFilter} onChange={e => setStateFilter(e.target.value)} />}</div><div className="list">{filtered.map(p => <button className="person" key={p.uid} onClick={() => setSelected(p)}><div className="avatar">{p.avatar && p.avatar.startsWith("http") ? <img src={p.avatar} /> : (p.avatar || "😀")}<i /></div><div><b>@{p.username}</b><small>{p.country} · {p.state} · {p.age} · {p.gender}</small></div><span>›</span></button>)}{filtered.length === 0 && <div className="empty">No people found. Try another search or filter.</div>}</div></section><section className="chat">{selected ? <><header><button className="back" onClick={() => setSelected(null)}>‹</button><div className="avatar">{selected.avatar && selected.avatar.startsWith("http") ? <img src={selected.avatar} /> : (selected.avatar || "😀")}</div><div><b>@{selected.username}</b><small>{selected.country} · {selected.state}</small></div></header><div className="messages">{messages.map((m, i) => <div key={i} className={`bubble ${m.uid === currentUser.uid ? "mine" : ""}`}>{m.image && <img src={m.image} />}{m.text && <div>{m.text}</div>}</div>)}{messages.length === 0 && <div className="empty">Say hello 👋</div>}</div><footer><label className="attach">＋<input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], sendMessage)} /></label><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Write a message… 😊" /><button onClick={() => sendMessage()}>➤</button></footer></> : <div className="welcome"><div>💬</div><h2>Choose someone to chat</h2><p>Search the people list and tap a profile to start a private conversation.</p></div>}</section>{error && <div className="toast error">{error}</div>}</main>;
}

export default App;
