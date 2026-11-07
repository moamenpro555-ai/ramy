/* Page bootstrap + route guard
   كل صفحة داخلية بتنادي RSU.boot({ page, admin }, main)
   - مفيش جلسة  → رجوع لصفحة الدخول
   - صفحة أدمن  → بيتحقق من الدور المحفوظ في قاعدة البيانات (مش من الواجهة)
   ملاحظة: حماية البيانات الفعلية بتتم في الباك إند (JWT + فحص الدور من قاعدة البيانات) — الـ guard هنا للتجربة فقط. */
(function () {
  const RSU = (window.RSU = window.RSU || {});

  const NO_LAST_PAGE = { dashboard: 1, admin: 1 };

  function ensureBackground() {
    if (!document.querySelector(".bg-aurora")) {
      const d = document.createElement("div");
      d.className = "bg-aurora";
      document.body.prepend(d);
    }
  }

  RSU.boot = async function (opts, main) {
    const app = document.getElementById("app");

    if (!RSU.configured) {
      RSU.renderSetupNeeded();
      return;
    }
    ensureBackground();
    RSU.hydrateIcons();

    let session;
    try {
      session = await RSU.auth.getSession();
    } catch (e) {
      app.innerHTML = RSU.ui.errorState(RSU.humanError(e));
      app.querySelector("[data-retry]").addEventListener("click", () => location.reload());
      return;
    }
    if (!session) {
      location.replace("index.html?next=" + encodeURIComponent(opts.page));
      return;
    }
    const user = session.user;

    let profile, role;
    try {
      [profile, role] = await Promise.all([RSU.data.profile.get(user.id), RSU.data.profile.role(user.id)]);
    } catch (e) {
      console.error(e);
      app.innerHTML = RSU.ui.errorState(RSU.humanError(e));
      app.querySelector("[data-retry]").addEventListener("click", () => location.reload());
      return;
    }
    if (!profile) {
      const meta = user.user_metadata || {};
      profile = { id: user.id, display_name: meta.display_name || (user.email || "").split("@")[0] || "", avatar_url: null, favorite_song_id: null, visit_count: 0, last_page: null, settings: {} };
    }
    profile.settings = profile.settings || {};
    const isAdmin = role === "admin";

    if (opts.admin && !isAdmin) {
      RSU.store.set("flash", "صفحة الإدارة متاحة للأدمن فقط.");
      location.replace("dashboard.html");
      return;
    }

    const ctx = { user, profile, isAdmin, page: opts.page, settings: profile.settings };
    RSU.ctx = ctx;

    RSU.ui.renderHeader(ctx);
    RSU.fx.init({ ambient: profile.settings.fx !== false });
    RSU.player.mount();

    // عدّاد الزيارات: مرة واحدة لكل جلسة متصفح
    const vKey = "rsu:visit:" + user.id;
    try {
      if (!sessionStorage.getItem(vKey)) {
        const n = await RSU.data.profile.touchVisit();
        if (typeof n === "number") profile.visit_count = n;
        sessionStorage.setItem(vKey, "1");
        RSU.data.activity.log(user.id, "visit", {});
      }
    } catch (e) { /* مش مشكلة لو فشل العدّاد */ }

    // آخر صفحة + نشاط
    if (!NO_LAST_PAGE[opts.page]) {
      RSU.store.set("lastPage", opts.page);
      RSU.data.profile.update(user.id, { last_page: opts.page }).catch(() => {});
    }
    RSU.data.activity.log(user.id, "page_view", { page: opts.page });

    RSU.auth.onChange((event) => {
      if (event === "SIGNED_OUT") location.replace("index.html");
    });

    const flash = RSU.store.get("flash", null);
    if (flash) {
      RSU.store.del("flash");
      RSU.ui.toast(flash, "info");
    }

    try {
      await main(ctx, app);
    } catch (e) {
      console.error(e);
      app.innerHTML = RSU.ui.errorState(RSU.humanError(e));
      const b = app.querySelector("[data-retry]");
      if (b) b.addEventListener("click", () => location.reload());
    }
  };

  /** عنوان قسم موحّد */
  RSU.pageHead = (title, text, icon) =>
    '<div class="page-head"><h1 class="gold-text">' + (icon ? RSU.icon(icon) + " " : "") + RSU.esc(title) + "</h1>" + (text ? "<p>" + RSU.esc(text) + "</p>" : "") + "</div>";

  /** غلاف الصورة: أيقونة احتياطية دايمًا تحت، والصورة فوقها (لو الرابط باظ بتتشال وتظهر الأيقونة) */
  RSU.coverHtml = (url, alt, icon) => {
    const u = url && RSU.safeUrl(url);
    return (
      '<span class="cover-fallback">' + RSU.icon(icon || "music") + "</span>" +
      (u ? '<img src="' + RSU.esc(u) + '" alt="' + RSU.esc(alt || "") + '" loading="lazy" decoding="async" onerror="this.remove()" />' : "")
    );
  };
})();
