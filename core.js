let db = null;
let auth = null;

const SETTINGS_KEY = "localgram_settings";
const DEFAULT_SETTINGS = {
    theme: "dark",
    fontSize: 15,
    sendByEnter: true,
    notifications: true,
    recordMode: "voice",
    sound: true,
    vibrate: true,
    preview: true,
    notifyPrivate: true,
    notifyGroups: true,
    notifySaved: false,
    inAppSound: true,
    inAppVibrate: true,
    inAppPreview: true,
    lastSeen: "everyone",
    profilePhoto: "everyone",
    bioVisibility: "everyone",
    callsFrom: "everyone",
    groupsFrom: "everyone",
    readReceipts: true,
    forwardLink: true,
    sensitiveContent: false,
    cacheLifetime: "1w",
    autoDownloadPhotos: "always",
    autoDownloadVideos: "wifi",
    autoDownloadFiles: "wifi",
    autoDownloadVoice: "always",
    saveTraffic: false,
    cornerRadius: 12,
    chatWallpaper: "",
    swipeAction: "archive",
    language: "ru",
    stickerSuggestions: true,
};

const state = {
    user: null,
    profile: null,
    chats: {},
    unread: {},
    activeChatId: null,
    activeChat: null,
    partner: null,
    messages: [],
    msgLimit: 100,
    folder: "all",
    replyTo: null,
    editing: null,
    drafts: {},
    typing: {},
    presence: {},
    settings: loadSettings(),
    stars: 0,
    isAdmin: false,
    verifiedUsers: new Set(),
};

const listenerGroups = {};

function listen(group, ref, event, cb) {
    ref.on(event, cb, function (err) { console.error("[localgram] listener " + group + ":", err.message); });
    if (!listenerGroups[group]) listenerGroups[group] = [];
    listenerGroups[group].push(function () { ref.off(event, cb); });
}

function offGroup(group) {
    (listenerGroups[group] || []).forEach(function (off) { off(); });
    listenerGroups[group] = [];
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        return Object.assign({}, DEFAULT_SETTINGS, saved);
    } catch (e) {
        return Object.assign({}, DEFAULT_SETTINGS);
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    applySettings();
}

function applySettings() {
    const s = state.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.style.setProperty("--msg-size", s.fontSize + "px");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", s.theme === "dark" ? "#17212b" : "#ffffff");
    if (s.cornerRadius) document.documentElement.style.setProperty("--radius", s.cornerRadius + "px");
    if (s.chatWallpaper && typeof applyWallpaperColors === "function") {
        applyWallpaperColors(s.chatWallpaper);
    }
    const toggle = $("nightToggle");
    if (toggle) toggle.checked = s.theme === "dark";
}

function initFirebase(config) {
    firebase.initializeApp(config);
    db = firebase.database();
    auth = firebase.auth();
}

function friendlyError(error) {
    const map = {
        "auth/invalid-email": "Некорректный email.",
        "auth/user-not-found": "Пользователь не найден.",
        "auth/wrong-password": "Неверный пароль.",
        "auth/invalid-credential": "Неверный email или пароль.",
        "auth/invalid-login-credentials": "Неверный email или пароль.",
        "auth/email-already-in-use": "Этот email уже зарегистрирован.",
        "auth/weak-password": "Слишком простой пароль (минимум 6 символов).",
        "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
        "auth/network-request-failed": "Нет соединения с сервером.",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Неверный API-ключ Firebase.",
    };
    if (error && error.code && map[error.code]) return map[error.code];
    if (String(error && error.message || "").includes("permission_denied")) return "Нет доступа. Проверьте правила безопасности Firebase.";
    return error && error.message || "Неизвестная ошибка";
}

function showAuth(mode) {
    mode = mode || "login";
    $("app").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    $("loginForm").classList.toggle("hidden", mode !== "login");
    $("registerForm").classList.toggle("hidden", mode !== "register");
    document.querySelectorAll(".auth-error").forEach(function (n) { n.remove(); });
}

