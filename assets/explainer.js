/* Shared runtime for masteryau.com theorem explainers.
   Each page defines window.EXPLAINER = { surface, nodes, edges, active } before loading this file. */
(() => {
const CFG = window.EXPLAINER || {};
const root = document.documentElement;

/* ---------------- language ---------------- */
function setLang(l){
  root.dataset.lang = l; root.lang = l === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
  try { localStorage.setItem('masteryau-lang', l); } catch(e) {}
  if (l === 'en') history.replaceState(null, '', '#en');
  else if (location.hash === '#en' || location.hash === '#zh') history.replaceState(null, '', location.pathname);
  buildToc(); renderNote();
}
let saved = null; try { saved = localStorage.getItem('masteryau-lang'); } catch(e) {}
let initial = saved || (/^zh/i.test(navigator.language || 'zh') ? 'zh' : 'en');
if (location.hash === '#en') initial = 'en'; else if (location.hash === '#zh') initial = 'zh';
document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.l)));

/* ---------------- toc + progress ---------------- */
const secs = [...document.querySelectorAll('article section')];
function buildToc(){
  const l = root.dataset.lang, toc = document.getElementById('toc'); if (!toc) return;
  toc.innerHTML = secs.map((s, i) => `<li><a href="#${s.id}" data-s="${s.id}"><span class="n">${i === 0 ? '◈' : i === secs.length - 1 ? '∗' : i}</span>${s.dataset[l === 'zh' ? 'tZh' : 'tEn']}</a></li>`).join('');
}
addEventListener('scroll', () => {
  const h = document.documentElement, bar = document.getElementById('progress');
  if (bar) bar.style.width = (h.scrollTop/(h.scrollHeight - h.clientHeight))*100 + '%';
  let cur = secs[0] && secs[0].id; for (const s of secs) if (s.getBoundingClientRect().top < innerHeight*.35) cur = s.id;
  document.querySelectorAll('#toc a').forEach(a => a.classList.toggle('on', a.dataset.s === cur));
}, { passive: true });

/* ---------------- proof map ---------------- */
const NODES = CFG.nodes || [], EDGES = CFG.edges || [];
let activeNode = CFG.active || (NODES[0] && NODES[0].id);
const NH = 64;
(function buildMap(){
  const svg = document.getElementById('pmap'); if (!svg || !NODES.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a, p = svg) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  const maxY = Math.max(...NODES.map(n => n.y)) + NH + 16;
  svg.setAttribute('viewBox', `0 0 700 ${maxY}`);
  const defs = el('defs', {});
  const mk = el('marker', { id:'arr', viewBox:'0 0 10 10', refX:9, refY:5, markerWidth:7, markerHeight:7, orient:'auto' }, defs);
  el('path', { d:'M0,0 L10,5 L0,10 z', fill:'#d8b46a' }, mk);
  const by = Object.fromEntries(NODES.map(n => [n.id, n]));
  for (const [a, b] of EDGES){
    const A = by[a], B = by[b]; let d;
    if (A.y === B.y){
      const fwd = B.x > A.x, x1 = fwd ? A.x + A.w : A.x, x2 = fwd ? B.x - 4 : B.x + B.w + 4, y = A.y + NH/2;
      d = `M${x1},${y} L${x2},${y}`;
    } else {
      const down = B.y > A.y, x1 = A.x + A.w/2, y1 = down ? A.y + NH : A.y, x2 = B.x + B.w/2, y2 = down ? B.y - 4 : B.y + NH + 4, m = (y1 + y2)/2;
      d = `M${x1},${y1} C${x1},${m} ${x2},${m} ${x2},${y2}`;
    }
    el('path', { class:'ed', d });
  }
  for (const n of NODES){
    const g = el('g', { class:'nd' + (n.key ? ' key' : ''), 'data-id':n.id, tabindex:0, role:'button' });
    el('rect', { x:n.x, y:n.y, width:n.w, height:NH, rx:2 }, g);
    const t = el('text', { x:n.x + n.w/2, y:n.y + 27, 'text-anchor':'middle', class:'lbl' }, g); t.dataset.zh = n.zh; t.dataset.en = n.en;
    const s = el('text', { x:n.x + n.w/2, y:n.y + 48, 'text-anchor':'middle', class:'sm' }, g); s.textContent = n.s || '';
    const pick = () => { activeNode = n.id; renderNote(); };
    g.addEventListener('click', pick); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pick(); } });
  }
})();
function renderNote(){
  const note = document.getElementById('pnote'); if (!note || !NODES.length) return;
  const l = root.dataset.lang || 'zh';
  document.querySelectorAll('#pmap .lbl').forEach(t => t.textContent = t.dataset[l]);
  document.querySelectorAll('#pmap .nd').forEach(g => g.classList.toggle('on', g.dataset.id === activeNode));
  const n = NODES.find(n => n.id === activeNode); note.innerHTML = l === 'zh' ? n.nzh : n.nen;
}
setLang(initial);

