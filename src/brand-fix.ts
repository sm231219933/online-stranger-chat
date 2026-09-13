const OLD_BRAND = "ChatOnlineMe";
const NEW_BRAND = "Stranger Chat Now";

function replaceBrandText(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(textNode => {
    if (textNode.nodeValue?.includes(OLD_BRAND)) {
      textNode.nodeValue = textNode.nodeValue.replaceAll(OLD_BRAND, NEW_BRAND);
    }
  });
}

const startBrandFix = () => {
  const root = document.getElementById("root");
  if (!root) return;
  replaceBrandText(root);
  const observer = new MutationObserver(() => replaceBrandText(root));
  observer.observe(root, { childList: true, subtree: true, characterData: true });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startBrandFix, { once: true });
} else {
  startBrandFix();
}
