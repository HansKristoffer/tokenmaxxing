// Injected before any page script (scripts/perf-harness.mjs). Counts WebGL work without touching the app, so the
// same numbers come out of any renderer version. Hardware independent: draw calls, triangles, bytes, live objects.
(() => {
  // A fixed seed so wandering folk and weather repeat run to run.
  let s = 1234567;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const P = {
    draws: 0, tris: 0, instances: 0, programsUsed: new Set(), texBytes: 0, bufBytes: 0, rbBytes: 0,
    live: { texture: 0, buffer: 0, program: 0, framebuffer: 0, renderbuffer: 0, vao: 0 },
    created: { texture: 0, buffer: 0, program: 0 },
    texUploads: 0, gpuMs: [], timing: false, rafMs: [], gaps: [], frames: 0, cb: 0, longTasks: 0, gcs: 0,
  };
  window.__probe = P;
  const trisOf = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    const wrap = (name, fn) => {
      const o = p[name];
      if (o) p[name] = function (...a) { if (!P.gl && this.canvas) P.gl = this; fn.call(this, a); return o.apply(this, a); };
    };
    wrap("drawElements", (a) => { P.draws++; P.tris += trisOf(a[0], a[1]); });
    wrap("drawArrays", (a) => { P.draws++; P.tris += trisOf(a[0], a[2]); });
    wrap("drawElementsInstanced", (a) => { P.draws++; P.instances += a[4]; P.tris += trisOf(a[0], a[1]) * a[4]; });
    wrap("drawArraysInstanced", (a) => { P.draws++; P.instances += a[3]; P.tris += trisOf(a[0], a[2]) * a[3]; });
    wrap("drawRangeElements", (a) => { P.draws++; P.tris += trisOf(a[0], a[4]); });
    wrap("useProgram", (a) => { if (a[0]) P.programsUsed.add(a[0]); });
    wrap("drawElements", () => {});
    // Live bytes per object: set on upload, dropped on delete, so rebuilds and leaks show as they are.
    const bytes = new WeakMap();
    const bound = { tex: new Map(), buf: new Map(), rb: null };
    const BPP = { 6408: 4, 6407: 3, 6403: 1, 33319: 2, 6406: 1, 6409: 1, 6410: 2, 6402: 4, 34041: 4, 34842: 8, 35898: 4 };
    const setBytes = (kind, obj, n) => {
      if (!obj) return;
      P[kind] += n - (bytes.get(obj) ?? 0);
      bytes.set(obj, n);
    };
    wrap("bindTexture", (a) => bound.tex.set(a[0], a[1]));
    wrap("bindBuffer", (a) => bound.buf.set(a[0], a[1]));
    wrap("bindRenderbuffer", (a) => (bound.rb = a[1]));
    wrap("bufferData", (a) => { const d = a[1]; setBytes("bufBytes", bound.buf.get(a[0]), typeof d === "number" ? d : d.byteLength ?? 0); });
    const levelBytes = (target, level, w, h, ifmt, fmt, type) => {
      const t = bound.tex.get(target);
      if (!t) return;
      let bpp = type === 5131 || ifmt === 34842 ? 8 : type === 5126 ? (ifmt === 33326 ? 4 : 16) : (BPP[ifmt] ?? BPP[fmt] ?? 4);
      if (ifmt === 36012 || ifmt === 33326) bpp = 4;
      const n = w * h * bpp;
      t.__lv ??= {};
      const per = t.__lv;
      per[level] = n;
      let sum = 0;
      for (const k in per) sum += per[k];
      setBytes("texBytes", t, sum);
    };
    wrap("texImage2D", (a) => {
      P.texUploads++;
      { const w = a.length >= 9 ? a[3] : a[5]?.width ?? 0, h = a.length >= 9 ? a[4] : a[5]?.height ?? 0; if (a[1] === 0) { const k = `${w}x${h}`; P.sizes ??= {}; P.sizes[k] = (P.sizes[k] ?? 0) + 1; } if (w * h >= 262144) { P.big ??= []; P.big.push(["img", a[0], a[1], w, h, a[2]]); } }
      const [w, h] = a.length >= 9 ? [a[3], a[4]] : [a[5]?.width ?? 0, a[5]?.height ?? 0];
      levelBytes(a[0], a[1], w, h, a[2], a.length >= 9 ? a[6] : a[3], a.length >= 9 ? a[7] : a[4]);
    });
    wrap("texStorage2D", (a) => {
      if (a[3] * a[4] >= 262144) {
        P.big ??= [];
        P.big.push(["storage", a[0], a[1], a[3], a[4], a[2]]);
      }
      const t = bound.tex.get(a[0]);
      if (!t) return;
      const bpp = a[2] === 34842 || a[2] === 36012 ? 8 : a[2] === 33326 ? 4 : a[2] === 35056 ? 4 : 4;
      let sum = 0, w = a[3], h = a[4];
      for (let l = 0; l < a[1]; l++) { sum += w * h * bpp; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
      setBytes("texBytes", t, sum);
    });
    wrap("generateMipmap", (a) => { const t = bound.tex.get(a[0]); if (t) { const base = t.__lv?.[0] ?? 0; if (base) setBytes("texBytes", t, base * 1.34); } });
    wrap("renderbufferStorageMultisample", (a) => {
      P.big ??= [];
      P.big.push(["rbms", a[1], a[3], a[4], a[2]]);
      return 0;
    });
    wrap("renderbufferStorageMultisample", (a) => setBytes("rbBytes", bound.rb, a[3] * a[4] * 4 * Math.max(1, a[1]) * (a[2] === 34842 ? 2 : 1)));
    wrap("renderbufferStorage", (a) => setBytes("rbBytes", bound.rb, a[2] * a[3] * 4));
    const sizeKind = { texture: "texBytes", buffer: "bufBytes", renderbuffer: "rbBytes" };
    for (const k of ["texture", "buffer", "program", "framebuffer", "renderbuffer"]) {
      const cap = k[0].toUpperCase() + k.slice(1);
      wrap(`create${cap}`, () => { P.live[k]++; if (P.created[k] !== undefined) P.created[k]++; });
      const o = p[`delete${cap}`];
      if (o)
        p[`delete${cap}`] = function (obj) {
          P.live[k]--;
          if (obj && sizeKind[k]) setBytes(sizeKind[k], obj, 0);
          return o.call(this, obj);
        };
    }
  }
  // Frames: time between rAF callbacks, and how long the app's own callbacks took (CPU side).
  const raf = window.requestAnimationFrame.bind(window);
  let ext = null;
  const pending = [];
  const timer = () => {
    const gl = P.gl;
    if (!gl || !gl.createQuery) return null;
    ext ??= gl.getExtension("EXT_disjoint_timer_query_webgl2") ?? false;
    return ext || null;
  };
  const collect = () => {
    const gl = P.gl;
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) P.gpuMs.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
  };
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const t0 = performance.now();
      let q = null;
      if (P.timing && timer() && pending.length < 6) {
        collect();
        q = P.gl.createQuery();
        P.gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      }
      if (P.last) P.gaps.push(t0 - P.last);
      P.last = t0;
      cb(t);
      if (q) {
        P.gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push(q);
      }
      P.rafMs.push(performance.now() - t0);
      P.frames++;
    });
  try {
    new PerformanceObserver((l) => { P.longTasks += l.getEntries().length; }).observe({ entryTypes: ["longtask"] });
  } catch {}
  P.reset = () => {
    P.draws = P.tris = P.instances = P.frames = P.texUploads = 0;
    P.rafMs = []; P.gaps = []; P.gpuMs = []; P.programsUsed = new Set(); P.longTasks = 0;
  };
})();
