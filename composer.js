const EMOJI_SETS = {
    "🕘": [],
    "😀": "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👻 💀 🤡 💩 👽 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾".split(" "),
    "👍": "👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 💪 🦾 👀 👁 👄 🧠 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟".split(" "),
    "🐶": "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦒 🐪 🐄 🐎 🐖 🐑 🐕 🐈 🌵 🎄 🌲 🌴 🌱 🍀 🍁 🍄 🌷 🌹 🌻 🌸 🌈 ☀️ 🌙 ⚡ ❄️ ☃️ 🌊".split(" "),
    "🍔": "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶 🥒 🥦 🧄 🧅 🍞 🥐 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍱 🥟 🍤 🍙 🍚 🍰 🎂 🧁 🍭 🍬 🍫 🍿 🍩 🍪 ☕ 🍵 🥤 🧃 🍺 🍻 🥂 🍷 🍸 🍹".split(" "),
    "⚽": "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🏏 ⛳ 🏹 🎣 🥊 🥋 🎽 🛹 ⛸ 🎿 🏂 🏋️ 🤸 🚴 🏆 🥇 🥈 🥉 🏅 🎖 🎗 🎫 🎟 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎯 🎳 🎮 🧩 🚗 🚕 🚌 🏎 🚓 🚑 🚒 ✈️ 🚀 🛸 🚁 ⛵ 🚢 🏠 🏢 🏰 🗼 🗽 ⛺ 🌋".split(" "),
    "💡": "⌚ 📱 💻 ⌨️ 🖥 🖨 🖱 💾 💿 📷 📹 🎥 📞 ☎️ 📺 📻 🎙 ⏰ ⏳ 📡 🔋 🔌 💡 🔦 🕯 💸 💵 💰 💳 💎 ⚖️ 🔧 🔨 🛠 ⚙️ 🔫 💣 🔪 🛡 🔮 💊 💉 🧬 🔭 🔬 🧹 🧺 🧻 🚽 🛁 🔑 🗝 🚪 🛋 🛏 🧸 🎁 🎈 🎉 🎊 ✉️ 📦 📝 📁 📅 📌 📎 ✂️ 🔒 🔓".split(" "),
    "❤️": "❤️ ✅ ❌ ❓ ❗ ‼️ ⁉️ 💤 ♻️ ⚠️ 🚫 ⛔ 🔞 📵 🆗 🆒 🆕 🆓 🆙 🔝 🔜 ✔️ ☑️ ➕ ➖ ➗ ✖️ 💲 ©️ ®️ ™️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔶 🔷 ▶️ ⏸ ⏹ ⏺ ⏭ ⏮ 🔀 🔁 🔂 ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↩️ ↪️ 🔄 🎵 🎶 💬 💭 🗯 ♠️ ♣️ ♥️ ♦️ 🃏 🀄 🏳️ 🏴 🏁 🚩 🏳️‍🌈".split(" "),
};
const RECENT_EMOJI_KEY = "localgram_recent_emoji";

let typingTimer = null;
let lastTypingSent = 0;
let recorder = null;

/* ===== INPUT ===== */

function autosizeInput() {
    const input = $("messageInput");
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
}

function updateSendMode() {
    const btn = $("sendBtn");
    const hasText = $("messageInput").value.trim().length > 0;
    let mode = state.settings.recordMode === "video" ? "video" : "voice";
    if (state.editing) mode = "edit";
    else if (hasText) mode = "send";
    btn.dataset.mode = mode;
    btn.setAttribute("aria-label", {
        send: "Отправить", edit: "Сохранить изменения",
        voice: "Записать голосовое (нажмите, чтобы переключить на видео)",
        video: "Записать видеосообщение (нажмите, чтобы переключить на голос)",
    }[mode]);
}

function setReply(m) {
    state.editing = null;
    state.replyTo = { id: m.id, name: m.senderId === state.user.uid ? state.profile.nickname : m.senderName || "Сообщение", text: previewOf(m) };
    $("replyBarIcon").replaceChildren(...icon("reply").childNodes);
    $("replyBarTitle").textContent = `В ответ ${state.replyTo.name}`;
    $("replyBarText").textContent = state.replyTo.text;
    $("replyBar").classList.remove("hidden");
    updateSendMode();
    $("messageInput").focus();
}

