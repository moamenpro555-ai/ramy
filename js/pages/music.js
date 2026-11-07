/* music.html — عالم الأغاني */
RSU.boot({ page: "music" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;
  const uid = ctx.user.id;

  app.innerHTML = RSU.pageHead("عالم الأغاني", "كل أغنية بتتشغّل من مصدر رسمي. ضيفي اللي بتحبيه لمفضلتك ❤️", "music") + '<div id="music-body">' + '<div class="grid grid-auto">' + ui.skeletons(6) + "</div></div>";
  const body = app.querySelector("#music-body");

  let songs = [], favs = new Set();
  let view = "all"; // all | favs
  let query = "";

  try {
    [songs, favs] = await Promise.all([RSU.data.songs.listCached(), RSU.data.favorites.ids(uid)]);
  } catch (e) {
    console.error(e);
    body.innerHTML = ui.errorState(RSU.humanError(e));
    body.querySelector("[data-retry]").addEventListener("click", () => location.reload());
    return;
  }

  if (!songs.length) {
    body.innerHTML = ui.empty({
      icon: "music",
      title: "لسه مفيش أغاني هنا",
      text: ctx.isAdmin ? "ضيفي أغاني (بروابط رسمية) من لوحة الإدارة وهتظهر هنا فورًا." : "الأغاني هتظهر هنا أول ما تتضاف — ارجعي بعد شوية ✨",
      action: ctx.isAdmin ? { label: "إضافة أغاني", href: "admin.html" } : null
    });
    return;
  }

  body.innerHTML =
    '<div class="toolbar glass"><div class="search"><span class="search-ico">' + RSU.icon("search") + '</span><input class="input" id="song-search" type="search" placeholder="دوّري على أغنية أو ألبوم…" autocomplete="off" /></div>' +
    '<div class="chips" role="tablist"><button class="chip is-active" data-view="all" role="tab">الكل <span id="cnt-all"></span></button><button class="chip" data-view="favs" role="tab">' + RSU.icon("heart") + ' المفضلة <span id="cnt-favs"></span></button></div>' +
    '<button class="btn btn-sm" id="play-all">' + RSU.icon("play") + " تشغيل الكل</button></div>" +
    '<div id="song-grid" class="grid grid-auto"></div>' +
    '<p class="legal muted center">' + RSU.icon("info") + " الأغاني بتتشغّل من روابط رسمية (يوتيوب أو ملفات مرخّصة) — مفيش ملفات أغاني متخزّنة في الموقع.</p>";

  const grid = body.querySelector("#song-grid");
  let shown = [];

  function visible() {
    const q = query.trim().toLowerCase();
    return songs.filter((s) => (view === "all" || favs.has(s.id)) && (!q || (s.title + " " + (s.album || "")).toLowerCase().includes(q)));
  }

  function card(s) {
    const isFav = favs.has(s.id);
    const ext = (s.source || RSU.songSource(s.play_url)) === "external";
    return (
      '<article class="glass song-card hover-lift" data-id="' + esc(s.id) + '">' +
      '<div class="song-cover cover">' + RSU.coverHtml(s.cover_url, s.title, "disc") +
      '<button class="play-fab btn btn-icon btn-primary" data-play="' + esc(s.id) + '" aria-label="تشغيل"></button>' +
      (ext ? '<span class="badge gold ext-badge">' + RSU.icon("external-link") + " رابط خارجي</span>" : "") +
      "</div>" +
      '<div class="song-info"><h3 title="' + esc(s.title) + '">' + esc(s.title) + "</h3>" +
      '<p class="muted">' + esc([s.album, s.year].filter(Boolean).join(" · ") || "رامي صبري") + "</p></div>" +
      '<button class="btn btn-icon sm fav-btn' + (isFav ? " is-active" : "") + '" data-fav="' + esc(s.id) + '" aria-pressed="' + isFav + '" aria-label="' + (isFav ? "شيل من المفضلة" : "ضيف للمفضلة") + '">' + RSU.icon("heart") + "</button>" +
      "</article>"
    );
  }

  function render() {
    shown = visible();
    body.querySelector("#cnt-all").textContent = RSU.num(songs.length);
    body.querySelector("#cnt-favs").textContent = RSU.num(favs.size);
    if (!shown.length) {
      grid.className = "";
      grid.innerHTML = view === "favs" && !query
        ? ui.empty({ icon: "heart", title: "مفضلتك فاضية", text: "اضغطي على القلب ♥ في أي أغنية وهتلاقيها هنا." })
        : ui.empty({ icon: "search", title: "مفيش نتيجة", text: "جرّبي كلمة تانية." });
      return;
    }
    grid.className = "grid grid-auto";
    grid.innerHTML = shown.map(card).join("");
    RSU.hydrateIcons(grid);
    syncPlay();
  }

  // أزرار التشغيل: مرتبطة بالقائمة المعروضة حاليًا
  const off = ui.bindPlayButtons(grid, () => shown);
  function syncPlay() { /* bindPlayButtons بتزامن لوحدها — بنطلب تحديث يدوي بعد إعادة الرسم */
    const S = RSU.player.state, cur = S.queue[S.index];
    grid.querySelectorAll("[data-play]").forEach((b) => {
      const on = !!cur && cur.id === b.dataset.play && S.playing;
      b.innerHTML = RSU.icon(on ? "pause" : "play");
      b.classList.toggle("is-playing", on);
    });
  }

  // المفضلة (تحديث فوري ثم تأكيد من السيرفر، مع تراجع لو فشل)
  const busy = new Set();
  grid.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    const id = b.dataset.fav;
    if (busy.has(id)) return;
    busy.add(id);
    const was = favs.has(id);
    const song = songs.find((s) => s.id === id);
    if (was) favs.delete(id); else favs.add(id);
    b.classList.toggle("is-active", !was);
    b.setAttribute("aria-pressed", String(!was));
    body.querySelector("#cnt-favs").textContent = RSU.num(favs.size);
    if (!was) {
      const r = b.getBoundingClientRect();
      RSU.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 12);
    }
    try {
      if (was) await RSU.data.favorites.remove(uid, id); else await RSU.data.favorites.add(uid, id);
      RSU.data.activity.log(uid, was ? "unfavorite" : "favorite", { song: song && song.title });
      if (view === "favs" && was) render(); // اختفاء الأغنية من قائمة المفضلة
    } catch (err) {
      if (was) favs.add(id); else favs.delete(id);
      b.classList.toggle("is-active", was);
      b.setAttribute("aria-pressed", String(was));
      body.querySelector("#cnt-favs").textContent = RSU.num(favs.size);
      ui.toast(RSU.humanError(err), "error");
    } finally {
      busy.delete(id);
    }
  });

  body.querySelectorAll("[data-view]").forEach((c) =>
    c.addEventListener("click", () => {
      view = c.dataset.view;
      body.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("is-active", x === c));
      render();
    })
  );
  body.querySelector("#song-search").addEventListener("input", RSU.debounce((e) => { query = e.target.value; render(); }, 150));
  body.querySelector("#play-all").addEventListener("click", () => {
    const list = shown.length ? shown : songs;
    RSU.player.setQueue(list, 0, true);
  });

  render();
  window.addEventListener("pagehide", off);
});
