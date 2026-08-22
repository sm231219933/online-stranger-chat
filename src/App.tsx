import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, linkWithCredential, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, type User } from "firebase/auth";
import { arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Country, State } from "country-state-city";
import { auth, db } from "./firebase";
import "./styles.css";

type Gender = "Male" | "Female" | "Neutral";
type Screen = "home" | "profile" | "room" | "auth";
type Profile = { uid: string; username: string; country: string; countryCode: string; state: string; stateCode: string; age: number; gender: Gender | ""; avatar: string; online?: boolean; emailAccount?: boolean; photoURL?: string };
type Message = { uid: string; text: string; createdAt: number; image?: string };

const countries = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));
const avatarSets: Record<Gender, string[]> = {
  Male: ["👨", "🧔", "👨‍🦱", "👨‍🦰", "👨‍🦳", "👨‍💻"],
  Female: ["👩", "👩‍🦱", "👩‍🦰", "👩‍🦳", "👩‍🎨", "👩‍💻"],
  Neutral: ["🧑", "🧑‍🎨", "🧑‍💻", "🧑‍🚀", "🧑‍🏫", "🧑‍🔬"],
};
const emptyProfile = (uid = ""): Profile => ({ uid, username: "", country: "", countryCode: "", state: "", stateCode: "", age: 18, gender: "", avatar: "🧑", online: true, emailAccount: false });