/* ---------------- KaTeX ---------------- */
const goMath = () => window.renderMathInElement
  ? renderMathInElement(document.querySelector('article'), { delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}], throwOnError:false })
  : setTimeout(goMath, 60);
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', goMath); else goMath();

/* ---------------- surfaces ---------------- */
const cpow = (re, im, p) => { const r = Math.hypot(re, im), a = Math.atan2(im, re), rp = Math.pow(r, p); return [rp*Math.cos(p*a), rp*Math.sin(p*a)]; };
const cmul = (a, b) => [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]];
function grid(R, C, f, k = 0){ const pts = []; for (let i = 0; i <= R; i++) for (let j = 0; j <= C; j++) pts.push(f(i/R, j/C)); return { R, C, pts, k }; }
const small = innerWidth < 700;

const SURFACES = {
  /* Fermat quintic slice, Hanson projection */
  'calabi-yau': (() => {
    const N = 5, G = small ? 9 : 12, XI = 1.15, base = [];
    for (let k1 = 0; k1 < N; k1++) for (let k2 = 0; k2 < N; k2++){
      const p1 = [Math.cos(2*Math.PI*k1/N), Math.sin(2*Math.PI*k1/N)], p2 = [Math.cos(2*Math.PI*k2/N), Math.sin(2*Math.PI*k2/N)];
      base.push(grid(G, G, (a, b) => {
        const x = -XI + 2*XI*a, y = (Math.PI/2)*b;
        const ch = [Math.cosh(x)*Math.cos(y), Math.sinh(x)*Math.sin(y)], sh = [Math.sinh(x)*Math.cos(y), Math.cosh(x)*Math.sin(y)];
        const z1 = cmul(p1, cpow(ch[0], ch[1], 2/N)), z2 = cmul(p2, cpow(sh[1], -sh[0], 2/N));
        return [z1[0], z1[1], z2[0], z2[1]];
      }, k1*N + k2));
    }
    return { scale:1, sample(t){ const al = 0.8 + 0.35*Math.sin(t*.00018), ca = Math.cos(al), sa = Math.sin(al);
      return base.map(g => ({ R:g.R, C:g.C, k:g.k, pts:g.pts.map(v => [v[0], v[2], ca*v[1] + sa*v[3]]) })); } };
  })(),
  /* Einstein–Rosen bridge: spatial slice of Schwarzschild (Flamm's paraboloid), both sheets */
  'flamm': (() => {
    const M = .5, W = 2.3, g = grid(small ? 16 : 24, small ? 24 : 36, (a, b) => {
      const w = -W + 2*W*a, th = 2*Math.PI*b, r = 2*M + w*w/(8*M);
      return [r*Math.cos(th)*.55, w*.5, r*Math.sin(th)*.55];
    });
    return { scale:.85, sample(){ return [g]; } };
  })(),
  /* Heat kernel spreading on the plane */
  'heat': (() => {
    const R = small ? 26 : 40;
    return { scale:1.05, pitch:-.42, yaw:.6, sample(t){
      const tau = .06 + .55*(.5 - .5*Math.cos(t*.0006));
      const amp = Math.min(.9/Math.sqrt(tau), 3);
      return [grid(R, R, (a, b) => { const x = -3 + 6*a, y = -3 + 6*b, h = amp*Math.exp(-(x*x + y*y)/(4*tau));
        return [x*.42, h*.55 - .5, y*.42]; })];
    } };
  })(),
  /* Two linked tori: a picture of bundles and connections */
  'bundle': (() => {
    const R1 = 1, r = .32, G1 = small ? 30 : 44, G2 = small ? 10 : 14;
    const A = grid(G1, G2, (a, b) => { const u = 2*Math.PI*a, v = 2*Math.PI*b; return [(R1 + r*Math.cos(v))*Math.cos(u) - .5, r*Math.sin(v), (R1 + r*Math.cos(v))*Math.sin(u)]; }, 0);
    const B = grid(G1, G2, (a, b) => { const u = 2*Math.PI*a, v = 2*Math.PI*b; return [(R1 + r*Math.cos(v))*Math.cos(u) + .5, (R1 + r*Math.cos(v))*Math.sin(u), r*Math.sin(v)]; }, 7);
    return { scale:.95, sample(){ return [A, B]; } };
  })(),
  /* A torus fibration degenerating at the ends of its base */
  'syz': (() => {
    const n = 9, out = [];
    for (let i = 0; i < n; i++){
      const s = i/(n - 1), cx = -2 + 4*s, cy = .3*Math.sin(Math.PI*s) - .1, sh = Math.sin(Math.PI*s);
      const rr = .12*sh**.9 + .01, RR = .28*sh**.45 + .025;
      out.push(grid(small ? 18 : 26, small ? 8 : 10, (a, b) => { const u = 2*Math.PI*a, v = 2*Math.PI*b;
        return [cx + (RR + rr*Math.cos(v))*Math.cos(u), cy + rr*Math.sin(v), (RR + rr*Math.cos(v))*Math.sin(u)]; }, i));
    }
    return { scale:1.1, pitch:-.45, yaw:.12, sample(){ return out; } };
  })(),
  /* Catenoid ↔ helicoid: the associate family of minimal surfaces */
  'catenoid': (() => {
    const R = small ? 22 : 32, C = small ? 10 : 14;
    return { scale:1.2, sample(t){
      const al = (Math.PI/2)*(.5 + .5*Math.sin(t*.0005)), ca = Math.cos(al), sa = Math.sin(al);
      return [grid(R, C, (a, b) => { const u = -Math.PI + 2*Math.PI*a, v = -1.25 + 2.5*b;
        const x = ca*Math.sinh(v)*Math.sin(u) + sa*Math.cosh(v)*Math.cos(u), y = -ca*Math.sinh(v)*Math.cos(u) + sa*Math.cosh(v)*Math.sin(u), z = u*ca + v*sa;
        return [x*.55, z*.42, y*.55]; })];
    } };
  })()
};

