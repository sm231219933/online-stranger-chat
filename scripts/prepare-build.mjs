import fs from "node:fs";

const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");

// Only apply deterministic, syntax-safe fixes needed before the production build.
s = s.replaceAll("ChatOnlineMe", "Stranger Chat Now");
s = s.replace(
  'setError(`Chat error: ${e.message}`)},[user,selected]);',
  'setError(`Chat error: ${e.message}`))},[user,selected]);'
);

// Load the requested profile layout/mobile-avatar fixes without changing app behavior.
if (!s.includes('import "./fixes.css";')) {
  s = s.replace('import "./pages.css";', 'import "./pages.css";\nimport "./fixes.css";');
}

// Preserve focus/cursor when React remounts a form control during typing.
if (!s.includes('scnFocusObserver')) {
  const marker = 'const previousMessageCount=useRef(0);';
  const focusFix = `const previousMessageCount=useRef(0);\n  useEffect(()=>{\n    let last:{tag:string;placeholder:string;selectionStart:number;selectionEnd:number}|null=null;\n    const remember=(event:Event)=>{const el=event.target;if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){last={tag:el.tagName,placeholder:el.getAttribute("placeholder")||"",selectionStart:el.selectionStart??el.value.length,selectionEnd:el.selectionEnd??el.value.length}}};\n    const onFocus=(event:Event)=>remember(event);\n    const scnFocusObserver=new MutationObserver(()=>{if(!last)return;const active=document.activeElement;if(active&&active!==document.body)return;const controls=Array.from(document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>("input,textarea"));const el=controls.find(x=>x.tagName===last!.tag&&x.getAttribute("placeholder")===last!.placeholder);if(el){el.focus();const max=el.value.length;const start=Math.min(last!.selectionStart,max),end=Math.min(last!.selectionEnd,max);try{el.setSelectionRange(start,end)}catch{}}});\n    document.addEventListener("focusin",onFocus,true);document.addEventListener("input",remember,true);scnFocusObserver.observe(document.body,{childList:true,subtree:true});\n    return()=>{document.removeEventListener("focusin",onFocus,true);document.removeEventListener("input",remember,true);scnFocusObserver.disconnect()};\n  },[]);`;
  if (s.includes(marker)) s = s.replace(marker, focusFix);
}

fs.writeFileSync(p, s);
