const QUICK_REACTIONS = ["👍", "❤️", "🔥", "😂", "😮", "😢", "🙏", "👎"];
let msgCache = new Map();
let partnerProfile = null;
let chatSearch = { query: "", hits: [], index: -1 };
let newWhileAway = 0;
let currentAudio = null;

/* ===== HELPERS ===== */

function dataUrlToBlobUrl(dataUrl) {
    if (typeof dataUrl !== "string") throw new Error("not a string");
    const comma = dataUrl.indexOf(",");
    if (comma < 0) throw new Error("bad data url");
    const meta = dataUrl.slice(0, comma);
    let b64 = dataUrl.slice(comma + 1);
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const isBase64 = meta.indexOf(";base64") >= 0;
    if (!isBase64) {
        const text = decodeURIComponent(b64);
        return URL.createObjectURL(new Blob([text], { type: mime }));
    }
    b64 = b64.replace(/\s/g, "");
    if (b64.indexOf("%") >= 0) { try { b64 = decodeURIComponent(b64); } catch (e) {} }
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    let bin;
    try { bin = atob(b64); } catch (err) { throw new Error("atob failed: " + err.message); }
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime }));
}

function isVideoDataUrl(s) {
    return typeof s === "string" && s.indexOf("data:video/") === 0;
}

/* ===== OPEN / CLOSE ===== */

function openChat(chatId) {
    const entry = state.chats[chatId];
    if (!entry) return;
    if (state.activeChatId && state.activeChatId !== chatId) {
        state.drafts[state.activeChatId] = $("messageInput").value;
        clearTyping();
    }
    const switching = state.activeChatId !== chatId;
    state.activeChatId = chatId;
    state.activeChat = entry;
    $("app").classList.add("chat-open");
    $("chatEmpty").classList.add("hidden");
    $("chatView").classList.remove("hidden");
    if (switching) {
        offGroup("chat");
        msgCache = new Map();
        state.messages = [];
        state.msgLimit = 100;
        partnerProfile = null;
        newWhileAway = 0;
        $("messages").replaceChildren();
        closeChatSearch();
        cancelReplyEdit();
        $("messageInput").value = state.drafts[chatId] || "";
        autosizeInput();
        updateSendMode();
        listenMessages(chatId);
        listenTyping(chatId);
        if (entry.type === "private" || (!entry.type && entry.partnerId)) {
            listen("chat", db.ref("users/" + entry.partnerId), "value", function (snap) {
                partnerProfile = snap.val() ? Object.assign({ uid: entry.partnerId }, snap.val()) : null;
                if (partnerProfile) userCache[entry.partnerId] = partnerProfile;
                renderChatHeader();
                if (!$("infoPanel").classList.contains("hidden")) renderInfoPanel();
            });
        }
    }
    renderChatHeader();
    renderPinnedBar();
    markChatRead(chatId);
    renderChatList();
    if (!$("infoPanel").classList.contains("hidden")) renderInfoPanel();
    if (window.matchMedia("(min-width: 721px)").matches) $("messageInput").focus();
}

function closeChat() {
    if (state.activeChatId) state.drafts[state.activeChatId] = $("messageInput").value;
    clearTyping();
    offGroup("chat");
    state.activeChatId = null;
    state.activeChat = null;
    msgCache = new Map();
    $("app").classList.remove("chat-open");
    $("chatView").classList.add("hidden");
    $("chatEmpty").classList.remove("hidden");
    $("infoPanel").classList.add("hidden");
    renderChatList();
}

/* ===== HEADER ===== */

function renderChatHeader() {
    const entry = state.activeChat;
    if (!entry) return;
    const title = entry.type === "private" && partnerProfile ? (partnerProfile.nickname || partnerProfile.username) : chatTitle(entry);
    const titleEl = $("chatTitle");
    titleEl.replaceChildren(h("span", { text: title }));
    if (entry.type === "private") {
        const vUsername = (partnerProfile && partnerProfile.username) || entry.partnerUsername;
        if (isVerifiedUser(vUsername)) titleEl.appendChild(verifiedBadge(15));
    }
    const av = $("chatAvatar");
    if (entry.type === "saved") setAvatar(av, "", "", { icon: "bookmark" });
    else setAvatar(av, title, entry.type === "group" ? entry.avatarUrl : ((partnerProfile && partnerProfile.avatarUrl) || entry.partnerAvatarUrl), { key: entry.partnerId || entry.title });
    const status = $("chatStatus");
    status.className = "";
    status.replaceChildren();
    const typing = state.typing[state.activeChatId];
    if (typing) {
        status.className = "typing";
        status.append(h("span", { class: "typing-dots" }, h("i"), h("i"), h("i")), typing);
    } else if (entry.type === "saved") {
        status.textContent = "";
    } else if (entry.type === "group") {
        const n = Object.keys(entry.members || {}).length;
        status.textContent = n + " " + plural(n, "участник", "участника", "участников");
    } else if (partnerProfile && partnerProfile.online) {
        status.className = "online";
        status.textContent = "в сети";
    } else {
        status.textContent = formatLastSeen(partnerProfile && partnerProfile.lastSeen);
    }
    $("composer").classList.remove("hidden");
    $("composerDisabled").classList.add("hidden");
}

