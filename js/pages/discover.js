/* discover.html — اكتشفي رامي صبري */
RSU.boot({ page: "discover" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;

  app.innerHTML = ui.loading("بنجمّع المعلومات…");

  const [content, albums, timeline, songs, photos] = await Promise.all([
    RSU.data.content.all(),
    RSU.data.albums.list(),
    RSU.data.timeline.list(),
    RSU.data.songs.listCached(),
    RSU.data.gallery.list()
  ]);
  const a = content.artist;
  const adminHint = ctx.isAdmin ? "ضيفيه من لوحة الإدارة ← المحتوى." : "هيتضاف قريب ✨";
  const paras = (t) => String(t || "").split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => "<p>" + esc(x).replace(/\n/g, "<br>") + "</p>").join("");
  const section = (id, title, icon, inner) =>
    '<section class="disc-section" id="' + id + '"><div class="section-head"><h2>' + RSU.icon(icon) + " " + esc(title) + "</h2></div>" + inner + "</section>";

  const famous = songs.slice(0, 6);

  app.innerHTML =
    RSU.pageHead("اكتشفي " + a.name, "نبذة عن الفنان ومسيرته وألبوماته وأبرز محطاته.", "compass") +
    /* نبذة */
    '<section class="glass card about"><div class="about-art cover">' + RSU.coverHtml(a.hero_image, a.name, "mic") + "</div><div class=\"about-text\"><h2 class=\"gold-text\">" + esc(a.name) + "</h2>" +
    (a.bio ? paras(a.bio) : ui.empty({ icon: "mic", title: "النبذة لسه مااتكتبتش", text: adminHint })) + "</div></section>" +
    /* المسيرة */
    section("career", "مسيرته الفنية", "star", a.career ? '<div class="glass card prose">' + paras(a.career) + "</div>" : ui.empty({ icon: "star", title: "المسيرة لسه ماتضافتش", text: adminHint })) +
    /* الألبومات */
    section("albums", "ألبوماته", "disc",
      albums.length
        ? '<div class="grid grid-auto">' + albums.map((al) =>
            '<article class="glass album-card hover-lift"><div class="album-cover cover">' + RSU.coverHtml(al.cover_url, al.title, "disc") + "</div><div class=\"song-info\"><h3>" + esc(al.title) + "</h3><p class=\"muted\">" + esc(al.year || "") + "</p>" +
            (al.description ? "<p>" + esc(al.description) + "</p>" : "") + "</div></article>").join("") + "</div>"
        : ui.empty({ icon: "disc", title: "مفيش ألبومات مضافة", text: adminHint })) +
    /* أشهر الأغاني */
    section("famous", "أشهر أغانيه", "music",
      famous.length
        ? '<div class="grid grid-auto-sm" id="famous">' + famous.map((s) =>
            '<div class="glass card song-row hover-lift"><div class="thumb cover">' + RSU.coverHtml(s.cover_url, s.title, "music") + '</div><div class="song-meta"><strong>' + esc(s.title) + "</strong><span>" + esc([s.album, s.year].filter(Boolean).join(" · ") || "رامي صبري") +
            '</span></div><button class="btn btn-icon sm" data-play="' + esc(s.id) + '" aria-label="تشغيل"></button></div>').join("") + "</div>"
        : ui.empty({ icon: "music", title: "مفيش أغاني مضافة", text: adminHint, action: { label: "عالم الأغاني", href: "music.html" } })) +
    /* صور */
    section("photos", "صور فنية", "image",
      photos.length
        ? '<div class="photo-strip">' + photos.slice(0, 6).map((p) => '<a class="strip-item cover" href="gallery.html">' + RSU.coverHtml(p.url, p.caption || "", "image") + "</a>").join("") + '</div><p class="center"><a class="btn btn-sm" href="gallery.html">كل الصور ' + RSU.icon("chevron-left") + "</a></p>"
        : ui.empty({ icon: "image", title: "المعرض لسه فاضي", text: adminHint })) +
    /* Timeline */
    section("timeline", "أبرز محطاته", "clock",
      timeline.length
        ? '<ol class="timeline">' + timeline.map((t) => '<li class="tl-item reveal"><div class="tl-dot"></div><div class="glass card tl-card"><span class="badge gold">' + esc(t.year) + "</span><h3>" + esc(t.title) + "</h3>" + (t.description ? "<p>" + esc(t.description) + "</p>" : "") + "</div></li>").join("") + "</ol>"
        : ui.empty({ icon: "clock", title: "الخط الزمني لسه فاضي", text: adminHint }));

  RSU.hydrateIcons(app);
  if (famous.length) ui.bindPlayButtons(app.querySelector("#famous"), famous);

  // ظهور تدريجي للـ Timeline
  const items = app.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15 });
    items.forEach((i) => io.observe(i));
  } else items.forEach((i) => i.classList.add("in"));
});
