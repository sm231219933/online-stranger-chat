// Preserve the active field when React remounts a screen during a state update.
type FieldInfo = {
  tag: "input" | "textarea";
  id: string;
  name: string;
  placeholder: string;
  type: string;
  value: string;
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
    value: el.value,
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

  // Match the exact value after React has replaced the DOM node.
  // This handles the profile username field, which intentionally has no id/name.
  const candidates = Array.from(document.querySelectorAll(lastField.tag))
    .filter(isEditable)
    .filter(el => (el instanceof HTMLInputElement ? el.type : "textarea") === lastField!.type);

  const exact = candidates.find(el => el.value === lastField!.value);
  if (exact) return exact;

  // Final fallback for the age number input.
  return candidates[0] || null;
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
  window.setTimeout(restoreNow, 0);
  window.setTimeout(restoreNow, 16);
}

document.addEventListener("focusin", event => remember(event.target as Element), true);
document.addEventListener("input", event => {
  remember(event.target as Element);
  queueRestore();
}, true);

document.addEventListener("change", event => {
  remember(event.target as Element);
  queueRestore();
}, true);

const observer = new MutationObserver(() => {
  if (lastField) queueRestore();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