(function hero(){
  const cv = document.getElementById('cy'); if (!cv) return;
  const S0 = SURFACES[CFG.surface || 'calabi-yau'], ctx = cv.getContext('2d');
  let W, H;
  function resize(){ const d = Math.min(devicePixelRatio||1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W*d; cv.height = H*d; ctx.setTransform(d,0,0,d,0,0); }
  addEventListener('resize', resize); resize();
  let yaw = S0.yaw ?? 0.9, pitch = S0.pitch ?? 0.3, vy = 0.002, drag = false, lx = 0, ly = 0, vis = true;
  new IntersectionObserver(es => vis = es[0].isIntersecting).observe(cv);
  cv.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; yaw += (e.clientX-lx)*.008; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY-ly)*.008)); vy = (e.clientX-lx)*.0008; lx = e.clientX; ly = e.clientY; });
  cv.addEventListener('pointerup', () => drag = false);
  const Ln = Math.hypot(-0.4, -0.7, 0.6), L = [-0.4/Ln, -0.7/Ln, 0.6/Ln], Q = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function frame(t){
    requestAnimationFrame(frame); if (!vis) return;
    if (!drag && !reduce){ yaw += vy; vy += (0.002 - vy)*.01; }
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cx0 = W > 900 ? W*.7 : W*.5, cy0 = W > 900 ? H*.44 : H*.3, S = Math.min(W, H)*(W > 900 ? .18 : .16)*S0.scale, F = 4.2;
    ctx.clearRect(0, 0, W, H); Q.length = 0;
    for (const P of S0.sample(reduce ? 0 : t)){
      const C1 = P.C + 1;
      const pr = P.pts.map(([x, y, z]) => { const x1 = cy*x + sy*z, z1 = -sy*x + cy*z, y1 = cp*y - sp*z1, z2 = sp*y + cp*z1, s = F/(F + z2); return [x1, y1, z2, cx0 + x1*S*s, cy0 - y1*S*s]; });
      for (let i = 0; i < P.R; i++) for (let j = 0; j < P.C; j++){
        const a = pr[i*C1+j], b = pr[(i+1)*C1+j], c = pr[(i+1)*C1+j+1], d = pr[i*C1+j+1];
        const ux = c[0]-a[0], uy = c[1]-a[1], uz = c[2]-a[2], vx = d[0]-b[0], vy2 = d[1]-b[1], vz = d[2]-b[2];
        const nx = uy*vz-uz*vy2, ny = uz*vx-ux*vz, nz = ux*vy2-uy*vx, nl = Math.hypot(nx, ny, nz) || 1;
        Q.push({ z:(a[2]+b[2]+c[2]+d[2])/4, a, b, c, d, lam:Math.abs((nx*L[0]+ny*L[1]+nz*L[2])/nl), k:P.k });
      }
    }
    Q.sort((p, q) => q.z - p.z);
    for (const q of Q){
      const dep = Math.max(0, Math.min(1, (1.6 - q.z)/3.2)), hue = 34 + (q.k%5)*3 - Math.floor(q.k/5)*2;
      ctx.beginPath(); ctx.moveTo(q.a[3], q.a[4]); ctx.lineTo(q.b[3], q.b[4]); ctx.lineTo(q.c[3], q.c[4]); ctx.lineTo(q.d[3], q.d[4]); ctx.closePath();
      ctx.fillStyle = `hsla(${hue},${48+q.lam*20}%,${14+q.lam*52+dep*10}%,${.5+dep*.4})`; ctx.fill();
      ctx.strokeStyle = `hsla(42,70%,${60+q.lam*25}%,${.08+dep*.2})`; ctx.lineWidth = .6; ctx.stroke();
    }
  })(0);
})();
})();
