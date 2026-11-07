/* gallery.html — معرض الصور (Masonry + Lightbox) */
RSU.boot({ page: "gallery" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;

  app.innerHTML = RSU.pageHead("المعرض", "صور بتصنيفات — اضغطي على أي صورة علشان تكبّريها.", "image") + '<div id="gal-body">' + ui.loading("بنحمّل الصور…") + "</div>";
  const body = app.querySelector("#gal-body");

  let images;
  try {
    images = await RSU.data.gallery.list();
  } catch (e) {
    console.error(e);
    body.innerHTML = ui.errorState(RSU.humanError(e));
    body.querySelector("[data-retry]").addEventListener("click", () => location.reload());
    return;
  }
  images = images.filter((i) => RSU.safeUrl(i.url));

  if (!images.length) {
    body.innerHTML = ui.empty({
      icon: "image",
      title: "المعرض لسه فاضي",
      text: ctx.isAdmin ? "ضيفي صور مرخّصة (برابط أو رفع) من لوحة الإدارة ← المعرض." : "الصور هتظهر هنا أول ما تتضاف ✨",
      action: ctx.isAdmin ? { label: "إضافة صور", href: "admin.html" } : null
    });
    return;
  }

  const cats = ["الكل"].concat(Array.from(new Set(images.map((i) => i.category || "عام"))));
  let cat = "الكل";
  let shown = images;

  body.innerHTML =
    '<div class="chips gal-chips" role="tablist">' + cats.map((c) => '<button class="chip' + (c === "الكل" ? " is-active" : "") + '" role="tab" data-cat="' + esc(c) + '">' + esc(c) + "</button>").join("") + "</div>" +
    '<div class="masonry" id="masonry"></div>';
  const grid = body.querySelector("#masonry");

  function renderGrid() {
    shown = cat === "الكل" ? images : images.filter((i) => (i.category || "عام") === cat);
    grid.innerHTML = shown.map((im, i) =>
      '<figure class="m-item" style="--d:' + Math.min(i, 14) * 40 + 'ms"><button class="m-btn" data-i="' + i + '" aria-label="فتح الصورة' + (im.caption ? ": " + esc(im.caption) : "") + '">' +
      '<img src="' + esc(RSU.safeUrl(im.url)) + '" alt="' + esc(im.caption || "صورة من المعرض") + '" loading="lazy" decoding="async" onerror="this.closest(\'.m-item\').remove()" />' +
      (im.caption ? '<figcaption>' + esc(im.caption) + "</figcaption>" : "") + "</button></figure>").join("");
  }

  body.querySelector(".gal-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    cat = b.dataset.cat;
    body.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("is-active", x === b));
    renderGrid();
  });
  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".m-btn");
    if (b) openLightbox(Number(b.dataset.i));
  });

  /* ---------- Lightbox ---------- */
  let lb = null, cur = 0;
  function openLightbox(i) {
    cur = i;
    lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "عارض الصور");
    lb.innerHTML =
      '<button class="lb-close btn btn-icon" aria-label="إغلاق">' + RSU.icon("x") + "</button>" +
      '<button class="lb-nav lb-prev btn btn-icon" aria-label="السابقة">' + RSU.icon("chevron-right") + "</button>" +
      '<button class="lb-nav lb-next btn btn-icon" aria-label="التالية">' + RSU.icon("chevron-left") + "</button>" +
      '<figure class="lb-fig"><img class="lb-img" alt="" /><figcaption class="lb-cap"></figcaption></figure>' +
      '<div class="lb-count"></div>';
    document.body.appendChild(lb);
    document.body.style.overflow = "hidden";
    lb.querySelector(".lb-close").addEventListener("click", closeLightbox);
    lb.querySelector(".lb-prev").addEventListener("click", () => go(-1));
    lb.querySelector(".lb-next").addEventListener("click", () => go(1));
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-fig")) closeLightbox(); });
    document.addEventListener("keydown", onKey);
    // سحب على الموبايل
    let x0 = null;
    lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); // RTL: السحب لليسار = التالية
    }, { passive: true });
    show();
    lb.querySelector(".lb-close").focus();
  }
  function show() {
    const im = shown[cur];
    if (!im) return;
    const img = lb.querySelector(".lb-img");
    img.classList.remove("in");
    img.onload = () => img.classList.add("in");
    img.src = RSU.safeUrl(im.url);
    img.alt = im.caption || "";
    const cap = lb.querySelector(".lb-cap");
    cap.innerHTML = (im.caption ? "<strong>" + esc(im.caption) + "</strong>" : "") + (im.credit ? '<span class="muted">المصدر: ' + esc(im.credit) + "</span>" : "");
    lb.querySelector(".lb-count").textContent = RSU.num(cur + 1) + " / " + RSU.num(shown.length);
    const multi = shown.length > 1;
    lb.querySelectorAll(".lb-nav").forEach((b) => (b.hidden = !multi));
    // تحميل مسبق للصورة اللي بعدها
    if (multi) { const n = new Image(); n.src = RSU.safeUrl(shown[(cur + 1) % shown.length].url); }
  }
  function go(d) {
    cur = (cur + d + shown.length) % shown.length;
    show();
  }
  function onKey(e) {
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") go(1);   // RTL
    else if (e.key === "ArrowRight") go(-1);
  }
  function closeLightbox() {
    document.removeEventListener("keydown", onKey);
    if (lb) lb.remove();
    lb = null;
    document.body.style.overflow = "";
  }

  renderGrid();
});