function authError(form, text) {
    const prev = form.querySelector(".auth-error");
    if (prev) prev.remove();
    form.querySelector(".tg-btn.primary").before(h("p", { class: "auth-error", role: "alert", text: text }));
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    if (!email || !password) return authError(form, "Введите email и пароль.");
    const btn = form.querySelector(".tg-btn.primary");
    btn.disabled = true;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        authError(form, friendlyError(error));
    } finally {
        btn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const nickname = $("regNickname").value.trim();
    const username = normalizeUsername($("regUsername").value);
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;

    if (!nickname || !username || !email || password.length < 6) {
        return authError(form, "Заполните все поля. Пароль — минимум 6 символов.");
    }
    if (!isValidUsername(username)) {
        return authError(form, "Username: латиница, цифры и _, от 3 до 32 символов.");
    }

    const btn = form.querySelector(".tg-btn.primary");
    btn.disabled = true;

    try {
        let taken = null;
        try {
            const snap = await db.ref("usernames/" + username).once("value");
            taken = snap.val();
        } catch (err) {
            console.warn("[localgram] username check failed:", err.message);
        }
        if (taken) {
            authError(form, "Этот username уже занят.");
            return;
        }

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        try { await user.getIdToken(true); } catch (e) {}

        const profile = {
            email: email, username: username, nickname: nickname,
            avatarUrl: "", bio: "",
            createdAt: Date.now(), updatedAt: Date.now(),
        };

        await db.ref("users/" + user.uid).set(profile);
        await db.ref("usernames/" + username).set(user.uid);

        state.profile = profile;
        console.log("[localgram] registration complete for uid:", user.uid);
    } catch (error) {
        console.error("[localgram] register error:", error);
        authError(form, friendlyError(error));
    } finally {
        btn.disabled = false;
    }
}

async function handleAuthState(user) {
    offGroup("global");
    offGroup("chat");
    if (typeof offGiftsGroup === "function") offGiftsGroup();
    state.user = user;

    if (!user) {
        state.profile = null;
        state.chats = {};
        state.stars = 0;
        state.isAdmin = false;
        state.verifiedUsers = new Set();
        closeChat();
        showAuth("login");
        return;
    }

    let profile = null;
    for (let i = 0; i < 5; i++) {
        try {
            const snap = await db.ref("users/" + user.uid).once("value");
            profile = snap.val();
            if (profile) break;
        } catch (err) {
            console.warn("[localgram] profile read attempt " + (i + 1) + ":", err.message);
        }
        await new Promise(function (r) { setTimeout(r, 500); });
    }

    if (!profile) {
        console.warn("[localgram] profile not found after 5 attempts");
        toast("Профиль не найден. Войдите снова.");
        showAuth("login");
        return;
    }

    state.profile = profile;
    state.isAdmin = isAdminUser(profile.username);

    // Загружаем список верифицированных
    try {
        const vSnap = await db.ref("config/verified").once("value");
        const vVal = vSnap.val() || {};
        state.verifiedUsers = new Set(Object.keys(vVal));
    } catch (e) {
        console.warn("[localgram] verified list load failed:", e.message);
        state.verifiedUsers = new Set();
    }
    DEFAULT_VERIFIED.forEach(function (u) { state.verifiedUsers.add(u); });

    // Загружаем баланс звёзд
    try {
        const sSnap = await db.ref("users/" + user.uid + "/stars").once("value");
        state.stars = Number(sSnap.val()) || 0;
    } catch (e) { state.stars = 0; }

    $("authScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    renderDrawerProfile();
    startPresence();

    listen("global", db.ref("users/" + user.uid), "value", function (snap) {
        if (!snap.val()) return;
        state.profile = snap.val();
        state.isAdmin = isAdminUser(state.profile.username);
        renderDrawerProfile();
        toggleAdminButtonVisibility();
    });
    listenChats();

    if (typeof listenStars === "function") listenStars();

    toggleAdminButtonVisibility();
}

function toggleAdminButtonVisibility() {
    const btn = $("drawerAdminBtn");
    if (!btn) return;
    btn.classList.toggle("hidden", !state.isAdmin);
}

function startPresence() {
    const uid = state.user.uid;
    const userRef = db.ref("users/" + uid);
    listen("global", db.ref(".info/connected"), "value", function (snap) {
        if (snap.val() !== true) return;
        userRef.child("online").onDisconnect().set(false);
        userRef.child("lastSeen").onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
        userRef.update({ online: true, lastSeen: Date.now() }).catch(function () {});
    });
}

async function logout() {
    try {
        stopRecording(true);
        await clearTyping();
        if (state.user) await db.ref("users/" + state.user.uid).update({ online: false, lastSeen: Date.now() });
    } catch (e) {}
    closeDrawer();
    closeModal();
    try { if (typeof closeSettings === "function") closeSettings(); } catch (e) {}
    try { if (typeof closeProfilePanel === "function") closeProfilePanel(); } catch (e) {}
    try { if (typeof closeAdminPanel === "function") closeAdminPanel(); } catch (e) {}
    try { if (typeof closeGiftsPanel === "function") closeGiftsPanel(); } catch (e) {}
    await auth.signOut();
}

/* ===== MODAL ===== */

let modalBackHandler = null;
let modalCloseHandler = null;

function openModal(opts) {
    $("modalTitle").textContent = opts.title || "";
    const bodyNode = $("modalBody");
    const bodyList = [].concat(opts.body || []).filter(Boolean);
    bodyNode.replaceChildren.apply(bodyNode, bodyList);
    $("modalBackBtn").classList.toggle("hidden", !opts.onBack);
    modalBackHandler = opts.onBack || null;
    modalCloseHandler = opts.onClose || null;
    $("modal").style.maxWidth = opts.wide ? "520px" : "";
    $("modalOverlay").classList.remove("hidden");
    setTimeout(function () {
        const input = bodyNode.querySelector("input:not([type=checkbox]):not([type=range]), textarea");
        if (input) input.focus();
    }, 50);
}

function closeModal() {
    if ($("modalOverlay").classList.contains("hidden")) return;
    $("modalOverlay").classList.add("hidden");
    $("modalBody").replaceChildren();
    const cb = modalCloseHandler;
    modalCloseHandler = null;
    if (cb) cb();
}

function confirmDialog(opts) {
    return new Promise(function (resolve) {
        let settled = false;
        const done = function (value) { if (settled) return; settled = true; resolve(value); };
        const check = opts.checkbox ? h("input", { type: "checkbox" }) : null;
        const body = [
            opts.text ? h("p", { text: opts.text }) : null,
            opts.checkbox ? h("label", { class: "check-row" }, check, h("span", { text: opts.checkbox })) : null,
            h("div", { class: "modal-actions" },
                h("button", { class: "tg-btn link", onclick: function () { done(null); closeModal(); } }, "Отмена"),
                h("button", {
                    class: "tg-btn " + (opts.danger ? "danger" : "link"),
                    onclick: function () { done({ checked: check && check.checked || false }); closeModal(); }
                }, opts.ok || "OK")
            ),
        ].filter(Boolean);
        openModal({ title: opts.title, body: body, onClose: function () { done(null); } });
    });
}

function promptDialog(opts) {
    return new Promise(function (resolve) {
        let settled = false;
        const done = function (v) { if (settled) return; settled = true; resolve(v); };
        const input = h("input", { type: "text", placeholder: " ", maxlength: opts.maxLength || 64 });
        input.value = opts.value || "";
        const submit = function () { done(input.value.trim()); closeModal(); };
        input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !isComposingEvent(e)) submit(); });
        openModal({
            title: opts.title,
            body: [
                h("label", { class: "tg-field" }, input, h("span", { text: opts.label })),
                h("div", { class: "modal-actions" },
                    h("button", { class: "tg-btn link", onclick: function () { done(null); closeModal(); } }, "Отмена"),
                    h("button", { class: "tg-btn link", onclick: submit }, opts.ok || "Сохранить")),
            ],
            onClose: function () { done(null); },
        });
    });
}

