let db = null;
let auth = null;

const SETTINGS_KEY = "localgram_settings";
const DEFAULT_SETTINGS = {
    theme: "dark", fontSize: 15, sendByEnter: true, notifications: true, recordMode: "voice",
    sound: true, vibrate: true, preview: true,
    notifyPrivate: true, notifyGroups: true, notifySaved: false,
    inAppSound: true, inAppVibrate: true, inAppPreview: true,
    lastSeen: "everyone", profilePhoto: "everyone", bioVisibility: "everyone", callsFrom: "everyone", groupsFrom: "everyone",
    readReceipts: true, forwardLink: true, sensitiveContent: false,
    cacheLifetime: "1w", autoDownloadPhotos: "always", autoDownloadVideos: "wifi", autoDownloadFiles: "wifi", autoDownloadVoice: "always",
    saveTraffic: false, cornerRadius: 12, chatWallpaper: "", swipeAction: "archive", language: "ru", stickerSuggestions: true,
    requirePaymentForStrangers: false, paidMessagePrice: 5,
    hidePattern: false, compactMode: false, animationEnabled: true, timeFormat24: true, reactionsEnabled: true,
    accentColor: "",
};

const state = {
    user: null, profile: null, chats: {}, unread: {},
    activeChatId: null, activeChat: null, partner: null,
    messages: [], msgLimit: 100, folder: "all",
    replyTo: null, editing: null, drafts: {}, typing: {}, presence: {},
    settings: loadSettings(),
    stars: 0, isAdmin: false, verifiedUsers: new Set(),
    prefixes: {},
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
    if (s.cornerRadius !== undefined) document.documentElement.style.setProperty("--radius", s.cornerRadius + "px");
    if (s.chatWallpaper && typeof applyWallpaperColors === "function") applyWallpaperColors(s.chatWallpaper);
    const toggle = $("nightToggle");
    if (toggle) toggle.checked = s.theme === "dark";
    if (typeof applyCustomization === "function") applyCustomization();
}

function applyCustomization() {
    const s = state.settings;
    const root = document.documentElement;
    root.classList.toggle("hide-pattern", !!s.hidePattern);
    root.classList.toggle("compact-mode", !!s.compactMode);
    root.classList.toggle("no-animation", s.animationEnabled === false);
    if (s.accentColor) {
        root.style.setProperty("--accent", s.accentColor);
        root.style.setProperty("--accent-2", s.accentColor);
    } else {
        root.style.removeProperty("--accent");
        root.style.removeProperty("--accent-2");
    }
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
        "auth/requires-recent-login": "Требуется повторный вход. Выйдите и войдите снова.",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Неверный API-ключ Firebase.",
    };
    if (error && error.code && map[error.code]) return map[error.code];
    if (String(error && error.message || "").indexOf("permission_denied") >= 0) return "Нет доступа. Проверьте правила безопасности Firebase.";
    return (error && error.message) || "Неизвестная ошибка";
}

/* ===== AUTH ===== */

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
    let createdUser = null;

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        createdUser = cred.user;
        try { await createdUser.getIdToken(true); } catch (e) {}

        const unameRef = db.ref("usernames/" + username);
        const tx = await unameRef.transaction(function (cur) {
            if (cur === null) return createdUser.uid;
            return;
        });
        if (!tx.committed) {
            try { await createdUser.delete(); } catch (e) {}
            authError(form, "Этот username уже занят.");
            return;
        }

        const profile = {
            email: email, username: username, nickname: nickname,
            avatarUrl: "", bio: "", birthday: "",
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        await db.ref("users/" + createdUser.uid).set(profile);
        state.profile = profile;
    } catch (error) {
        if (createdUser) {
            try { await db.ref("usernames/" + username).remove(); } catch (e) {}
            try { await createdUser.delete(); } catch (e) {}
        }
        authError(form, friendlyError(error));
    } finally {
        btn.disabled = false;
    }
}