function setEdit(m) {
    state.replyTo = null;
    state.editing = { id: m.id, original: $("messageInput").value };
    $("replyBarIcon").replaceChildren(...icon("edit").childNodes);
    $("replyBarTitle").textContent = "Редактирование";
    $("replyBarText").textContent = previewOf(m);
    $("replyBar").classList.remove("hidden");
    const input = $("messageInput");
    input.value = m.text || "";
    autosizeInput();
    updateSendMode();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
}

function cancelReplyEdit() {
    const wasEditing = state.editing;
    state.replyTo = null;
    state.editing = null;
    $("replyBar").classList.add("hidden");
    if (wasEditing) {
        $("messageInput").value = wasEditing.original || "";
        autosizeInput();
    }
    updateSendMode();
}

async function submitText() {
    const input = $("messageInput");
    const text = input.value.trim();
    const chatId = state.activeChatId;
    if (!chatId) return;

    if (state.editing) {
        const { id } = state.editing;
        if (!text) return toast("Сообщение не может быть пустым");
        try {
            await db.ref(`private_messages/${chatId}/${id}`).update({ text, editedAt: Date.now() });
            if (state.messages[state.messages.length - 1]?.id === id) {
                const m = { ...state.messages[state.messages.length - 1], text };
                await Promise.all(chatMembers(state.activeChat, chatId).map((u) => db.ref(`user_chats/${u}/${chatId}/lastMessage`).set(previewOf(m)).catch(() => {})));
            }
        } catch (error) {
            return toast(friendlyError(error));
        }
        state.editing = null;
        input.value = "";
        $("replyBar").classList.add("hidden");
        autosizeInput();
        updateSendMode();
        return;
    }

    if (!text) return;
    const replyTo = state.replyTo;
    input.value = "";
    state.drafts[chatId] = "";
    autosizeInput();
    cancelReplyEdit();
    clearTyping();
    const chunks = [];
    for (let i = 0; i < text.length; i += 4096) chunks.push(text.slice(i, i + 4096));
    try {
        for (const [i, chunk] of chunks.entries()) await pushMessage(chatId, { text: chunk, replyTo: i === 0 ? replyTo || undefined : undefined });
    } catch (error) {
        input.value = text;
        autosizeInput();
        updateSendMode();
        toast(friendlyError(error));
    }
}

/* ===== TYPING ===== */

function emitTyping() {
    const chatId = state.activeChatId;
    if (!chatId || state.activeChat?.type === "saved") return;
    const now = Date.now();
    const ref = db.ref(`typing/${chatId}/${state.user.uid}`);
    if (now - lastTypingSent > 2500) {
        lastTypingSent = now;
        ref.set({ name: state.profile.nickname, ts: now }).catch(() => {});
        ref.onDisconnect().remove();
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(clearTyping, 4000);
}

function clearTyping() {
    clearTimeout(typingTimer);
    if (!state.activeChatId || !state.user || !lastTypingSent) return Promise.resolve();
    lastTypingSent = 0;
    return db.ref(`typing/${state.activeChatId}/${state.user.uid}`).remove().catch(() => {});
}

/* ===== ATTACHMENTS ===== */

async function sendImages(files) {
    const chatId = state.activeChatId;
    if (!chatId) return;
    const caption = $("messageInput").value.trim();
    const replyTo = state.replyTo || undefined;
    let first = true;
    for (const file of files) {
        try {
            const { data } = await compressImage(file);
            if (data.length > 7_000_000) { toast("Изображение слишком большое"); continue; }
            await pushMessage(chatId, { type: "image", data, text: first ? caption : "", replyTo: first ? replyTo : undefined });
            first = false;
        } catch (error) {
            toast(friendlyError(error));
        }
    }
    if (!first) {
        $("messageInput").value = "";
        autosizeInput();
        cancelReplyEdit();
    }
}

async function sendFile(file) {
    if (!state.activeChatId) return;
    if (file.type.startsWith("image/")) return sendImages([file]);
    if (file.size > 5 * 1048576) return toast("Максимальный размер файла — 5 МБ");
    try {
        const data = await readAsDataURL(file);
        await pushMessage(state.activeChatId, { type: "file", data, fileName: file.name, fileSize: file.size, text: "", replyTo: state.replyTo || undefined });
        cancelReplyEdit();
    } catch (error) {
        toast(friendlyError(error));
    }
}

function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const others = files.filter((f) => !f.type.startsWith("image/"));
    if (images.length) sendImages(images);
    others.forEach(sendFile);
}

