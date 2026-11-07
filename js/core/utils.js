/* Shared helpers */
(function () {
  const RSU = (window.RSU = window.RSU || {});

  RSU.$ = (sel, root) => (root || document).querySelector(sel);
  RSU.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  RSU.esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** يسمح بروابط http/https فقط (منع javascript: وغيرها) */
  RSU.safeUrl = (u) => {
    try {
      const x = new URL(String(u || "").trim(), location.href);
      return x.protocol === "http:" || x.protocol === "https:" ? x.href : "";
    } catch (e) {
      return "";
    }
  };

  RSU.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  RSU.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  RSU.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  RSU.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  RSU.num = (n) => Number(n || 0).toLocaleString("ar-EG");
  RSU.fmtTime = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };
  RSU.fmtDate = (d) => {
    try {
      return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return "";
    }
  };
  RSU.fmtDateTime = (d) => {
    try {
      return new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return "";
    }
  };
  RSU.initials = (name) => (String(name || "").trim().charAt(0) || "♥").toUpperCase();

  /** localStorage آمن */
  RSU.store = {
    get(key, def) {
      try {
        const v = localStorage.getItem("rsu:" + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem("rsu:" + key, JSON.stringify(val));
      } catch (e) {}
    },
    del(key) {
      try {
        localStorage.removeItem("rsu:" + key);
      } catch (e) {}
    }
  };

  RSU.params = new URLSearchParams(location.search);

  RSU.youtubeId = (url) => {
    const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  RSU.songSource = (url) => {
    if (RSU.youtubeId(url)) return "youtube";
    if (/\.(mp3|m4a|ogg|oga|wav|aac|flac|opus)(\?.*)?$/i.test(String(url || ""))) return "audio";
    return "external";
  };

  /** رسائل أخطاء مفهومة بالعربي */
  RSU.humanError = (e) => {
    if (e && e.userMessage) return e.userMessage; // رسالة جاهزة من الباك إند
    const raw = (e && (e.message || e.error_description || e.msg)) || String(e || "");
    const l = raw.toLowerCase();
    if (l.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (l.includes("already registered") || l.includes("already been registered")) return "البريد ده مسجّل قبل كده، جرّبي تسجّلي دخول.";
    if (l.includes("email not confirmed")) return "لازم تأكدي بريدك الإلكتروني الأول، شوفي رسالة التأكيد في صندوق الوارد.";
    if (l.includes("password should be at least") || l.includes("weak password")) return "كلمة المرور ضعيفة، استخدمي ٦ حروف أو أرقام على الأقل.";
    if (l.includes("same password") || l.includes("different from the old")) return "كلمة المرور الجديدة لازم تكون مختلفة عن القديمة.";
    if (l.includes("rate limit") || l.includes("too many") || l.includes("security purposes")) return "محاولات كتير ورا بعض، استني شوية وجرّبي تاني.";
    if (l.includes("failed to fetch") || l.includes("networkerror") || l.includes("network request")) return "في مشكلة في الاتصال بالإنترنت، جرّبي تاني.";
    if (l.includes("row-level security") || l.includes("permission denied") || l.includes("not allowed")) return "مفيش صلاحية للعملية دي.";
    if (l.includes("jwt") || l.includes("token") && l.includes("expired")) return "انتهت الجلسة، سجّلي دخول تاني.";
    if (l.includes("invalid email") || l.includes("unable to validate email")) return "البريد الإلكتروني غير صالح.";
    if (l.includes("duplicate key")) return "العنصر ده موجود بالفعل.";
    if (l.includes("bucket") && l.includes("not found")) return "مخزن الصور مش متفعّل — شغّل ملف schema.sql كامل.";
    if (l.includes("mime") || l.includes("file type")) return "نوع الملف غير مسموح.";
    if (l.includes("exceeded the maximum") || l.includes("too large") || l.includes("payload")) return "حجم الملف أكبر من المسموح.";
    return "حصلت مشكلة: " + raw;
  };
})();