async function ensureOwnUsername() {
    if (!state.profile || !state.profile.username || !state.user) return;
    const uname = normalizeUsername(state.profile.username);
    if (!isValidUsername(uname)) return;
    try {
        const ref = db.ref("usernames/" + uname);
        const snap = await ref.once("value");
        const cur = snap.val();
        if (cur === state.user.uid) return;
        const tx = await ref.transaction(function (current) {
            if (current === null || current === state.user.uid) return state.user.uid;
            return;
        });
    } catch (e) {}
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
        state.prefixes = {};
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
        } catch (err) {}
        await new Promise(function (r) { setTimeout(r, 500); });
    }
    if (!profile) {
        toast("Профиль не найден. Войдите снова.");
        showAuth("login");
        return;
    }

    state.profile = profile;
    state.isAdmin = isAdminUser(profile.username);

    // Синхронизация платных сообщений
    if (profile.requirePaymentForStrangers !== undefined) {
        state.settings.requirePaymentForStrangers = !!profile.requirePaymentForStrangers;
    }
    if (profile.paidMessagePrice !== undefined) {
        state.settings.paidMessagePrice = Number(profile.paidMessagePrice) || 5;
    }
    saveSettings();

    try {
        const vSnap = await db.ref("config/verified").once("value");
        state.verifiedUsers = new Set(Object.keys(vSnap.val() || {}));
    } catch (e) { state.verifiedUsers = new Set(); }
    DEFAULT_VERIFIED.forEach(function (u) { state.verifiedUsers.add(u); });

    try {
        const sSnap = await db.ref("users/" + user.uid + "/stars").once("value");
        state.stars = Number(sSnap.val()) || 0;
    } catch (e) { state.stars = 0; }

    $("authScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    renderDrawerProfile();
    startPresence();
    ensureOwnUsername().catch(function () {});

    listen("global", db.ref("users/" + user.uid), "value", function (snap) {
        if (!snap.val()) return;
        state.profile = snap.val();
        state.isAdmin = isAdminUser(state.profile.username);
        renderDrawerProfile();
        toggleAdminButtonVisibility();
    });
    listenChats();
    if (typeof listenStars === "function") listenStars();
    listenPrefixes();

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
    try { if (typeof closeContactsPanel === "function") closeContactsPanel(); } catch (e) {}
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
                    onclick: function () { done({ checked: (check && check.checked) || false }); closeModal(); }
                }, opts.ok || "OK")
            ),
        ].filter(Boolean);
        openModal({ title: opts.title, body: body, onClose: function () { done(null); } });
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
    let uid = null;
    try {
        const snap = await db.ref("usernames/" + username).once("value");
        const val = snap.val();
        if (typeof val === "string") uid = val;
        else if (val && typeof val === "object" && typeof val.uid === "string") uid = val.uid;
    } catch (err) {}
    if (uid) {
        const user = await getUser(uid);
        if (user) return user;
    }
    const found = Object.values(state.chats).find(function (e) {
        return e.type === "private" && normalizeUsername(e.partnerUsername || "") === username;
    });
    if (found && found.partnerId) return getUser(found.partnerId);
    return null;
}

/* ===== PREFIXES ===== */

const PREFIX_DEFS = {
    admin: { label: "ADMIN", color: "#e53935" },
    dev:   { label: "DEV",   color: "#3390ec" },
    scam:  { label: "SCAM",  color: "#f59e0b" },
    loh:   { label: "ЛОХ",   color: "#8d6e63" },
};

function listenPrefixes() {
    const ref = db.ref("user_prefixes");
    listen("global", ref, "value", function (snap) {
        state.prefixes = snap.val() || {};
        try { renderChatList(); } catch (e) {}
        try { renderChatHeader(); } catch (e) {}
        try { if ($("infoPanel") && !$("infoPanel").classList.contains("hidden")) renderInfoPanel(); } catch (e) {}
    });
}

function prefixBadge(uid) {
    if (!uid || !state.prefixes) return null;
    const key = state.prefixes[uid];
    if (!key || !PREFIX_DEFS[key]) return null;
    const def = PREFIX_DEFS[key];
    return h("span", {
        class: "user-prefix user-prefix-" + key,
        style: "background:" + def.color + ";",
        text: def.label,
    });
}