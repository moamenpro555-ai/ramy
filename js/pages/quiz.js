/* quiz.html — قد إيه إنتِ بتحبي رامي صبري؟ */
RSU.boot({ page: "quiz" }, async function (ctx, app) {
  const { esc } = RSU;
  const ui = RSU.ui;
  const uid = ctx.user.id;

  app.innerHTML = ui.loading("بنجهّز الأسئلة…");
  const [questions, last] = await Promise.all([RSU.data.quiz.questions(), RSU.data.quiz.latest(uid)]);

  const valid = questions.filter((q) => Array.isArray(q.options) && q.options.length >= 2);
  if (!valid.length) {
    app.innerHTML =
      RSU.pageHead("قد إيه إنتِ بتحبي رامي صبري؟", "", "trophy") +
      ui.empty({ icon: "trophy", title: "الاختبار لسه مش جاهز", text: ctx.isAdmin ? "ضيفي أسئلة من لوحة الإدارة ← الاختبار." : "الأسئلة هتتضاف قريب ✨", action: ctx.isAdmin ? { label: "لوحة الإدارة", href: "admin.html" } : null });
    return;
  }

  const total = valid.length;
  const maxScore = valid.reduce((s, q) => s + Math.max(...q.options.map((o) => Number(o.points) || 0)), 0);
  const TIERS = [
    { min: 85, name: "الفان رقم ١ 👑", text: "إنتِ مش معجبة وبس… إنتِ جزء من عالمه! بتعرفي كل تفصيلة وبتحسي بكل أغنية." },
    { min: 65, name: "معجبة حقيقية 💜", text: "حبك واضح في كل إجابة. إنتِ فعلًا من الفانز اللي بيسمعوا بقلبهم." },
    { min: 40, name: "في الطريق للقمة ✨", text: "بداية جميلة! كل ما تسمعي أكتر هتكتشفي حاجات أحلى." },
    { min: 0, name: "مستمعة جديدة 🌱", text: "لسه في أول الرحلة… ومعانا أغاني كتير مستنياكي تكتشفيها." }
  ];
  const tierFor = (pct) => TIERS.find((t) => pct >= t.min);

  let idx = 0;
  let answers = []; // index of chosen option per question
  let locked = false;

  function intro() {
    app.innerHTML =
      RSU.pageHead("قد إيه إنتِ بتحبي رامي صبري؟", "", "trophy") +
      '<div class="glass card quiz-card center">' +
      '<div class="quiz-emblem">' + RSU.icon("trophy") + "</div>" +
      "<h2>اختبار المعجبات</h2><p>" + RSU.num(total) + " أسئلة عن ذوقك وحبك للموسيقى. مفيش إجابة غلط… كل إجابة بتحكي عنك.</p>" +
      (last
        ? '<div class="prev-result"><span class="badge gold">آخر نتيجة ليكي</span><strong>' + esc(last.tier) + "</strong><span class=\"muted\">" + RSU.num(last.score) + " من " + RSU.num(last.max_score) + " · " + esc(RSU.fmtDate(last.created_at)) + "</span></div>"
        : "") +
      '<button class="btn btn-primary btn-lg" id="start">' + RSU.icon("play") + (last ? " اعملي الاختبار تاني" : " يلا نبدأ") + "</button></div>";
    RSU.hydrateIcons(app);
    app.querySelector("#start").addEventListener("click", () => { idx = 0; answers = []; question("next"); });
  }

  function question(dir) {
    const q = valid[idx];
    locked = false;
    const pct = Math.round((idx / total) * 100);
    app.innerHTML =
      RSU.pageHead("قد إيه إنتِ بتحبي رامي صبري؟", "", "trophy") +
      '<div class="quiz-wrap"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + idx + '"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
      '<div class="quiz-meta"><span>سؤال ' + RSU.num(idx + 1) + " من " + RSU.num(total) + "</span><span>" + RSU.num(pct) + "٪</span></div>" +
      '<div class="glass card quiz-card slide-' + dir + '" id="qcard"><h2>' + esc(q.question) + '</h2><div class="options" role="radiogroup" aria-label="' + esc(q.question) + '">' +
      q.options.map((o, i) => '<button class="option' + (answers[idx] === i ? " is-selected" : "") + '" role="radio" aria-checked="' + (answers[idx] === i) + '" data-i="' + i + '"><span class="opt-mark">' + RSU.num(i + 1) + "</span><span>" + esc(o.text) + "</span></button>").join("") +
      '</div><div class="quiz-nav"><button class="btn btn-ghost" id="back"' + (idx === 0 ? " disabled" : "") + ">" + RSU.icon("chevron-right") + " السابق</button></div></div></div>";
    RSU.hydrateIcons(app);

    app.querySelector(".options").addEventListener("click", (e) => {
      const b = e.target.closest(".option");
      if (!b || locked) return;
      locked = true;
      answers[idx] = Number(b.dataset.i);
      app.querySelectorAll(".option").forEach((x) => { x.classList.toggle("is-selected", x === b); x.setAttribute("aria-checked", String(x === b)); });
      const r = b.getBoundingClientRect();
      RSU.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 8);
      setTimeout(() => {
        const card = app.querySelector("#qcard");
        if (card) card.classList.add("slide-out");
        setTimeout(() => {
          if (idx < total - 1) { idx++; question("next"); } else finish();
        }, 280);
      }, 380);
    });
    app.querySelector("#back").addEventListener("click", () => {
      if (idx > 0 && !locked) { idx--; question("prev"); }
    });
  }

  async function finish() {
    const score = valid.reduce((s, q, i) => s + (Number((q.options[answers[i]] || {}).points) || 0), 0);
    const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const tier = tierFor(pct);
    app.innerHTML =
      RSU.pageHead("نتيجتك", "", "trophy") +
      '<div class="glass card quiz-card center result"><div class="score-ring" style="--p:' + pct + '"><div class="score-in"><strong>' + RSU.num(pct) + '٪</strong><span>' + RSU.num(score) + " / " + RSU.num(maxScore) + "</span></div></div>" +
      '<h2 class="gold-text">' + esc(tier.name) + "</h2><p>" + esc(tier.text) + "</p>" +
      '<p class="muted" id="save-state">' + RSU.icon("clock") + " بنسجّل نتيجتك…</p>" +
      '<div class="row" style="justify-content:center"><button class="btn btn-primary" id="again">' + RSU.icon("refresh") + ' إعادة الاختبار</button><a class="btn" href="music.html">' + RSU.icon("music") + " كمّلي مع الأغاني</a></div></div>";
    RSU.hydrateIcons(app);
    RSU.fx.rain(3800);
    setTimeout(() => RSU.fx.burst(innerWidth / 2, innerHeight * 0.35, 30), 300);
    app.querySelector("#again").addEventListener("click", () => { idx = 0; answers = []; question("next"); });

    const state = app.querySelector("#save-state");
    try {
      const saved = await RSU.data.quiz.saveResult(uid, score, maxScore, tier.name);
      last && Object.assign(last, saved);
      RSU.data.activity.log(uid, "quiz_done", { score, max: maxScore, tier: tier.name });
      if (state) state.innerHTML = RSU.icon("check") + " اتسجّلت نتيجتك";
    } catch (e) {
      console.error(e);
      if (state) state.innerHTML = RSU.icon("alert-circle") + " ماقدرناش نسجّل النتيجة: " + esc(RSU.humanError(e));
    }
  }

  intro();
});
