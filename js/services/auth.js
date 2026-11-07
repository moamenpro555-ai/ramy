/* Authentication service (JWT من الباك إند) */
(function () {
  const RSU = (window.RSU = window.RSU || {});
  let cachedUser = null;
  let resetToken = null; // بيتحط لما المستخدمة تفتح رابط استعادة كلمة المرور

  const toUser = (u) => ({ id: u.id, email: u.email, user_metadata: { display_name: u.display_name || "" } });
  const resetData = () => { cachedUser = null; if (RSU.data && RSU.data.reset) RSU.data.reset(); };

  function startSession(r) {
    RSU.token.set(r.token);
    resetData();
    cachedUser = toUser(r.user);
    return { user: cachedUser };
  }

  RSU.auth = {
    /** يرجّع { user } لو في جلسة صالحة، أو null */
    async getSession() {
      if (!RSU.token.get()) return null;
      if (cachedUser) return { user: cachedUser };
      try {
        const r = await RSU.api.get("/auth/me");
        cachedUser = toUser(r.user);
        return { user: cachedUser };
      } catch (e) {
        if (e.status === 401) { RSU.token.clear(); return null; }
        throw e;
      }
    },
    async signIn(email, password) {
      return startSession(await RSU.api.post("/auth/login", { email: email.trim(), password }));
    },
    /** مفيش تأكيد بريد في النسخة دي، فبيدخلها على طول */
    async signUp(email, password, displayName) {
      startSession(await RSU.api.post("/auth/signup", { email: email.trim(), password, display_name: displayName.trim() }));
      return { needsConfirm: false };
    },
    async resetPassword(email) {
      await RSU.api.post("/auth/forgot", { email: email.trim() });
    },
    setResetToken(t) { resetToken = t; },
    /** لو جاية من رابط الاستعادة بتستخدم التوكن، غير كده بتغيّر كلمة المرور لمستخدمة داخلة */
    async updatePassword(newPassword) {
      if (resetToken) {
        const r = await RSU.api.post("/auth/reset", { token: resetToken, password: newPassword });
        resetToken = null;
        startSession(r);
      } else {
        await RSU.api.post("/auth/change-password", { password: newPassword });
      }
    },
    async signOut() {
      RSU.token.clear();
      resetData();
      try {
        Object.keys(sessionStorage).forEach((k) => k.indexOf("rsu:") === 0 && sessionStorage.removeItem(k));
      } catch (e) {}
      RSU.authEvents.emit("SIGNED_OUT");
    },
    onChange(cb) {
      return RSU.authEvents.on((ev) => cb(ev, null));
    }
  };
})();
