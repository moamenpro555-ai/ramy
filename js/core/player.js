/* Persistent bottom music player
   - YouTube (رسمي عبر IFrame API) / ملف صوت مرخّص (mp3…) / رابط خارجي بيتفتح على موقعه الرسمي
   - بيفتكر آخر أغنية ومكان التوقف والصوت بين الصفحات */
(function () {
  const RSU = (window.RSU = window.RSU || {});
  const { esc } = RSU;

  const S = { queue: [], index: -1, playing: false, time: 0, duration: 0, volume: RSU.store.get("volume", 0.8), engine: null, note: "", lazy: false };
  const subs = new Set();
  let root = null, els = {};
  let yt = null, ytReady = false, ytApiPromise = null;
  let audio = null;
  let tick = null, lastPersist = 0, dragging = false;
  let wantPlay = false, bgResumes = 0; // المستخدمة عايزة الأغنية شغّالة (علشان نكمّلها لو الشاشة اتقفلت)

  const cur = () => S.queue[S.index] || null;
  const srcOf = (s) => (s && (s.source || RSU.songSource(s.play_url))) || "external";

  /* ---------- State notifications ---------- */
  function emit() {
    render();
    syncSession();
    subs.forEach((fn) => { try { fn(S); } catch (e) {} });
  }

  function persist(force) {
    const now = Date.now();
    if (!force && now - lastPersist < 2500) return;
    lastPersist = now;
    const s = cur();
    RSU.store.set("player", { ids: S.queue.map((x) => x.id), index: S.index, songId: s ? s.id : null, time: Math.floor(S.time || 0), volume: S.volume });
  }

  /* ---------- Engines ---------- */
  function stopEngine() {
    clearInterval(tick);
    tick = null;
    if (audio) {
      audio.onended = audio.onerror = audio.onplay = audio.onpause = audio.ontimeupdate = audio.onloadedmetadata = null;
      try { audio.pause(); } catch (e) {}
    }
    if (yt && ytReady) { try { yt.stopVideo(); } catch (e) {} }
    S.playing = false;
    wantPlay = false;
  }

  function loadYTApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const t = document.createElement("script");
      t.src = "https://www.youtube.com/iframe_api";
      t.onerror = () => { ytApiPromise = null; reject(new Error("yt api")); };
      document.head.appendChild(t);
      setTimeout(() => { if (!(window.YT && window.YT.Player)) { ytApiPromise = null; reject(new Error("yt timeout")); } }, 15000);
    });
    return ytApiPromise;
  }

  function onYTState(e) {
    const st = e.data;
    if (st === 1 || st === 3) { S.playing = true; S.note = ""; wantPlay = true; if (st === 1) bgResumes = 0; }
    else if (st === 2 && document.hidden && wantPlay && bgResumes < 6) {
      // المتصفح وقّف الفيديو لما الشاشة اتقفلت: نحاول نكمّله (best-effort — مش مضمون على كل الأجهزة)
      bgResumes++;
      setTimeout(() => { try { if (yt && ytReady && wantPlay) yt.playVideo(); } catch (e) {} }, 350);
      return;
    }
    else if (st === 2 || st === 5) S.playing = false;
    else if (st === 0) { S.playing = false; next(true); return; }
    emit();
  }
  function onYTError() {
    S.playing = false;
    S.note = "yt-error";
    emit();
  }

  async function loadYT(s, autoplay, startAt) {
    const id = RSU.youtubeId(s.play_url);
    if (!id) { S.note = "bad-link"; return; }
    try { await loadYTApi(); } catch (e) { S.note = "offline"; return; }
    if (cur() !== s) return; // اتغيّرت الأغنية أثناء التحميل
    await new Promise((resolve) => {
      if (yt && ytReady) {
        const opts = { videoId: id, startSeconds: startAt || 0 };
        if (autoplay) yt.loadVideoById(opts); else yt.cueVideoById(opts);
        yt.setVolume(Math.round(S.volume * 100));
        resolve();
        return;
      }
      ytReady = false;
      const vars = { autoplay: autoplay ? 1 : 0, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(startAt || 0) };
      if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
      yt = new window.YT.Player("yt-el", {
        videoId: id, width: "200", height: "200", playerVars: vars,
        events: {
          onReady: (e) => { ytReady = true; e.target.setVolume(Math.round(S.volume * 100)); resolve(); },
          onStateChange: onYTState,
          onError: onYTError
        }
      });
    });
    clearInterval(tick);
    tick = setInterval(() => {
      if (!yt || !ytReady || S.engine !== "youtube") return;
      try {
        S.time = yt.getCurrentTime() || 0;
        S.duration = yt.getDuration() || 0;
        renderProgress();
        persist();
      } catch (e) {}
    }, 500);
  }

  function loadAudio(s, autoplay, startAt) {
    audio = audio || new Audio();
    audio.preload = "metadata";
    audio.src = RSU.safeUrl(s.play_url);
    audio.volume = S.volume;
    audio.onloadedmetadata = () => {
      S.duration = audio.duration || 0;
      if (startAt) audio.currentTime = startAt;
      renderProgress();
    };
    audio.ontimeupdate = () => { S.time = audio.currentTime; renderProgress(); persist(); };
    audio.onended = () => next(true);
    audio.onplay = () => { S.playing = true; S.note = ""; emit(); };
    audio.onpause = () => { S.playing = false; emit(); };
    audio.onerror = () => { S.note = "audio-error"; S.playing = false; emit(); };
    if (autoplay) audio.play().catch(() => { S.note = "blocked"; emit(); });
  }

  /* ---------- Controls ---------- */
  async function load(i, autoplay, startAt) {
    stopEngine();
    S.index = i; S.time = startAt || 0; S.duration = 0; S.note = ""; S.lazy = false;
    const s = cur();
    if (!s) { S.engine = null; emit(); return; }
    S.engine = srcOf(s);
    mediaSession(s);
    emit(); // تحديث فوري للواجهة
    if (S.engine === "youtube") {
      await loadYT(s, autoplay, startAt);
    } else if (S.engine === "audio") {
      loadAudio(s, autoplay, startAt);
    } else {
      S.note = "external";
      if (autoplay) window.open(RSU.safeUrl(s.play_url), "_blank", "noopener");
    }
    persist(true);
    emit();
  }

  function setQueue(songs, startIndex, autoplay) {
    S.queue = songs.slice();
    return load(Math.max(0, Math.min(startIndex || 0, S.queue.length - 1)), autoplay !== false);
  }

  /** تشغيل/إيقاف أغنية معيّنة من قائمة — لو هي الحالية بيبدّل play/pause */
  function playSong(song, list) {
    const s = cur();
    if (s && s.id === song.id && !S.note) return toggle();
    const q = list && list.length ? list : [song];
    return setQueue(q, Math.max(0, q.findIndex((x) => x.id === song.id)), true);
  }

  function toggle() {
    const s = cur();
    if (!s) return;
    if (S.lazy || S.note === "yt-error" || S.note === "offline" || S.note === "audio-error") {
      return load(S.index, true, S.lazy ? S.time : 0);
    }
    if (S.engine === "external") { window.open(RSU.safeUrl(s.play_url), "_blank", "noopener"); return; }
    if (S.engine === "youtube") {
      if (!yt || !ytReady) return;
      if (S.playing) { wantPlay = false; yt.pauseVideo(); } else { wantPlay = true; yt.playVideo(); }
    } else if (S.engine === "audio" && audio) {
      if (S.playing) { wantPlay = false; audio.pause(); } else { wantPlay = true; audio.play().catch(() => {}); }
    }
  }
  const play = () => { if (!S.playing) toggle(); };
  const pause = () => { if (S.playing) toggle(); };

  function step(dir, auto) {
    const n = S.queue.length;
    if (!n) return;
    let i = S.index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      // التشغيل التلقائي بيتخطّى الروابط الخارجية (مينفعش تتفتح من غير ضغطة)
      if (auto && srcOf(S.queue[i]) === "external") continue;
      if (auto && n === 1) return; // مفيش حاجة تتكرر
      return load(i, true);
    }
  }
  function next(auto) { return step(1, auto); }
  function prev() {
    if (S.time > 4 && S.engine !== "external") return seek(0);
    return step(-1, false);
  }

  function seek(sec) {
    S.time = sec;
    if (S.engine === "youtube" && yt && ytReady) yt.seekTo(sec, true);
    else if (S.engine === "audio" && audio) audio.currentTime = sec;
    renderProgress();
  }
  function setVolume(v) {
    S.volume = Math.max(0, Math.min(1, v));
    if (yt && ytReady) try { yt.setVolume(Math.round(S.volume * 100)); } catch (e) {}
    if (audio) audio.volume = S.volume;
    RSU.store.set("volume", S.volume);
    renderVolume();
  }

  function mediaSession(s) {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.title, artist: "رامي صبري", album: s.album || "",
        artwork: s.cover_url && RSU.safeUrl(s.cover_url) ? [{ src: RSU.safeUrl(s.cover_url) }] : []
      });
      const h = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch (e) {} };
      h("play", play);
      h("pause", pause);
      h("nexttrack", () => next(false));
      h("previoustrack", prev);
      h("seekto", (d) => { if (d && typeof d.seekTime === "number") seek(d.seekTime); });
      h("seekbackward", (d) => seek(Math.max(0, S.time - ((d && d.seekOffset) || 10))));
      h("seekforward", (d) => seek(Math.min(S.duration || 1e9, S.time + ((d && d.seekOffset) || 10))));
    } catch (e) {}
  }

  /** بيحدّث حالة التشغيل وموضعها على شاشة القفل / إشعارات الموبايل */
  function syncSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = !cur() ? "none" : S.playing ? "playing" : "paused";
      if (S.duration > 0 && navigator.mediaSession.setPositionState) {
        navigator.mediaSession.setPositionState({ duration: S.duration, position: Math.min(S.time || 0, S.duration), playbackRate: 1 });
      }
    } catch (e) {}
  }

  /* ---------- UI ---------- */
  const NOTES = {
    external: "الأغنية دي بتتشغّل على موقعها الرسمي — اضغطي «فتح الرابط».",
    "yt-error": "الفيديو ده مش بيسمح بالتشغيل جوه الموقع — افتحيه على يوتيوب.",
    offline: "تعذّر تحميل مشغّل يوتيوب، اتأكدي من الإنترنت وجرّبي تاني.",
    "audio-error": "تعذّر تشغيل الملف الصوتي، الرابط ممكن يكون غير صالح.",
    "bad-link": "رابط الأغنية غير صالح — الأدمن يقدر يعدّله.",
    blocked: "المتصفح منع التشغيل التلقائي — اضغطي زر التشغيل."
  };

  function mount() {
    if (root) return;
    root = document.createElement("div");
    root.className = "player";
    root.id = "player";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "مشغل الموسيقى");
    root.innerHTML =
      '<div class="container"><div class="player-inner">' +
      '<div class="p-info"><div class="p-cover" id="p-cover">' + RSU.icon("music") + '</div><div class="p-meta"><div class="p-title" id="p-title"></div><div class="p-sub" id="p-sub"></div></div></div>' +
      '<div class="p-center"><div class="p-ctrls">' +
      '<button class="btn btn-icon sm" id="p-prev" aria-label="السابق">' + RSU.icon("skip-back") + "</button>" +
      '<button class="btn btn-icon play-main" id="p-play" aria-label="تشغيل">' + RSU.icon("play") + "</button>" +
      '<button class="btn btn-icon sm" id="p-next" aria-label="التالي">' + RSU.icon("skip-forward") + "</button>" +
      '<a class="btn btn-sm" id="p-open" target="_blank" rel="noopener" hidden>' + RSU.icon("external-link") + " فتح الرابط</a>" +
      "</div>" +
      '<div class="p-prog"><span id="p-cur">0:00</span><input class="range" id="p-seek" type="range" min="0" max="100" step="0.1" value="0" aria-label="شريط تقدم الأغنية" /><span id="p-dur">0:00</span></div></div>' +
      '<div class="p-vol"><button class="btn btn-icon sm" id="p-mute" aria-label="كتم الصوت">' + RSU.icon("volume-2") + '</button><input class="range" id="p-vol" type="range" min="0" max="1" step="0.01" aria-label="مستوى الصوت" /></div>' +
      '<div class="p-note" id="p-note" hidden></div>' +
      "</div></div>";
    document.body.appendChild(root);

    const h = document.createElement("div");
    h.id = "yt-holder";
    h.innerHTML = '<div id="yt-el"></div>';
    document.body.appendChild(h);

    ["cover", "title", "sub", "play", "prev", "next", "open", "seek", "cur", "dur", "mute", "vol", "note"].forEach((k) => (els[k] = root.querySelector("#p-" + k)));

    els.play.addEventListener("click", () => (cur() ? toggle() : (location.href = "music.html")));
    els.prev.addEventListener("click", prev);
    els.next.addEventListener("click", () => next(false));
    els.seek.addEventListener("input", () => { dragging = true; els.cur.textContent = RSU.fmtTime(+els.seek.value); });
    els.seek.addEventListener("change", () => { seek(+els.seek.value); dragging = false; });
    els.vol.addEventListener("input", () => setVolume(+els.vol.value));
    let lastVol = 0.8;
    els.mute.addEventListener("click", () => {
      if (S.volume > 0) { lastVol = S.volume; setVolume(0); } else setVolume(lastVol || 0.8);
    });
    els.vol.value = S.volume;
    render();
    restore();
    window.addEventListener("pagehide", () => persist(true));
  }

  function render() {
    if (!root) return;
    const s = cur();
    const showEmpty = !s;
    els.title.textContent = s ? s.title : "المشغّل جاهز";
    els.sub.textContent = s ? [s.album, s.year].filter(Boolean).join(" · ") || "رامي صبري" : "اختاري أغنية من صفحة الأغاني";
    const cover = s && s.cover_url && RSU.safeUrl(s.cover_url);
    els.cover.innerHTML = cover ? '<img src="' + esc(cover) + '" alt="" />' : RSU.icon("music");
    els.cover.classList.toggle("playing", S.playing);
    els.play.innerHTML = RSU.icon(S.playing ? "pause" : "play");
    els.play.setAttribute("aria-label", S.playing ? "إيقاف مؤقت" : "تشغيل");
    const isExt = S.engine === "external";
    els.open.hidden = !(s && (isExt || S.note === "yt-error"));
    if (s) els.open.href = RSU.safeUrl(s.play_url) || "#";
    els.seek.disabled = !s || isExt || !S.duration;
    els.prev.disabled = els.next.disabled = S.queue.length < 2;
    const msg = NOTES[S.note];
    els.note.hidden = !msg;
    els.note.textContent = msg || "";
    root.classList.toggle("is-empty", showEmpty);
    renderProgress();
    renderVolume();
  }
  function renderProgress() {
    if (!root || dragging) return;
    els.seek.disabled = !cur() || S.engine === "external" || !S.duration;
    els.seek.max = S.duration || 100;
    els.seek.value = S.time || 0;
    els.cur.textContent = RSU.fmtTime(S.time);
    els.dur.textContent = RSU.fmtTime(S.duration);
    const pct = S.duration ? (S.time / S.duration) * 100 : 0;
    els.seek.style.background = "linear-gradient(to right, var(--gold) " + pct + "%, rgba(255,255,255,0.15) " + pct + "%)";
  }
  function renderVolume() {
    if (!root) return;
    els.vol.value = S.volume;
    els.mute.innerHTML = RSU.icon(S.volume === 0 ? "volume-x" : "volume-2");
    els.vol.style.background = "linear-gradient(to right, var(--gold) " + S.volume * 100 + "%, rgba(255,255,255,0.15) " + S.volume * 100 + "%)";
  }

  /** استرجاع آخر أغنية (متوقفة) بدون ما نحمّل مشغّل يوتيوب غير وقت الضغط على تشغيل */
  async function restore() {
    const saved = RSU.store.get("player", null);
    if (!saved || !saved.songId || !RSU.data) return;
    try {
      const all = await RSU.data.songs.listCached();
      const byId = {};
      all.forEach((x) => (byId[x.id] = x));
      const q = (saved.ids || []).map((id) => byId[id]).filter(Boolean);
      if (!q.length || !byId[saved.songId] || S.queue.length) return;
      S.queue = q;
      S.index = Math.max(0, q.findIndex((x) => x.id === saved.songId));
      S.time = saved.time || 0;
      S.engine = srcOf(cur());
      S.lazy = S.engine !== "external";
      if (S.engine === "external") S.note = "external";
      emit();
    } catch (e) { /* مش مشكلة لو فشل الاسترجاع */ }
  }

  RSU.player = {
    state: S,
    mount,
    playSong,
    setQueue,
    toggle,
    next: () => next(false),
    prev,
    seek,
    setVolume,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** لو الأغنية اتحذفت من الأدمن وهي الحالية */
    clear() { stopEngine(); S.queue = []; S.index = -1; S.note = ""; RSU.store.del("player"); emit(); }
  };
})();
