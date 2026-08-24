// Keeps form fields focused when a parent component is re-mounted after each keystroke.
// This is intentionally limited to text-like inputs and textareas.
let lastField: { tag: string; id: string; name: string; placeholder: string; type: string } | null = null;
let restoring = false;

function remember(el: Element) {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
  if (el instanceof HTMLInputElement && !["text", "email", "password", "number", "search", "tel", "url"].includes(el.type)) return;
  lastField = {
    tag: el.tagName,
    id: el.id,
    name: el.getAttribute("name") || "",
    placeholder: el.getAttribute("placeholder") || "",
    type: el instanceof HTMLInputElement ? el.type : "textarea",
  };
}

function restore() {
  if (!lastField || restoring) return;
  const selector = lastField.id
    ? `#${CSS.escape(lastField.id)}`
    : lastField.name
      ? `${lastField.tag.toLowerCase()}[name="${CSS.escape(lastField.name)}"]`
      : lastField.placeholder
        ? `${lastField.tag.toLowerCase()}[placeholder="${CSS.escape(lastField.placeholder)}"]`
        : null;
  if (!selector) return;
  const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el || document.activeElement === el) return;

  restoring = true;
  el.focus({ preventScroll: true });
  try {
    const end = el.value.length;
    el.setSelectionRange(end, end);
  } catch {
    // Some input types/browsers do not expose selection ranges.
  }
  restoring = false;
}

document.addEventListener("focusin", (event) => remember(event.target as Element), true);
document.addEventListener("input", () => requestAnimationFrame(restore), true);
