let db = null;
let auth = null;

const SETTINGS_KEY = "localgram_settings";
const DEFAULT_SETTINGS = { theme: "dark", fontSize: 15, sendByEnter: true, notifications: true, recordMode: "voice" };

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
};

const listenerGroups = {};

function listen(group, ref, event, cb) {
    ref.on(event, cb, (err) => console.error(`[localgram] listener ${group}:`, err.message));
    (listenerGroups[group] ||= []).push(() => ref.off(event, cb));
}

function offGroup(group) {
    (listenerGroups[group] || []).forEach((off) => off());
    listenerGroups[group] = [];
}

function loadSettings() {
    try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    applySettings();
}

function applySettings() {
    const { theme, fontSize } = state.settings;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--msg-size", `${fontSize}px`);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#17212b" : "#ffffff");
    const toggle = $("nightToggle");
    if (toggle) toggle.checked = theme === "dark";
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
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Неверный API-ключ Firebase. Проверьте переменную GCP_API_KEY.",
    };
    if (error?.code && map[error.code]) return map[error.code];
    if (String(error?.message || "").includes("permission_denied")) return "Нет доступа. Проверьте правила безопасности Firebase.";
    return error?.message || "Неизвестная ошибка";
}

/* ===== AUTH ===== */

function showAuth(mode = "login") {
    $("app").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    $("loginForm").classList.toggle("hidden", mode !== "login");
    $("registerForm").classList.toggle("hidden", mode !== "register");
    document.querySelectorAll(".auth-error").forEach((n) => n.remove());
}

function authError(form, text) {
    form.querySelector(".auth-error")?.remove();
    form.querySelector(".tg-btn.primary").before(h("p", { class: "auth-error", role: "alert", text }));
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
        // 1. Проверяем username (правило .read: true разрешает)
        let taken = null;
        try {
            const snap = await db.ref(`usernames/${username}`).once("value");
            taken = snap.val();
        } catch (err) {
            console.warn("[localgram] username check failed:", err.message);
        }
        if (taken) {
            authError(form, "Этот username уже занят.");
            return;
        }

        // 2. Создаём пользователя в Auth
        const { user } = await auth.createUserWithEmailAndPassword(email, password);

        // 3. КРИТИЧНО: форсируем обновление ID-токена для RTDB
        await user.getIdToken(true);

        // 4. Пишем профиль и username (токен уже готов)
        const profile = {
            email, username, nickname,
            avatarUrl: "", bio: "",
            createdAt: Date.now(), updatedAt: Date.now()
        };

        await db.ref(`users/${user.uid}`).set(profile);
        await db.ref(`usernames/${username}`).set(user.uid);

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
    state.user = user;

    if (!user) {
        state.profile = null;
        state.chats = {};
        closeChat();
        showAuth("login");
        return;
    }

    // Читаем профиль с повторами — токен может быть ещё не готов
    let profile = null;
    for (let i = 0; i < 5; i++) {
        try {
            const snap = await db.ref(`users/${user.uid}`).once("value");
            profile = snap.val();
            if (profile) break;
        } catch (err) {
            console.warn(`[localgram] profile read attempt ${i + 1}:`, err.message);
        }
        await new Promise((r) => setTimeout(r, 500));
    }

    if (!profile) {
        console.warn("[localgram] profile not found after 5 attempts");
        toast("Профиль не найден. Войдите снова.");
        showAuth("login");
        return;
    }

    state.profile = profile;
    $("authScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    renderDrawerProfile();
    startPresence();

    listen("global", db.ref(`users/${user.uid}`), "value", (snap) => {
        if (!snap.val()) return;
        state.profile = snap.val();
        renderDrawerProfile();
    });
    listenChats();
}
function startPresence() {
    const uid = state.user.uid;
    const userRef = db.ref(`users/${uid}`);
    listen("global", db.ref(".info/connected"), "value", (snap) => {
        if (snap.val() !== true) return;
        userRef.child("online").onDisconnect().set(false);
        userRef.child("lastSeen").onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
        userRef.update({ online: true, lastSeen: Date.now() }).catch(() => {});
    });
}

async function logout() {
    try {
        stopRecording(true);
        await clearTyping();
        if (state.user) await db.ref(`users/${state.user.uid}`).update({ online: false, lastSeen: Date.now() });
    } catch {}
    closeDrawer();
    closeModal();
    await auth.signOut();
}

/* ===== MODAL ===== */

let modalBackHandler = null;
let modalCloseHandler = null;

function openModal({ title, body, onBack, onClose, wide }) {
    $("modalTitle").textContent = title || "";
    const bodyNode = $("modalBody");
    bodyNode.replaceChildren(...[].concat(body));
    $("modalBackBtn").classList.toggle("hidden", !onBack);
    modalBackHandler = onBack || null;
    modalCloseHandler = onClose || null;
    $("modal").style.maxWidth = wide ? "520px" : "";
    $("modalOverlay").classList.remove("hidden");
    setTimeout(() => bodyNode.querySelector("input:not([type=checkbox]):not([type=range]), textarea")?.focus(), 50);
}

function closeModal() {
    if ($("modalOverlay").classList.contains("hidden")) return;
    $("modalOverlay").classList.add("hidden");
    $("modalBody").replaceChildren();
    const cb = modalCloseHandler;
    modalCloseHandler = null;
    cb?.();
}

function confirmDialog({ title, text, ok = "OK", danger = false, checkbox }) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => { if (settled) return; settled = true; resolve(value); };
        const check = checkbox ? h("input", { type: "checkbox" }) : null;
        const body = [
            text ? h("p", { text }) : null,
            checkbox ? h("label", { class: "check-row" }, check, h("span", { text: checkbox })) : null,
            h("div", { class: "modal-actions" },
                h("button", { class: "tg-btn link", onclick: () => { done(null); closeModal(); } }, "Отмена"),
                h("button", { class: `tg-btn ${danger ? "danger" : "link"}`, onclick: () => { done({ checked: check?.checked || false }); closeModal(); } }, ok),
            ),
        ].filter(Boolean);
        openModal({ title, body, onClose: () => done(null) });
    });
}

