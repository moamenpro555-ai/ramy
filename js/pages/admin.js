/* admin.html — لوحة الإدارة
   الصلاحية بتتحقق من دور محفوظ في جدول user_roles (RLS) — مش من إخفاء الزر في الواجهة. */
RSU.boot({ page: "admin", admin: true }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;

  const TABS = [
    { id: "overview", label: "نظرة عامة", icon: "bar-chart" },
    { id: "songs", label: "الأغاني", icon: "music" },
    { id: "gallery", label: "المعرض", icon: "image" },
    { id: "content", label: "محتوى الموقع", icon: "pencil" },
    { id: "career", label: "الألبومات والمحطات", icon: "disc" },
    { id: "letters", label: "الرسائل", icon: "mail" },
    { id: "quiz", label: "الاختبار", icon: "trophy" },
    { id: "users", label: "المستخدمين", icon: "users" },
    { id: "activity", label: "النشاط", icon: "clock" }
  ];

  app.innerHTML =
    RSU.pageHead("لوحة الإدارة", "كل محتوى الموقع بتتحكمي فيه من هنا.", "shield") +
    '<div class="admin-tabs" role="tablist">' + TABS.map((t) => '<button class="admin-tab" role="tab" data-tab="' + t.id + '">' + RSU.icon(t.icon) + "<span>" + t.label + "</span></button>").join("") + "</div>" +
    '<div id="panel"></div>';
  const panel = app.querySelector("#panel");

  /* ---------- أدوات مشتركة ---------- */
  const fmtDT = (d) => (d ? RSU.fmtDateTime(d) : "—");

  function fieldHtml(f, v) {
    const val = v[f.name] != null ? v[f.name] : f.default != null ? f.default : "";
    const id = "f-" + f.name;
    let ctrl;
    if (f.type === "textarea") {
      ctrl = '<textarea class="input" id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 4) + '" placeholder="' + esc(f.placeholder || "") + '">' + esc(val) + "</textarea>";
    } else if (f.type === "select") {
      ctrl = '<select class="input" id="' + id + '" name="' + f.name + '">' + f.options.map((o) => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? " selected" : "") + ">" + esc(o.label) + "</option>").join("") + "</select>";
    } else if (f.type === "checkbox") {
      return '<label class="check"><input type="checkbox" name="' + f.name + '"' + (val ? " checked" : "") + " /> " + esc(f.label) + (f.hint ? '<small class="hint"> — ' + esc(f.hint) + "</small>" : "") + "</label>";
    } else {
      const t = f.type === "number" ? "number" : f.type === "url" ? "text" : "text";
      ctrl = '<input class="input" id="' + id + '" name="' + f.name + '" type="' + t + '"' + (f.type === "url" ? ' dir="ltr" inputmode="url"' : "") + (f.type === "number" ? ' dir="ltr" step="1"' : "") + ' value="' + esc(val) + '" placeholder="' + esc(f.placeholder || "") + '"' + (f.max ? ' maxlength="' + f.max + '"' : "") + " />";
    }
    const upload = f.upload
      ? '<label class="btn btn-sm upload-btn">' + RSU.icon("upload") + " رفع صورة<input type=\"file\" accept=\"image/png,image/jpeg,image/webp,image/gif\" data-upload=\"" + f.name + "\" data-folder=\"" + esc(f.upload) + '" hidden /></label>'
      : "";
    return '<div class="field"><span>' + esc(f.label) + (f.required ? ' <b class="req">*</b>' : "") + "</span>" + (upload ? '<div class="with-upload">' + ctrl + upload + "</div>" : ctrl) + (f.hint ? '<div class="hint">' + esc(f.hint) + "</div>" : "") + "</div>";
  }

  /** يربط رفع الصور داخل أي form */
  function bindUploads(root) {
    root.querySelectorAll("input[data-upload]").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const file = inp.files[0];
        if (!file) return;
        const lbl = inp.closest("label");
        const old = lbl.innerHTML;
        lbl.classList.add("is-busy");
        try {
          const url = await RSU.data.gallery.uploadMedia(file, inp.dataset.folder);
          root.querySelector('[name="' + inp.dataset.upload + '"]').value = url;
          ui.toast("اترفعت الصورة ✅", "success");
        } catch (e) {
          ui.toast(RSU.humanError(e), "error");
        } finally {
          lbl.classList.remove("is-busy");
          inp.value = "";
        }
      });
    });
  }

  function readForm(form, fields) {
    const out = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      if (!el) continue;
      if (f.type === "checkbox") { out[f.name] = el.checked; continue; }
      let v = String(el.value || "").trim();
      if (f.required && !v) { el.focus(); throw new Error("حقل «" + f.label + "» مطلوب.") }
      if (f.type === "url" && v && !RSU.safeUrl(v)) { el.focus(); throw new Error("«" + f.label + "» لازم يكون رابط صحيح يبدأ بـ https://") }
      if (f.type === "number" && v && !/^-?\d+$/.test(v)) { el.focus(); throw new Error("«" + f.label + "» لازم يكون رقم صحيح.") }
      out[f.name] = v;
    }
    return out;
  }

  /** مودال نموذج عام: onSubmit(values) */
  function formModal(o) {
    const v = o.values || {};
    const m = ui.modal(
      "<h3>" + esc(o.title) + '</h3><form id="fm" novalidate>' + o.fields.map((f) => fieldHtml(f, v)).join("") +
        '<div class="actions"><button type="button" class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" type="submit">' + esc(o.submitText || "حفظ") + "</button></div></form>",
      { persistent: true }
    );
    const form = m.el.querySelector("#fm");
    bindUploads(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("[type=submit]");
      let values;
      try { values = readForm(form, o.fields); } catch (err) { return ui.toast(err.message, "error"); }
      ui.busy(btn, true, "بنحفظ…");
      try {
        await o.onSubmit(values);
        m.close();
        ui.toast("اتحفظ ✅", "success");
        if (o.after) o.after();
      } catch (err) {
        console.error(err);
        ui.busy(btn, false);
        ui.toast(RSU.humanError(err), "error");
      }
    });
    return m;
  }

  async function removeWithConfirm(label, fn, after) {
    const ok = await ui.confirm({ title: "حذف", message: "متأكدة إنك عايزة تحذفي «" + label + "»؟ مش هينفع ترجّعيه.", okText: "حذف", danger: true });
    if (!ok) return;
    try { await fn(); ui.toast("اتحذف", "success"); after(); } catch (e) { ui.toast(RSU.humanError(e), "error"); }
  }

  const head = (title, btnLabel, id) =>
    '<div class="admin-head"><h2>' + esc(title) + "</h2>" + (btnLabel ? '<button class="btn btn-primary" id="' + id + '">' + RSU.icon("plus") + " " + esc(btnLabel) + "</button>" : "") + "</div>";
  const rowBtns = (edit, del) =>
    '<div class="row-actions"><button class="btn btn-icon sm" data-edit="' + esc(edit) + '" aria-label="تعديل">' + RSU.icon("pencil") + '</button><button class="btn btn-icon sm btn-danger" data-del="' + esc(del) + '" aria-label="حذف">' + RSU.icon("trash-2") + "</button></div>";

  /* ======================= نظرة عامة ======================= */
  async function tabOverview() {
    const names = [["profiles", "مستخدمين", "users"], ["songs", "أغاني", "music"], ["gallery_images", "صور", "image"], ["letters", "رسائل", "mail"], ["quiz_results", "نتائج اختبار", "trophy"], ["user_activity", "حدث نشاط", "clock"]];
    ui.load(panel, () => RSU.data.admin.counts(), (counts) => {
      panel.innerHTML = head("نظرة عامة") +
        '<div class="stats">' + names.map((n, i) => '<div class="glass stat"><div class="stat-ico">' + RSU.icon(n[2]) + '</div><div class="stat-val">' + RSU.num(counts[n[0]]) + '</div><div class="stat-lbl">' + n[1] + "</div></div>").join("") + "</div>" +
        '<div class="glass card" style="margin-top:20px"><h3>ازاي تبدئي؟</h3><ol class="steps"><li>ضيف الأغاني (روابط رسمية) من تبويب «الأغاني».</li><li>اكتب نبذة الفنان وحطي الصور من «محتوى الموقع».</li><li>ضيفي الصور المرخّصة في «المعرض».</li><li>عدّلي الرسائل والأسئلة لو حابة.</li></ol></div>';
      RSU.hydrateIcons(panel);
    });
  }

  /* ======================= الأغاني ======================= */
  const SONG_FIELDS = [
    { name: "title", label: "اسم الأغنية", required: true, max: 120 },
    { name: "album", label: "الألبوم", max: 120 },
    { name: "year", label: "سنة الإصدار", type: "number", placeholder: "مثال: 2019", hint: "اتركيها فاضية لو مش متأكدة." },
    { name: "cover_url", label: "صورة الغلاف", type: "url", upload: "covers", hint: "رابط أو رفع — استخدمي صورة تملكي حق استخدامها." },
    { name: "play_url", label: "رابط التشغيل الرسمي", type: "url", required: true, hint: "يوتيوب (القناة الرسمية) أو ملف صوت مرخّص .mp3 أو رابط الأغنية على منصة رسمية." },
    { name: "sort_order", label: "الترتيب", type: "number", default: 0, hint: "الأصغر بيظهر الأول." }
  ];
  async function tabSongs() {
    ui.load(panel, () => RSU.data.songs.list(), (songs) => {
      panel.innerHTML = head("إدارة الأغاني", "إضافة أغنية", "add") +
        (songs.length
          ? '<div class="admin-list">' + songs.map((s) =>
              '<div class="glass admin-row"><div class="thumb cover">' + RSU.coverHtml(s.cover_url, s.title, "music") + '</div><div class="row-main"><strong>' + esc(s.title) + "</strong><span class=\"muted\">" + esc([s.album, s.year].filter(Boolean).join(" · ") || "—") +
              ' <span class="badge ' + (s.source === "youtube" ? "pink" : s.source === "audio" ? "gold" : "") + '">' + (s.source === "youtube" ? "يوتيوب" : s.source === "audio" ? "ملف صوت" : "رابط خارجي") + "</span></span></div>" + rowBtns(s.id, s.id) + "</div>").join("") + "</div>"
          : ui.empty({ icon: "music", title: "لسه مفيش أغاني", text: "ابدئي بإضافة أول أغنية بالرابط الرسمي.", action: { label: "إضافة أغنية" } }));
      RSU.hydrateIcons(panel);
      const add = () => formModal({ title: "إضافة أغنية", fields: SONG_FIELDS, onSubmit: (v) => RSU.data.songs.save(null, v), after: tabSongs });
      const addBtn = panel.querySelector("#add"); if (addBtn) addBtn.addEventListener("click", add);
      const ea = panel.querySelector("[data-empty-action]"); if (ea) ea.addEventListener("click", add);
      panel.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const s = songs.find((x) => x.id === b.dataset.edit);
        formModal({ title: "تعديل أغنية", fields: SONG_FIELDS, values: s, onSubmit: (v) => RSU.data.songs.save(s.id, v), after: tabSongs });
      }));
      panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        const s = songs.find((x) => x.id === b.dataset.del);
        removeWithConfirm(s.title, async () => {
          await RSU.data.songs.removeSong(s.id);
          const cur = RSU.player.state.queue[RSU.player.state.index];
          if (cur && cur.id === s.id) RSU.player.clear();
        }, tabSongs);
      }));
    });
  }

  /* ======================= المعرض ======================= */
  const IMG_FIELDS = [
    { name: "url", label: "الصورة", type: "url", required: true, upload: "gallery", hint: "رابط أو رفع من جهازك (JPG/PNG/WebP حتى ٨ ميجا)." },
    { name: "caption", label: "وصف قصير", max: 140 },
    { name: "category", label: "التصنيف", default: "عام", max: 40, hint: "مثال: حفلات، كواليس، ألبومات." },
    { name: "credit", label: "المصدر / الترخيص", max: 160, hint: "مهم: اكتب مصدر الصورة ونوع الترخيص." },
    { name: "sort_order", label: "الترتيب", type: "number", default: 0 }
  ];
  async function tabGallery() {
    ui.load(panel, () => RSU.data.gallery.list(), (imgs) => {
      panel.innerHTML = head("إدارة المعرض", "إضافة صورة", "add") +
        '<p class="notice">' + RSU.icon("info") + " ماتضيفيش صور إلا اللي ليكي حق استخدامها أو مرخّصة. الصور على الإنترنت مش مجانية تلقائيًا.</p>" +
        (imgs.length
          ? '<div class="admin-gal">' + imgs.map((im) =>
              '<div class="glass gal-tile"><div class="cover">' + RSU.coverHtml(im.url, im.caption, "image") + '</div><div class="gal-meta"><strong>' + esc(im.caption || "بدون وصف") + '</strong><span class="muted">' + esc(im.category) + "</span>" + rowBtns(im.id, im.id) + "</div></div>").join("") + "</div>"
          : ui.empty({ icon: "image", title: "المعرض فاضي", text: "ضيف أول صورة.", action: { label: "إضافة صورة" } }));
      RSU.hydrateIcons(panel);
      const add = () => formModal({ title: "إضافة صورة", fields: IMG_FIELDS, onSubmit: (v) => RSU.data.gallery.create(clean(v)), after: tabGallery });
      const clean = (v) => ({ url: v.url, caption: v.caption || null, category: v.category || "عام", credit: v.credit || null, sort_order: Number(v.sort_order) || 0 });
      const addBtn = panel.querySelector("#add"); if (addBtn) addBtn.addEventListener("click", add);
      const ea = panel.querySelector("[data-empty-action]"); if (ea) ea.addEventListener("click", add);
      panel.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const im = imgs.find((x) => x.id === b.dataset.edit);
        formModal({ title: "تعديل صورة", fields: IMG_FIELDS, values: im, onSubmit: (v) => RSU.data.gallery.update(im.id, clean(v)), after: tabGallery });
      }));
      panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        const im = imgs.find((x) => x.id === b.dataset.del);
        removeWithConfirm(im.caption || "الصورة", () => RSU.data.gallery.remove(im.id), tabGallery);
      }));
    });
  }

  /* ======================= محتوى الموقع ======================= */
  async function tabContent() {
    ui.load(panel, () => RSU.data.content.all(true), (c) => {
      const A = [
        { name: "name", label: "اسم الفنان", max: 80, required: true },
        { name: "bio", label: "نبذة عن الفنان", type: "textarea", rows: 6, hint: "فقرة جديدة = سطر فاضي." },
        { name: "career", label: "مسيرته الفنية", type: "textarea", rows: 6 },
        { name: "hero_image", label: "صورة الداشبورد والنبذة", type: "url", upload: "site" },
        { name: "splash_image", label: "صورة شاشة البداية (خلفية سينمائية)", type: "url", upload: "site", hint: "أفقية وعالية الجودة يفضّل." },
        { name: "concert_image", label: "صورة التذكرة (اختياري)", type: "url", upload: "site", hint: "لو فاضية بنستخدم صورة الداشبورد." }
      ];
      const C = [
        { name: "title", label: "اسم الحفلة", max: 60, required: true },
        { name: "date_label", label: "التاريخ (لازم يوضح إنه تجريبي)", max: 90, required: true },
        { name: "venue", label: "المكان الخيالي", max: 80 },
        { name: "note", label: "ملاحظة أسفل التذكرة", max: 120 }
      ];
      panel.innerHTML = head("محتوى الموقع") +
        '<form class="glass card" id="f-artist" novalidate><h3>معلومات الفنان</h3>' + A.map((f) => fieldHtml(f, c.artist)).join("") + '<button class="btn btn-primary" type="submit">' + RSU.icon("save") + " حفظ</button></form>" +
        '<form class="glass card" id="f-phrases" novalidate><h3>عبارات الترحيب في الداشبورد</h3><div class="field"><span>كل سطر عبارة</span><textarea class="input" name="phrases" rows="6">' + esc(c.welcome_phrases.join("\n")) + '</textarea></div><button class="btn btn-primary" type="submit">' + RSU.icon("save") + " حفظ</button></form>" +
        '<form class="glass card" id="f-concert" novalidate><h3>تذكرة الحفلة</h3>' + C.map((f) => fieldHtml(f, c.concert)).join("") + '<button class="btn btn-primary" type="submit">' + RSU.icon("save") + " حفظ</button></form>";
      RSU.hydrateIcons(panel);
      panel.querySelectorAll("form").forEach(bindUploads);
      const submit = (formId, fields, key, build) =>
        panel.querySelector(formId).addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = e.target.querySelector("[type=submit]");
          let vals;
          try { vals = fields ? readForm(e.target, fields) : null; } catch (err) { return ui.toast(err.message, "error"); }
          ui.busy(btn, true, "بنحفظ…");
          try { await RSU.data.content.set(key, build(vals, e.target)); ui.toast("اتحفظ ✅", "success"); }
          catch (err) { ui.toast(RSU.humanError(err), "error"); }
          finally { ui.busy(btn, false); }
        });
      submit("#f-artist", A, "artist", (v) => v);
      submit("#f-phrases", null, "welcome_phrases", (_, f) => f.elements.phrases.value.split("\n").map((x) => x.trim()).filter(Boolean));
      submit("#f-concert", C, "concert", (v) => v);
    });
  }

  /* ======================= الألبومات والمحطات ======================= */
  const ALBUM_FIELDS = [
    { name: "title", label: "اسم الألبوم", required: true, max: 120 },
    { name: "year", label: "السنة", type: "number" },
    { name: "cover_url", label: "الغلاف", type: "url", upload: "covers" },
    { name: "description", label: "وصف قصير", type: "textarea", rows: 3, max: 400 },
    { name: "sort_order", label: "الترتيب", type: "number", default: 0 }
  ];
  const TL_FIELDS = [
    { name: "year", label: "السنة / الفترة", required: true, max: 30, placeholder: "مثال: 2012" },
    { name: "title", label: "العنوان", required: true, max: 120 },
    { name: "description", label: "التفاصيل", type: "textarea", rows: 3 },
    { name: "sort_order", label: "الترتيب", type: "number", default: 0, hint: "الأصغر الأول (رتّبيهم من الأقدم للأحدث)." }
  ];
  async function tabCareer() {
    ui.load(panel, () => Promise.all([RSU.data.albums.list(), RSU.data.timeline.list()]), ([albums, tl]) => {
      panel.innerHTML =
        head("الألبومات", "إضافة ألبوم", "add-album") +
        (albums.length ? '<div class="admin-list">' + albums.map((a) => '<div class="glass admin-row"><div class="thumb cover">' + RSU.coverHtml(a.cover_url, a.title, "disc") + '</div><div class="row-main"><strong>' + esc(a.title) + '</strong><span class="muted">' + esc(a.year || "—") + "</span></div>" + rowBtns("a:" + a.id, "a:" + a.id) + "</div>").join("") + "</div>" : ui.empty({ icon: "disc", title: "مفيش ألبومات" })) +
        '<div style="height:26px"></div>' + head("الخط الزمني (Timeline)", "إضافة محطة", "add-tl") +
        (tl.length ? '<div class="admin-list">' + tl.map((t) => '<div class="glass admin-row"><span class="badge gold">' + esc(t.year) + '</span><div class="row-main"><strong>' + esc(t.title) + "</strong></div>" + rowBtns("t:" + t.id, "t:" + t.id) + "</div>").join("") + "</div>" : ui.empty({ icon: "clock", title: "مفيش محطات" }));
      RSU.hydrateIcons(panel);
      const nums = (v) => Object.assign({}, v, { year: v.year, sort_order: Number(v.sort_order) || 0 });
      const albumPayload = (v) => ({ title: v.title, year: v.year ? Number(v.year) : null, cover_url: v.cover_url || null, description: v.description || null, sort_order: Number(v.sort_order) || 0 });
      const tlPayload = (v) => ({ year: v.year, title: v.title, description: v.description || null, sort_order: Number(v.sort_order) || 0 });
      panel.querySelector("#add-album").addEventListener("click", () => formModal({ title: "إضافة ألبوم", fields: ALBUM_FIELDS, onSubmit: (v) => RSU.data.albums.create(albumPayload(v)), after: tabCareer }));
      panel.querySelector("#add-tl").addEventListener("click", () => formModal({ title: "إضافة محطة", fields: TL_FIELDS, onSubmit: (v) => RSU.data.timeline.create(tlPayload(v)), after: tabCareer }));
      panel.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const [k, id] = b.dataset.edit.split(":");
        if (k === "a") { const a = albums.find((x) => x.id === id); formModal({ title: "تعديل ألبوم", fields: ALBUM_FIELDS, values: a, onSubmit: (v) => RSU.data.albums.update(id, albumPayload(v)), after: tabCareer }); }
        else { const t = tl.find((x) => x.id === id); formModal({ title: "تعديل محطة", fields: TL_FIELDS, values: t, onSubmit: (v) => RSU.data.timeline.update(id, tlPayload(v)), after: tabCareer }); }
      }));
      panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        const [k, id] = b.dataset.del.split(":");
        const item = (k === "a" ? albums : tl).find((x) => x.id === id);
        removeWithConfirm(item.title, () => (k === "a" ? RSU.data.albums : RSU.data.timeline).remove(id), tabCareer);
      }));
    });
  }

  /* ======================= الرسائل ======================= */
  const LETTER_FIELDS = [
    { name: "title", label: "عنوان (اختياري)", max: 80 },
    { name: "body", label: "نص الرسالة", type: "textarea", rows: 7, required: true },
    { name: "is_secret", label: "رسالة سرية", type: "checkbox", hint: "بتظهر بس بعد ما تفتح كل الرسائل العادية (الشرط متحقق في قاعدة البيانات)" }
  ];
  async function tabLetters() {
    ui.load(panel, () => RSU.data.letters.list(), (ls) => {
      panel.innerHTML = head("رسائل من القلب", "إضافة رسالة", "add") +
        (ls.length ? '<div class="admin-list">' + ls.map((l) => '<div class="glass admin-row"><div class="row-main"><strong>' + esc(l.title || "بدون عنوان") + (l.is_secret ? ' <span class="badge gold">سرية</span>' : "") + '</strong><span class="muted clamp">' + esc(l.body) + "</span></div>" + rowBtns(l.id, l.id) + "</div>").join("") + "</div>" : ui.empty({ icon: "mail", title: "مفيش رسائل", action: { label: "إضافة رسالة" } }));
      RSU.hydrateIcons(panel);
      const pl = (v) => ({ title: v.title || null, body: v.body, is_secret: !!v.is_secret });
      const add = () => formModal({ title: "إضافة رسالة", fields: LETTER_FIELDS, onSubmit: (v) => RSU.data.letters.create(pl(v)), after: tabLetters });
      const addBtn = panel.querySelector("#add"); if (addBtn) addBtn.addEventListener("click", add);
      const ea = panel.querySelector("[data-empty-action]"); if (ea) ea.addEventListener("click", add);
      panel.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const l = ls.find((x) => x.id === b.dataset.edit);
        formModal({ title: "تعديل رسالة", fields: LETTER_FIELDS, values: l, onSubmit: (v) => RSU.data.letters.update(l.id, pl(v)), after: tabLetters });
      }));
      panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        const l = ls.find((x) => x.id === b.dataset.del);
        removeWithConfirm(l.title || "الرسالة", () => RSU.data.letters.remove(l.id), tabLetters);
      }));
    });
  }

  /* ======================= الاختبار ======================= */
  const Q_FIELDS = [
    { name: "question", label: "نص السؤال", required: true, max: 200 },
    { name: "position", label: "الترتيب", type: "number", default: 0 },
    { name: "options", label: "الاختيارات", type: "textarea", rows: 6, required: true, hint: "كل سطر اختيار بالشكل: النص | النقاط (مثال: بسمعه كل يوم | 4). لازم اختيارين على الأقل." }
  ];
  const optsToText = (o) => (Array.isArray(o) ? o.map((x) => x.text + " | " + x.points).join("\n") : "");
  function parseOpts(txt) {
    const opts = txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.lastIndexOf("|");
      const text = (i === -1 ? l : l.slice(0, i)).trim();
      const pts = i === -1 ? 1 : parseInt(l.slice(i + 1).trim(), 10);
      return { text, points: Number.isFinite(pts) ? Math.max(0, Math.min(10, pts)) : 1 };
    }).filter((o) => o.text);
    if (opts.length < 2) throw new Error("لازم تكتبي اختيارين على الأقل.");
    return opts;
  }
  async function tabQuiz() {
    ui.load(panel, () => Promise.all([RSU.data.quiz.questions(), RSU.data.admin.quizResults()]), ([qs, results]) => {
      panel.innerHTML = head("أسئلة الاختبار", "إضافة سؤال", "add") +
        (qs.length ? '<div class="admin-list">' + qs.map((q) => '<div class="glass admin-row"><span class="badge">' + RSU.num(q.position) + '</span><div class="row-main"><strong>' + esc(q.question) + '</strong><span class="muted">' + RSU.num((q.options || []).length) + " اختيارات</span></div>" + rowBtns(q.id, q.id) + "</div>").join("") + "</div>" : ui.empty({ icon: "trophy", title: "مفيش أسئلة" })) +
        '<div style="height:26px"></div><div class="admin-head"><h2>نتائج المستخدمين</h2></div>' +
        (results.length
          ? '<div class="glass table-wrap"><table class="table"><thead><tr><th>المستخدمة</th><th>النتيجة</th><th>التصنيف</th><th>التاريخ</th><th></th></tr></thead><tbody>' +
            results.map((r) => "<tr><td>" + esc(r.profile ? r.profile.display_name : "—") + '</td><td dir="ltr">' + RSU.num(r.score) + " / " + RSU.num(r.max_score) + "</td><td>" + esc(r.tier) + "</td><td>" + esc(fmtDT(r.created_at)) + '</td><td><button class="btn btn-icon sm btn-danger" data-delres="' + esc(r.id) + '" aria-label="حذف">' + RSU.icon("trash-2") + "</button></td></tr>").join("") + "</tbody></table></div>"
          : ui.empty({ icon: "bar-chart", title: "لسه محدش عمل الاختبار" }));
      RSU.hydrateIcons(panel);
      const payload = (v) => ({ question: v.question, position: Number(v.position) || 0, options: parseOpts(v.options) });
      panel.querySelector("#add").addEventListener("click", () => formModal({ title: "إضافة سؤال", fields: Q_FIELDS, onSubmit: (v) => RSU.data.quiz.createQuestion(payload(v)), after: tabQuiz }));
      panel.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const q = qs.find((x) => x.id === b.dataset.edit);
        formModal({ title: "تعديل سؤال", fields: Q_FIELDS, values: Object.assign({}, q, { options: optsToText(q.options) }), onSubmit: (v) => RSU.data.quiz.updateQuestion(q.id, payload(v)), after: tabQuiz });
      }));
      panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        const q = qs.find((x) => x.id === b.dataset.del);
        removeWithConfirm(q.question, () => RSU.data.quiz.removeQuestion(q.id), tabQuiz);
      }));
      panel.querySelectorAll("[data-delres]").forEach((b) => b.addEventListener("click", () => removeWithConfirm("النتيجة", () => RSU.data.admin.deleteQuizResult(b.dataset.delres), tabQuiz)));
    });
  }

  /* ======================= المستخدمين ======================= */
  async function tabUsers() {
    ui.load(panel, () => RSU.data.admin.users(), (users) => {
      panel.innerHTML = head("المستخدمين (" + RSU.num(users.length) + ")") +
        '<div class="glass table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>البريد</th><th>الزيارات</th><th>آخر ظهور</th><th>الدور</th><th></th></tr></thead><tbody>' +
        users.map((u) => '<tr><td><div class="u-name"><span class="avatar">' + (u.avatar_url ? '<img src="' + esc(RSU.safeUrl(u.avatar_url)) + '" alt="" />' : esc(RSU.initials(u.display_name))) + "</span>" + esc(u.display_name) + '</div></td><td dir="ltr">' + esc(u.email || "—") + "</td><td>" + RSU.num(u.visit_count) + "</td><td>" + esc(fmtDT(u.last_seen_at)) +
          '</td><td><span class="badge ' + (u.role === "admin" ? "pink" : "") + '">' + (u.role === "admin" ? "أدمن" : "مستخدمة") + '</span></td><td>' +
          (u.id === ctx.user.id ? '<span class="muted">إنتِ</span>' : '<div class="row-actions"><button class="btn btn-sm" data-role="' + esc(u.id) + '" data-to="' + (u.role === "admin" ? "user" : "admin") + '">' + (u.role === "admin" ? "إلغاء الأدمن" : "تعيين أدمن") + '</button><button class="btn btn-sm" data-reset="' + esc(u.id) + '">رابط استعادة</button></div>') + "</td></tr>").join("") + "</tbody></table></div>";
      panel.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", async () => {
        try {
          const url = await RSU.data.admin.resetLink(b.dataset.reset);
          const m = ui.modal(
            "<h3>رابط استعادة كلمة المرور</h3><p class=\"muted\">ابعتيه للمستخدمة — صالح ساعة واحدة ولمرة واحدة.</p>" +
              '<input class="input" id="rl-url" dir="ltr" readonly value="' + esc(url) + '" />' +
              '<div class="actions"><button class="btn btn-ghost" data-close>إغلاق</button><button class="btn btn-primary" id="rl-copy">نسخ الرابط</button></div>',
            {}
          );
          const input = m.el.querySelector("#rl-url");
          input.addEventListener("focus", () => input.select());
          m.el.querySelector("#rl-copy").addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(url); ui.toast("اتنسخ الرابط ✅", "success"); } catch (e) { input.select(); }
          });
        } catch (e) { ui.toast(RSU.humanError(e), "error"); }
      }));
      panel.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", async () => {
        const to = b.dataset.to;
        const ok = await ui.confirm({ title: "تغيير الصلاحية", message: to === "admin" ? "هتدّي المستخدم ده صلاحيات إدارة كاملة. متأكدة؟" : "هتشيلي صلاحيات الإدارة من المستخدم ده. متأكدة؟", okText: "تأكيد", danger: to === "admin" });
        if (!ok) return;
        try { await RSU.data.admin.setRole(b.dataset.role, to); ui.toast("اتغيّرت الصلاحية ✅", "success"); tabUsers(); }
        catch (e) { ui.toast(RSU.humanError(e), "error"); }
      }));
    });
  }

  /* ======================= النشاط ======================= */
  const ACTIONS = { visit: "زيارة جديدة", page_view: "تصفّح صفحة", play: "تشغيل أغنية", favorite: "أضافت للمفضلة", unfavorite: "شالت من المفضلة", quiz_done: "أنهت الاختبار", letter_open: "فتحت رسالة", ticket_download: "حمّلت التذكرة", profile_update: "عدّلت حسابها" };
  async function tabActivity() {
    ui.load(panel, () => RSU.data.admin.recentActivity(), (rows) => {
      panel.innerHTML = head("آخر النشاط") +
        (rows.length
          ? '<div class="glass table-wrap"><table class="table"><thead><tr><th>المستخدمة</th><th>الحدث</th><th>تفاصيل</th><th>الوقت</th></tr></thead><tbody>' +
            rows.map((r) => "<tr><td>" + esc(r.name) + "</td><td>" + esc(ACTIONS[r.action] || r.action) + "</td><td>" + esc(r.meta && (r.meta.song || r.meta.page || r.meta.tier) || "") + "</td><td>" + esc(fmtDT(r.created_at)) + "</td></tr>").join("") + "</tbody></table></div>"
          : ui.empty({ icon: "clock", title: "مفيش نشاط لسه" }));
    });
  }

  /* ---------- Router ---------- */
  const VIEWS = { overview: tabOverview, songs: tabSongs, gallery: tabGallery, content: tabContent, career: tabCareer, letters: tabLetters, quiz: tabQuiz, users: tabUsers, activity: tabActivity };
  function go(id) {
    if (!VIEWS[id]) id = "overview";
    app.querySelectorAll(".admin-tab").forEach((t) => {
      const on = t.dataset.tab === id;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    history.replaceState(null, "", "#" + id);
    VIEWS[id]();
  }
  app.querySelector(".admin-tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".admin-tab");
    if (b) go(b.dataset.tab);
  });
  RSU.hydrateIcons(app);
  go(location.hash.replace("#", "") || "overview");
});
