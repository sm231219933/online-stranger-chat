// Keep the active form field focused if React replaces that DOM node during a render.
// This is intentionally limited to editable inputs and textareas.
type FieldInfo = {
  tag: "input" | "textarea";
  id: string;
  name: string;
  placeholder: string;
  type: string;
};

let lastField: FieldInfo | null = null;
let restoring = false;
let restoreQueued = false;

function isEditable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement && !["text", "email", "password", "number", "search", "tel", "url"].includes(el.type)) return false;
  return !el.disabled && !el.readOnly;
}

function remember(el: Element | null) {
  if (!isEditable(el)) return;
  lastField = {
    tag: el instanceof HTMLTextAreaElement ? "textarea" : "input",
    id: el.id,
    name: el.getAttribute("name") || "",
    placeholder: el.getAttribute("placeholder") || "",
    type: el instanceof HTMLInputElement ? el.type : "textarea",
  };
}

function findField() {
  if (!lastField) return null;

  const selector = lastField.id
    ? `#${CSS.escape(lastField.id)}`
    : lastField.name
      ? `${lastField.tag}[name="${CSS.escape(lastField.name)}"]`
      : lastField.placeholder
        ? `${lastField.tag}[placeholder="${CSS.escape(lastField.placeholder)}"]`
        : null;

  if (selector) {
    const el = document.querySelector(selector);
    if (isEditable(el)) return el;
  }

  // Some fields (notably the Age number input) have no id/name/placeholder.
  // Use their stable HTML type as a fallback instead of losing the cursor.
  if (lastField.tag === "textarea") {
    const el = document.querySelector("textarea");
    if (isEditable(el)) return el;
  } else {
    const el = document.querySelector(`input[type="${CSS.escape(lastField.type)}"]`);
    if (isEditable(el)) return el;
  }

  return null;
}

function restoreNow() {
  if (!lastField || restoring) return;
  const el = findField();
  if (!el || document.activeElement === el) return;

  restoring = true;
  try {
    el.focus({ preventScroll: true });
    const end = el.value.length;
    if (typeof (el as HTMLInputElement).setSelectionRange === "function") {
      (el as HTMLInputElement).setSelectionRange(end, end);
    }
  } finally {
    restoring = false;
  }
}

function queueRestore() {
  if (restoreQueued) return;
  restoreQueued = true;
  queueMicrotask(() => {
    restoreQueued = false;
    restoreNow();
  });
  requestAnimationFrame(restoreNow);
}

document.addEventListener("focusin", event => remember(event.target as Element), true);
document.addEventListener("input", event => {
  remember(event.target as Element);
  queueRestore();
}, true);

const observer = new MutationObserver(() => {
  if (lastField && document.activeElement !== findField()) queueRestore();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
