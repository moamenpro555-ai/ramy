/* UI helpers: toasts, modals, states, header */
(function () {
  const RSU = (window.RSU = window.RSU || {});
  const { esc } = RSU;

  const ui = (RSU.ui = {});

  /* ---------- Toasts ---------- */
  ui.toast = function (message, type) {
    type = type || "info";
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.setAttribute("role", type === "error" ? "alert" : "status");
    t.innerHTML = RSU.icon(type === "success" ? "check" : type === "error" ? "alert-circle" : "info") + "<span>" + esc(message) + "</span>";
    box.appendChild(t);
    const kill = () => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 350);
    };
    setTimeout(kill, type === "error" ? 6000 : 3800);
    t.addEventListener("click", kill);
    return t;
  };

  /* ---------- Modal ---------- */
  ui.modal = function (html, opts) {
    opts = opts || {};
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = '<div class="glass modal" role="dialog" aria-modal="true">' + html + "</div>";
    document.body.appendChild(back);
    const box = back.firstElementChild;
    RSU.hydrateIcons(box);
    const prevFocus = document.activeElement;
    function close(result) {
      document.removeEventListener("keydown", onKey);
      back.remove();
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
      if (opts.onClose) opts.onClose(result);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    back.addEventListener("mousedown", (e) => {
      if (e.target === back && !opts.persistent) close();
    });
    box.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close()));
    const first = box.querySelector("[autofocus], input, textarea, select, button");
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 50);
    return { el: box, close };
  };

  ui.confirm = function (o) {
    o = o || {};
    return new Promise((resolve) => {
      let done = false;
      const m = ui.modal(
        "<h3>" + esc(o.title || "متأكدة؟") + "</h3><p>" + esc(o.message || "") + "</p>" +
          '<div class="actions"><button class="btn btn-ghost" data-no>' + esc(o.cancelText || "إلغاء") + "</button>" +
          '<button class="btn ' + (o.danger ? "btn-danger" : "btn-primary") + '" data-yes>' + esc(o.okText || "تأكيد") + "</button></div>",
        { onClose: () => { if (!done) resolve(false); } }
      );
      m.el.querySelector("[data-yes]").addEventListener("click", () => { done = true; m.close(); resolve(true); });
      m.el.querySelector("[data-no]").addEventListener("click", () => m.close());
    });
  };

  /* ---------- States (loading / empty / error) ---------- */
  ui.loading = (msg) => '<div class="state" role="status"><div class="loader"></div><p>' + esc(msg || "لحظة واحدة…") + "</p></div>";
  ui.skeletons = (n, cls) => Array.from({ length: n || 6 }, () => '<div class="skeleton ' + (cls || "") + '"></div>').join("");
  ui.empty = function (o) {
    o = o || {};
    const action = o.action
      ? o.action.href
        ? '<a class="btn btn-primary" href="' + esc(o.action.href) + '">' + esc(o.action.label) + "</a>"
        : '<button class="btn btn-primary" data-empty-action>' + esc(o.action.label) + "</button>"
      : "";
    return (
      '<div class="state"><div class="state-icon">' + RSU.icon(o.icon || "sparkles") + "</div><h3>" + esc(o.title || "لسه مفيش حاجة هنا") + "</h3>" +
      (o.text ? "<p>" + esc(o.text) + "</p>" : "") + action + "</div>"
    );
  };
  ui.errorState = (msg) =>
    '<div class="state error" role="alert"><div class="state-icon">' + RSU.icon("alert-circle") + "</div><h3>حصلت مشكلة</h3><p>" + esc(msg || "جرّبي تاني بعد شوية.") +
    '</p><button class="btn" data-retry>' + RSU.icon("refresh") + " حاولي تاني</button></div>";

  /** يعرض حالة تحميل ثم ينفّذ loader ويعرض النتيجة أو الخطأ مع زر إعادة المحاولة */
  ui.load = async function (el, loader, render, loadingHtml) {
    el.innerHTML = loadingHtml || ui.loading();
    try {
      const data = await loader();
      render(data);
      RSU.hydrateIcons(el);
    } catch (e) {
      console.error(e);
      el.innerHTML = ui.errorState(RSU.humanError(e));
      const b = el.querySelector("[data-retry]");
      if (b) b.addEventListener("click", () => ui.load(el, loader, render, loadingHtml));
    }
  };

  /* ---------- Button busy state ---------- */
  ui.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.html = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = RSU.icon("refresh", "spin") + "<span>" + esc(label || "لحظة…") + "</span>";
    } else {
      btn.disabled = false;
      if (btn.dataset.html != null) btn.innerHTML = btn.dataset.html;
    }
  };

  /* ---------- Password eye toggle ---------- */
  ui.bindPasswordToggles = function (root) {
    (root || document).querySelectorAll(".toggle-eye").forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.innerHTML = RSU.icon("eye");
      b.addEventListener("click", () => {
        const input = b.parentElement.querySelector("input");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        b.innerHTML = RSU.icon(show ? "eye-off" : "eye");
        b.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      });
    });
  };

  /* ---------- Header / navigation ---------- */
  const NAV = [
    { id: "dashboard", href: "dashboard.html", label: "الرئيسية", icon: "home" },
    { id: "music", href: "music.html", label: "الأغاني", icon: "music" },
    { id: "discover", href: "discover.html", label: "اكتشفي رامي", icon: "compass" },
    { id: "quiz", href: "quiz.html", label: "الاختبار", icon: "trophy" },
    { id: "letters", href: "letters.html", label: "رسائل من القلب", icon: "mail" },
    { id: "concert", href: "concert.html", label: "حفلتي", icon: "ticket" },
    { id: "gallery", href: "gallery.html", label: "المعرض", icon: "image" }
  ];
  ui.NAV = NAV;

  ui.renderHeader = function (ctx) {
    const items = NAV.concat(ctx.isAdmin ? [{ id: "admin", href: "admin.html", label: "الإدارة", icon: "shield" }] : []);
    const name = (ctx.profile && ctx.profile.display_name) || "";
    const av = ctx.profile && ctx.profile.avatar_url ? '<img src="' + esc(RSU.safeUrl(ctx.profile.avatar_url)) + '" alt="" />' : esc(RSU.initials(name));
    const h = document.createElement("header");
    h.className = "site-header";
    h.innerHTML =
      '<div class="container">' +
      '<button class="btn btn-icon sm menu-btn" aria-label="القائمة" aria-expanded="false" aria-controls="nav">' + RSU.icon("menu") + "</button>" +
      '<a class="brand" href="dashboard.html"><span class="logo-dot">' + RSU.icon("heart") + '</span><span class="gold-text">Ramy Sabry Universe</span></a>' +
      '<nav class="nav" id="nav" aria-label="التنقل">' +
      items.map((n) => '<a href="' + n.href + '" data-nav="' + n.id + '"' + (n.id === ctx.page ? ' class="is-active" aria-current="page"' : "") + ">" + RSU.icon(n.icon) + n.label + "</a>").join("") +
      "</nav>" +
      '<span class="spacer"></span>' +
      '<a class="user-chip" href="dashboard.html#profile" title="حسابي"><span class="name">' + esc(name) + '</span><span class="avatar" id="hdr-avatar">' + av + "</span></a>" +
      '<button class="btn btn-icon sm" id="logout-btn" aria-label="تسجيل الخروج" title="تسجيل الخروج">' + RSU.icon("log-out") + "</button>" +
      "</div>";
    document.body.prepend(h);

    const menuBtn = h.querySelector(".menu-btn");
    const nav = h.querySelector("#nav");
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.innerHTML = RSU.icon(open ? "x" : "menu");
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) nav.classList.remove("open");
    });
    h.querySelector("#logout-btn").addEventListener("click", async () => {
      const ok = await ui.confirm({ title: "تسجيل الخروج", message: "هتخرجي من عالمك، ومستنيينك ترجعي قريب ❤️", okText: "خروج" });
      if (ok) {
        try { await RSU.auth.signOut(); } catch (e) {}
        location.replace("index.html");
      }
    });
    return h;
  };

  ui.updateHeaderUser = function (profile) {
    const chip = document.querySelector(".user-chip");
    if (!chip || !profile) return;
    chip.querySelector(".name").textContent = profile.display_name || "";
    const av = document.getElementById("hdr-avatar");
    av.innerHTML = profile.avatar_url ? '<img src="' + esc(RSU.safeUrl(profile.avatar_url)) + '" alt="" />' : esc(RSU.initials(profile.display_name));
  };

  /** أزرار التشغيل [data-play="songId"] داخل عنصر: بتشغّل الأغنية وبتتزامن مع المشغّل الثابت */
  ui.bindPlayButtons = function (root, getList) {
    const list = () => (typeof getList === "function" ? getList() : getList) || [];
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-play]");
      if (!b || !root.contains(b)) return;
      const songs = list();
      const s = songs.find((x) => x.id === b.dataset.play);
      if (!s) return;
      const cur = RSU.player.state.queue[RSU.player.state.index];
      const starting = !(cur && cur.id === s.id && RSU.player.state.playing);
      RSU.player.playSong(s, songs);
      if (starting && RSU.ctx) RSU.data.activity.log(RSU.ctx.user.id, "play", { song: s.title });
    });
    const sync = (S) => {
      const cur = S.queue[S.index];
      root.querySelectorAll("[data-play]").forEach((b) => {
        const on = !!cur && cur.id === b.dataset.play && S.playing;
        b.innerHTML = RSU.icon(on ? "pause" : "play") + (b.dataset.label ? "<span>" + (on ? "إيقاف" : b.dataset.label) + "</span>" : "");
        b.classList.toggle("is-playing", on);
        b.setAttribute("aria-label", on ? "إيقاف مؤقت" : "تشغيل");
      });
    };
    sync(RSU.player.state);
    return RSU.player.subscribe(sync);
  };

  ui.greeting = function () {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "صباح الخير";
    if (h >= 12 && h < 18) return "نهارك سعيد";
    return "مساء الخير";
  };
})();