function renderPinnedBar() {
    const pinned = state.activeChat && state.activeChat.pinnedMsg;
    $("pinnedBar").classList.toggle("hidden", !pinned);
    if (pinned) $("pinnedText").textContent = pinned.text || "Сообщение";
}

/* ===== LISTEN ===== */

function listenMessages(chatId) {
    const ref = db.ref("private_messages/" + chatId).orderByChild("timestamp").limitToLast(state.msgLimit);
    let first = true;
    listen("chat", ref, "value", function (snap) {
        if (chatId !== state.activeChatId) return;
        const list = [];
        snap.forEach(function (child) {
            const m = child.val();
            if (!m || (m.deletedFor && m.deletedFor[state.user.uid])) return;
            list.push(Object.assign({ id: child.key }, m));
        });
        const prevLast = state.messages.length ? state.messages[state.messages.length - 1].id : null;
        state.messages = list;
        state.hasMore = snap.numChildren() >= state.msgLimit;
        renderMessages({ initial: first, prevLast: prevLast });
        first = false;
        markMessagesRead();
    });
}

function loadMoreMessages() {
    const box = $("messages");
    const prevHeight = box.scrollHeight;
    const prevTop = box.scrollTop;
    state.msgLimit += 100;
    offGroup("chat-msgs");
    const chatId = state.activeChatId;
    const ref = db.ref("private_messages/" + chatId).orderByChild("timestamp").limitToLast(state.msgLimit);
    ref.once("value", function () {
        requestAnimationFrame(function () { box.scrollTop = box.scrollHeight - prevHeight + prevTop; });
    });
    const oldListeners = listenerGroups.chat || [];
    const first = oldListeners.shift();
    if (first) first();
    listenerGroups.chat = oldListeners;
    listenMessages(chatId);
}

function listenTyping(chatId) {
    listen("chat", db.ref("typing/" + chatId), "value", function (snap) {
        const now = Date.now();
        const names = [];
        snap.forEach(function (child) {
            const v = child.val();
            if (child.key !== state.user.uid && v && now - (v.ts || 0) < 7000) names.push(v.name || "Кто-то");
        });
        const entry = state.chats[chatId];
        let text = "";
        if (names.length) {
            text = entry && entry.type === "group"
                ? names.slice(0, 2).join(", ") + " " + (names.length > 1 ? "печатают" : "печатает") + "…"
                : "печатает…";
        }
        state.typing[chatId] = text;
        if (chatId === state.activeChatId) renderChatHeader();
        renderChatList();
        if (text) {
            clearTimeout(listenTyping.t);
            listenTyping.t = setTimeout(function () {
                state.typing[chatId] = "";
                if (chatId === state.activeChatId) renderChatHeader();
                renderChatList();
            }, 7000);
        }
    });
}

function markMessagesRead() {
    if (document.visibilityState !== "visible" || !state.activeChatId) return;
    const entry = state.activeChat;
    const uid = state.user.uid;
    const updates = {};
    state.messages.forEach(function (m) {
        if (m.senderId === uid || m.type === "system") return;
        if (entry.type === "group") {
            if (!m.readBy || !m.readBy[uid]) updates["private_messages/" + state.activeChatId + "/" + m.id + "/readBy/" + uid] = true;
        } else if (!m.read) {
            updates["private_messages/" + state.activeChatId + "/" + m.id + "/read"] = true;
        }
    });
    if (Object.keys(updates).length) db.ref().update(updates).catch(function () {});
    markChatRead(state.activeChatId);
}

/* ===== RENDER ===== */

function isNearBottom() {
    const box = $("messages");
    return box.scrollHeight - box.scrollTop - box.clientHeight < 160;
}

function scrollToBottom(smooth) {
    const box = $("messages");
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    newWhileAway = 0;
    updateScrollDown();
}

