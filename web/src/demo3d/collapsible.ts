/** Makes every floating menu fold down to its header: click the header (▾) to hide or show the rest. */

const HEADERS = ".title, .head, h4, .inv-head";
const style = document.createElement("style");
style.textContent = `
  .cx-head{cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .cx-head::after{content:"▾";color:var(--muted);font-size:13px;transition:transform .15s}
  .cx-collapsed .cx-head::after{transform:rotate(-90deg)}
  .cx-collapsed > :not(.cx-head){display:none !important}
  .cx-collapsed{gap:0 !important}
`;
document.head.append(style);

const saved: Record<string, boolean> = JSON.parse(localStorage.getItem("demo3d.collapsed") ?? "{}");

function attach(panel: HTMLElement): void {
  if (panel.dataset.cx) return;
  const head = panel.querySelector<HTMLElement>(`:scope > ${HEADERS.split(", ").join(`, :scope > `)}`);
  if (!head) return;
  const key = panel.id || panel.className.replace(/\s*cx-\S+/g, "");
  panel.dataset.cx = "1";
  head.classList.add("cx-head");
  head.removeAttribute("data-act"); // the Atmosphere panel had its own toggle; this replaces it
  panel.classList.remove("min");
  if (saved[key]) panel.classList.add("cx-collapsed");
  head.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button, input, select, a")) return;
    const folded = panel.classList.toggle("cx-collapsed");
    saved[key] = folded;
    localStorage.setItem("demo3d.collapsed", JSON.stringify(saved));
  });
}

function scan(): void {
  for (const p of document.querySelectorAll<HTMLElement>(".panel, .decor")) attach(p);
}

scan();
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