function Avatar({ profile, large = false }: { profile?: Profile | null; large?: boolean }) {
  const value = profile?.photoURL || profile?.avatar || "🧑";
  const gender = profile?.gender || "Neutral";
  return <div className={`avatar avatar-${gender.toLowerCase()} ${large ? "large" : ""}`}>{value.startsWith("http") ? <img src={value} alt="" /> : value}</div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [screen, setScreen] = useState<Screen>("home");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");

  useEffect(() => onAuthStateChanged(auth, async firebaseUser => {
    if (!firebaseUser) return;
    setUser(firebaseUser);
    try {
      const snap = await getDoc(doc(db, "matches", firebaseUser.uid));
      if (snap.exists()) setProfile(snap.data() as Profile);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect to Firebase."); }
  }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "matches"), snap => setProfiles(snap.docs.map(d => d.data() as Profile).filter(p => p.uid !== user.uid)), e => setError(`Could not load users: ${e.message}`));
  }, [user]);

  useEffect(() => {
    if (!user || !selected) return;
    const chatId = [user.uid, selected.uid].sort().join("_");
    return onSnapshot(doc(db, "chats", chatId), snap => setMessages((snap.data()?.messages || []) as Message[]), e => setError(`Chat error: ${e.message}`));
  }, [user, selected]);

  const profileCountry = countries.find(c => c.name === profile.country);
  const profileStates = profileCountry ? State.getStatesOfCountry(profileCountry.isoCode) : [];
  const filterCountry = countries.find(c => c.name === countryFilter);
  const filterStates = filterCountry ? State.getStatesOfCountry(filterCountry.isoCode) : [];
  const avatarOptions = profile.gender ? avatarSets[profile.gender] : avatarSets.Neutral;
  const filteredProfiles = useMemo(() => profiles.filter(p => (!search || p.username.toLowerCase().includes(search.toLowerCase())) && (!countryFilter || p.country === countryFilter) && (!stateFilter || p.state === stateFilter) && (!genderFilter || p.gender === genderFilter)), [profiles, search, countryFilter, stateFilter, genderFilter]);

  async function startGuest() {
    setError("");
    try {
      const active = user || (await signInAnonymously(auth)).user;
      setUser(active); setProfile(p => ({ ...p, uid: active.uid })); setScreen("profile");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start guest session."); }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const activeUser = user || (await signInAnonymously(auth)).user;
      const current = { ...profile, uid: activeUser.uid };
      const username = current.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,24}$/.test(username)) throw new Error("Username must be 3-24 letters, numbers, dot, dash or underscore.");
      if (!current.country || !current.state || !current.gender) throw new Error("Please select country, state and gender.");
      if (current.age < 13 || current.age > 100) throw new Error("Age must be between 13 and 100.");
      const existing = await getDocs(query(collection(db, "matches"), where("username", "==", username)));
      if (existing.docs.some(d => d.id !== activeUser.uid)) throw new Error("This username is already taken. Choose another one.");
      await setDoc(doc(db, "matches", activeUser.uid), { ...current, username, online: true, emailAccount: !activeUser.isAnonymous, updatedAt: serverTimestamp() }, { merge: true });
      setUser(activeUser); setProfile({ ...current, username, online: true, emailAccount: !activeUser.isAnonymous }); setScreen("room");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save profile."); }
    finally { setSaving(false); }
  }

  async function uploadImage(file: File, callback: (url: string) => void) {
    setError("");
    try {
      const form = new FormData(); form.append("file", file); form.append("upload_preset", "stranger_chat");
      const response = await fetch("https://api.cloudinary.com/v1_1/miglsezs/image/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Cloudinary upload failed. Check your unsigned upload preset.");
      const data = await response.json(); callback(data.secure_url);
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
  }

  async function sendMessage(image?: string) {
    const cleanText = text.trim();
    if (!user || !selected || (!cleanText && !image) || sending) return;
    setSending(true); setError("");
    const chatId = [user.uid, selected.uid].sort().join("_");
    // Fix: Firestore arrayUnion rejects undefined fields. Omit image completely for text-only messages.
    const message: Message = image ? { uid: user.uid, text: cleanText, image, createdAt: Date.now() } : { uid: user.uid, text: cleanText, createdAt: Date.now() };
    try {
      await setDoc(doc(db, "chats", chatId), { participants: [user.uid, selected.uid], messages: arrayUnion(message), updatedAt: serverTimestamp() }, { merge: true });
      setText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  async function accountAction() {
    setError("");
    try {
      if (authMode === "signup" && user?.isAnonymous) {
        await linkWithCredential(user, EmailAuthProvider.credential(email.trim(), password)); setProfile(p => ({ ...p, emailAccount: true })); setScreen("profile");
      } else if (authMode === "login") { await signInWithEmailAndPassword(auth, email.trim(), password); setScreen("room"); }
      else throw new Error("Start a guest session first to keep this profile, or log in to an existing account.");
    } catch (e) { setError(e instanceof Error ? e.message.replace("Firebase: ", "") : "Authentication failed."); }
  }

  if (screen === "home") return <main className="app home-page">
    <header className="home-nav"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Talk. Connect. Have fun.</small></div></div><nav><button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>How it works</button><button onClick={() => document.getElementById("safety")?.scrollIntoView({ behavior: "smooth" })}>Safety</button><button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}>FAQ</button><button onClick={() => setScreen("auth")}>Log in</button></nav></header>
    <section className="hero"><div className="hero-copy"><span className="pill">🌎 People worldwide · Guest chat available</span><h1>Meet a stranger.<br /><em>Start a real conversation.</em></h1><p>Choose your username, country, age, gender and avatar. Enter the room, find someone interesting and chat instantly.</p><div className="hero-buttons"><button className="primary big" onClick={startGuest}>Start chatting for free →</button><button className="secondary big" onClick={() => setScreen("auth")}>🔐 Sign up / Log in</button></div><div className="trust"><span>⚡ Fast</span><span>🔒 Private 1-on-1</span><span>📷 Photos + emojis</span></div></div><div className="hero-card"><div className="floating top">🟢 People are online</div><div className="mock-chat"><div className="mock-title"><Avatar profile={{ avatar: "👩‍🦱", username: "Luna", uid: "", country: "Canada", countryCode: "CA", state: "Ontario", stateCode: "ON", age: 24, gender: "Female" }} /><div><b>Luna</b><small>● Online · Canada</small></div></div><div className="mock-bubble left">Hey! 👋 Where are you from?</div><div className="mock-bubble right">India 🇮🇳 You?</div><div className="mock-photo">📷 <span>Photo shared</span></div><div className="mock-bubble left">Nice! 😊</div></div><div className="floating bottom">🔎 Search by username, country & gender</div></div></section>
    <section id="how" className="feature-section"><div className="section-heading"><span className="eyebrow">SIMPLE BY DESIGN</span><h2>Everything you need to chat</h2><p>No clutter. Find someone interesting and start talking.</p></div><div className="feature-grid"><article><b>👥</b><h3>Discover people</h3><p>Search usernames and filter by country, state and gender.</p></article><article><b>💬</b><h3>Private 1-on-1 chat</h3><p>Tap a person to open a dedicated conversation.</p></article><article><b>📷</b><h3>Photos & emojis</h3><p>Share images through Cloudinary and keep conversations fun.</p></article><article><b>✨</b><h3>Guest or account</h3><p>Guests use avatars. Sign up with email to keep your username and add a profile photo.</p></article></div></section>
    <section id="safety" className="info-section"><div><span className="eyebrow">SAFETY FIRST</span><h2>Chat comfortably and responsibly.</h2><p>Never share passwords, OTPs, bank details or private documents. Block or report people who behave badly.</p></div><div className="info-list"><span>🛡️ Keep personal information private</span><span>🚫 Block unwanted conversations</span><span>⚠️ Report abusive behaviour</span><span>🔐 Keep private chats private</span></div></section>
    <section id="faq" className="faq-section"><div className="section-heading"><span className="eyebrow">FAQ</span><h2>Questions, answered.</h2></div><div className="faq-grid"><details><summary>Do I need an account?</summary><p>No. You can enter as a guest with a unique username and avatar.</p></details><details><summary>Can I keep my username?</summary><p>Yes. Sign up with email and password to keep using your account.</p></details><details><summary>Can I send photos?</summary><p>Yes. Private chat supports image sharing and emojis.</p></details><details><summary>Can I search for someone?</summary><p>Yes. Search usernames and filter by country, state and gender.</p></details></div></section>
    <footer id="privacy" className="home-footer"><div><b>💬 Stranger Chat</b><p>A fast place to meet new people.</p></div><div><a href="#faq">FAQ</a><a href="#safety">Safety</a><a href="#privacy">Privacy Policy</a><a href="#terms">Terms</a><a href="#contact">Contact</a></div><small>Privacy: we only use profile/account information needed to provide the chat service. Do not share sensitive personal information.</small><small id="terms">Terms: use the service responsibly and respect other users.</small><small id="contact">Contact: add your support email here before launch.</small></footer>
  </main>;

  if (screen === "auth") return <main className="app center"><section className="card auth-card"><div className="logo">💬</div><h1>{authMode === "signup" ? "Create your account" : "Log in"}</h1><p>Keep your username and profile permanently.</p><input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><button className="primary" onClick={accountAction}>{authMode === "signup" ? "Create account" : "Log in"}</button><button className="ghost" onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Already have an account? Log in" : "Create a new account"}</button><button className="link" onClick={() => setScreen("home")}>Back to home</button>{error && <div className="error">{error}</div>}</section></main>;

  if (screen === "profile") return <main className="app center"><section className="card profile-card"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Meet people worldwide</small></div></div><h1>{profile.username ? "Edit your profile" : "Create your profile"}</h1><p className="muted">Choose your details before entering the room.</p><form onSubmit={saveProfile}><input placeholder="Unique username" value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} /><div className="two"><input type="number" min="13" max="100" placeholder="Age" value={profile.age || ""} onChange={e => setProfile({ ...profile, age: Number(e.target.value) })} /><select value={profile.gender} onChange={e => { const gender = e.target.value as Gender | ""; setProfile({ ...profile, gender, avatar: gender ? avatarSets[gender][0] : "🧑", photoURL: undefined }); }}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Neutral</option></select></div><select value={profile.country} onChange={e => { const c = countries.find(x => x.name === e.target.value); setProfile({ ...profile, country: c?.name || "", countryCode: c?.isoCode || "", state: "", stateCode: "" }); }}><option value="">Select country</option>{countries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}</select><select disabled={!profileCountry} value={profile.state} onChange={e => { const s = profileStates.find(x => x.name === e.target.value); setProfile({ ...profile, state: s?.name || "", stateCode: s?.isoCode || "" }); }}><option value="">Select state / province</option>{profileStates.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}</select><div className="avatar-section"><div className="avatar-heading"><div><b>Choose your avatar</b><small>{profile.gender ? `${profile.gender} avatar style` : "Select gender to see matching avatars"}</small></div><Avatar profile={profile} large /></div><div className="avatar-grid">{avatarOptions.map(a => <button type="button" key={a} className={profile.avatar === a && !profile.photoURL ? "avatar-choice selected" : "avatar-choice"} onClick={() => setProfile({ ...profile, avatar: a, photoURL: undefined })}><span className={`avatar avatar-${(profile.gender || "Neutral").toLowerCase()}`}>{a}</span></button>)}</div>{user && !user.isAnonymous ? <label className="upload">📷 Add profile photo<input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file, url => setProfile({ ...profile, photoURL: url })); }} /></label> : <small className="guest-note">Guest users use avatars. Sign up to add a profile photo.</small>}</div><button className="primary big" disabled={saving}>{saving ? "Entering…" : "Enter Chat Room →"}</button></form><button className="ghost" onClick={() => setScreen("auth")}>🔐 Sign up / Log in</button>{error && <div className="error">{error}</div>}</section></main>;

  const chatPanel = selected ? <section className="chat-panel"><header className="chat-top"><button className="back mobile-only" onClick={() => setSelected(null)}>←</button><Avatar profile={selected} /><div><b>{selected.username}</b><small>🟢 Online · {selected.age} · {selected.country}</small></div><button className="more">⋯</button></header><div className="messages">{messages.length === 0 ? <div className="chat-empty"><span>💬</span><b>Start the conversation</b><p>Say hello to {selected.username} 👋</p></div> : messages.map(m => <div key={`${m.createdAt}-${m.uid}`} className={`bubble ${m.uid === user?.uid ? "mine" : ""}`}>{m.image && <img src={m.image} alt="Shared" />}{m.text && <div>{m.text}</div>}<small>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div><div className="composer"><button className="icon-btn" title="Emoji" onClick={() => setText(t => `${t} 😊`)}>😊</button><label className="icon-btn" title="Send photo">📷<input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file, url => void sendMessage(url)); e.currentTarget.value = ""; }} /></label><input value={text} placeholder="Write a message…" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} /><button className="send" disabled={sending || !text.trim()} onClick={() => void sendMessage()}>{sending ? "…" : "➤"}</button></div></section> : <section className="chat-panel chat-placeholder"><div><span>💬</span><h2>Select someone to chat</h2><p>Choose a person from the list. Their private chat will open here.</p></div></section>;

  return <main className="app room-page"><header className="topbar"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Online people worldwide</small></div></div><div className="top-actions"><button className="ghost" onClick={() => setScreen("profile")}>Edit profile</button><button className="ghost" onClick={() => setScreen("home")}>Home</button></div></header><div className={`room-layout ${selected ? "has-chat" : ""}`}><aside className="people-panel"><div className="room-title"><div><h2>People online</h2><p>{filteredProfiles.length} people found</p></div><div className="my-mini"><Avatar profile={profile} /><span>{profile.username || "You"}</span></div></div><div className="search-box">🔎<input placeholder="Search username…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filters"><select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}><option value="">All genders</option><option>Male</option><option>Female</option><option>Neutral</option></select><select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setStateFilter(""); }}><option value="">All countries</option>{countries.map(c => <option key={c.isoCode}>{c.name}</option>)}</select><select disabled={!filterCountry} value={stateFilter} onChange={e => setStateFilter(e.target.value)}><option value="">All states</option>{filterStates.map(s => <option key={s.isoCode}>{s.name}</option>)}</select></div><div className="people-list">{filteredProfiles.length === 0 ? <div className="empty">No people match these filters yet.</div> : filteredProfiles.map(p => <button key={p.uid} className={`person ${selected?.uid === p.uid ? "active" : ""}`} onClick={() => { setSelected(p); setMessages([]); }}><div className="person-avatar"><Avatar profile={p} /><i /></div><div className="person-info"><b>{p.username}</b><span>{p.age} yrs · {p.country}</span><small>{p.gender || "Gender not set"}{p.state ? ` · ${p.state}` : ""}</small></div><span className="arrow">›</span></button>)}</div></aside>{chatPanel}</div>{error && <div className="toast error">{error}</div>}</main>;
}
