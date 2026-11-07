/* letters.html — رسائل من القلب */
RSU.boot({ page: "letters" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;
  const uid = ctx.user.id;

  app.innerHTML = ui.loading("بنجهّز الظروف…");

  let letters = await RSU.data.letters.list();
  let opened = await RSU.data.letters.opened(uid);
  let order = null; // ترتيب عشوائي ثابت طول الزيارة

  const normal = () => letters.filter((l) => !l.is_secret);
  const secret = () => letters.find((l) => l.is_secret) || null;
  const byId = (id) => letters.find((l) => l.id === id);

  if (!normal().length) {
    app.innerHTML = RSU.pageHead("رسائل من القلب", "", "mail") +
      ui.empty({ icon: "mail", title: "لسه مفيش رسائل", text: ctx.isAdmin ? "اكتبي رسائل من لوحة الإدارة ← الرسائل." : "الرسائل هتظهر هنا قريب ❤️", action: ctx.isAdmin ? { label: "لوحة الإدارة", href: "admin.html" } : null });
    return;
  }

  function envelope(l, secretCard) {
    const isOpen = opened.has(l.id);
    return (
      '<button class="envelope' + (isOpen ? " is-opened" : "") + (secretCard ? " is-secret" : "") + '" data-id="' + esc(l.id) + '" aria-label="' + (secretCard ? "رسالة سرية" : "ظرف رسالة") + (isOpen ? " (مفتوحة)" : "") + '">' +
      '<span class="env-back"></span><span class="env-paper"></span><span class="env-front"></span><span class="env-flap"></span>' +
      '<span class="env-seal">' + RSU.icon(secretCard ? "key" : "heart") + "</span>" +
      '<span class="env-label">' + (secretCard ? "رسالة سرية ✨" : isOpen ? "اتفتحت" : "افتحيني") + "</span></button>"
    );
  }

  function render() {
    if (!order) order = RSU.shuffle(normal().map((l) => l.id));
    const list = order.map(byId).filter(Boolean);
    const s = secret();
    const n = normal().length;
    const done = normal().filter((l) => opened.has(l.id)).length;
    app.innerHTML =
      RSU.pageHead("رسائل من القلب", "كل ظرف فيه رسالة مكتوبة ليكي. اضغطي على ظرف علشان تفتحيه 💌", "mail") +
      '<div class="glass toolbar"><div class="letters-progress"><div class="progress"><div class="progress-bar" style="width:' + Math.round((done / n) * 100) + '%"></div></div><span>فتحتي ' + RSU.num(done) + " من " + RSU.num(n) + " رسالة</span></div>" +
      '<button class="btn btn-pink" id="random-env">' + RSU.icon("sparkles") + " اختاري لي ظرف</button></div>" +
      '<div class="envelopes" id="envs">' + list.map((l) => envelope(l, false)).join("") + (s ? envelope(s, true) : "") + "</div>";
    RSU.hydrateIcons(app);
  }

  function openLetter(id, envEl) {
    const l = byId(id);
    if (!l) return;
    const reveal = () => showLetter(l);
    if (envEl) {
      envEl.classList.add("opening");
      const r = envEl.getBoundingClientRect();
      RSU.fx.burst(r.left + r.width / 2, r.top + r.height / 3, 16);
      setTimeout(reveal, 750);
    } else reveal();
  }

  async function showLetter(l) {
    const m = ui.modal(
      '<div class="paper"><div class="paper-hearts" aria-hidden="true">♥ ✦ ♥</div>' +
        (l.title ? '<h3 class="gold-text">' + esc(l.title) + "</h3>" : "") +
        '<div class="paper-body">' + esc(l.body).replace(/\n/g, "<br>") + "</div>" +
        '<div class="paper-sign">— بكل حب ❤️</div></div>' +
        '<div class="actions"><button class="btn btn-ghost" data-close>إغلاق</button><button class="btn btn-pink" id="another">' + RSU.icon("mail") + " ظرف تاني</button></div>",
      { onClose: afterClose }
    );
    m.el.classList.add("letter-modal");
    RSU.fx.rain(2200, 90);
    m.el.querySelector("#another").addEventListener("click", () => { pendingNext = true; m.close(); });

    // تسجيل الفتح
    if (!opened.has(l.id)) {
      opened.add(l.id);
      try {
        await RSU.data.letters.markOpened(uid, l.id);
        RSU.data.activity.log(uid, "letter_open", { secret: !!l.is_secret });
      } catch (e) {
        opened.delete(l.id);
        ui.toast(RSU.humanError(e), "error");
      }
    }
  }

  let pendingNext = false;
  async function afterClose() {
    const hadSecret = !!secret();
    render();
    // لو فتحت كل الرسائل العادية: نتحقق من الرسالة السرية (الشرط بيتحقق في قاعدة البيانات)
    if (!hadSecret && normal().every((l) => opened.has(l.id))) {
      try {
        const st = await RSU.data.letters.secretState();
        if (st.has_secret && st.unlocked) {
          letters = await RSU.data.letters.list();
          render();
          const el = app.querySelector(".envelope.is-secret");
          if (el) el.classList.add("just-unlocked");
          ui.toast("ظهرت رسالة سرية ✨ دوري عليها في آخر الظروف", "success");
          RSU.fx.rain(4500);
        }
      } catch (e) { /* مش مشكلة */ }
    }
    if (pendingNext) {
      pendingNext = false;
      randomEnvelope();
    }
  }

  function randomEnvelope() {
    const pool = normal();
    const fresh = pool.filter((l) => !opened.has(l.id));
    const pick = RSU.pick(fresh.length ? fresh : pool);
    const el = app.querySelector('.envelope[data-id="' + pick.id + '"]');
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => openLetter(pick.id, el), 300);
  }

  app.addEventListener("click", (e) => {
    const env = e.target.closest(".envelope");
    if (env) return openLetter(env.dataset.id, env);
    if (e.target.closest("#random-env")) randomEnvelope();
  });

  render();
});
