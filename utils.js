const $ = (id) => document.getElementById(id);

function h(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value == null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key === "style") node.style.cssText = value;
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
        if (child == null || child === false) continue;
        node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
}

const ICON_PATHS = {
    check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
    checks: "M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41 6 19l1.41-1.41L1.83 12 .41 13.41z",
    pin: "M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z",
    mute: "M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z",
    unmute: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
    reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
    forward: "M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z",
    edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    copy: "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z",
    trash: "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
    bookmark: "M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z",
    archive: "M20.5 5.2 19.1 3.5A1.5 1.5 0 0 0 18 3H6c-.5 0-.9.2-1.2.5L3.5 5.2C3.2 5.6 3 6 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.5-.2-.9-.5-1.3zM12 17.5 6.5 12H10v-2h4v2h3.5L12 17.5zM5.1 5l.8-1h12l.9 1H5.1z",
    info: "M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z",
    play: "M8 5v14l11-7z",
    pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
    file: "M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z",
    download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4V5z",
    addUser: "M15 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z",
    group: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0h-1c1.2.9 2 2 2 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z",
    at: "M12 2a10 10 0 1 0 0 20h5v-2h-5a8 8 0 1 1 8-8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12a5 5 0 1 0-1.46 3.53A3.7 3.7 0 0 0 18.5 17c1.97 0 3.5-1.6 3.5-3.57V12A10 10 0 0 0 12 2zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
    search: "M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z",
    message: "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z",
    broom: "M19.36 2.72 20.78 4.14 15.06 9.85C16.13 11.39 16.28 13.24 15.38 14.44L9.06 8.12C10.26 7.22 12.11 7.37 13.65 8.44L19.36 2.72M5.93 17.57C3.92 15.56 2.69 13.16 2.35 10.92L7.23 8.83 14.67 16.27 12.58 21.15C10.34 20.81 7.94 19.58 5.93 17.57Z",
    unread: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
    bell: "M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
    lock: "M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10z",
    star: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    camera: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9z",
    image: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z",
    video: "M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z",
};

function icon(name, cls) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (cls) svg.setAttribute("class", cls);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICON_PATHS[name] || "");
    svg.appendChild(path);
    return svg;
}

const AVATAR_COLORS = [
    ["#ff885e", "#ff516a"], ["#ffcd6a", "#ffa85c"], ["#e0a2f3", "#d669ed"],
    ["#a0de7e", "#54cb68"], ["#53edd6", "#28c9b7"], ["#72d5fd", "#2a9ef1"], ["#82b1ff", "#665fff"],
];
const NAME_COLORS = ["#e17076", "#eda86c", "#a695e7", "#7bc862", "#6ec9cb", "#65aadd", "#ee7aae"];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < (str || "").length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
}

function nameColor(key) {
    return NAME_COLORS[hashString(key) % NAME_COLORS.length];
}

function initials(name) {
    const parts = String(name || "?").replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = Array.from(parts[0])[0] || "";
    const second = parts[1] ? Array.from(parts[1])[0] || "" : "";
    return (first + second).toUpperCase();
}

function setAvatar(node, name, url, opts = {}) {
    node.replaceChildren();
    node.style.backgroundImage = "";
    if (opts.icon) {
        node.style.background = opts.bg || "linear-gradient(#72d5fd, #2a9ef1)";
        node.appendChild(icon(opts.icon));
        return node;
    }
    if (url) {
        node.style.background = "";
        node.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
        node.style.backgroundSize = "cover";
        node.style.backgroundPosition = "center";
        return node;
    }
    const [a, b] = AVATAR_COLORS[hashString(opts.key || name) % AVATAR_COLORS.length];
    node.style.background = `linear-gradient(${a}, ${b})`;
    node.textContent = initials(name);
    return node;
}

function avatarEl(name, url, cls = "", opts = {}) {
    return setAvatar(h("span", { class: `avatar ${cls}`.trim(), "aria-hidden": "true" }), name, url, opts);
}

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function linkify(text, query) {
    let html = escapeHtml(text);
    html = html.replace(/(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/(^|[\s(])@([a-z0-9_]{3,32})/gi, '$1<span class="mention" data-username="$2">@$2</span>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/__([^_\n]+)__/g, "<i>$1</i>").replace(/`([^`\n]+)`/g, "<code>$1</code>");
    if (query) {
        const safe = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`(?![^<]*>)(${safe})`, "gi"), '<mark class="hl">$1</mark>');
    }
    return html;
}

function isEmojiOnly(text) {
    const t = String(text || "").trim();
    if (!t || t.length > 24) return false;
    if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|\u20e3|\s)+$/u.test(t)) return false;
    const count = typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter().segment(t.replace(/\s/g, ""))].length : 1;
    return count <= 3;
}

const pad = (n) => String(n).padStart(2, "0");
function formatTime(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function sameDay(a, b) {
    const x = new Date(a), y = new Date(b);
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
function formatListTime(ts) {
    if (!ts) return "";
    const now = Date.now();
    if (sameDay(ts, now)) return formatTime(ts);
    if (now - ts < 6 * 86400000) return new Date(ts).toLocaleDateString("ru-RU", { weekday: "short" });
    return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function formatDay(ts) {
    const now = Date.now();
    if (sameDay(ts, now)) return "Сегодня";
    if (sameDay(ts, now - 86400000)) return "Вчера";
    const d = new Date(ts);
    const opts = { day: "numeric", month: "long" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("ru-RU", opts);
}
function formatLastSeen(ts) {
    if (!ts) return "был(а) недавно";
    const diff = Date.now() - ts;
    if (diff < 60000) return "был(а) только что";
    if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
    if (sameDay(ts, Date.now())) return `был(а) сегодня в ${formatTime(ts)}`;
    if (sameDay(ts, Date.now() - 86400000)) return `был(а) вчера в ${formatTime(ts)}`;
    return `был(а) ${new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
}
function formatDuration(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1048576).toFixed(1)} МБ`;
}
function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@/, "").toLowerCase();
}
function isValidUsername(value) {
    return /^[a-z0-9_]{3,32}$/.test(value);
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function readAsDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

async function compressImage(file, maxSide = 1280, quality = 0.82) {
    if (file.type === "image/gif" && file.size < 900000) return { data: await readAsDataURL(file), width: 0, height: 0 };
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = url;
        });
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return { data: canvas.toDataURL("image/jpeg", quality), width: canvas.width, height: canvas.height };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function toast(text, ms = 2600) {
    const node = h("div", { class: "toast", text });
    $("toastStack").appendChild(node);
    setTimeout(() => node.remove(), ms);
}

function isComposingEvent(e) {
    return e.isComposing || e.keyCode === 229;
}

function onLongPress(node, cb) {
    let timer = null, startX = 0, startY = 0;
    node.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        timer = setTimeout(() => { timer = null; cb({ clientX: startX, clientY: startY, preventDefault() {} }); }, 480);
    }, { passive: true });
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
    node.addEventListener("touchend", cancel);
    node.addEventListener("touchcancel", cancel);
    node.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) cancel();
    }, { passive: true });
    node.addEventListener("contextmenu", (e) => { e.preventDefault(); cb(e); });
}