function promptDialog({ title, label, value = "", ok = "Сохранить", maxLength = 64 }) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (v) => { if (settled) return; settled = true; resolve(v); };
        const input = h("input", { type: "text", placeholder: " ", maxlength: maxLength });
        input.value = value;
        const submit = () => { done(input.value.trim()); closeModal(); };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !isComposingEvent(e)) submit(); });
        openModal({
            title,
            body: [
                h("label", { class: "tg-field" }, input, h("span", { text: label })),
                h("div", { class: "modal-actions" },
                    h("button", { class: "tg-btn link", onclick: () => { done(null); closeModal(); } }, "Отмена"),
                    h("button", { class: "tg-btn link", onclick: submit }, ok)),
            ],
            onClose: () => done(null),
        });
    });
}

/* ===== CONTEXT MENU ===== */

function showMenu(items, pos, extra) {
    const menu = $("ctxMenu");
    menu.replaceChildren();
    if (extra) menu.appendChild(extra);
    items.filter(Boolean).forEach((item) => {
        if (item === "sep") return menu.appendChild(h("div", { class: "ctx-sep" }));
        menu.appendChild(h("button", {
            class: `ctx-item ${item.danger ? "danger" : ""}`,
            role: "menuitem",
            onclick: () => { hideMenu(); item.onClick(); },
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
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.querySelector("button")?.focus({ preventScroll: true });
}

function hideMenu() {
    $("ctxMenu").classList.add("hidden");
    $("ctxBackdrop").classList.add("hidden");
}

/* ===== USERS ===== */

const userCache = {};

async function getUser(uid) {
    if (userCache[uid]) return userCache[uid];
    const data = (await db.ref(`users/${uid}`).once("value")).val();
    if (data) userCache[uid] = { uid, ...data };
    return userCache[uid] || null;
}

async function findUserByUsername(raw) {
    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) return null;
    const uid = (await db.ref(`usernames/${username}`).once("value")).val();
    if (!uid) return null;
    return getUser(uid);
}