/* ===== RECORDING ===== */

function pickMime(kind) {
    const candidates = kind === "video"
        ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    return candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

async function startRecording(kind) {
    if (recorder || !state.activeChatId) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast("Запись не поддерживается в этом браузере");
    const pending = { kind, cancelled: false, starting: true };
    recorder = pending;
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia(kind === "video"
            ? { audio: true, video: { width: 320, height: 320, facingMode: "user" } }
            : { audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
        recorder = null;
        return toast(kind === "video" ? "Нет доступа к камере" : "Нет доступа к микрофону");
    }
    if (pending.cancelled || recorder !== pending) {
        stream.getTracks().forEach((t) => t.stop());
        if (recorder === pending) recorder = null;
        return;
    }

    const mimeType = pickMime(kind);
    const mr = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 32000,
        videoBitsPerSecond: kind === "video" ? 350000 : undefined,
    });
    const chunks = [];
    Object.assign(pending, { mr, stream, chunks, startedAt: Date.now(), starting: false });
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.start(250);

    if (kind === "video") {
        $("videoRecVideo").srcObject = stream;
        $("videoRecPreview").classList.remove("hidden");
    }
    $("inputRow").classList.add("hidden");
    $("recordingBar").classList.remove("hidden", "cancel");
    $("recordingHint").textContent = "Отпустите для отправки, влево — отмена";
    $("sendBtn").classList.add("recording");
    const tick = () => {
        if (recorder !== pending) return;
        const sec = (Date.now() - pending.startedAt) / 1000;
        $("recordingTime").textContent = formatDuration(sec);
        if (sec >= (kind === "video" ? 30 : 300)) return stopRecording(false);
        pending.raf = setTimeout(tick, 250);
    };
    tick();
}

function stopRecording(cancel) {
    const rec = recorder;
    if (!rec) return;
    recorder = null;
    if (rec.starting) { rec.cancelled = true; return; }
    clearTimeout(rec.raf);
    $("inputRow").classList.remove("hidden");
    $("recordingBar").classList.add("hidden");
    $("videoRecPreview").classList.add("hidden");
    $("videoRecVideo").srcObject = null;
    $("sendBtn").classList.remove("recording");

    const duration = (Date.now() - rec.startedAt) / 1000;
    const chatId = state.activeChatId;
    rec.mr.onstop = async () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        if (cancel || duration < 0.8 || !chatId) {
            if (!cancel && duration < 0.8) toast("Удерживайте кнопку, чтобы записать");
            return;
        }
        try {
            const blob = new Blob(rec.chunks, { type: rec.mr.mimeType || (rec.kind === "video" ? "video/webm" : "audio/webm") });
            const data = await readAsDataURL(blob);
            if (data.length > 9_000_000) return toast("Запись слишком большая");
            await pushMessage(chatId, { type: rec.kind, data, duration: Math.round(duration), text: "", replyTo: state.replyTo || undefined });
            cancelReplyEdit();
        } catch (error) {
            toast(friendlyError(error));
        }
    };
    if (rec.mr.state !== "inactive") rec.mr.stop();
}

function bindRecordButton() {
    const btn = $("sendBtn");
    let pressTimer = null, startX = 0, pressing = false;

    btn.addEventListener("pointerdown", (e) => {
        const mode = btn.dataset.mode;
        if (mode !== "voice" && mode !== "video") return;
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        pressing = true;
        startX = e.clientX;
        pressTimer = setTimeout(() => { pressTimer = null; startRecording(mode); }, 220);
    });
    btn.addEventListener("pointermove", (e) => {
        if (!pressing || !recorder || recorder.starting) return;
        const dx = e.clientX - startX;
        $("recordingBar").classList.toggle("cancel", dx < -60);
        $("recordingHint").textContent = dx < -60 ? "Отпустите для отмены" : "Отпустите для отправки, влево — отмена";
    });
    const end = (e) => {
        if (!pressing) return;
        pressing = false;
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            state.settings.recordMode = state.settings.recordMode === "video" ? "voice" : "video";
            saveSettings();
            updateSendMode();
            return;
        }
        const cancel = e.type === "pointercancel" || e.clientX - startX < -60;
        stopRecording(cancel);
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        if (mode === "send" || mode === "edit") submitText();
    });
}

