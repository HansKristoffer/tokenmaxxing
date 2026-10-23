// bun scripts/perf-diff.mjs <dirA> <dirB> [--max 2]: pixel diff of two perf-shots runs, per picture. Exit 1 when one differs by more than --max % of pixels.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const [a, b] = process.argv.slice(2);
const mi = process.argv.indexOf("--max");
const max = mi > 0 ? Number(process.argv[mi + 1]) : 2;
const pw = await import(process.env.PLAYWRIGHT ?? "/Users/nicholaserlin/Desktop/YeetBudget/node_modules/playwright/index.mjs");
const browser = await pw.chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto("about:blank");
let bad = 0;
for (const f of readdirSync(a).filter((x) => x.endsWith(".png")).sort()) {
  let pb;
  try {
    pb = readFileSync(`${b}/${f}`);
  } catch {
    continue;
  }
  const r = await page.evaluate(
    async ([x, y]) => {
      const load = (d) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${d}`; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const get = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
      const A = get(ia).data, B = get(ib).data;
      let sum = 0, big = 0;
      for (let k = 0; k < A.length; k += 4) {
        const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
        sum += d;
        if (d > 90) big++;
      }
      return { mean: sum / (A.length / 4) / 3, big: (big / (A.length / 4)) * 100 };
    },
    [readFileSync(`${a}/${f}`).toString("base64"), pb.toString("base64")],
  );
  const flag = r.big > max;
  if (flag) bad++;
  console.log(`${flag ? "CHECK" : "ok   "} ${f.padEnd(34)} mean ${r.mean.toFixed(2)}  >90: ${r.big.toFixed(2)}%`);
}
await browser.close();
process.exit(bad ? 1 : 0);
