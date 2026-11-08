/* Data service layer — كل الكلام مع الباك إند بيعدّي من هنا (نفس الواجهة القديمة) */
(function () {
  const RSU = (window.RSU = window.RSU || {});
  const api = () => RSU.api;
  let cache = {};
  let mePromise = null; // GET /profile بيرجّع الملف + الدور في طلب واحد

  /** CRUD بسيط لمورد (الترتيب بيتحدد في السيرفر) */
  function crud(path) {
    return {
      async list() {
        return (await api().get(path)) || [];
      },
      create: (row) => api().post(path, row),
      update: (id, patch) => api().patch(path + "/" + id, patch),
      async remove(id) {
        await api().del(path + "/" + id);
      }
    };
  }

  const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  function checkImage(file, maxMB) {
    if (!file) throw new Error("مفيش ملف");
    if (ALLOWED_IMG.indexOf(file.type) === -1) throw new Error("نوع الملف غير مسموح — الصور فقط (JPG / PNG / WebP)");
    if (file.size > maxMB * 1024 * 1024) throw new Error("حجم الملف أكبر من " + maxMB + " ميجابايت");
  }

  const DEFAULT_ARTIST = { name: "رامي صبري", bio: "", career: "", hero_image: "", splash_image: "", concert_image: "" };
  const DEFAULT_PHRASES = ["نورتي عالمك ✨", "الموسيقى بتحلى أكتر وإنتِ جنبها 🎶"];
  const DEFAULT_CONCERT = {
    title: "My Dream Concert",
    date_label: "تاريخ افتراضي (تجريبي)",
    venue: "مسرح الأحلام (خيالي)",
    note: "تذكرة تجريبية للترفيه فقط — غير صالحة للدخول لأي فعالية حقيقية"
  };

  function me() {
    if (!mePromise) mePromise = api().get("/profile").catch((e) => { mePromise = null; throw e; });
    return mePromise;
  }

  const data = (RSU.data = {
    /** بيمسح الكاش (عند تسجيل الدخول/الخروج) */
    reset() {
      cache = {};
      mePromise = null;
    },

    /* ---------- محتوى الموقع ---------- */
    content: {
      async all(force) {
        if (cache.content && !force) return cache.content;
        const rows = (await api().get("/content")) || [];
        const m = {};
        rows.forEach((r) => (m[r.key] = r.value));
        m.artist = Object.assign({}, DEFAULT_ARTIST, m.artist || {});
        m.welcome_phrases = Array.isArray(m.welcome_phrases) && m.welcome_phrases.length ? m.welcome_phrases : DEFAULT_PHRASES;
        m.concert = Object.assign({}, DEFAULT_CONCERT, m.concert || {});
        cache.content = m;
        return m;
      },
      async set(key, value) {
        await api().put("/content/" + encodeURIComponent(key), { value });
        delete cache.content;
      }
    },

    /* ---------- الملف الشخصي ---------- */
    profile: {
      async get() {
        const r = await me();
        const p = Object.assign({}, r);
        delete p.role;
        return p;
      },
      async update(uid, patch) {
        const row = await api().patch("/profile", patch);
        mePromise = null;
        return row;
      },
      async uploadAvatar(uid, file) {
        checkImage(file, 2);
        const r = await api().upload("/profile/avatar", file);
        return r.url;
      },
      async touchVisit() {
        const r = await api().post("/profile/visit");
        return r && r.visit_count;
      },
      async role() {
        const r = await me();
        return r.role || "user";
      }
    },

    /* ---------- الأغاني ---------- */
    songs: Object.assign(crud("/songs"), {
      async listCached() {
        if (!cache.songs) cache.songs = await data.songs.list();
        return cache.songs;
      },
      async save(id, fields) {
        const row = {
          title: fields.title.trim(),
          album: (fields.album || "").trim() || null,
          year: fields.year ? Number(fields.year) : null,
          cover_url: (fields.cover_url || "").trim() || null,
          play_url: fields.play_url.trim(),
          sort_order: Number(fields.sort_order) || 0
        };
        row.source = RSU.songSource(row.play_url);
        cache.songs = null;
        return id ? data.songs.update(id, row) : data.songs.create(row);
      },
      async removeSong(id) {
        cache.songs = null;
        return data.songs.remove(id);
      }
    }),

    albums: crud("/albums"),
    timeline: crud("/timeline"),

    /* ---------- المفضلة ---------- */
    favorites: {
      async ids() {
        return new Set((await api().get("/favorites")) || []);
      },
      async add(uid, songId) {
        await api().post("/favorites/" + songId);
      },
      async remove(uid, songId) {
        await api().del("/favorites/" + songId);
      }
    },

    /* ---------- الاختبار ---------- */
    quiz: {
      async questions() {
        return (await api().get("/quiz/questions")) || [];
      },
      saveResult: (uid, score, max, tier) => api().post("/quiz/results", { score, max_score: max, tier }),
      async latest() {
        return (await api().get("/quiz/results/latest")) || null;
      },
      createQuestion: (row) => api().post("/quiz/questions", row),
      updateQuestion: (id, patch) => api().patch("/quiz/questions/" + id, patch),
      removeQuestion: async (id) => { await api().del("/quiz/questions/" + id); }
    },

    /* ---------- الرسائل ---------- */
    letters: Object.assign(crud("/letters"), {
      async opened() {
        return new Set((await api().get("/letters/opened")) || []);
      },
      async markOpened(uid, letterId) {
        await api().post("/letters/" + letterId + "/open");
      },
      async secretState() {
        return (await api().get("/letters/secret-state")) || { has_secret: false, unlocked: false };
      }
    }),

    /* ---------- المعرض ---------- */
    gallery: Object.assign(crud("/gallery"), {
      async uploadMedia(file) {
        checkImage(file, 8);
        const r = await api().upload("/upload/media", file);
        return r.url;
      }
    }),

    /* ---------- النشاط ---------- */
    /* ---------- الحفلة: تذكرة + مقاعد + سيت ليست ---------- */
    concert: {
      me: () => api().get("/concert/me"),
      seats: () => api().get("/concert/seats"),
      saveTicket: (t) => api().put("/concert/ticket", t),
      claimSeat: (seat) => api().post("/concert/seat", { seat }),
      releaseSeat: () => api().del("/concert/seat"),
      createRoom: () => api().post("/concert/rooms"),
      join: (code) => api().post("/concert/rooms/" + code + "/join"),
      room: (code, rx) => api().get("/concert/rooms/" + code + "?rx=" + (rx || 0)),
      sync: (code, body) => api().post("/concert/rooms/" + code + "/sync", body),
      react: (code, emoji) => api().post("/concert/rooms/" + code + "/react", { emoji }),
      fly: (code, message) => api().post("/concert/rooms/" + code + "/fly", { message }),
      leave: (code) => api().post("/concert/rooms/" + code + "/leave")
    },

    activity: {
      log(uid, action, meta) {
        // fire-and-forget: ماينفعش التتبّع يعطّل تجربة المستخدمة
        try {
          Promise.resolve(api().post("/activity", { action, meta: meta || {} })).catch(() => {});
        } catch (e) {}
      }
    },

    /* ---------- أدمن ---------- */
    admin: {
      async users() { return (await api().get("/admin/users")) || []; },
      async quizResults() { return (await api().get("/admin/quiz-results")) || []; },
      async recentActivity() { return (await api().get("/admin/activity")) || []; },
      async deleteQuizResult(id) { await api().del("/admin/quiz-results/" + id); },
      async setRole(userId, role) { await api().patch("/admin/users/" + userId + "/role", { role }); },
      counts: () => api().get("/admin/counts"),
      async resetLink(userId) { return (await api().post("/admin/users/" + userId + "/reset-link")).url; }
    }
  });
})();