function renderMessages(opts) {
    opts = opts || {};
    const box = $("messages");
    const nearBottom = isNearBottom();
    const entry = state.activeChat;
    const isGroup = entry && entry.type === "group";
    const uid = state.user.uid;
    const inner = h("div", { class: "messages-inner" });
    if (state.hasMore) inner.appendChild(h("button", { class: "tg-btn link small load-more", onclick: loadMoreMessages }, "Загрузить ранее"));
    if (!state.messages.length) {
        inner.appendChild(h("div", { class: "sys-msg" }, h("span", { text: entry && entry.type === "saved" ? "Сохраняйте сюда сообщения, заметки и файлы" : "Сообщений пока нет. Напишите первым!" })));
    }
    const nextCache = new Map();
    let lastDay = null;
    state.messages.forEach(function (m, i) {
        if (!lastDay || !sameDay(lastDay, m.timestamp)) {
            inner.appendChild(h("div", { class: "date-sep" }, h("span", { text: formatDay(m.timestamp) })));
            lastDay = m.timestamp;
        }
        if (m.type === "system") {
            inner.appendChild(h("div", { class: "sys-msg" }, h("span", { text: m.text })));
            return;
        }
        const sig = JSON.stringify(Object.assign({}, m, { data: undefined })) + (entry && entry.pinnedMsg && entry.pinnedMsg.id === m.id ? "p" : "");
        let node = msgCache.get(m.id);
        if (!node || node.dataset.sig !== sig) node = buildMessage(m, isGroup);
        node.dataset.sig = sig;
        nextCache.set(m.id, node);
        const prev = state.messages[i - 1];
        const next = state.messages[i + 1];
        const groupWith = function (o) {
            return o && o.type !== "system" && o.senderId === m.senderId && sameDay(o.timestamp, m.timestamp) && Math.abs(o.timestamp - m.timestamp) < 600000;
        };
        node.classList.toggle("first", !groupWith(prev));
        node.classList.toggle("last", !groupWith(next));
        const avatarSlot = node.querySelector(".msg-avatar");
        if (avatarSlot) avatarSlot.style.visibility = groupWith(next) ? "hidden" : "visible";
        const senderName = node.querySelector(".msg-sender");
        if (senderName) senderName.classList.toggle("hidden", groupWith(prev));
        inner.appendChild(node);
    });
    msgCache = nextCache;
    box.replaceChildren(inner);
    applyChatSearchMarks();
    const last = state.messages.length ? state.messages[state.messages.length - 1] : null;
    const newMsg = last && last.id !== opts.prevLast && !opts.initial;
    if (opts.initial) scrollToBottom(false);
    else if (newMsg && (nearBottom || last.senderId === uid)) scrollToBottom(true);
    else if (newMsg) { newWhileAway++; updateScrollDown(); }
}