/* ===== EMOJI ===== */

function recentEmoji() {
    try { return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || "[]"); } catch { return []; }
}

function pushRecentEmoji(emoji) {
    const list = [emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, 32);
    localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(list));
}

function insertAtCursor(text) {
    const input = $("messageInput");
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    autosizeInput();
    updateSendMode();
}

function renderEmojiTab(tab) {
    const list = tab === "🕘" ? recentEmoji() : EMOJI_SETS[tab];
    $("emojiTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    const grid = $("emojiGrid");
    grid.replaceChildren(...(list.length ? list : ["👍", "❤️", "😂", "🔥", "🙏", "😍"]).map((emoji) =>
        h("button", { type: "button", text: emoji, "aria-label": emoji, onclick: () => { insertAtCursor(emoji); pushRecentEmoji(emoji); } })));
    grid.scrollTop = 0;
}

function toggleEmojiPicker(force) {
    const picker = $("emojiPicker");
    const show = force ?? picker.classList.contains("hidden");
    if (!show) return picker.classList.add("hidden");
    if (!$("emojiTabs").children.length) {
        Object.keys(EMOJI_SETS).forEach((tab) => $("emojiTabs").appendChild(h("button", { type: "button", dataset: { tab }, text: tab, onclick: () => renderEmojiTab(tab) })));
    }
    renderEmojiTab(recentEmoji().length ? "🕘" : "😀");
    picker.classList.remove("hidden");
    const r = $("composer").getBoundingClientRect();
    picker.style.left = `${Math.max(8, r.left + 16)}px`;
    picker.style.top = `${Math.max(8, r.top - picker.offsetHeight - 4)}px`;
}

/* ===== BINDINGS ===== */

function bindComposer() {
    const input = $("messageInput");
    input.addEventListener("input", () => {
        autosizeInput();
        updateSendMode();
        if (state.activeChatId) state.drafts[state.activeChatId] = input.value;
        if (input.value.trim()) emitTyping();
    });
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && state.settings.sendByEnter) {
            if (isComposingEvent(e)) return;
            e.preventDefault();
            submitText();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !state.settings.sendByEnter) {
            e.preventDefault();
            submitText();
        } else if (e.key === "Escape" && (state.replyTo || state.editing)) {
            e.preventDefault();
            cancelReplyEdit();
        } else if (e.key === "ArrowUp" && !input.value) {
            const last = [...state.messages].reverse().find((m) => m.senderId === state.user.uid && !m.type && m.text && !m.forwardedFrom);
            if (last) { e.preventDefault(); setEdit(last); }
        }
    });
    input.addEventListener("paste", (e) => {
        const files = Array.from(e.clipboardData?.files || []);
        if (files.length) { e.preventDefault(); handleFiles(files); }
    });

    $("replyBarClose").addEventListener("click", cancelReplyEdit);
    $("emojiBtn").addEventListener("click", (e) => { e.stopPropagation(); toggleEmojiPicker(); });
    $("attachBtn").addEventListener("click", (e) => { e.stopPropagation(); $("attachMenu").classList.toggle("hidden"); });
    $("attachMenu").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-attach]");
        if (!btn) return;
        $("attachMenu").classList.add("hidden");
        (btn.dataset.attach === "photo" ? $("photoInput") : $("fileInput")).click();
    });
    $("photoInput").addEventListener("change", (e) => { handleFiles(e.target.files); e.target.value = ""; });
    $("fileInput").addEventListener("change", (e) => { handleFiles(e.target.files); e.target.value = ""; });

    const chat = $("chat");
    chat.addEventListener("dragover", (e) => { if (state.activeChatId && e.dataTransfer?.types?.includes("Files")) e.preventDefault(); });
    chat.addEventListener("drop", (e) => {
        if (!state.activeChatId || !e.dataTransfer?.files?.length) return;
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#emojiPicker, #emojiBtn")) $("emojiPicker").classList.add("hidden");
        if (!e.target.closest("#attachMenu, #attachBtn")) $("attachMenu").classList.add("hidden");
    });

    bindRecordButton();
    updateSendMode();
}
