import { type FormEvent, useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, linkWithCredential, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, type User } from "firebase/auth";
import { arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Country, State } from "country-state-city";
import { auth, db } from "./firebase";
import "./styles.css";

type Gender = "Male" | "Female" | "Neutral";
type Screen = "home" | "profile" | "room" | "chat" | "auth";
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
  return <div className={`avatar avatar-${gender.toLowerCase()} ${large ? "large" : ""}`}>{value.startsWith("http") ? <img src={value} alt="Profile" /> : value}</div>;
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
  const [uploading, setUploading] = useState(false);
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

  function changeGender(gender: Gender) {
    setProfile(p => ({ ...p, gender, avatar: avatarSets[gender][0] }));
  }

  async function startGuest() {
    setError("");
    try {
      const active = user || (await signInAnonymously(auth)).user;
      setUser(active); setProfile(p => ({ ...p, uid: active.uid })); setScreen("profile");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start guest session."); }
  }

  async function uploadImage(file: File, callback: (url: string) => void) {
    setError("");
    try {
      const form = new FormData(); form.append("file", file); form.append("upload_preset", "stranger_chat");
      const response = await fetch("https://api.cloudinary.com/v1_1/miglsezs/image/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Cloudinary upload failed. Check your unsigned upload preset.");
      const data = await response.json();
      if (!data.secure_url) throw new Error("Cloudinary did not return an image URL.");
      callback(data.secure_url);
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
  }

  async function chooseProfilePhoto(file?: File) {
    if (!file) return;
    setUploading(true);
    await uploadImage(file, url => setProfile(p => ({ ...p, photoURL: url })));
    setUploading(false);
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

  async function createAccount() {
    setError(""); setSaving(true);
    try {
      if (!email.trim() || password.length < 6) throw new Error("Enter a valid email and a password of at least 6 characters.");
      if (!profile.username.trim() || !profile.country || !profile.state || !profile.gender) throw new Error("Please complete username, country, state and gender.");
      if (profile.age < 13 || profile.age > 100) throw new Error("Age must be between 13 and 100.");
      const username = profile.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,24}$/.test(username)) throw new Error("Username must be 3-24 letters, numbers, dot, dash or underscore.");
      const existing = await getDocs(query(collection(db, "matches"), where("username", "==", username)));
      if (existing.docs.some(d => d.id !== user?.uid)) throw new Error("This username is already taken. Choose another one.");

      const activeUser = user || (await signInAnonymously(auth)).user;
      let accountUser = activeUser;
      if (activeUser.isAnonymous) {
        accountUser = (await linkWithCredential(activeUser, EmailAuthProvider.credential(email.trim(), password))).user;
      } else {
        throw new Error("This session is already linked. Please use Log in or continue to your profile.");
      }

      const finalProfile = { ...profile, uid: accountUser.uid, username, online: true, emailAccount: true };
      await setDoc(doc(db, "matches", accountUser.uid), { ...finalProfile, updatedAt: serverTimestamp() }, { merge: true });
      setUser(accountUser); setProfile(finalProfile); setScreen("room");
    } catch (e) { setError(e instanceof Error ? e.message.replace("Firebase: ", "") : "Account creation failed."); }
    finally { setSaving(false); }
  }

  async function login() {
    setError(""); setSaving(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, "matches", result.user.uid));
      if (snap.exists()) { setProfile(snap.data() as Profile); setUser(result.user); setScreen("room"); }
      else { setUser(result.user); setProfile(p => ({ ...p, uid: result.user.uid, emailAccount: true })); setScreen("profile"); }
    } catch (e) { setError(e instanceof Error ? e.message.replace("Firebase: ", "") : "Login failed."); }
    finally { setSaving(false); }
  }

  async function sendMessage(image?: string) {
    const cleanText = text.trim();
    if (!user || !selected || (!cleanText && !image) || sending) return;
    setSending(true); setError("");
    const chatId = [user.uid, selected.uid].sort().join("_");
    const message: Message = image ? { uid: user.uid, text: cleanText, image, createdAt: Date.now() } : { uid: user.uid, text: cleanText, createdAt: Date.now() };
    try {
      await setDoc(doc(db, "chats", chatId), { participants: [user.uid, selected.uid], messages: arrayUnion(message), updatedAt: serverTimestamp() }, { merge: true });
      setText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  if (screen === "home") return <main className="app home-page">
    <header className="home-nav"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Talk. Connect. Have fun.</small></div></div><nav><button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>How it works</button><button onClick={() => document.getElementById("safety")?.scrollIntoView({ behavior: "smooth" })}>Safety</button><button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}>FAQ</button><button onClick={() => { setAuthMode("login"); setScreen("auth"); }}>Log in</button></nav></header>
    <section className="hero"><div className="hero-copy"><span className="pill">🌎 People worldwide · Guest chat available</span><h1>Meet a stranger.<br /><em>Start a real conversation.</em></h1><p>Choose your username, country, age, gender and avatar. Enter the room, find someone interesting and chat instantly.</p><div className="hero-buttons"><button className="primary big" onClick={startGuest}>Start chatting for free →</button><button className="secondary big" onClick={() => { setAuthMode("signup"); setProfile(emptyProfile(user?.uid || "")); setScreen("auth"); }}>🔐 Sign up / Log in</button></div><div className="trust"><span>⚡ Fast</span><span>🔒 Private 1-on-1</span><span>📷 Photos + emojis</span></div></div><div className="hero-card"><div className="floating top">🟢 People are online</div><div className="mock-chat"><div className="mock-title"><Avatar profile={{ avatar: "👩‍🦱", username: "Luna", uid: "", country: "Canada", countryCode: "CA", state: "Ontario", stateCode: "ON", age: 24, gender: "Female" }} /><div><b>Luna</b><small>● Online · Canada</small></div></div><div className="mock-bubble left">Hey! 👋 Where are you from?</div><div className="mock-bubble right">India 🇮🇳 You?</div><div className="mock-photo">📷 <span>Photo shared</span></div><div className="mock-bubble left">Nice! 😊</div></div><div className="floating bottom">🔎 Search by username, country & gender</div></div></section>
    <section id="how" className="feature-section"><div className="section-heading"><span className="eyebrow">SIMPLE BY DESIGN</span><h2>Everything you need to chat</h2><p>No clutter. Find someone interesting and start talking.</p></div><div className="feature-grid"><article><b>👥</b><h3>Discover people</h3><p>Search usernames and filter by country, state and gender.</p></article><article><b>💬</b><h3>Private 1-on-1 chat</h3><p>Tap a person to open a dedicated conversation.</p></article><article><b>📷</b><h3>Photos & emojis</h3><p>Share images through Cloudinary and keep conversations fun.</p></article><article><b>✨</b><h3>Guest or account</h3><p>Guests use avatars. Sign up once with email, password and your full profile to keep everything.</p></article></div></section>
    <section id="safety" className="info-section"><div><span className="eyebrow">SAFETY FIRST</span><h2>Chat comfortably and responsibly.</h2><p>Never share passwords, OTPs, bank details or private documents. Block or report people who behave badly.</p></div><div className="info-list"><span>🛡️ Keep personal information private</span><span>🚫 Block unwanted conversations</span><span>⚠️ Report abusive behaviour</span><span>🔐 Keep private chats private</span></div></section>
    <section id="faq" className="faq-section"><div className="section-heading"><span className="eyebrow">FAQ</span><h2>Questions, answered.</h2></div><div className="faq-grid"><details><summary>Do I need an account?</summary><p>No. You can enter as a guest with a unique username and avatar.</p></details><details><summary>Can I keep my username?</summary><p>Yes. Create an account once and your username, profile and photo can be used again.</p></details><details><summary>Can I send photos?</summary><p>Yes. Private chat supports image sharing and emojis.</p></details><details><summary>Can I search for someone?</summary><p>Yes. Search usernames and filter by country, state and gender.</p></details></div></section>
    <footer id="privacy" className="home-footer"><div><b>💬 Stranger Chat</b><p>A fast place to meet new people.</p></div><div><a href="#faq">FAQ</a><a href="#safety">Safety</a><a href="#privacy">Privacy Policy</a><a href="#terms">Terms</a><a href="#contact">Contact</a></div><small>Privacy: we only use profile/account information needed to provide the chat service. Do not share sensitive personal information.</small><small id="terms">Terms: use the service responsibly and respect other users.</small><small id="contact">Contact: add your support email here before launch.</small></footer>
  </main>;

  if (screen === "auth") return <main className="app center"><section className={`card auth-card ${authMode === "signup" ? "signup-card" : ""}`}>
    <div className="logo">💬</div><h1>{authMode === "signup" ? "Create your account" : "Log in"}</h1><p>{authMode === "signup" ? "One page registration — save your full profile and return anytime." : "Use your email and password to continue."}</p>
    {authMode === "signup" ? <form onSubmit={e => { e.preventDefault(); void createAccount(); }} className="signup-form">
      <div className="signup-photo-row"><Avatar profile={profile} large /><div><label>Profile photo <span className="muted">(optional)</span></label><label className="file-button">{uploading ? "Uploading…" : "📷 Choose profile photo"}<input type="file" accept="image/*" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) void chooseProfilePhoto(f); e.currentTarget.value = ""; }} /></label><small>Guests use an avatar. Accounts can use a profile photo.</small></div></div>
      <input required placeholder="Unique username" value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} />
      <div className="two"><input required type="number" min="13" max="100" placeholder="Age" value={profile.age || ""} onChange={e => setProfile({ ...profile, age: Number(e.target.value) })} /><select required value={profile.gender} onChange={e => changeGender(e.target.value as Gender)}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Neutral</option></select></div>
      <div className="avatar-picker"><label>Choose your avatar</label><div className="avatar-options">{avatarOptions.map(a => <button type="button" key={a} className={profile.avatar === a && !profile.photoURL ? "avatar-choice selected" : "avatar-choice"} onClick={() => setProfile({ ...profile, avatar: a, photoURL: "" })}>{a}</button>)}</div></div>
      <select required value={profile.country} onChange={e => { const c = countries.find(x => x.name === e.target.value); setProfile({ ...profile, country: e.target.value, countryCode: c?.isoCode || "", state: "", stateCode: "" }); }}><option value="">Select country</option>{countries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}</select>
      <select required value={profile.state} disabled={!profileCountry} onChange={e => { const s = profileStates.find(x => x.name === e.target.value); setProfile({ ...profile, state: e.target.value, stateCode: s?.isoCode || "" }); }}><option value="">{profileCountry ? "Select state / province" : "Select country first"}</option>{profileStates.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}</select>
      <input required type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <input required type="password" minLength={6} placeholder="Password (6+ characters)" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="primary" type="submit" disabled={saving || uploading}>{saving ? "Creating account…" : "Create account & Enter Chat Room →"}</button>
    </form> : <div className="login-form"><input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><button className="primary" onClick={() => void login()} disabled={saving}>{saving ? "Logging in…" : "Log in →"}</button></div>}
    <button className="ghost" onClick={() => { setError(""); setAuthMode(authMode === "signup" ? "login" : "signup"); }}>{authMode === "signup" ? "Already have an account? Log in" : "Create a new account"}</button><button className="link" onClick={() => setScreen("home")}>Back to home</button>{error && <div className="error">{error}</div>}
  </section></main>;

  if (screen === "profile") return <main className="app center"><section className="card profile-card"><div className="brand"><span>💬</span><div><b>Stranger Chat</b><small>Meet people worldwide</small></div></div><h1>{profile.username ? "Edit your profile" : "Create your profile"}</h1><p className="muted">Guest users get an avatar. Sign up later to add a profile photo and keep your username.</p><form onSubmit={saveProfile}><input required placeholder="Unique username" value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} /><div className="two"><input required type="number" min="13" max="100" placeholder="Age" value={profile.age || ""} onChange={e => setProfile({ ...profile, age: Number(e.target.value) })} /><select required value={profile.gender} onChange={e => changeGender(e.target.value as Gender)}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Neutral</option></select></div><div className="avatar-control"><Avatar profile={profile} large /><div><label>Choose your avatar</label><div className="avatar-options">{avatarOptions.map(a => <button type="button" key={a} className={profile.avatar === a ? "avatar-choice selected" : "avatar-choice"} onClick={() => setProfile({ ...profile, avatar: a })}>{a}</button>)}</div></div></div><select required value={profile.country} onChange={e => { const c = countries.find(x => x.name === e.target.value); setProfile({ ...profile, country: e.target.value, countryCode: c?.isoCode || "", state: "", stateCode: "" }); }}><option value="">Select country</option>{countries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}</select><select required value={profile.state} disabled={!profileCountry} onChange={e => { const s = profileStates.find(x => x.name === e.target.value); setProfile({ ...profile, state: e.target.value, stateCode: s?.isoCode || "" }); }}><option value="">{profileCountry ? "Select state / province" : "Select country first"}</option>{profileStates.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}</select><button className="primary" disabled={saving}>{saving ? "Entering…" : "Enter Chat Room →"}</button></form>{error && <div className="error">{error}</div>}<button className="ghost" onClick={() => { setAuthMode("signup"); setScreen("auth"); }}>🔐 Sign up & add profile photo</button></section></main>;

  if (screen === "room") return <main className="app room-page"><header className="room-title"><div><b>💬 Stranger Chat</b><small>{filteredProfiles.length} people match your search</small></div><button className="ghost" onClick={() => setScreen("profile")}>My Profile</button></header><div className="room-layout"><section className="people-panel"><div className="filters"><input placeholder="🔎 Search username" value={search} onChange={e => setSearch(e.target.value)} /><select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}><option value="">All genders</option><option>Male</option><option>Female</option><option>Neutral</option></select><select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setStateFilter(""); }}><option value="">All countries</option>{countries.map(c => <option key={c.isoCode}>{c.name}</option>)}</select><select value={stateFilter} disabled={!filterCountry} onChange={e => setStateFilter(e.target.value)}><option value="">{filterCountry ? "All states" : "Select country first"}</option>{filterStates.map(s => <option key={s.isoCode}>{s.name}</option>)}</select></div><div className="people-list">{filteredProfiles.length === 0 ? <div className="empty"><span>👀</span><b>No matching users yet</b><small>Try another search or filter.</small></div> : filteredProfiles.map(p => <button className="person" key={p.uid} onClick={() => { setSelected(p); setScreen("chat"); }}><Avatar profile={p} /><span><b>@{p.username}</b><small>{p.age} · {p.gender} · {p.state}, {p.country}</small></span><i>{p.online ? "●" : "○"}</i></button>)}</div></section><aside className="room-preview"><div className="empty"><span>💬</span><b>Select someone to chat</b><small>Your private conversation will open here.</small></div></aside></div>{error && <div className="toast error">{error}</div>}</main>;

  return <main className="app chat-page"><header className="chat-top"><button className="back" onClick={() => setScreen("room")}>‹</button><Avatar profile={selected} /><div><b>@{selected?.username}</b><small>{selected?.online ? "● Online" : "Offline"} · {selected?.country}</small></div><button className="more" onClick={() => setScreen("profile")}>⋯</button></header><div className="messages">{messages.length === 0 && <div className="empty chat-empty"><span>👋</span><b>Say hello to @{selected?.username}</b><small>Be friendly and start the conversation.</small></div>}{messages.map((m, i) => <div className={`bubble ${m.uid === user?.uid ? "mine" : ""}`} key={`${m.createdAt}-${i}`}>{m.image && <img src={m.image} alt="Shared" />}{m.text && <span>{m.text}</span>}<small>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div><footer className="composer"><label className="icon-btn" title="Send photo">📷<input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImage(f, url => void sendMessage(url)); e.currentTarget.value = ""; }} /></label><button type="button" className="icon-btn" onClick={() => setText(t => `${t}${t ? " " : ""}😊`)} title="Emoji">😊</button><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Write a message…" autoComplete="off" /><button type="button" className="send" disabled={sending || !text.trim()} onClick={() => void sendMessage()}>{sending ? "…" : "➤"}</button></footer>{error && <div className="toast error">{error}</div>}</main>;
}