function buildMessage(m, isGroup) {
    const uid = state.user.uid;
    const out = m.senderId === uid;
    const row = h("div", { class: "msg " + (out ? "out" : "in"), dataset: { id: m.id } });
    const bubble = h("div", { class: "bubble" });

    if (isGroup && !out) {
        const author = userCache[m.senderId];
        const slot = h("span", { class: "msg-avatar" });
        const av = avatarEl(m.senderName || (author && author.nickname), author && author.avatarUrl, "", { key: m.senderId });
        av.addEventListener("click", function () { openUserProfile(m.senderId); });
        slot.appendChild(av);
        row.appendChild(slot);
        if (!author) getUser(m.senderId).then(function (u) { if (u && u.avatarUrl) setAvatar(av, u.nickname, u.avatarUrl); });
        bubble.appendChild(h("div", { class: "msg-sender", style: "color:" + nameColor(m.senderId), text: m.senderName || "Участник", onclick: function () { openUserProfile(m.senderId); } }));
    }

    if (m.forwardedFrom) bubble.appendChild(h("div", { class: "msg-forward" }, "Переслано от ", h("b", { text: m.forwardedFrom })));
    if (m.replyTo) {
        bubble.appendChild(h("button", { class: "msg-reply", onclick: function (e) { e.stopPropagation(); scrollToMessage(m.replyTo.id); } },
            h("strong", { text: m.replyTo.name || "Сообщение" }), h("small", { text: m.replyTo.text || "" })));
    }

    const meta = h("span", { class: "msg-meta" },
        state.activeChat && state.activeChat.pinnedMsg && state.activeChat.pinnedMsg.id === m.id ? icon("pin", "pin-mark") : null,
        m.editedAt ? "изм. " : "",
        formatTime(m.timestamp),
        out && state.activeChat && state.activeChat.type !== "saved" ? icon(isMessageRead(m) ? "checks" : "check") : null);

    const hasText = !!(m.text && m.text.trim());

    if (m.type === "image") {
        const media = h("div", { class: "msg-media " + (hasText ? "" : "only"), onclick: function () { openViewer(m.data, m.text); } },
            h("img", { src: m.data, alt: m.text || "Фото", loading: "lazy" }));
        bubble.appendChild(media);
        if (!hasText) { bubble.classList.add("media-only"); meta.classList.add("on-media"); media.appendChild(meta); }
    } else if (m.type === "voice") {
        bubble.appendChild(buildVoice(m));
    } else if (m.type === "video") {
        bubble.classList.add("no-bg");
        bubble.appendChild(buildRoundVideo(m));
        meta.classList.add("on-media");
        bubble.style.position = "relative";
    } else if (m.type === "videoFile") {
        bubble.appendChild(buildVideoFile(m));
    } else if (m.type === "gift") {
        bubble.classList.add("no-bg");
        bubble.appendChild(buildGiftMessage(m));
        meta.classList.add("on-media");
        bubble.style.position = "relative";
    } else if (m.type === "nft") {
        bubble.classList.add("no-bg");
        bubble.appendChild(buildNFTMessage(m));
        meta.classList.add("on-media");
        bubble.style.position = "relative";
    } else if (m.type === "file") {
        bubble.appendChild(h("a", { class: "file-msg", href: m.data, download: m.fileName || "file" },
            h("span", { class: "file-icon" }, icon("download")),
            h("span", { class: "file-info" }, h("strong", { text: m.fileName || "Файл" }), h("small", { text: m.fileSize ? formatSize(m.fileSize) : "" }))));
    }

    if (hasText) {
        const text = h("div", { class: "msg-text " + (m.type ? "" : isEmojiOnly(m.text) ? "jumbo" : ""), html: linkify(m.text) });
        text.querySelectorAll(".mention").forEach(function (n) {
            n.addEventListener("click", function (e) { e.stopPropagation(); openUserByUsername(n.dataset.username); });
        });
        text.appendChild(meta);
        bubble.appendChild(text);
        if (!m.type && isEmojiOnly(m.text)) bubble.classList.add("no-bg");
    } else if (m.type !== "image" && m.type !== "videoFile" && m.type !== "gift" && m.type !== "nft") {
        bubble.appendChild(meta);
    }

    const reactions = Object.entries(m.reactions || {}).filter(function (pair) { return pair[1] && Object.keys(pair[1]).length; });
    if (reactions.length) {
        bubble.appendChild(h("div", { class: "reactions" }, reactions.map(function (pair) {
            const emoji = pair[0];
            const users = pair[1];
            return h("button", { class: "reaction " + (users[uid] ? "mine" : ""), onclick: function (e) { e.stopPropagation(); toggleReaction(m, emoji); } },
                h("span", { class: "r-emoji", text: emoji }), Object.keys(users).length);
        })));
    }

    row.appendChild(bubble);
    onLongPress(bubble, function (e) { openMessageMenu(m, e); });
    bubble.addEventListener("dblclick", function (e) {
        if (!e.target.closest("a, button, video, .video-file, .gift-message, .nft-message")) setReply(m);
    });
    return row;
}

/* ===== BUILD: VOICE ===== */

function buildVoice(m) {
    const bars = 36;
    const seed = hashString(m.id);
    const wave = h("span", { class: "wave" });
    for (let i = 0; i < bars; i++) {
        const v = ((seed >> (i % 16)) ^ (i * 2654435761)) >>> 0;
        wave.appendChild(h("i", { style: "height:" + (20 + (v % 80)) + "%" }));
    }
    const btn = h("button", { class: "voice-btn", "aria-label": "Воспроизвести" }, icon("play"));
    const time = h("span", { class: "voice-time", text: formatDuration(m.duration) });
    let audio = null;
    const paint = function (ratio) {
        wave.querySelectorAll("i").forEach(function (bar, i) { bar.classList.toggle("played", i / bars < ratio); });
    };
    const setIcon = function (playing) {
        btn.replaceChildren(icon(playing ? "pause" : "play"));
        btn.setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
    };
    const ensure = function () {
        if (audio) return audio;
        audio = new Audio(m.data);
        audio.addEventListener("timeupdate", function () {
            const dur = audio.duration && isFinite(audio.duration) ? audio.duration : (m.duration || 1);
            paint(audio.currentTime / dur);
            time.textContent = formatDuration(audio.currentTime);
        });
        audio.addEventListener("ended", function () { setIcon(false); paint(0); time.textContent = formatDuration(m.duration); });
        audio.addEventListener("pause", function () { setIcon(false); });
        audio.addEventListener("play", function () { setIcon(true); });
        return audio;
    };
    btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const a = ensure();
        if (a.paused) { if (currentAudio && currentAudio !== a) currentAudio.pause(); currentAudio = a; a.play(); }
        else a.pause();
    });
    wave.addEventListener("click", function (e) {
        e.stopPropagation();
        const a = ensure();
        const r = wave.getBoundingClientRect();
        const ratio = (e.clientX - r.left) / r.width;
        const dur = a.duration && isFinite(a.duration) ? a.duration : (m.duration || 0);
        a.currentTime = dur * ratio;
        if (a.paused) { if (currentAudio && currentAudio !== a) currentAudio.pause(); currentAudio = a; a.play(); }
    });
    return h("div", { class: "voice" }, btn, h("span", { class: "voice-body" }, wave, time));
}

