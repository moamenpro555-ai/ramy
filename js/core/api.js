/* API client — بيكلّم الباك إند (Express على Render) ويحفظ التوكن في المتصفح */
(function () {
  const RSU = (window.RSU = window.RSU || {});
  const cfg = window.APP_CONFIG || {};
  const BASE = String(cfg.API_URL || "").trim().replace(/\/+$/, "");
  const TOKEN_KEY = "rsu:token";

  // نحفظ الـ hash الأصلي (كان بيستخدمه رابط الاستعادة؛ بنسيبه للتوافق)
  RSU.initialHash = location.hash || "";
  RSU.hasConfig = !!BASE;
  RSU.configured = RSU.hasConfig;
  RSU.apiBase = BASE;

  /* ---------- التوكن ---------- */
  RSU.token = {
    get() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {} },
    clear() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  };

  /* ---------- أحداث الجلسة (SIGNED_OUT …) ---------- */
  const listeners = new Set();
  RSU.authEvents = {
    on(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    emit(ev) { listeners.forEach((cb) => { try { cb(ev); } catch (e) {} }); }
  };

  const netError = () => {
    const e = new Error("network");
    e.userMessage = "في مشكلة في الاتصال بالسيرفر، جرّبي تاني.";
    return e;
  };

  let wakeToastShown = false;
  function hintWaking() {
    if (wakeToastShown) return;
    wakeToastShown = true;
    try { if (RSU.ui && RSU.ui.toast) RSU.ui.toast("السيرفر بيصحى… ثواني ✨", "info"); } catch (e) {}
  }

  /** طلب واحد. بيعيد المحاولة لو السيرفر لسه بيصحى (Render المجاني بينام لما يخمل). */
  async function request(method, path, body) {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const headers = {};
    const t = RSU.token.get();
    if (t) headers.Authorization = "Bearer " + t;
    if (body != null && !isForm) headers["Content-Type"] = "application/json";

    const MAX_TRIES = 4;
    for (let i = 0; i < MAX_TRIES; i++) {
      let res;
      try {
        res = await fetch(BASE + "/api" + path, {
          method,
          headers,
          body: body == null ? undefined : isForm ? body : JSON.stringify(body),
          signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined
        });
      } catch (e) {
        if (i < MAX_TRIES - 1) { hintWaking(); await RSU.sleep(2500 * (i + 1)); continue; }
        throw netError();
      }
      if ((res.status === 502 || res.status === 503 || res.status === 504) && i < MAX_TRIES - 1) {
        hintWaking();
        await RSU.sleep(2500 * (i + 1));
        continue;
      }

      const text = await res.text();
      let json = null;
      if (text) { try { json = JSON.parse(text); } catch (e) {} }

      if (!res.ok) {
        const err = new Error((json && json.error) || "HTTP " + res.status);
        err.status = res.status;
        err.userMessage = json && json.error ? json.error : res.status === 429 ? "محاولات كتير ورا بعض، استني شوية وجرّبي تاني." : "حصلت مشكلة في السيرفر، جرّبي تاني.";
        // جلسة منتهية: نمسح التوكن ونبلّغ الصفحات (إلا لو ده طلب تسجيل الدخول نفسه)
        if (res.status === 401 && t && path.indexOf("/auth/login") !== 0) {
          RSU.token.clear();
          RSU.authEvents.emit("SIGNED_OUT");
        }
        throw err;
      }
      return json;
    }
    throw netError();
  }

  RSU.api = {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b == null ? {} : b),
    put: (p, b) => request("PUT", p, b),
    patch: (p, b) => request("PATCH", p, b),
    del: (p) => request("DELETE", p),
    upload(path, file) {
      const fd = new FormData();
      fd.append("file", file, file.name || "image");
      return request("POST", path, fd);
    },
    /** بيصحّي السيرفر في الخلفية (من غير ما نستنى الرد) */
    wake() {
      if (!BASE) return;
      try { fetch(BASE + "/api/health", { method: "GET", mode: "cors" }).catch(() => {}); } catch (e) {}
    }
  };

  /** شاشة توضح إن الإعداد ناقص */
  RSU.renderSetupNeeded = function () {
    document.body.innerHTML =
      '<div class="bg-aurora"></div><div class="container" style="min-height:100dvh;display:grid;place-items:center;padding:24px 0">' +
      '<div class="glass card center" style="max-width:560px"><h2 class="gold-text">محتاجين إعداد بسيط ✨</h2><p>' +
      'افتح ملف <code dir="ltr">js/config.js</code> وحط فيه <code dir="ltr">API_URL</code> (رابط الباك إند على Render). الخطوات كلها في README.' +
      "</p></div></div>";
  };
})();