/* ===== CONTEXT MENU ===== */

function showMenu(items, pos, extra) {
    const menu = $("ctxMenu");
    menu.replaceChildren();
    if (extra) menu.appendChild(extra);
    items.filter(Boolean).forEach(function (item) {
        if (item === "sep") return menu.appendChild(h("div", { class: "ctx-sep" }));
        menu.appendChild(h("button", {
            class: "ctx-item " + (item.danger ? "danger" : ""),
            role: "menuitem",
            onclick: function () { hideMenu(); item.onClick(); },
        }, icon(item.icon), item.label));
    });
    menu.classList.remove("hidden");
    $("ctxBackdrop").classList.remove("hidden");

    let x = pos.x, y = pos.y;
    if (pos.anchor) {
        const r = pos.anchor.getBoundingClientRect();
        x = r.right - menu.offsetWidth;
        y = r.bottom + 4;
    }
    const w = menu.offsetWidth, hgt = menu.offsetHeight;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    if (y + hgt > window.innerHeight - 8) y = Math.max(8, y - hgt);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    const firstBtn = menu.querySelector("button");
    if (firstBtn) firstBtn.focus({ preventScroll: true });
}

function hideMenu() {
    $("ctxMenu").classList.add("hidden");
    $("ctxBackdrop").classList.add("hidden");
}

/* ===== USERS ===== */

const userCache = {};

async function getUser(uid) {
    if (userCache[uid]) return userCache[uid];
    const data = (await db.ref("users/" + uid).once("value")).val();
    if (data) userCache[uid] = Object.assign({ uid: uid }, data);
    return userCache[uid] || null;
}

async function findUserByUsername(raw) {
    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) return null;
    const uid = (await db.ref("usernames/" + username).once("value")).val();
    if (!uid) return null;
    return getUser(uid);
}