/* ===== BUILD: ROUND VIDEO ===== */

function buildRoundVideo(m) {
    const wrap = h("div", { class: "round-video" });
    const video = h("video", { playsinline: true, preload: "metadata", muted: false, loop: false });
    const playIcon = h("span", { class: "rv-play" }, icon("play"));
    const timeEl = h("span", { class: "rv-time", text: formatDuration(m.duration) });
    const loadingEl = h("span", { class: "rv-loading hidden" });
    const errorEl = h("span", { class: "rv-error hidden" }, "Ошибка");

    wrap.append(video, playIcon, timeEl, loadingEl, errorEl);

    let loaded = false;
    let blobUrl = null;

    const ensureLoaded = function () {
        if (loaded) return;
        loaded = true;
        try {
            if (typeof m.data === "string" && (m.data.indexOf("http://") === 0 || m.data.indexOf("https://") === 0)) {
                video.src = m.data;
            } else if (isVideoDataUrl(m.data)) {
                blobUrl = dataUrlToBlobUrl(m.data);
                video.src = blobUrl;
            } else {
                video.src = m.data;
            }
            video.load();
        } catch (err) {
            console.warn("[localgram] ensureLoaded failed:", err);
            errorEl.classList.remove("hidden");
        }
    };

    const togglePlay = async function (e) {
        if (e) e.stopPropagation();
        ensureLoaded();
        if (video.paused) {
            if (currentAudio) currentAudio.pause();
            loadingEl.classList.remove("hidden");
            errorEl.classList.add("hidden");
            try {
                await video.play();
                wrap.classList.add("playing");
            } catch (err) {
                console.warn("[localgram] play error:", err);
                errorEl.classList.remove("hidden");
                setTimeout(function () { errorEl.classList.add("hidden"); }, 2000);
            } finally {
                loadingEl.classList.add("hidden");
            }
        } else {
            video.pause();
            wrap.classList.remove("playing");
        }
    };

    wrap.addEventListener("click", togglePlay);
    video.addEventListener("click", function (e) { e.stopPropagation(); });
    video.addEventListener("ended", function () {
        wrap.classList.remove("playing");
        video.currentTime = 0;
        timeEl.textContent = formatDuration(m.duration);
    });
    video.addEventListener("timeupdate", function () {
        timeEl.textContent = formatDuration(video.currentTime || 0);
    });
    video.addEventListener("loadedmetadata", function () {
        if (video.duration && isFinite(video.duration)) timeEl.textContent = formatDuration(video.duration);
        else timeEl.textContent = formatDuration(m.duration);
    });
    video.addEventListener("error", function () {
        console.warn("[localgram] video error:", video.error);
        loadingEl.classList.add("hidden");
        errorEl.classList.remove("hidden");
    });

    const observer = new MutationObserver(function () {
        if (!document.body.contains(wrap)) {
            if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) {} blobUrl = null; }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return wrap;
}

/* ===== BUILD: VIDEO FILE ===== */

function buildVideoFile(m) {
    const video = h("video", { playsinline: true, preload: "metadata", controls: true });
    try {
        if (isVideoDataUrl(m.data)) video.src = dataUrlToBlobUrl(m.data);
        else video.src = m.data;
    } catch (e) { video.src = m.data; }
    return h("div", { class: "video-file" }, video);
}

/* ===== BUILD: GIFT ===== */

function buildGiftMessage(m) {
    const wrap = h("div", { class: "gift-message" });
    const emoji = h("span", { class: "gift-message-emoji", text: m.giftEmoji || "🎁" });
    const info = h("div", { class: "gift-message-info" },
        h("strong", { text: "Подарок" }),
        h("span", { text: m.giftName || "Подарок" }),
        h("small", {}, "⭐ " + (m.giftPrice || 0).toLocaleString("ru-RU"))
    );
    wrap.append(emoji, info);
    if (m.giftMessage) wrap.appendChild(h("em", { class: "gift-message-text", text: '"' + m.giftMessage + '"' }));
    return wrap;
}

/* ===== BUILD: NFT ===== */

function buildNFTMessage(m) {
    const r = (typeof getRarity === "function") ? getRarity(m.nftRarity) : { id: "common", label: "Обычный", color: "#8a9aab" };
    const wrap = h("div", { class: "nft-message rarity-" + r.id });

    const imgWrap = h("div", { class: "nft-message-img-wrap" });
    const img = h("img", {
        class: "nft-message-img",
        src: "pic_gift/" + m.nftId + "_" + m.nftRarity + ".png",
        alt: m.nftName || "NFT",
        onerror: function () { this.style.display = "none"; }
    });
    const emojiFallback = h("span", { class: "nft-message-emoji", text: m.nftEmoji || "🎁" });
    imgWrap.append(img, emojiFallback);

    const info = h("div", { class: "nft-message-info" },
        h("div", { class: "nft-message-label" }, "NFT-подарок"),
        h("div", { class: "nft-message-name", text: m.nftName || "NFT" }),
        h("div", { class: "nft-message-rarity", style: "color:" + r.color, text: r.label }),
        h("div", { class: "nft-message-serial", text: "№" + (m.nftSerial || "?") + "/" + (m.nftSupply || "?") }),
        h("div", { class: "nft-message-price", text: "⭐ " + (m.nftPrice || 0).toLocaleString("ru-RU") })
    );

    wrap.append(imgWrap, info);
    if (m.nftMessage) wrap.appendChild(h("em", { class: "nft-message-text", text: '"' + m.nftMessage + '"' }));
    return wrap;
}

/* ===== MISC ===== */

function isMessageRead(m) {
    if (state.activeChat && state.activeChat.type === "group") {
        return Object.keys(m.readBy || {}).some(function (k) { return k !== state.user.uid; });
    }
    return !!m.read;
}

function scrollToMessage(id) {
    const node = $("messages").querySelector('.msg[data-id="' + CSS.escape(id) + '"]');
    if (!node) return toast("Сообщение не найдено");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.remove("highlight");
    void node.offsetWidth;
    node.classList.add("highlight");
}

function updateScrollDown() {
    const show = !isNearBottom() && state.messages.length > 0;
    $("scrollDownBtn").classList.toggle("hidden", !show);
    const badge = $("scrollDownBadge");
    badge.textContent = newWhileAway;
    badge.classList.toggle("hidden", !newWhileAway);
    if (!show) newWhileAway = 0;
}

/* ===== SEND ===== */

async function pushMessage(chatId, payload) {
    const entry = state.chats[chatId];
    if (!entry) throw new Error("Чат не найден");
    const uid = state.user.uid;
    const now = Date.now();
    const msg = Object.assign({
        senderId: payload.type === "system" ? "system" : uid,
        senderName: state.profile.nickname || state.profile.username,
        timestamp: now,
    }, payload);
    Object.keys(msg).forEach(function (k) { if (msg[k] === undefined) delete msg[k]; });
    await db.ref("private_messages/" + chatId).push(msg);
    const preview = payload.type === "system" ? payload.text : previewOf(payload);
    const summary = { lastMessage: preview, lastTimestamp: now, lastSenderId: msg.senderId, lastSenderName: msg.senderName };
    await db.ref("user_chats/" + uid + "/" + chatId).update(Object.assign({}, summary, { readAt: now }));
    const others = chatMembers(entry, chatId).filter(function (m) { return m && m !== uid; });
    await Promise.all(others.map(function (other) {
        const extra = entry.type === "group" ? {} : {
            type: "private", partnerId: uid,
            partnerName: state.profile.nickname,
            partnerUsername: state.profile.username,
            partnerAvatarUrl: state.profile.avatarUrl || "",
            partnerBio: state.profile.bio || "",
        };
        return db.ref("user_chats/" + other + "/" + chatId).update(Object.assign({}, extra, summary)).catch(function () {});
    }));
    if (entry.type === "private" && payload.type !== "system") {
        db.ref("notifications/" + entry.partnerId + "/" + chatId).set({
            senderId: uid, senderName: msg.senderName, message: preview, timestamp: now, read: false
        }).catch(function () {});
    }
}

async function refreshLastMessage(chatId, forAll) {
    const snap = await db.ref("private_messages/" + chatId).orderByChild("timestamp").limitToLast(5).once("value");
    let last = null;
    snap.forEach(function (c) {
        const m = c.val();
        if (!(m.deletedFor && m.deletedFor[state.user.uid])) last = m;
    });
    const summary = last
        ? { lastMessage: last.type === "system" ? last.text : previewOf(last), lastSenderId: last.senderId, lastSenderName: last.senderName || "" }
        : { lastMessage: "", lastSenderId: null, lastSenderName: null };
    const members = forAll ? chatMembers(state.chats[chatId], chatId) : [state.user.uid];
    await Promise.all(members.map(function (m) { return db.ref("user_chats/" + m + "/" + chatId).update(summary).catch(function () {}); }));
}

/* ===== ACTIONS ===== */

function openMessageMenu(m, e) {
    const uid = state.user.uid;
    const out = m.senderId === uid;
    const entry = state.activeChat;
    const pinned = entry && entry.pinnedMsg && entry.pinnedMsg.id === m.id;
    const canEdit = out && !m.forwardedFrom && (m.type ? true : !!m.text) && m.type !== "voice" && m.type !== "video" && m.type !== "videoFile" && m.type !== "gift" && m.type !== "nft";

    const reactRow = h("div", { class: "ctx-reactions" }, QUICK_REACTIONS.map(function (emoji) {
        return h("button", { "aria-label": "Реакция " + emoji, text: emoji, onclick: function () { hideMenu(); toggleReaction(m, emoji); } });
    }));

    showMenu([
        { label: "Ответить", icon: "reply", onClick: function () { setReply(m); } },
        canEdit ? { label: "Изменить", icon: "edit", onClick: function () { setEdit(m); } } : null,
        m.text ? { label: "Копировать", icon: "copy", onClick: function () { navigator.clipboard.writeText(m.text).then(function () { toast("Скопировано"); }); } } : null,
        { label: pinned ? "Открепить" : "Закрепить", icon: "pin", onClick: function () { togglePin(m); } },
        { label: "Переслать", icon: "forward", onClick: function () { openForward(m); } },
        entry && entry.type !== "saved" ? { label: "В избранное", icon: "bookmark", onClick: function () { saveToFavorites(m); } } : null,
        (m.type === "image" || m.type === "file" || m.type === "videoFile") ? { label: "Скачать", icon: "download", onClick: function () { downloadData(m.data, m.fileName || "media"); } } : null,
        "sep",
        { label: "Удалить", icon: "trash", danger: true, onClick: function () { deleteMessage(m); } },
    ], { x: e.clientX, y: e.clientY }, entry && entry.type === "saved" ? null : reactRow);
}

function downloadData(data, name) {
    const a = h("a", { href: data, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
}

async function toggleReaction(m, emoji) {
    const uid = state.user.uid;
    const base = "private_messages/" + state.activeChatId + "/" + m.id + "/reactions";
    const updates = {};
    const had = m.reactions && m.reactions[emoji] && m.reactions[emoji][uid];
    Object.entries(m.reactions || {}).forEach(function (pair) {
        const e = pair[0]; const users = pair[1];
        if (users && users[uid]) updates[base + "/" + e + "/" + uid] = null;
    });
    if (!had) updates[base + "/" + emoji + "/" + uid] = true;
    try { await db.ref().update(updates); } catch (error) { toast(friendlyError(error)); }
}

async function togglePin(m) {
    const chatId = state.activeChatId;
    const pinned = state.activeChat && state.activeChat.pinnedMsg && state.activeChat.pinnedMsg.id === m.id;
    const value = pinned ? null : { id: m.id, text: previewOf(m), senderName: m.senderName || "" };
    try {
        await Promise.all(chatMembers(state.activeChat, chatId).map(function (uid) {
            return db.ref("user_chats/" + uid + "/" + chatId + "/pinnedMsg").set(value).catch(function () {});
        }));
        if (!pinned && state.activeChat.type === "group") {
            await pushMessage(chatId, { type: "system", text: state.profile.nickname + " закрепил(а) сообщение" });
        }
        toast(pinned ? "Откреплено" : "Закреплено");
    } catch (error) { toast(friendlyError(error)); }
}

async function deleteMessage(m) {
    const entry = state.activeChat;
    const out = m.senderId === state.user.uid;
    const canForAll = entry.type === "saved" || out || entry.type === "private" || entry.ownerId === state.user.uid;
    const res = await confirmDialog({
        title: "Удалить сообщение",
        text: "Вы точно хотите удалить это сообщение?",
        ok: "Удалить", danger: true,
        checkbox: canForAll && entry.type !== "saved" ? (entry.type === "group" ? "Удалить для всех" : "Также удалить у " + chatTitle(entry)) : null,
    });
    if (!res) return;
    const chatId = state.activeChatId;
    const isLast = state.messages.length && state.messages[state.messages.length - 1].id === m.id;
    try {
        const forAll = res.checked || entry.type === "saved";
        if (forAll) await db.ref("private_messages/" + chatId + "/" + m.id).remove();
        else await db.ref("private_messages/" + chatId + "/" + m.id + "/deletedFor/" + state.user.uid).set(true);
        if (entry.pinnedMsg && entry.pinnedMsg.id === m.id && forAll) {
            await Promise.all(chatMembers(entry, chatId).map(function (u) {
                return db.ref("user_chats/" + u + "/" + chatId + "/pinnedMsg").remove().catch(function () {});
            }));
        }
        if (isLast) await refreshLastMessage(chatId, forAll);
    } catch (error) { toast(friendlyError(error)); }
}

async function saveToFavorites(m) {
    const savedId = "saved_" + state.user.uid;
    if (!state.chats[savedId]) {
        const entry = { type: "saved", title: "Избранное", lastMessage: "", lastTimestamp: Date.now(), readAt: Date.now() };
        await db.ref("user_chats/" + state.user.uid + "/" + savedId).set(entry);
        state.chats[savedId] = entry;
    }
    await pushMessage(savedId, forwardPayload(m));
    toast("Сохранено в Избранное");
}

function forwardPayload(m) {
    return {
        type: m.type || undefined, text: m.text || "",
        data: m.data, fileName: m.fileName, fileSize: m.fileSize, duration: m.duration,
        giftId: m.giftId, giftEmoji: m.giftEmoji, giftName: m.giftName, giftPrice: m.giftPrice, giftMessage: m.giftMessage,
        nftItemId: m.nftItemId, nftId: m.nftId, nftName: m.nftName, nftEmoji: m.nftEmoji,
        nftRarity: m.nftRarity, nftRarityId: m.nftRarityId, nftRarityLabel: m.nftRarityLabel,
        nftRarityColor: m.nftRarityColor, nftSerial: m.nftSerial, nftSupply: m.nftSupply,
        nftPrice: m.nftPrice, nftMessage: m.nftMessage,
        forwardedFrom: m.forwardedFrom || (m.senderId === state.user.uid ? state.profile.nickname : m.senderName || chatTitle(state.activeChat)),
    };
}

function openForward(m) {
    const search = h("input", { type: "search", placeholder: " " });
    const list = h("div", { class: "pick-list" });
    const render = function () {
        const q = search.value.trim().toLowerCase();
        const items = sortedChats(function (id, e) { return chatTitle(e).toLowerCase().includes(q); });
        list.replaceChildren.apply(list, items.map(function (pair) {
            const id = pair[0]; const e = pair[1];
            return h("button", {
                class: "pick-row",
                onclick: async function () {
                    try {
                        await pushMessage(id, forwardPayload(m));
                        closeModal();
                        toast("Переслано");
                        openChat(id);
                    } catch (error) { toast(friendlyError(error)); }
                },
            }, chatAvatar(e, "small"), h("span", { class: "m-text" }, h("strong", { text: chatTitle(e) })));
        }));
        if (!items.length) list.appendChild(h("div", { class: "list-empty", text: "Чаты не найдены" }));
    };
    search.addEventListener("input", render);
    render();
    openModal({ title: "Переслать", body: [h("label", { class: "tg-field" }, search, h("span", { text: "Поиск чата" })), list] });
}

/* ===== IN-CHAT SEARCH ===== */

function openChatSearch() { $("chatSearch").classList.remove("hidden"); $("chatSearchInput").focus(); }
function closeChatSearch() {
    $("chatSearch").classList.add("hidden");
    $("chatSearchInput").value = "";
    chatSearch = { query: "", hits: [], index: -1 };
    $("chatSearchCount").textContent = "";
    applyChatSearchMarks();
}
function runChatSearch() {
    const q = $("chatSearchInput").value.trim().toLowerCase();
    chatSearch.query = q;
    chatSearch.hits = q ? state.messages.filter(function (m) {
        return m.type !== "system" && (m.text || m.fileName || "").toLowerCase().includes(q);
    }).map(function (m) { return m.id; }) : [];
    chatSearch.index = chatSearch.hits.length - 1;
    applyChatSearchMarks(true);
}
function stepChatSearch(dir) {
    if (!chatSearch.hits.length) return;
    chatSearch.index = (chatSearch.index + dir + chatSearch.hits.length) % chatSearch.hits.length;
    applyChatSearchMarks(true);
}
function applyChatSearchMarks(scroll) {
    const box = $("messages");
    box.querySelectorAll(".search-hit, .search-current").forEach(function (n) { n.classList.remove("search-hit", "search-current"); });
    const hits = chatSearch.hits; const index = chatSearch.index; const query = chatSearch.query;
    $("chatSearchCount").textContent = query ? (hits.length ? (index + 1) + " из " + hits.length : "Нет") : "";
    hits.forEach(function (id, i) {
        const node = box.querySelector('.msg[data-id="' + CSS.escape(id) + '"]');
        if (!node) return;
        node.classList.add("search-hit");
        if (i === index) {
            node.classList.add("search-current");
            if (scroll) node.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });
}