/* dashboard.html — لوحة التحكم الشخصية */
RSU.boot({ page: "dashboard" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;
  const uid = ctx.user.id;

  app.innerHTML = ui.loading("بنجهّز لوحتك…");

  const [content, songs, favIds, lastQuiz, opened] = await Promise.all([
    RSU.data.content.all(),
    RSU.data.songs.listCached(),
    RSU.data.favorites.ids(uid),
    RSU.data.quiz.latest(uid),
    RSU.data.letters.opened(uid)
  ]);

  const artist = content.artist;
  const phrases = content.welcome_phrases;
  const PAGE_LABELS = { music: "عالم الأغاني", discover: "اكتشفي رامي", quiz: "اختبار المعجبات", letters: "رسائل من القلب", concert: "حفلتي", gallery: "المعرض" };
  const PAGE_ICONS = { music: "music", discover: "compass", quiz: "trophy", letters: "mail", concert: "ticket", gallery: "image" };

  const songById = (id) => songs.find((s) => s.id === id) || null;
  const newest = songs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);

  function render() {
    const p = ctx.profile;
    const fav = songById(p.favorite_song_id);
    const last = p.last_page && PAGE_LABELS[p.last_page] ? p.last_page : null;

    app.innerHTML =
      /* ---------- Hero ---------- */
      '<section class="hero glass">' +
      '<div class="hero-text">' +
      '<p class="eyebrow">' + esc(ui.greeting()) + "</p>" +
      "<h1>أهلًا يا <span class=\"gold-text\">" + esc(p.display_name || "حبيبتي") + '</span> <span class="heart-beat">❤️</span></h1>' +
      '<p class="hero-phrase" id="phrase" aria-live="polite">' + esc(RSU.pick(phrases)) + "</p>" +
      '<div class="row"><a class="btn btn-primary" href="music.html">' + RSU.icon("music") + " استمعي دلوقتي</a>" +
      '<a class="btn" href="quiz.html">' + RSU.icon("trophy") + " اختبري حبك</a></div>" +
      "</div>" +
      '<div class="hero-art"><div class="cover">' + RSU.coverHtml(artist.hero_image, artist.name, "mic") + '</div><div class="hero-name">' + esc(artist.name) + "</div></div>" +
      "</section>" +
      /* ---------- Stats ---------- */
      '<section class="stats">' +
      stat("users", RSU.num(p.visit_count || 0), "زياراتك لعالمك") +
      stat("heart", RSU.num(favIds.size), "أغاني في مفضلتك") +
      stat("mail-open", RSU.num(opened.size), "رسائل فتحتيها") +
      stat("trophy", lastQuiz ? esc(lastQuiz.tier) : "—", lastQuiz ? "آخر نتيجة: " + RSU.num(lastQuiz.score) + "/" + RSU.num(lastQuiz.max_score) : "لسه ماعملتيش الاختبار") +
      "</section>" +
      /* ---------- Favorite + Continue ---------- */
      '<section class="grid cols-2">' +
      '<div class="glass card fav-card"><h3>' + RSU.icon("heart") + " أغنيتك المفضلة</h3>" +
      (fav
        ? '<div class="song-row big">' + songThumb(fav) + '<div class="song-meta"><strong>' + esc(fav.title) + "</strong><span>" + esc([fav.album, fav.year].filter(Boolean).join(" · ") || "رامي صبري") +
          '</span></div><button class="btn btn-icon btn-primary" data-play="' + esc(fav.id) + '" aria-label="تشغيل"></button></div>' +
          '<button class="btn btn-sm btn-ghost" id="change-fav">' + RSU.icon("pencil") + " تغيير الأغنية المفضلة</button>"
        : '<p>لسه ما اخترتيش أغنيتك المفضلة.</p><button class="btn btn-sm" id="change-fav">' + RSU.icon("heart") + " اختاري أغنيتك</button>") +
      "</div>" +
      '<div class="glass card"><h3>' + RSU.icon("compass") + " كمّلي من حيث وقفتي</h3>" +
      (last
        ? '<p>آخر مكان زرتيه: <strong>' + esc(PAGE_LABELS[last]) + '</strong></p><a class="btn btn-primary btn-sm" href="' + last + '.html">' + RSU.icon(PAGE_ICONS[last]) + " كمّلي</a>"
        : "<p>ابدأي رحلتك من أي قسم من الأقسام اللي تحت 👇</p>") +
      "</div>" +
      "</section>" +
      /* ---------- Latest songs ---------- */
      '<section><div class="section-head"><h2>آخر الأغاني المضافة</h2><a class="btn btn-sm btn-ghost" href="music.html">كل الأغاني ' + RSU.icon("chevron-left") + "</a></div>" +
      (newest.length
        ? '<div class="grid grid-auto-sm" id="latest">' +
          newest.map((s) => '<div class="glass card song-row hover-lift">' + songThumb(s) + '<div class="song-meta"><strong>' + esc(s.title) + "</strong><span>" + esc([s.album, s.year].filter(Boolean).join(" · ") || "رامي صبري") +
            '</span></div><button class="btn btn-icon sm" data-play="' + esc(s.id) + '" aria-label="تشغيل"></button></div>').join("") + "</div>"
        : ui.empty({ icon: "music", title: "لسه مفيش أغاني اتضافت", text: ctx.isAdmin ? "ضيفي الأغاني من لوحة الإدارة وهتظهر هنا." : "الأغاني هتظهر هنا أول ما تتضاف." , action: ctx.isAdmin ? { label: "افتحي لوحة الإدارة", href: "admin.html" } : null })) +
      "</section>" +
      /* ---------- Shortcuts ---------- */
      '<section><div class="section-head"><h2>أقسام عالمك</h2></div><div class="grid shortcuts">' +
      tile("music.html", "music", "عالم الأغاني", "شغّلي أغانيك وضيفيها للمفضلة") +
      tile("discover.html", "compass", "اكتشفي رامي", "نبذة ومسيرة وألبومات") +
      tile("quiz.html", "trophy", "اختبار المعجبات", "قد إيه إنتِ بتحبيه؟") +
      tile("letters.html", "mail", "رسائل من القلب", "ظروف مقفولة ومفاجآت") +
      tile("concert.html", "ticket", "My Dream Concert", "تذكرتك الافتراضية") +
      tile("gallery.html", "image", "المعرض", "صور بتصنيفات ولايت بوكس") +
      "</div></section>" +
      /* ---------- Profile ---------- */
      '<section class="glass card profile-card" id="profile"><div class="avatar lg">' +
      (p.avatar_url ? '<img src="' + esc(RSU.safeUrl(p.avatar_url)) + '" alt="" />' : esc(RSU.initials(p.display_name))) +
      '</div><div class="profile-info"><h3>' + esc(p.display_name) + '</h3><p class="muted" dir="ltr" style="text-align:start">' + esc(ctx.user.email || "") +
      '</p><div class="chips"><span class="badge gold">' + RSU.num(p.visit_count || 0) + ' زيارة</span>' + (ctx.isAdmin ? '<span class="badge pink">أدمن</span>' : "") + "</div></div>" +
      '<button class="btn" id="edit-profile">' + RSU.icon("sliders") + " تخصيص حسابي</button></section>";

    RSU.hydrateIcons(app);
    ui.bindPlayButtons(app, songs);
    const changeFav = app.querySelector("#change-fav");
    if (changeFav) changeFav.addEventListener("click", openProfile);
    app.querySelector("#edit-profile").addEventListener("click", openProfile);
    rotatePhrases();
  }

  const stat = (icon, value, label) =>
    '<div class="glass stat hover-lift"><div class="stat-ico">' + RSU.icon(icon) + '</div><div class="stat-val">' + value + '</div><div class="stat-lbl">' + esc(label) + "</div></div>";
  const tile = (href, icon, title, text) =>
    '<a class="glass tile hover-lift" href="' + href + '"><div class="tile-ico">' + RSU.icon(icon) + "</div><h3>" + esc(title) + "</h3><p>" + esc(text) + "</p></a>";
  const songThumb = (s) => '<div class="thumb cover">' + RSU.coverHtml(s.cover_url, s.title, "music") + "</div>";

  let phraseTimer = null;
  function rotatePhrases() {
    clearInterval(phraseTimer);
    if (phrases.length < 2) return;
    phraseTimer = setInterval(() => {
      const el = document.getElementById("phrase");
      if (!el) return clearInterval(phraseTimer);
      el.classList.add("fade-out");
      setTimeout(() => {
        let next;
        do { next = RSU.pick(phrases); } while (next === el.textContent);
        el.textContent = next;
        el.classList.remove("fade-out");
      }, 400);
    }, 6500);
  }

  /* ---------- تخصيص الحساب ---------- */
  function openProfile() {
    const p = ctx.profile;
    const m = ui.modal(
      "<h3>تخصيص حسابي</h3>" +
        '<div class="center"><div class="avatar lg" id="pm-avatar" style="margin:0 auto 10px">' +
        (p.avatar_url ? '<img src="' + esc(RSU.safeUrl(p.avatar_url)) + '" alt="" />' : esc(RSU.initials(p.display_name))) +
        '</div><label class="btn btn-sm">' + RSU.icon("camera") + ' تغيير الصورة<input type="file" id="pm-file" accept="image/png,image/jpeg,image/webp" hidden /></label>' +
        '<p class="hint">JPG / PNG / WebP — لحد ٢ ميجابايت</p></div>' +
        '<label class="field"><span>الاسم</span><input class="input" id="pm-name" maxlength="40" value="' + esc(p.display_name) + '" /></label>' +
        '<label class="field"><span>أغنيتك المفضلة</span><select class="input" id="pm-song"><option value="">— من غير —</option>' +
        songs.map((s) => '<option value="' + esc(s.id) + '"' + (s.id === p.favorite_song_id ? " selected" : "") + ">" + esc(s.title) + "</option>").join("") +
        "</select></label>" +
        '<label class="check"><input type="checkbox" id="pm-fx"' + (p.settings.fx !== false ? " checked" : "") + " /> تأثيرات القلوب والنجوم في الخلفية</label>" +
        '<div class="actions"><button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="pm-save">' + RSU.icon("save") + " حفظ</button></div>" +
        '<details class="pw-box"><summary>تغيير كلمة المرور</summary>' +
        '<label class="field"><span>كلمة المرور الجديدة</span><input class="input" type="password" id="pm-pw" dir="ltr" autocomplete="new-password" minlength="6" /></label>' +
        '<button class="btn btn-sm" id="pm-pw-save">تحديث كلمة المرور</button></details>',
      {}
    );
    let file = null;
    const fileInput = m.el.querySelector("#pm-file");
    fileInput.addEventListener("change", () => {
      file = fileInput.files[0] || null;
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { ui.toast("الصورة أكبر من ٢ ميجابايت.", "error"); file = null; fileInput.value = ""; return; }
      m.el.querySelector("#pm-avatar").innerHTML = '<img src="' + URL.createObjectURL(file) + '" alt="" />';
    });
    m.el.querySelector("#pm-save").addEventListener("click", async (e) => {
      const name = m.el.querySelector("#pm-name").value.trim();
      if (name.length < 2) return ui.toast("اكتبي اسم (حرفين على الأقل).", "error");
      const btn = e.currentTarget;
      ui.busy(btn, true, "بنحفظ…");
      try {
        let avatar = p.avatar_url;
        if (file) avatar = await RSU.data.profile.uploadAvatar(uid, file);
        const settings = Object.assign({}, p.settings, { fx: m.el.querySelector("#pm-fx").checked });
        const updated = await RSU.data.profile.update(uid, {
          display_name: name,
          avatar_url: avatar,
          favorite_song_id: m.el.querySelector("#pm-song").value || null,
          settings
        });
        Object.assign(ctx.profile, updated);
        ctx.profile.settings = updated.settings || settings;
        RSU.fx.setAmbient(ctx.profile.settings.fx !== false);
        ui.updateHeaderUser(ctx.profile);
        RSU.data.activity.log(uid, "profile_update", {});
        m.close();
        render();
        ui.toast("اتحفظت تغييراتك ✨", "success");
      } catch (err) {
        ui.busy(btn, false);
        ui.toast(RSU.humanError(err), "error");
      }
    });
    m.el.querySelector("#pm-pw-save").addEventListener("click", async (e) => {
      const pw = m.el.querySelector("#pm-pw").value;
      if (pw.length < 6) return ui.toast("كلمة المرور لازم تكون ٦ حروف على الأقل.", "error");
      const btn = e.currentTarget;
      ui.busy(btn, true, "لحظة…");
      try {
        await RSU.auth.updatePassword(pw);
        m.el.querySelector("#pm-pw").value = "";
        ui.toast("اتغيّرت كلمة المرور ✅", "success");
      } catch (err) {
        ui.toast(RSU.humanError(err), "error");
      } finally {
        ui.busy(btn, false);
      }
    });
  }

  render();
  if (location.hash === "#profile") {
    openProfile();
    history.replaceState(null, "", location.pathname);
  }
});
