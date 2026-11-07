/* index.html — شاشة البداية + تسجيل الدخول الإبداعي */
(function () {
  const RSU = window.RSU;
  const { $, $$, esc } = RSU;

  const PAGES = ["dashboard", "music", "discover", "quiz", "letters", "concert", "gallery", "admin"];
  const nextParam = RSU.params.get("next");
  const TARGET = PAGES.indexOf(nextParam) !== -1 ? nextParam + ".html" : "dashboard.html";

  const screens = { splash: $("#screen-splash"), auth: $("#screen-auth"), welcome: $("#screen-welcome") };
  const forms = { login: $("#form-login"), signup: $("#form-signup"), forgot: $("#form-forgot"), reset: $("#form-reset") };
  const TITLES = { login: "أول خطوة لعالمك", signup: "اعملي حسابك", forgot: "استعادة كلمة المرور", reset: "كلمة مرور جديدة" };
  const msgBox = $("#auth-msg");
  let hasSession = false;
  let recovering = false;

  RSU.hydrateIcons();
  RSU.ui.bindPasswordToggles();
  RSU.fx.init({ ambient: true });

  /* ---------- Screens & forms ---------- */
  function showScreen(name) {
    Object.keys(screens).forEach((k) => {
      const on = k === name;
      screens[k].hidden = !on;
      screens[k].classList.toggle("is-active", on);
    });
    window.scrollTo(0, 0);
  }
  function showForm(name) {
    Object.keys(forms).forEach((k) => (forms[k].hidden = k !== name));
    $("#auth-title").textContent = TITLES[name];
    $("#auth-tabs").hidden = name === "forgot" || name === "reset";
    $$(".tab").forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    clearMsg();
    const first = forms[name].querySelector("input");
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
  function showMsg(type, text) {
    msgBox.hidden = false;
    msgBox.className = "auth-msg " + type;
    msgBox.innerHTML = RSU.icon(type === "success" ? "check" : type === "error" ? "alert-circle" : "info") + "<span>" + esc(text) + "</span>";
  }
  function clearMsg() {
    msgBox.hidden = true;
    msgBox.textContent = "";
  }
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  /* ---------- Splash ---------- */
  async function loadSplashImage() {
    try {
      const content = await RSU.data.content.all();
      const img = content.artist && RSU.safeUrl(content.artist.splash_image || "");
      if (img) {
        const bg = $("#splash-bg");
        bg.style.backgroundImage = "url('" + img.replace(/'/g, "%27") + "')";
        bg.classList.add("has-image");
        $("#stage-art").style.opacity = "0";
      }
    } catch (e) { /* الصورة اختيارية */ }
  }

  $("#enter-btn").addEventListener("click", () => {
    if (hasSession) {
      document.body.classList.add("leaving");
      setTimeout(() => (location.href = TARGET), 350);
    } else {
      showScreen("auth");
      showForm("login");
    }
  });
  $("#auth-back").addEventListener("click", () => showScreen("splash"));

  /* ---------- Tabs & links ---------- */
  $$(".tab").forEach((t) => t.addEventListener("click", () => showForm(t.dataset.tab)));
  $("#to-forgot").addEventListener("click", () => showForm("forgot"));
  $("#to-login").addEventListener("click", () => showForm("login"));

  /* ---------- Welcome cinematic ---------- */
  function showWelcome(name) {
    $("#welcome-name").textContent = name || "حبيبتي";
    const stars = $(".welcome-stars");
    if (!stars.childElementCount) {
      for (let i = 0; i < 36; i++) {
        const s = document.createElement("span");
        s.style.cssText = "left:" + Math.random() * 100 + "%;top:" + Math.random() * 100 + "%;animation-delay:" + (Math.random() * 3).toFixed(2) + "s;font-size:" + (8 + Math.random() * 14).toFixed(0) + "px";
        s.textContent = Math.random() < 0.5 ? "✦" : "♥";
        stars.appendChild(s);
      }
    }
    showScreen("welcome");
    RSU.fx.rain(6500);
    setTimeout(() => RSU.fx.burst(innerWidth / 2, innerHeight * 0.42, 34), 1400);
  }
  $("#welcome-enter").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    RSU.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 30);
    document.body.classList.add("leaving");
    setTimeout(() => (location.href = TARGET), 450);
  });

  async function welcomeCurrentUser() {
    const session = await RSU.auth.getSession();
    const user = session && session.user;
    let name = (user && user.user_metadata && user.user_metadata.display_name) || (user && user.email ? user.email.split("@")[0] : "");
    try {
      const p = await RSU.data.profile.get(user.id);
      if (p && p.display_name) name = p.display_name;
    } catch (e) {}
    showWelcome(name);
  }

  /* ---------- Submit handlers ---------- */
  forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(forms.login);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    if (!isEmail(email)) return showMsg("error", "اكتبي بريد إلكتروني صحيح.");
    if (!password) return showMsg("error", "اكتبي كلمة المرور.");
    const btn = forms.login.querySelector("[type=submit]");
    RSU.ui.busy(btn, true, "بندخلك…");
    clearMsg();
    try {
      await RSU.auth.signIn(email, password);
      hasSession = true;
      await welcomeCurrentUser();
    } catch (err) {
      showMsg("error", RSU.humanError(err));
    } finally {
      RSU.ui.busy(btn, false);
    }
  });

  forms.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(forms.signup);
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    const confirm = String(f.get("confirm") || "");
    if (name.length < 2) return showMsg("error", "اكتبي اسمك (حرفين على الأقل).");
    if (!isEmail(email)) return showMsg("error", "اكتبي بريد إلكتروني صحيح.");
    if (password.length < 6) return showMsg("error", "كلمة المرور لازم تكون ٦ حروف على الأقل.");
    if (password !== confirm) return showMsg("error", "كلمتي المرور مش متطابقتين.");
    const btn = forms.signup.querySelector("[type=submit]");
    RSU.ui.busy(btn, true, "بنجهّز عالمك…");
    clearMsg();
    try {
      const r = await RSU.auth.signUp(email, password, name);
      if (r.needsConfirm) {
        forms.signup.reset();
        showForm("login");
        showMsg("success", "اتبعتلك رسالة تأكيد على بريدك. اضغطي على الرابط اللي فيها وبعدها سجّلي دخول ❤️");
      } else {
        hasSession = true;
        showWelcome(name);
      }
    } catch (err) {
      showMsg("error", RSU.humanError(err));
    } finally {
      RSU.ui.busy(btn, false);
    }
  });

  forms.forgot.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = String(new FormData(forms.forgot).get("email") || "").trim();
    if (!isEmail(email)) return showMsg("error", "اكتبي بريد إلكتروني صحيح.");
    const btn = forms.forgot.querySelector("[type=submit]");
    RSU.ui.busy(btn, true, "بنبعت…");
    clearMsg();
    try {
      await RSU.auth.resetPassword(email);
      showMsg("success", "لو البريد ده مسجّل عندنا، هيوصلك رابط لتعيين كلمة مرور جديدة خلال دقايق.");
    } catch (err) {
      showMsg("error", RSU.humanError(err));
    } finally {
      RSU.ui.busy(btn, false);
    }
  });

  forms.reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(forms.reset);
    const password = String(f.get("password") || "");
    if (password.length < 6) return showMsg("error", "كلمة المرور لازم تكون ٦ حروف على الأقل.");
    if (password !== String(f.get("confirm") || "")) return showMsg("error", "كلمتي المرور مش متطابقتين.");
    const btn = forms.reset.querySelector("[type=submit]");
    RSU.ui.busy(btn, true, "بنحفظ…");
    clearMsg();
    try {
      await RSU.auth.updatePassword(password);
      recovering = false;
      hasSession = true;
      history.replaceState(null, "", location.pathname);
      await welcomeCurrentUser();
    } catch (err) {
      showMsg("error", RSU.humanError(err));
    } finally {
      RSU.ui.busy(btn, false);
    }
  });

  /* ---------- Init ---------- */
  function enterRecovery() {
    recovering = true;
    showScreen("auth");
    showForm("reset");
  }

  async function init() {
    if (!RSU.configured) {
      RSU.renderSetupNeeded();
      return;
    }
    RSU.api.wake(); // بنصحّي السيرفر (Render) وإحنا في الشاشة الأولى
    loadSplashImage();

    // رابط استعادة كلمة المرور: index.html?reset=TOKEN
    const resetToken = RSU.params.get("reset");
    if (resetToken) {
      RSU.auth.setResetToken(resetToken);
      history.replaceState(null, "", location.pathname);
      enterRecovery();
      return;
    }

    RSU.auth.onChange((event) => {
      if (event === "PASSWORD_RECOVERY") enterRecovery();
    });

    const hash = RSU.initialHash || "";
    // رابط منتهي/غير صالح
    if (/error_code=|error=access_denied/.test(hash)) {
      showScreen("auth");
      showForm("login");
      showMsg("error", /otp_expired|expired/.test(hash) ? "الرابط انتهت صلاحيته، اطلبي رابط جديد." : "الرابط غير صالح، جرّبي تاني.");
      history.replaceState(null, "", location.pathname);
      return;
    }

    let session = null;
    try {
      session = await RSU.auth.getSession();
    } catch (e) { /* نكمل كزائرة */ }

    if (/type=recovery/.test(hash)) {
      enterRecovery();
      return;
    }
    if (session) {
      hasSession = true;
      const name = (session.user.user_metadata && session.user.user_metadata.display_name) || "";
      $("#splash-foot").textContent = name ? "نورتي تاني يا " + name + " ✨" : "نورتي تاني ✨";
      if (/type=signup|type=email/.test(hash)) {
        RSU.ui.toast("تم تأكيد بريدك الإلكتروني ✨", "success");
        history.replaceState(null, "", location.pathname);
      }
    }
  }

  init();
})();
