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
  const fallbackSeat = "VIP · " + String.fromCharCode(65 + (seed % 6)) + "-" + (1 + ((seed >> 3) % 40));

  // ثيمات التذكرة + فئات المقاعد (A-B VIP · C-D Gold · E-F عادي)
  const PAL = {
    violet: { a: "#1b0a3a", b: "#0d0919", c: "#2a0d3f", glow: "rgba(244,114,182,0.28)" },
    rose: { a: "#3a0a22", b: "#14070d", c: "#4a0f2c", glow: "rgba(251,113,133,0.32)" },
    gold: { a: "#2b1f06", b: "#0f0b04", c: "#3b2a08", glow: "rgba(246,220,155,0.3)" }
  };
  const THEME_LABEL = { violet: "بنفسجي", rose: "وردي", gold: "ذهبي" };
  const TIER = { A: "VIP", B: "VIP", C: "Gold", D: "Gold", E: "عادي", F: "عادي" };
  let server = { ticket: null, seat: null }, allSongs = [];
  try { server = (await RSU.data.concert.me()) || server; } catch (e) {}
  try { allSongs = (await RSU.data.songs.listCached()) || []; } catch (e) {}
  const st = {
    theme: (server.ticket && PAL[server.ticket.theme] && server.ticket.theme) || "violet",
    message: (server.ticket && server.ticket.message) || "",
    setlist: ((server.ticket && server.ticket.setlist) || []).filter((id) => allSongs.some((s) => s.id === id)),
    seat: server.seat
  };
  const seatLabel = () => (st.seat ? TIER[st.seat[0]] + " · " + st.seat : fallbackSeat);

  app.innerHTML =
    RSU.pageHead("My Dream Concert", "تذكرتك الافتراضية للحفلة اللي بتحلمي بيها 🎤 — تجربة للترفيه فقط.", "ticket") +
    '<div class="ticket-layout"><div class="ticket-stage"><canvas id="ticket" width="1200" height="520" role="img" aria-label="تذكرة حفلة افتراضية"></canvas></div>' +
    '<div class="glass card ticket-panel"><h3>خصّصي تذكرتك</h3>' +
    '<label class="field"><span>الاسم على التذكرة</span><input class="input" id="t-name" maxlength="30" value="' + esc(ctx.profile.display_name) + '" /></label>' +
    '<div class="field"><span>ثيم التذكرة</span><div class="cx-themes" id="cx-themes">' +
    Object.keys(PAL).map((k) => '<button type="button" class="btn btn-sm' + (st.theme === k ? " is-active" : "") + '" data-theme="' + k + '">' + THEME_LABEL[k] + "</button>").join("") + "</div></div>" +
    '<label class="field"><span>رسالة لرامي (بتظهر على التذكرة)</span><input class="input" id="t-msg" maxlength="60" value="' + esc(st.message) + '" /></label>' +
    '<button class="btn btn-primary btn-lg" id="t-download" style="width:100%">' + RSU.icon("download") + " تحميل التذكرة كصورة</button>" +
    '<p class="hint" style="margin-top:12px">' + RSU.icon("info") + " " + esc(c.note) + "</p>" +
    (imgUrl ? "" : '<p class="hint">' + (ctx.isAdmin ? "ضيفي صورة للتذكرة من لوحة الإدارة ← المحتوى." : "صورة الفنان هتظهر على التذكرة أول ما تتضاف.") + "</p>") +
    "</div></div>" +
    '<section class="glass card cx-section"><h3>اختاري مقعدك</h3><p class="hint" id="cx-seat-hint"></p>' +
    '<div class="cx-stage-bar">المسرح</div><div class="cx-map" id="cx-map" role="group" aria-label="خريطة المقاعد"></div>' +
    '<div class="cx-legend"><span><i class="cx-seat tier-A"></i>VIP</span><span><i class="cx-seat tier-C"></i>Gold</span><span><i class="cx-seat tier-E"></i>عادي</span><span><i class="cx-seat is-mine"></i>مقعدك</span><span><i class="cx-seat is-taken"></i>محجوز</span></div></section>' +
    '<section class="glass card cx-section"><h3>السيت ليست بتاعتك</h3><p class="hint">اختاري لحد ١٢ أغنية ورتّبيها، وهتتشغّل بالترتيب في وضع المسرح.</p>' +
    '<div class="cx-set-grid"><div><h4>الأغاني المتاحة</h4><div id="cx-pool" class="cx-pool"></div></div><div><h4>حفلتك <span id="cx-count"></span></h4><ol id="cx-list" class="cx-list"></ol></div></div></section>' +
    '<section class="glass card cx-section"><h3>حفلة مع حد تاني</h3><p class="hint">اعملي غرفة وابعتي الكود لحد (لحد ١٠ حاضرين)، وهتسمعوا نفس الأغنية في نفس الوقت وتبعتوا ردود فعل. المضيفة بس هي اللي بتتحكم.</p>' +
    '<div class="cx-room-row"><button type="button" class="btn btn-primary" id="cx-host">' + RSU.icon("users") + " ابدأ حفلة مشتركة</button></div>" +
    '<div class="cx-room-row"><input class="input" id="cx-code" maxlength="5" dir="ltr" placeholder="كود الغرفة" aria-label="كود الغرفة" autocomplete="off" /><button type="button" class="btn" id="cx-join">ادخلي الحفلة</button></div></section>' +
    '<div class="cx-go"><button class="btn btn-pink btn-lg" id="cx-stage">' + RSU.icon("mic") + " ابدأ الحفلة (وضع المسرح)</button></div>";
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
    const P = PAL[st.theme];
    g.direction = "rtl";
    g.textBaseline = "alphabetic";

    // الخلفية
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, P.a); bg.addColorStop(0.55, P.b); bg.addColorStop(1, P.c);
    rr(0, 0, W, H, 38); g.fillStyle = bg; g.fill();
    const glow = g.createRadialGradient(W * 0.75, H * 0.2, 10, W * 0.75, H * 0.2, 520);
    glow.addColorStop(0, P.glow); glow.addColorStop(1, "rgba(244,114,182,0)");
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
    g.fillStyle = "#b9aed1"; fit(c.venue + " · " + seatLabel(), maxW, 22, 600); g.fillText(c.venue + " · " + seatLabel(), R, 428);
    const foot = st.message ? "“" + st.message + "”" : c.note;
    g.fillStyle = st.message ? "#f6dc9b" : "#fb7185"; fit(foot, 520, st.message ? 22 : 17, 700); g.fillText(foot, R, 478);

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

  /* ================= تخصيص + مقاعد + سيت ليست + وضع المسرح ================= */
  const redraw = RSU.debounce(() => draw(true), 120);
  const save = RSU.debounce(async () => {
    try { await RSU.data.concert.saveTicket({ theme: st.theme, message: st.message, setlist: st.setlist }); }
    catch (e) { ui.toast(RSU.humanError(e), "error"); }
  }, 700);

  app.querySelector("#cx-themes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme]");
    if (!b) return;
    st.theme = b.dataset.theme;
    app.querySelectorAll("#cx-themes .btn").forEach((x) => x.classList.toggle("is-active", x === b));
    draw(true); save();
  });
  app.querySelector("#t-msg").addEventListener("input", (e) => { st.message = e.target.value.trim(); redraw(); save(); });

  /* ---- خريطة المقاعد ---- */
  let taken = new Map();
  const mapEl = app.querySelector("#cx-map");
  function renderSeats() {
    let h = "";
    "ABCDEF".split("").forEach((row) => {
      h += '<div class="cx-row"><b>' + row + "</b>";
      for (let n = 1; n <= 10; n++) {
        const id = row + "-" + n, mine = st.seat === id, off = taken.has(id) && !mine;
        h += '<button type="button" class="cx-seat tier-' + row + (mine ? " is-mine" : "") + (off ? " is-taken" : "") + '" data-seat="' + id + '"' + (off ? " disabled" : "") +
          ' aria-pressed="' + mine + '" aria-label="مقعد ' + id + " — " + TIER[row] + (off ? " (محجوز)" : "") + '">' + n + "</button>";
      }
      h += "</div>";
    });
    mapEl.innerHTML = h;
    app.querySelector("#cx-seat-hint").textContent = st.seat
      ? "مقعدك: " + st.seat + " (" + TIER[st.seat[0]] + ") — اضغطي عليه تاني لو عايزة تلغي الحجز."
      : "الصفوف A-B VIP، و C-D Gold، و E-F عادي. اضغطي على مقعد فاضي.";
  }
  async function loadSeats() {
    try { taken = new Map(((await RSU.data.concert.seats()) || []).map((x) => [x.seat, x.mine])); } catch (e) {}
    renderSeats();
  }
  mapEl.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-seat]");
    if (!b || b.disabled) return;
    const id = b.dataset.seat;
    try {
      if (st.seat === id) { await RSU.data.concert.releaseSeat(); st.seat = null; }
      else { await RSU.data.concert.claimSeat(id); st.seat = id; RSU.fx.burst(innerWidth / 2, innerHeight / 2, 18); ui.toast("اتحجز مقعدك " + id + " 🎟️", "success"); }
    } catch (err) { ui.toast(RSU.humanError(err), "error"); }
    await draw(true); loadSeats();
  });

  /* ---- السيت ليست ---- */
  const MAX_SET = 12;
  const songOf = (id) => allSongs.find((s) => s.id === id);
  function renderSet() {
    const pool = allSongs.filter((s) => !st.setlist.includes(s.id));
    app.querySelector("#cx-pool").innerHTML = allSongs.length
      ? (pool.map((s) => '<button type="button" class="cx-pick" data-add="' + s.id + '">' + RSU.icon("plus") + "<span>" + esc(s.title) + "</span></button>").join("") || '<p class="hint">ضفتي كل الأغاني 🎉</p>')
      : '<p class="hint">مفيش أغاني لسه — الأدمن هيضيفها من لوحة الإدارة.</p>';
    app.querySelector("#cx-count").textContent = "(" + st.setlist.length + "/" + MAX_SET + ")";
    app.querySelector("#cx-list").innerHTML = st.setlist.map((id, i) => '<li><span class="cx-t">' + esc(songOf(id).title) + '</span><span class="cx-acts">' +
      '<button type="button" class="btn btn-icon sm" data-act="play" data-i="' + i + '" aria-label="سماع">' + RSU.icon("play") + "</button>" +
      '<button type="button" class="btn btn-icon sm" data-act="up" data-i="' + i + '" aria-label="فوق"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button type="button" class="btn btn-icon sm" data-act="down" data-i="' + i + '" aria-label="تحت"' + (i === st.setlist.length - 1 ? " disabled" : "") + ">↓</button>" +
      '<button type="button" class="btn btn-icon sm" data-act="del" data-i="' + i + '" aria-label="شيل">' + RSU.icon("x") + "</button></span></li>").join("") ||
      '<li class="hint">لسه فاضية — ضيفي أغاني من القايمة.</li>';
    RSU.hydrateIcons(app);
  }
  app.querySelector("#cx-pool").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    if (st.setlist.length >= MAX_SET) return ui.toast("السيت ليست وصلت للحد الأقصى (" + MAX_SET + ").", "info");
    st.setlist.push(b.dataset.add); renderSet(); save();
  });
  app.querySelector("#cx-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const i = +b.dataset.i, L = st.setlist;
    if (b.dataset.act === "play") return RSU.player.setQueue([songOf(L[i])], 0, true);
    if (b.dataset.act === "del") L.splice(i, 1);
    if (b.dataset.act === "up" && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
    if (b.dataset.act === "down" && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
    renderSet(); save();
  });

  /* ---- وضع المسرح: فردي / مضيفة / ضيفة ---- */
  const EMO = ["❤️", "🔥", "👏", "🎶", "😍", "🎤"];
  const songsOf = (ids) => ids.map(songOf).filter(Boolean);
  /* ---- لوحة التعليقات + ملخص الحفلة ---- */
  const QUICK = ["صوته حلو 😍", "أحلى أغنية 🔥", "كمّلوا 👏", "❤️"];
  function chatHtml(host) {
    return '<aside class="stage-chat" hidden aria-label="التعليقات"><div class="sc-tabs"><button type="button" class="on" data-tab="cur">الأغنية الحالية</button><button type="button" data-tab="all">كل التعليقات</button></div>' +
      '<div class="sc-pin" id="sc-pin" hidden></div><ol class="sc-list" id="sc-list" aria-live="polite"></ol>' +
      '<div class="sc-quick">' + QUICK.map((t) => '<button type="button" data-q="' + t + '">' + t + "</button>").join("") + "</div>" +
      '<div class="sc-form"><input class="input" id="sc-in" maxlength="140" autocomplete="off" aria-label="تعليق" /><button type="button" class="btn btn-primary btn-sm" id="sc-send">إرسال</button></div>' +
      (host ? '<div class="sc-host"><button type="button" class="btn btn-sm" id="sc-lock">قفل التعليقات</button></div>' : "") + "</aside>";
  }
  function showSummary(items, concertTitle) {
    const by = new Map();
    items.forEach((m) => { if (!by.has(m.song_id)) by.set(m.song_id, []); by.get(m.song_id).push(m); });
    let html = '<h3>ملخص الحفلة 🎤</h3><p class="hint">التعليقات دي مش محفوظة — انسخيها لو عايزة تحتفظي بيها.</p><div class="cx-sum">', txt = concertTitle + "\n";
    by.forEach((arr, id) => {
      const sg = songOf(id), name = sg ? sg.title : "—";
      html += "<h4>" + esc(name) + "</h4><ul>" + arr.map((m) => "<li><b>" + esc(m.name) + ":</b> " + esc(m.body) + "</li>").join("") + "</ul>";
      txt += "\n" + name + "\n" + arr.map((m) => "- " + m.name + ": " + m.body).join("\n") + "\n";
    });
    html += '</div><div class="row" style="margin-top:14px;gap:10px"><button type="button" class="btn btn-primary" id="sum-copy">نسخ الملخص</button><button type="button" class="btn" data-close>تمام</button></div>';
    const m = ui.modal(html);
    m.el.querySelector("#sum-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(txt); ui.toast("اتنسخ الملخص ✨", "success"); } catch (e) { ui.toast("ماقدرناش ننسخ، حدّديه وانسخيه يدويًا.", "error"); }
    });
  }
  function openStage(o) {
    o = o || { role: "solo" };
    const role = o.role, list = o.list || songsOf(st.setlist), room = role !== "solo";
    if (!list.length) { ui.toast("ضيفي أغاني للسيت ليست الأول 🎶", "info"); app.querySelector("#cx-pool").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const ov = document.createElement("div");
    ov.className = "stage theme-" + st.theme;
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "وضع المسرح");
    ov.innerHTML =
      '<div class="stage-beams" aria-hidden="true"><i></i><i></i><i></i></div><div class="curtain l"></div><div class="curtain r"></div>' +
      '<button type="button" class="btn btn-icon stage-x" aria-label="خروج من المسرح">' + RSU.icon("x") + "</button>" +
      '<div class="stage-center"><h2 class="gold-text">' + esc(c.title) + "</h2><p>" + esc(a.name) + "</p>" +
      (st.message && role !== "guest" ? '<p class="stage-msg">“' + esc(st.message) + "”</p>" : "") +
      (room ? '<p class="stage-room">كود الغرفة: <b dir="ltr">' + esc(o.code) + '</b> <button type="button" class="btn btn-sm" id="sg-copy">نسخ الرابط</button></p><p class="hint" id="sg-who"></p>' : "") +
      (role === "guest" ? '<p id="sg-wait">في انتظار المضيفة تبدأ الحفلة…</p>' : '<button type="button" class="btn btn-primary btn-lg" id="sg-start">ابدأ الحفلة</button>') +
      '<div class="stage-count" id="sg-count" aria-live="assertive"></div></div>' +
      '<div class="stage-now" hidden><h3 id="sg-title"></h3><ol id="sg-list">' + list.map((s) => '<li data-id="' + s.id + '">' + esc(s.title) + "</li>").join("") + "</ol>" +
      (room ? '<div class="stage-emojis">' + EMO.map((e) => '<button type="button" class="btn btn-icon sm" data-emo="' + e + '" aria-label="رد فعل ' + e + '">' + e + "</button>").join("") + "</div>" : "") +
      (room ? '<div class="sg-say"><input class="input" id="sg-say" maxlength="140" autocomplete="off" aria-label="اكتبي تعليق" /><button type="button" class="btn btn-pink btn-sm" id="sg-say-btn">طيّر ✨</button></div>' : "") +
      '<div class="row">' + (room ? '<button type="button" class="btn btn-icon" id="sg-chat" aria-label="لوحة التعليقات">💬<i class="sc-dot" hidden></i></button><button type="button" class="btn btn-icon is-active" id="sg-fly" aria-label="التعليقات الطايرة" aria-pressed="true">✨</button>' : "") + '<button type="button" class="btn btn-icon" id="sg-toggle" aria-label="تشغيل / إيقاف">' + RSU.icon("pause") + "</button>" +
      (role !== "guest" ? '<button type="button" class="btn btn-icon" id="sg-next" aria-label="التالية">' + RSU.icon("skip-forward") + "</button>" : "") + "</div></div>" + (room ? chatHtml(role === "host") : "");
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    RSU.hydrateIcons(ov);
    const q = (s) => ov.querySelector(s);
    let timers = [], unsub = null, lastId = null, opened = false, rx = 0, hostLive = false, lastIdx = -1, lastPlaying = null;
    const CD = RSU.data.concert;

    /* ---- تعليقات طايرة على المسرح ---- */
    let fly = true, flying = 0, lane = 0;
    const FC_STYLES = ["fc-pop", "fc-neon", "fc-gold", "fc-glass", "fc-heart"], LANES = [16, 26, 36, 46, 56];
    const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function flyComment(m) {
      if (!fly || !opened || reduced || flying >= 8) return;
      const el = document.createElement("div"), across = Math.random() < 0.55;
      el.className = "stage-fc " + FC_STYLES[Math.floor(Math.random() * FC_STYLES.length)] + (across ? " fc-across" : " fc-rise");
      if (across) { el.style.top = LANES[lane++ % LANES.length] + "%"; el.style.setProperty("--dur", 7 + Math.random() * 3 + "s"); }
      else { el.style.left = 6 + Math.random() * 58 + "%"; el.style.setProperty("--rot", (Math.random() * 16 - 8) + "deg"); }
      const nm = document.createElement("small"); nm.textContent = m.name;
      const tx = document.createElement("span"); tx.textContent = m.body;
      el.append(nm, tx);
      flying++;
      el.addEventListener("animationend", () => { el.remove(); flying--; });
      ov.appendChild(el);
    }

    /* ---- تعليقات منظمة (مربوطة بالأغنية) ---- */
    const chat = { items: [], ids: new Set(), hidden: new Set(), pinned: null, open: true, muted: false, cx: 0, tab: "cur", unread: 0, mutedIds: new Set() };
    const curSong = () => { const S = RSU.player.state; return S.queue[S.index] || null; };
    const hhmm = (t) => new Date(t).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    function renderChat() {
      if (!room || !q(".stage-chat")) return;
      const cur = curSong(), host = role === "host";
      const show = chat.items.filter((m) => !chat.hidden.has(m.id) && (chat.tab === "all" || (cur && m.song_id === cur.id)));
      let h = "", last = null;
      show.forEach((m) => {
        if (chat.tab === "all" && m.song_id !== last) { last = m.song_id; const sg = songOf(m.song_id); h += '<li class="sc-head">' + esc(sg ? sg.title : "—") + "</li>"; }
        const mu = chat.mutedIds.has(m.uid);
        h += '<li class="sc-item' + (m.mine ? " mine" : "") + '"><b>' + esc(m.name) + "</b><time>" + hhmm(m.created_at) + "</time><p>" + esc(m.body) + "</p>" +
          (host ? '<span class="sc-mod"><button type="button" data-pin="' + m.id + '" aria-label="تثبيت">📌</button><button type="button" data-del="' + m.id + '" aria-label="حذف">🗑</button>' +
            (m.mine || !m.uid ? "" : '<button type="button" data-mute="' + m.uid + '" aria-label="' + (mu ? "فك الكتم" : "كتم") + '">' + (mu ? "🔊" : "🔇") + "</button>") + "</span>" : "") + "</li>";
      });
      const list = q("#sc-list"), stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 30;
      list.innerHTML = h || '<li class="hint">لسه مفيش تعليقات' + (chat.tab === "cur" ? " على الأغنية دي" : "") + ".</li>";
      if (stick) list.scrollTop = list.scrollHeight;
      const pin = q("#sc-pin");
      pin.hidden = !chat.pinned;
      if (chat.pinned) pin.innerHTML = "📌 <b>" + esc(chat.pinned.name) + ":</b> " + esc(chat.pinned.body);
      const can = host || (chat.open && !chat.muted);
      q("#sc-in").disabled = !can; q("#sc-send").disabled = !can; q("#sg-say").disabled = !can; q("#sg-say-btn").disabled = !can;
      q("#sg-say").placeholder = can ? "اكتبي تعليق وهيطير على المسرح ✨" : chat.muted ? "المضيفة قفلت التعليقات عندك" : "التعليقات مقفولة دلوقتي";
      q("#sc-in").placeholder = can ? "اكتبي تعليق (١٤٠ حرف)…" : chat.muted ? "المضيفة قفلت التعليقات عندك" : "التعليقات مقفولة دلوقتي";
      if (host) q("#sc-lock").textContent = chat.open ? "قفل التعليقات" : "فتح التعليقات";
    }
    function addComments(arr, force) {
      let n = 0;
      arr.forEach((m) => { if (chat.ids.has(m.id)) return; chat.ids.add(m.id); chat.items.push(m); if (!m.mine) n++; if (force || chat.ready) flyComment(m); });
      chat.items.sort((x, y) => x.id - y.id);
      if (n && q(".stage-chat").hidden) { chat.unread += n; q(".sc-dot").hidden = false; }
      renderChat();
    }
    async function sendComment(text) {
      const cur = curSong(); text = String(text || "").trim();
      if (!cur || !text) return;
      try {
        const m = await CD.comment(o.code, { body: text, song_id: cur.id });
        addComments([Object.assign({ name: ctx.profile.display_name, mine: true }, m)], true);
        q("#sc-in").value = ""; q("#sg-say").value = "";
      } catch (err) { ui.toast(RSU.humanError(err), "error"); }
    }
    if (room) {
      const panel = q(".stage-chat");
      q("#sg-chat").addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) { chat.unread = 0; q(".sc-dot").hidden = true; renderChat(); q("#sc-in").focus(); }
      });
      panel.addEventListener("click", async (e) => {
        const t = e.target.closest("button");
        if (!t) return;
        try {
          if (t.dataset.tab) { chat.tab = t.dataset.tab; panel.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === t)); renderChat(); }
          else if (t.id === "sc-send") sendComment(q("#sc-in").value);
          else if (t.dataset.q) sendComment(t.dataset.q);
          else if (t.dataset.pin) {
            const id = +t.dataset.pin, same = chat.pinned && chat.pinned.id === id;
            await CD.pin(o.code, id, !same);
            const m = chat.items.find((x) => x.id === id);
            chat.pinned = same || !m ? null : { id, name: m.name, body: m.body }; renderChat();
          }
          else if (t.dataset.del) { const id = +t.dataset.del; await CD.removeComment(o.code, id); chat.hidden.add(id); if (chat.pinned && chat.pinned.id === id) chat.pinned = null; renderChat(); }
          else if (t.dataset.mute) { const on = !chat.mutedIds.has(t.dataset.mute); await CD.mute(o.code, t.dataset.mute, on); if (on) chat.mutedIds.add(t.dataset.mute); else chat.mutedIds.delete(t.dataset.mute); renderChat(); }
          else if (t.id === "sc-lock") { await CD.setComments(o.code, !chat.open); chat.open = !chat.open; renderChat(); }
        } catch (err) { ui.toast(RSU.humanError(err), "error"); }
      });
      q("#sc-in").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") sendComment(q("#sc-in").value); });
      q("#sg-say").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") sendComment(q("#sg-say").value); });
      q("#sg-say-btn").addEventListener("click", () => sendComment(q("#sg-say").value));
      q("#sg-fly").addEventListener("click", (e) => { fly = !fly; e.currentTarget.classList.toggle("is-active", fly); e.currentTarget.setAttribute("aria-pressed", String(fly)); });
    }

    const onKey = (e) => { if (e.key === "Escape") close(); };
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      const summary = room ? chat.items.filter((m) => !chat.hidden.has(m.id)) : [];
      timers.forEach(clearInterval); if (unsub) unsub();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (room) CD.leave(o.code).catch(() => {});
      if (RSU.player.state.playing) RSU.player.toggle();
      ov.remove();
      if (summary.length) showSummary(summary, c.title);
    }
    function openCurtains() {
      if (opened) return; opened = true;
      q(".stage-center").classList.add("up"); ov.classList.add("open"); q(".stage-now").hidden = false;
      RSU.fx.burst(innerWidth / 2, innerHeight / 3, 40);
    }
    function floatEmoji(emoji, name) {
      const s = document.createElement("span");
      s.className = "stage-emo"; s.style.insetInlineStart = 8 + Math.random() * 80 + "%";
      s.innerHTML = emoji + (name ? "<small>" + esc(name) + "</small>" : "");
      ov.appendChild(s); setTimeout(() => s.remove(), 3200);
    }
    const pushSync = () => { const S = RSU.player.state; CD.sync(o.code, { idx: S.index, playing: !!S.playing, pos_ms: Math.round((S.time || 0) * 1000) }).catch(() => {}); };

    document.addEventListener("keydown", onKey);
    q(".stage-x").addEventListener("click", close);
    if (q("#sg-copy")) q("#sg-copy").addEventListener("click", async () => {
      const link = location.origin + location.pathname + "?room=" + o.code;
      try { await navigator.clipboard.writeText(link); ui.toast("اتنسخ الرابط 🔗", "success"); } catch (e) { ui.toast("الكود: " + o.code, "info"); }
    });
    if (q("#sg-start")) { q("#sg-start").focus(); q("#sg-start").addEventListener("click", (e) => {
      e.currentTarget.hidden = true;
      RSU.player.setQueue(list, 0, true); // الضغطة دي (تفاعل المستخدم) بتسمح بالتشغيل التلقائي
      let n = 3; const cnt = q("#sg-count"); cnt.textContent = n;
      const t = setInterval(() => {
        n--;
        if (n > 0) { cnt.textContent = n; return; }
        clearInterval(t); cnt.textContent = "";
        openCurtains();
        if (role === "host") { hostLive = true; const S = RSU.player.state; lastIdx = S.index; lastPlaying = !!S.playing; pushSync(); }
      }, 900);
      timers.push(t);
    }); }
    q("#sg-toggle").addEventListener("click", () => RSU.player.toggle());
    if (q("#sg-next")) q("#sg-next").addEventListener("click", () => RSU.player.next());
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-emo]");
      if (!b) return;
      floatEmoji(b.dataset.emo, "");
      CD.react(o.code, b.dataset.emo).catch(() => {});
    });

    unsub = RSU.player.subscribe(() => {
      const S = RSU.player.state, cur = S.queue[S.index];
      if (cur) {
        q("#sg-title").textContent = cur.title;
        ov.querySelectorAll("#sg-list li").forEach((li) => li.classList.toggle("on", li.dataset.id === cur.id));
        if (cur.id !== lastId) { lastId = cur.id; renderChat(); if (opened) RSU.fx.burst(innerWidth / 2, innerHeight / 3, 22); }
      }
      if (role === "host" && hostLive && (S.index !== lastIdx || !!S.playing !== lastPlaying)) { lastIdx = S.index; lastPlaying = !!S.playing; pushSync(); }
    });

    if (room) {
      async function poll() {
        let r;
        try { r = await CD.room(o.code, rx, chat.cx); }
        catch (e) { if (e.status === 404 || e.status === 403) { ui.toast("الحفلة خلصت.", "info"); close(); } return; }
        q("#sg-who").textContent = "الحاضرين (" + r.members.length + "): " + r.members.join("، ");
        r.reactions.forEach((x) => { rx = Math.max(rx, x.id); if (!x.mine) floatEmoji(x.emoji, x.name); });
        r.comments.forEach((m) => { chat.cx = Math.max(chat.cx, m.id); });
        r.hidden.forEach((id) => chat.hidden.add(id));
        chat.pinned = r.pinned; chat.open = r.comments_open; chat.muted = r.muted;
        if (r.muted_ids) chat.mutedIds = new Set(r.muted_ids);
        addComments(r.comments);
        chat.ready = true; // أول polling بيجيب التعليقات القديمة من غير ما تطير
        if (role !== "guest") return;
        if (r.state === "ended") { ui.toast("المضيفة خلّصت الحفلة 💜", "info"); close(); return; }
        if (r.state !== "live") return;
        openCurtains();
        const S = RSU.player.state;
        if (S.index !== r.idx || S.queue.length !== list.length) { RSU.player.setQueue(list, r.idx, r.playing); return; }
        if (!!S.playing !== r.playing) { RSU.player.toggle(); return; }
        if (r.playing && Math.abs((S.time || 0) * 1000 - r.pos_ms) > 4000) RSU.player.seek(r.pos_ms / 1000);
      }
      poll();
      timers.push(setInterval(poll, 2500));
      if (role === "host") timers.push(setInterval(() => { if (hostLive) pushSync(); }, 5000));
    }
  }

  /* ---- حفلة مشتركة ---- */
  const hostBtn = app.querySelector("#cx-host"), codeIn = app.querySelector("#cx-code");
  hostBtn.addEventListener("click", async () => {
    if (!st.setlist.length) return ui.toast("ضيفي أغاني للسيت ليست الأول 🎶", "info");
    ui.busy(hostBtn, true, "بنجهّز الغرفة…");
    try {
      await RSU.data.concert.saveTicket({ theme: st.theme, message: st.message, setlist: st.setlist });
      const { code } = await RSU.data.concert.createRoom();
      openStage({ role: "host", code });
    } catch (err) { ui.toast(RSU.humanError(err), "error"); }
    finally { ui.busy(hostBtn, false); }
  });
  async function joinRoom(raw) {
    const code = String(raw || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) return ui.toast("الكود لازم يكون ٥ حروف أو أرقام.", "error");
    try {
      const r = await RSU.data.concert.join(code);
      const list = songsOf(r.setlist);
      if (list.length !== r.setlist.length) return ui.toast("بعض أغاني الغرفة مش متاحة عندك.", "error");
      openStage({ role: "guest", code, list });
    } catch (err) { ui.toast(RSU.humanError(err), "error"); }
  }
  app.querySelector("#cx-join").addEventListener("click", () => joinRoom(codeIn.value));
  codeIn.addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom(codeIn.value); });
  const preset = new URLSearchParams(location.search).get("room");
  if (preset) { codeIn.value = preset.toUpperCase().slice(0, 5); codeIn.scrollIntoView({ block: "center" }); }
  app.querySelector("#cx-stage").addEventListener("click", () => openStage({ role: "solo" }));

  renderSeats(); renderSet(); loadSeats();
});
