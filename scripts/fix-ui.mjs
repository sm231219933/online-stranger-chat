import fs from "node:fs";

const appPath = "src/App.tsx";
const cssPath = "src/styles.css";

let app = fs.readFileSync(appPath, "utf8");

// patch-app.mjs injects the logout control into the room. Keep exactly one.
app = app.replace(
  /(<button className="ghost" onClick=\{\(\)=>setScreen\("profile"\)\}>My Profile<\/button>)(<button className="ghost" onClick=\{\(\)=>void logout\(\)\}>Logout<\/button>)+/,
  "$1<button className=\"ghost\" onClick={()=>void logout()}>Logout</button>"
);

// Local screen components are recreated on every keystroke. Use uncontrolled text/number
// inputs and commit their values on blur so the cursor no longer jumps after one character.
app = app.replace(
  'value={profile.username} onChange={e=>setProfile(p=>({...p,username:e.target.value}))}',
  'defaultValue={profile.username} onBlur={e=>setProfile(p=>({...p,username:e.currentTarget.value}))}'
);
app = app.replace(
  'value={profile.age||""} onChange={e=>setProfile(p=>({...p,age:Number(e.target.value)}))}',
  'defaultValue={profile.age||""} onBlur={e=>setProfile(p=>({...p,age:Number(e.currentTarget.value)}))}'
);
app = app.replace(
  'value={email} onChange={e=>setEmail(e.target.value)}',
  'defaultValue={email} onBlur={e=>setEmail(e.currentTarget.value)}'
);
app = app.replace(
  'value={password} onChange={e=>setPassword(e.target.value)}',
  'defaultValue={password} onBlur={e=>setPassword(e.currentTarget.value)}'
);

// Make the chosen avatar visible in the dropdown summary and preserve the working selection.
app = app.replace(
  '<details className="avatar-dropdown"><summary>😀 Choose avatar</summary>',
  '<details className="avatar-dropdown"><summary>😀 Choose avatar <span>{profile.avatar}</span></summary>'
);

fs.writeFileSync(appPath, app);

let css = fs.readFileSync(cssPath, "utf8");
const fixes = `

/* ChatOnlineMe UI stability fixes */
/* A page must have one site footer only, even if an older nested shell is present. */
.site-shell .site-shell .site-footer,
.site-footer + .site-footer { display:none !important; }

/* The chat is an app-like screen: its website footer must never overlap the composer. */
.chat-page-shell .site-footer,
.room-page .site-footer { display:none !important; }
.chat-page-shell { min-height:100dvh; height:100dvh; overflow:hidden; }
.chat-page-shell .chat-page { min-height:calc(100dvh - 1px); height:calc(100dvh - 1px); overflow:hidden; }
.chat-page-shell .messages { min-height:0; }

/* Keep the mobile composer above the browser safe area. */
@media (max-width:760px){
  .chat-page-shell .chat-page { height:100dvh; min-height:100dvh; }
  .chat-page-shell .composer { padding-bottom:calc(12px + env(safe-area-inset-bottom)); }
}

/* Avatar dropdown selection feedback. */
.avatar-dropdown summary span { margin-left:8px; font-size:1.25em; }
`;
if (!css.includes("/* ChatOnlineMe UI stability fixes */")) {
  css += fixes;
  fs.writeFileSync(cssPath, css);
}
