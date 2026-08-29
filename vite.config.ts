import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "stranger-chat-brand-and-refresh-fix",
      transform(code, id) {
        if (!id.endsWith("/src/App.tsx")) return;

        let out = code;

        // Rebrand the visible site name without touching the support email address.
        out = out.replaceAll("ChatOnlineMe", "Stranger Chat Now");

        // Keep the current screen after a browser refresh.
        out = out.replace(
          'useState<Screen>("home")',
          'useState<Screen>(() => { try { return (sessionStorage.getItem("stranger_chat_screen") as Screen) || "home"; } catch { return "home"; } })'
        );

        // Keep the selected person so a chat screen can be restored after refresh.
        out = out.replace(
          'useState<Profile|null>(null)',
          'useState<Profile|null>(() => { try { const v = sessionStorage.getItem("stranger_chat_selected"); return v ? JSON.parse(v) as Profile : null; } catch { return null; } })'
        );

        // Rename the React setter internally, then replace all navigation calls with a
        // small wrapper that also remembers the current screen in sessionStorage.
        out = out.replace('[screen,setScreen]', '[screen,__setScreen]');
        out = out.replace(
          /\n  function changeGender\(g:Gender\)/,
          '\n  const navigate = (s:Screen) => { __setScreen(s); try { sessionStorage.setItem("stranger_chat_screen", s); } catch {} };\n  useEffect(() => { try { if (selected) sessionStorage.setItem("stranger_chat_selected", JSON.stringify(selected)); else sessionStorage.removeItem("stranger_chat_selected"); } catch {} }, [selected]);\n  function changeGender(g:Gender)'
        );
        out = out.replaceAll("setScreen(", "navigate(");

        return { code: out, map: null };
      },
    },
  ],
  base: "/online-stranger-chat/",
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
