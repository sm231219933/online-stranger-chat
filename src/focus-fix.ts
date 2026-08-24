// Preserve the field that the user is actively editing when React replaces a screen subtree.
// The old fix waited for animation frames, which can be too late on mobile browsers.
let lastField: { tag: "input" | "textarea"; id: string; name: string; placeholder: string; type: string } | null = null;
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
  if (!selector) return null;
  const el = document.querySelector(selector);
  return isEditable(el) ? el : null;
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

// React can remove the focused input and create its replacement in the same update.
// Watching the DOM lets us restore focus immediately instead of waiting for another tap.
const observer = new MutationObserver(() => {
  if (lastField && document.activeElement !== findField()) queueRestore();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
