/* Canvas effects: ambient floating hearts/stars + celebration bursts */
(function () {
  const RSU = (window.RSU = window.RSU || {});
  const COLORS = ["#f472b6", "#e6c068", "#a78bfa", "#fb7185", "#f6dc9b", "#fff"];
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = () => Math.min(innerWidth, innerHeight) < 640;

  let cv, ctx, W = 0, H = 0, dpr = 1;
  let parts = [];
  let running = false;
  let ambientOn = false;
  let ambCount = 0;
  let inited = false;

  function ensure() {
    if (inited) return;
    cv = document.getElementById("fx");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.id = "fx";
      cv.setAttribute("aria-hidden", "true");
      document.body.prepend(cv);
    }
    ctx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", RSU.debounce(resize, 150));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) kick();
    });
    inited = true;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function heart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y - s * 0.3, x - s, y - s * 0.3, x - s, y + s * 0.3);
    ctx.bezierCurveTo(x - s, y + s * 0.8, x, y + s * 1.0, x, y + s * 1.3);
    ctx.bezierCurveTo(x, y + s * 1.0, x + s, y + s * 0.8, x + s, y + s * 0.3);
    ctx.bezierCurveTo(x + s, y - s * 0.3, x, y - s * 0.3, x, y + s * 0.3);
    ctx.fill();
  }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function make(o) {
    return Object.assign(
      { x: 0, y: 0, vx: 0, vy: 0, g: 0, s: 8, rot: 0, vr: 0, t: "h", c: COLORS[0], a: 1, life: 0, max: 0, amb: false, sway: 0, ph: Math.random() * 6.28 },
      o
    );
  }
  function spawnAmb() {
    const t = Math.random() < 0.45 ? "h" : Math.random() < 0.6 ? "s" : "d";
    parts.push(
      make({
        x: Math.random() * W, y: H + 20, vy: -(0.25 + Math.random() * 0.6), s: 4 + Math.random() * 8,
        t, c: COLORS[Math.floor(Math.random() * COLORS.length)], a: 0.12 + Math.random() * 0.25,
        amb: true, sway: 0.3 + Math.random() * 0.6, vr: (Math.random() - 0.5) * 0.02
      })
    );
    ambCount++;
  }

  function loop() {
    if (document.hidden) { running = false; return; }
    ctx.clearRect(0, 0, W, H);
    const wantAmb = ambientOn && !reduce;
    const target = isSmall() ? 10 : 22;
    if (wantAmb && ambCount < target && Math.random() < 0.08) spawnAmb();

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.ph += 0.02;
      p.x += p.vx + (p.amb ? Math.sin(p.ph) * p.sway : 0);
      p.y += p.vy;
      p.vy += p.g;
      p.rot += p.vr;
      let alpha = p.a;
      if (!p.amb) {
        p.life++;
        const k = p.life / p.max;
        if (k > 0.6) alpha = p.a * (1 - (k - 0.6) / 0.4);
      }
      const dead = p.amb ? (p.y < -30 || (!wantAmb && p.a < 0.01)) : (p.life >= p.max || p.y > H + 40);
      if (dead) {
        if (p.amb) ambCount--;
        parts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.c;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.t === "h") heart(0, -p.s * 0.6, p.s);
      else if (p.t === "s") star(0, 0, p.s);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.35, 0, 6.283); ctx.fill(); }
      ctx.restore();
    }
    if (parts.length === 0 && !wantAmb) { running = false; return; }
    requestAnimationFrame(loop);
  }
  function kick() {
    if (!inited || running || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }

  RSU.fx = {
    init(opts) {
      ensure();
      this.setAmbient(!opts || opts.ambient !== false);
    },
    setAmbient(on) {
      ensure();
      ambientOn = !!on;
      if (!ambientOn) {
        parts.forEach((p) => { if (p.amb) p.a = 0; });
      }
      kick();
    },
    /** انفجار قلوب ونجوم من نقطة */
    burst(x, y, n) {
      ensure();
      if (reduce) return;
      n = n || (isSmall() ? 14 : 22);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 4.5;
        parts.push(make({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, g: 0.07,
          s: 5 + Math.random() * 8, t: Math.random() < 0.55 ? "h" : "s",
          c: COLORS[Math.floor(Math.random() * COLORS.length)], a: 0.95,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.15, max: 70 + Math.random() * 50
        }));
      }
      kick();
    },
    /** مطر قلوب ونجوم لمدة معينة */
    rain(ms, rate) {
      ensure();
      if (reduce) return;
      const end = Date.now() + (ms || 5000);
      const every = rate || (isSmall() ? 110 : 60);
      const id = setInterval(() => {
        if (Date.now() > end) return clearInterval(id);
        parts.push(make({
          x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 1.2, vy: 1.4 + Math.random() * 2.6,
          s: 6 + Math.random() * 11, t: Math.random() < 0.55 ? "h" : "s",
          c: COLORS[Math.floor(Math.random() * COLORS.length)], a: 0.9,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.08, max: 260
        }));
        kick();
      }, every);
    }
  };
})();
