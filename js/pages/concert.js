/* concert.html — My Dream Concert (تذكرة افتراضية تجريبية) */
RSU.boot({ page: "concert" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;

  app.innerHTML = ui.loading("بنطبع تذكرتك…");
  const content = await RSU.data.content.all();
  const c = content.concert;
  const a = content.artist;
  const imgUrl = RSU.safeUrl(a.concert_image || a.hero_image || "");

  // رقم تذكرة ومقعد ثابتين لكل مستخدمة (زخرفيين)
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const seed = hash(ctx.user.id);
  const ticketNo = "DEMO-" + String(seed % 1000000).padStart(6, "0");
  const seat = "VIP · " + String.fromCharCode(65 + (seed % 6)) + "-" + (1 + ((seed >> 3) % 40));

  app.innerHTML =
    RSU.pageHead("My Dream Concert", "تذكرتك الافتراضية للحفلة اللي بتحلمي بيها 🎤 — تجربة للترفيه فقط.", "ticket") +
    '<div class="ticket-layout"><div class="ticket-stage"><canvas id="ticket" width="1200" height="520" role="img" aria-label="تذكرة حفلة افتراضية"></canvas></div>' +
    '<div class="glass card ticket-panel"><h3>خصّصي تذكرتك</h3>' +
    '<label class="field"><span>الاسم على التذكرة</span><input class="input" id="t-name" maxlength="30" value="' + esc(ctx.profile.display_name) + '" /></label>' +
    '<button class="btn btn-primary btn-lg" id="t-download" style="width:100%">' + RSU.icon("download") + " تحميل التذكرة كصورة</button>" +
    '<p class="hint" style="margin-top:12px">' + RSU.icon("info") + " " + esc(c.note) + "</p>" +
    (imgUrl ? "" : '<p class="hint">' + (ctx.isAdmin ? "ضيفي صورة للتذكرة من لوحة الإدارة ← المحتوى." : "صورة الفنان هتظهر على التذكرة أول ما تتضاف.") + "</p>") +
    "</div></div>";
  RSU.hydrateIcons(app);

  const cv = app.querySelector("#ticket");
  const g = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  let photo = null;

  function loadPhoto() {
    return new Promise((resolve) => {
      if (!imgUrl) return resolve(null);
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = imgUrl;
    });
  }

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function fit(text, maxW, size, weight) {
    let s = size;
    do { g.font = weight + " " + s + 'px Cairo, Tajawal, "Segoe UI", Tahoma, sans-serif'; s -= 2; } while (g.measureText(text).width > maxW && s > 12);
  }
  function rng(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function drawQR(x, y, size) {
    const N = 29, m = size / N, rand = rng(seed);
    g.fillStyle = "#fff";
    rr(x - 12, y - 12, size + 24, size + 24, 14); g.fill();
    g.fillStyle = "#14082b";
    const inFinder = (i, j) => (i < 8 && j < 8) || (i > N - 9 && j < 8) || (i < 8 && j > N - 9);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (inFinder(i, j)) continue;
      if (rand() > 0.5) g.fillRect(x + i * m, y + j * m, m + 0.4, m + 0.4);
    }
    [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([i, j]) => {
      g.fillStyle = "#14082b"; g.fillRect(x + i * m, y + j * m, 7 * m, 7 * m);
      g.fillStyle = "#fff"; g.fillRect(x + (i + 1) * m, y + (j + 1) * m, 5 * m, 5 * m);
      g.fillStyle = "#14082b"; g.fillRect(x + (i + 2) * m, y + (j + 2) * m, 3 * m, 3 * m);
    });
    // قلب في النص + شريط يوضح إنه زخرفي
    g.fillStyle = "#db2777"; g.font = "700 40px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#fff"; g.fillRect(x + size / 2 - 26, y + size / 2 - 26, 52, 52);
    g.fillStyle = "#db2777"; g.fillText("♥", x + size / 2, y + size / 2 + 2);
  }

  async function draw(withPhoto) {
    try { await document.fonts.load('700 40px Cairo'); await document.fonts.ready; } catch (e) {}
    g.clearRect(0, 0, W, H);
    g.direction = "rtl";
    g.textBaseline = "alphabetic";

    // الخلفية
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#1b0a3a"); bg.addColorStop(0.55, "#0d0919"); bg.addColorStop(1, "#2a0d3f");
    rr(0, 0, W, H, 38); g.fillStyle = bg; g.fill();
    const glow = g.createRadialGradient(W * 0.75, H * 0.2, 10, W * 0.75, H * 0.2, 520);
    glow.addColorStop(0, "rgba(244,114,182,0.28)"); glow.addColorStop(1, "rgba(244,114,182,0)");
    g.save(); rr(0, 0, W, H, 38); g.clip(); g.fillStyle = glow; g.fillRect(0, 0, W, H); g.restore();

    // نجوم صغيرة
    const rs = rng(7);
    g.fillStyle = "rgba(246,220,155,0.7)";
    for (let i = 0; i < 46; i++) { g.beginPath(); g.arc(340 + rs() * 520, 20 + rs() * 480, rs() * 1.8 + 0.4, 0, 6.3); g.fill(); }

    // الإطار الذهبي
    const gold = g.createLinearGradient(0, 0, W, 0);
    gold.addColorStop(0, "#f6dc9b"); gold.addColorStop(0.5, "#e6c068"); gold.addColorStop(1, "#b8892b");
    rr(8, 8, W - 16, H - 16, 32); g.lineWidth = 3; g.strokeStyle = gold; g.stroke();

    // الصورة (يمين)
    const px = 880, py = 44, pw = 276, ph = 432;
    g.save(); rr(px, py, pw, ph, 28); g.clip();
    if (withPhoto && photo) {
      const r = Math.max(pw / photo.width, ph / photo.height);
      const w = photo.width * r, h = photo.height * r;
      g.drawImage(photo, px + (pw - w) / 2, py + (ph - h) / 2, w, h);
    } else {
      const pg = g.createLinearGradient(px, py, px + pw, py + ph);
      pg.addColorStop(0, "#6d28d9"); pg.addColorStop(1, "#db2777");
      g.fillStyle = pg; g.fillRect(px, py, pw, ph);
      g.fillStyle = "rgba(255,255,255,0.9)"; g.textAlign = "center"; g.font = "700 150px sans-serif"; g.fillText("♪", px + pw / 2, py + ph / 2 + 30);
    }
    const fade = g.createLinearGradient(0, py + ph - 120, 0, py + ph);
    fade.addColorStop(0, "rgba(13,9,25,0)"); fade.addColorStop(1, "rgba(13,9,25,0.85)");
    g.fillStyle = fade; g.fillRect(px, py, pw, ph);
    g.restore();
    rr(px, py, pw, ph, 28); g.lineWidth = 2; g.strokeStyle = "rgba(246,220,155,0.8)"; g.stroke();
    g.textAlign = "center"; g.fillStyle = "#fff"; fit(a.name, pw - 30, 34, 800); g.fillText(a.name, px + pw / 2, py + ph - 24);

    // النصوص (محاذاة لليمين)
    const R = 838, maxW = 480;
    g.textAlign = "right";
    g.fillStyle = "#e6c068"; g.font = '700 24px Cairo, Tajawal, "Segoe UI", sans-serif'; g.fillText("تذكرة حفل افتراضية", R, 92);
    const tg = g.createLinearGradient(R - 460, 0, R, 0);
    tg.addColorStop(0, "#f472b6"); tg.addColorStop(0.5, "#f6dc9b"); tg.addColorStop(1, "#e6c068");
    g.fillStyle = tg; fit(c.title, maxW, 66, 800); g.fillText(c.title, R, 168);
    g.fillStyle = "#fff"; fit("مع " + a.name, maxW, 34, 700); g.fillText("مع " + a.name, R, 222);

    g.fillStyle = "#b9aed1"; g.font = '600 20px Cairo, Tajawal, "Segoe UI", sans-serif'; g.fillText("صاحبة التذكرة", R, 290);
    const holder = (document.getElementById("t-name").value || "").trim() || ctx.profile.display_name || "—";
    g.fillStyle = "#fff"; fit(holder, maxW, 46, 800); g.fillText(holder, R, 340);

    g.fillStyle = "#f6dc9b"; fit(c.date_label, maxW, 24, 700); g.fillText(c.date_label, R, 392);
    g.fillStyle = "#b9aed1"; fit(c.venue, maxW, 22, 600); g.fillText(c.venue + " · " + seat, R, 428);
    g.fillStyle = "#fb7185"; fit(c.note, 520, 17, 700); g.fillText(c.note, R, 478);

    // خط التقطيع + الكعب
    g.setLineDash([10, 9]); g.lineWidth = 2; g.strokeStyle = "rgba(246,220,155,0.6)";
    g.beginPath(); g.moveTo(330, 30); g.lineTo(330, H - 30); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#07050d";
    g.beginPath(); g.arc(330, 0, 18, 0, 6.3); g.fill(); g.beginPath(); g.arc(330, H, 18, 0, 6.3); g.fill();

    g.textAlign = "center";
    g.fillStyle = "#e6c068"; g.font = '800 26px Cairo, "Segoe UI", sans-serif'; g.fillText("DEMO", 165, 78);
    drawQR(65, 116, 200);
    g.fillStyle = "#b9aed1"; g.font = '600 17px Cairo, Tajawal, "Segoe UI", sans-serif'; g.fillText("رمز زخرفي — غير صالح للدخول", 165, 372);
    g.fillStyle = "#fff"; g.font = '700 20px "Courier New", monospace'; g.direction = "ltr"; g.fillText(ticketNo, 165, 412); g.direction = "rtl";
    g.fillStyle = "#fb7185"; g.font = '700 16px Cairo, "Segoe UI", sans-serif'; g.fillText("للترفيه فقط ♥", 165, 450);
  }

  photo = await loadPhoto();
  await draw(true);
  cv.addEventListener("click", () => RSU.fx.burst(innerWidth / 2, innerHeight / 2, 18));
  app.querySelector("#t-name").addEventListener("input", RSU.debounce(() => draw(true), 120));

  app.querySelector("#t-download").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    ui.busy(btn, true, "بنجهّز الصورة…");
    const save = (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-dream-concert-ticket.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    try {
      await draw(true);
      let blob;
      try {
        blob = await new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error("empty"))), "image/png"); } catch (err) { rej(err); } });
      } catch (taint) {
        // صورة الفنان من موقع بيمنع الاستخدام عبر CORS → نحمّل التذكرة بدونها
        photo = null;
        await draw(false);
        blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("empty"))), "image/png"));
        ui.toast("الصورة الخارجية مش بتسمح بالتحميل، اتحمّلت التذكرة بتصميم بديل.", "info");
      }
      save(blob);
      RSU.data.activity.log(ctx.user.id, "ticket_download", {});
      RSU.fx.burst(innerWidth / 2, innerHeight / 2, 28);
      ui.toast("اتحمّلت تذكرتك 🎟️", "success");
    } catch (err) {
      console.error(err);
      ui.toast("ماقدرناش نجهّز الصورة، جرّبي تاني.", "error");
    } finally {
      ui.busy(btn, false);
    }
  });
});
