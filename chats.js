let chatsLoaded = false;
const lastSeenTs = {};
const partnerWatchers = {};

function chatTitle(entry) {
    if (!entry) return "";
    if (entry.type === "saved") return "Избранное";
    if (entry.type === "group") return entry.title || "Группа";
    return entry.partnerName || (entry.partnerUsername ? `@${entry.partnerUsername}` : "Пользователь");
}

function chatAvatar(entry, cls = "") {
    if (entry.type === "saved") return avatarEl("", "", cls, { icon: "bookmark" });
    const node = avatarEl(chatTitle(entry), entry.type === "group" ? entry.avatarUrl : entry.partnerAvatarUrl, cls, { key: entry.partnerId || entry.title });
    if (entry.type !== "group" && state.presence[entry.partnerId]?.online) node.classList.add("online");
    return node;
}

function previewOf(msg) {
    if (!msg) return "";
    const kinds = { image: "Фото", voice: "Голосовое сообщение", video: "Видеосообщение", file: msg.fileName ? `Файл: ${msg.fileName}` : "Файл" };
    if (msg.type && kinds[msg.type]) return msg.text ? `${kinds[msg.type]}, ${msg.text}` : kinds[msg.type];
    return (msg.text || "").replace(/\s+/g, " ").slice(0, 140);
}

function chatMembers(entry, chatId) {
    if (!entry) return [];
    if (entry.type === "saved") return [state.user.uid];
    if (entry.type === "group") return Object.keys(entry.members || {});
    return [state.user.uid, entry.partnerId];
}

function listenChats() {
    chatsLoaded = false;
    listen("global", db.ref(`user_chats/${state.user.uid}`), "value", (snap) => {
        const chats = snap.val() || {};
        const prev = state.chats;
        state.chats = chats;

        Object.entries(chats).forEach(([chatId, entry]) => {
            const last = entry.lastTimestamp || 0;
            const incoming = entry.lastSenderId && entry.lastSenderId !== state.user.uid;
            const isNew = chatsLoaded && prev[chatId] && last > (prev[chatId].lastTimestamp || 0) && incoming;
            const viewing = chatId === state.activeChatId && document.visibilityState === "visible";

            if (isNew && entry.archived && !entry.muted) db.ref(`user_chats/${state.user.uid}/${chatId}/archived`).set(false);
            if (isNew && !viewing && !entry.muted) notifyNewMessage(chatId, entry);
            if (lastSeenTs[chatId] !== last || !chatsLoaded) {
                lastSeenTs[chatId] = last;
                refreshUnread(chatId, entry);
            }
            if (entry.type !== "group" && entry.type !== "saved" && entry.partnerId) watchPartner(entry.partnerId);
        });

        chatsLoaded = true;
        if (state.activeChatId) {
            if (!chats[state.activeChatId]) closeChat();
            else {
                state.activeChat = chats[state.activeChatId];
                renderChatHeader();
                renderPinnedBar();
                if (!$("infoPanel").classList.contains("hidden")) renderInfoPanel();
            }
        }
        renderChatList();
    });
}

function watchPartner(uid) {
    if (partnerWatchers[uid]) return;
    partnerWatchers[uid] = true;
    listen("global", db.ref(`users/${uid}/online`), "value", (snap) => {
        state.presence[uid] = { ...(state.presence[uid] || {}), online: snap.val() === true };
        document.querySelectorAll(`.chat-item[data-partner="${uid}"] .avatar`).forEach((n) => n.classList.toggle("online", snap.val() === true));
    });
}

async function refreshUnread(chatId, entry) {
    const readAt = entry.readAt || 0;
    const last = entry.lastTimestamp || 0;
    if (!last || last <= readAt || entry.lastSenderId === state.user.uid || !entry.lastSenderId) {
        if (state.unread[chatId]) { state.unread[chatId] = 0; renderChatList(); }
        return;
    }
    if (chatId === state.activeChatId && document.visibilityState === "visible") return markChatRead(chatId);
    try {
        const snap = await db.ref(`private_messages/${chatId}`).orderByChild("timestamp").startAt(readAt + 1).limitToLast(100).once("value");
        let count = 0;
        snap.forEach((child) => {
            const m = child.val();
            if (m.senderId !== state.user.uid && m.type !== "system" && !m.deletedFor?.[state.user.uid]) count++;
        });
        state.unread[chatId] = Math.max(count, 1);
    } catch {
        state.unread[chatId] = 1;
    }
    renderChatList();
}

function markChatRead(chatId) {
    const entry = state.chats[chatId];
    if (!entry) return;
    state.unread[chatId] = 0;
    if ((entry.readAt || 0) < (entry.lastTimestamp || 0) || entry.markedUnread) {
        db.ref(`user_chats/${state.user.uid}/${chatId}`).update({ readAt: Date.now(), markedUnread: null }).catch(() => {});
    }
}

function totalUnread() {
    return Object.entries(state.chats).reduce((sum, [id, e]) => sum + (!e.muted && !e.archived ? unreadOf(id) : 0), 0);
}

function unreadOf(chatId) {
    const entry = state.chats[chatId];
    return state.unread[chatId] || (entry?.markedUnread ? 1 : 0);
}

function sortedChats(filter) {
    return Object.entries(state.chats)
        .filter(([id, e]) => filter(id, e))
        .sort((a, b) => {
            const pa = a[1].pinnedAt || 0, pb = b[1].pinnedAt || 0;
            if (pa || pb) return pb - pa;
            return (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0);
        });
}

function folderFilter(folder) {
    return (id, e) => {
        if (folder === "archive") return !!e.archived;
        if (e.archived) return false;
        if (folder === "personal") return e.type !== "group";
        if (folder === "groups") return e.type === "group";
        if (folder === "unread") return unreadOf(id) > 0 || id === state.activeChatId;
        return true;
    };
}

function renderChatList() {
    const list = $("chatList");
    const scroll = list.scrollTop;
    const items = sortedChats(folderFilter(state.folder));
    const nodes = [];

    if (state.folder === "all") {
        const archived = Object.entries(state.chats).filter(([, e]) => e.archived);
        if (archived.length) {
            const unread = archived.reduce((s, [id]) => s + unreadOf(id), 0);
            nodes.push(h("button", { class: "chat-item archive-row", onclick: () => setFolder("archive") },
                avatarEl("", "", "", { icon: "archive", bg: "var(--muted)" }),
                h("span", { class: "ci-body" },
                    h("span", { class: "ci-row" }, h("span", { class: "ci-title" }, h("span", { text: "Архив" }))),
                    h("span", { class: "ci-row" },
                        h("span", { class: "ci-preview", text: archived.map(([, e]) => chatTitle(e)).join(", ") }),
                        unread ? h("span", { class: "ci-badge muted", text: unread }) : null))));
        }
    }

    items.forEach(([chatId, entry]) => nodes.push(chatItem(chatId, entry)));

    if (!items.length) {
        const text = {
            all: ["Здесь пока пусто", "Нажмите на карандаш внизу, чтобы найти человека по username или создать группу."],
            personal: ["Нет личных чатов", "Начните переписку через кнопку «Новое сообщение»."],
            groups: ["Нет групп", "Создайте группу через меню или кнопку внизу."],
            unread: ["Всё прочитано", "Новые сообщения появятся здесь."],
            archive: ["Архив пуст", "Архивируйте чат через контекстное меню."],
        }[state.folder];
        nodes.push(h("div", { class: "list-empty" }, h("strong", { text: text[0] }), text[1]));
    }

    list.replaceChildren(...nodes);
    list.scrollTop = scroll;

    const unread = totalUnread();
    const badge = $("unreadFolderBadge");
    badge.textContent = unread;
    badge.classList.toggle("hidden", !unread);
    document.title = unread ? `(${unread}) Localgram` : "Localgram";
}

function chatItem(chatId, entry) {
    const unread = unreadOf(chatId);
    const typingUsers = state.typing[chatId];
    let preview;
    if (typingUsers) {
        preview = h("span", { class: "typing", text: typingUsers });
    } else {
        const own = entry.lastSenderId === state.user.uid;
        const sender = own && entry.type !== "saved" ? "Вы: " : entry.type === "group" && entry.lastSenderName ? `${entry.lastSenderName}: ` : "";
        preview = [sender ? h("span", { class: "ci-sender", text: sender }) : null, entry.lastMessage || (entry.type === "group" ? "Группа создана" : "Нет сообщений")];
    }

    const node = h("button", {
        class: `chat-item ${chatId === state.activeChatId ? "active" : ""}`,
        role: "listitem",
        dataset: { chatId, partner: entry.partnerId || "" },
        onclick: () => openChat(chatId),
    },
        chatAvatar(entry),
        h("span", { class: "ci-body" },
            h("span", { class: "ci-row" },
                h("span", { class: "ci-title" },
                    entry.type === "group" ? icon("group", "ci-icon") : null,
                    h("span", { text: chatTitle(entry) }),
                    entry.muted ? icon("mute", "ci-icon") : null),
                entry.lastSenderId === state.user.uid && entry.type !== "saved" ? icon("check", "ci-icon check") : null,
                h("span", { class: "ci-time", text: formatListTime(entry.lastTimestamp) })),
            h("span", { class: "ci-row" },
                h("span", { class: "ci-preview" }, preview),
                unread ? h("span", { class: `ci-badge ${entry.muted ? "muted" : ""}`, text: unread > 99 ? "99+" : unread })
                    : entry.pinnedAt ? icon("pin", "ci-icon") : null)));

    onLongPress(node, (e) => openChatMenu(chatId, e));
    return node;
}

function setFolder(folder) {
    state.folder = folder;
    document.querySelectorAll(".folder").forEach((b) => {
        const active = b.dataset.folder === folder;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active);
    });
    renderChatList();
}

function openChatMenu(chatId, e) {
    const entry = state.chats[chatId];
    if (!entry) return;
    const ref = db.ref(`user_chats/${state.user.uid}/${chatId}`);
    const unread = unreadOf(chatId) > 0;
    showMenu([
        { label: entry.pinnedAt ? "Открепить" : "Закрепить", icon: "pin", onClick: () => ref.update({ pinnedAt: entry.pinnedAt ? null : Date.now() }) },
        entry.type !== "saved" ? { label: entry.muted ? "Включить уведомления" : "Отключить уведомления", icon: entry.muted ? "unmute" : "mute", onClick: () => ref.update({ muted: entry.muted ? null : true }) } : null,
        { label: entry.archived ? "Вернуть из архива" : "Архивировать", icon: "archive", onClick: () => ref.update({ archived: entry.archived ? null : true, pinnedAt: null }) },
        unread
            ? { label: "Пометить как прочитанное", icon: "checks", onClick: () => { ref.update({ readAt: Date.now(), markedUnread: null }); state.unread[chatId] = 0; renderChatList(); } }
            : { label: "Пометить как непрочитанное", icon: "unread", onClick: () => ref.update({ markedUnread: true }) },
        "sep",
        entry.type === "group"
            ? { label: "Покинуть группу", icon: "logout", danger: true, onClick: () => leaveGroup(chatId) }
            : { label: "Удалить чат", icon: "trash", danger: true, onClick: () => deleteChat(chatId) },
    ], { x: e.clientX, y: e.clientY });
}

async function deleteChat(chatId) {
    const entry = state.chats[chatId];
    if (!entry) return;
    const isPrivate = entry.type !== "saved";
    const res = await confirmDialog({
        title: "Удалить чат",
        text: `Вы точно хотите удалить чат ${isPrivate ? `с ${chatTitle(entry)}` : "«Избранное»"}?`,
        ok: "Удалить",
        danger: true,
        checkbox: isPrivate ? `Также удалить для ${chatTitle(entry)}` : null,
    });
    if (!res) return;
    try {
        if (chatId === state.activeChatId) closeChat();
        await db.ref(`user_chats/${state.user.uid}/${chatId}`).remove();
        if (res.checked || !isPrivate) {
            await db.ref(`private_messages/${chatId}`).remove().catch(() => {});
            if (res.checked) await db.ref(`user_chats/${entry.partnerId}/${chatId}`).remove().catch(() => {});
        }
        toast("Чат удалён");
    } catch (error) {
        toast(friendlyError(error));
    }
}

async function startPrivateChat(user) {
    if (user.uid === state.user.uid) return openSaved();
    const chatId = [state.user.uid, user.uid].sort().join("_");
    const now = Date.now();
    if (!state.chats[chatId]) {
        try {
            await db.ref(`user_chats/${state.user.uid}/${chatId}`).set({
                type: "private",
                partnerId: user.uid,
                partnerName: user.nickname || user.username,
                partnerUsername: user.username,
                partnerAvatarUrl: user.avatarUrl || "",
                partnerBio: user.bio || "",
                lastMessage: "",
                lastTimestamp: now,
                readAt: now,
            });
            await db.ref(`user_chats/${user.uid}/${chatId}`).update({
                type: "private",
                partnerId: state.user.uid,
                partnerName: state.profile.nickname,
                partnerUsername: state.profile.username,
                partnerAvatarUrl: state.profile.avatarUrl || "",
                partnerBio: state.profile.bio || "",
            }).catch(() => {});
            state.chats[chatId] = (await db.ref(`user_chats/${state.user.uid}/${chatId}`).once("value")).val();
        } catch (error) {
            return toast(friendlyError(error));
        }
    }
    closeSearch();
    closeModal();
    openChat(chatId);
}

async function openSaved() {
    const chatId = `saved_${state.user.uid}`;
    if (!state.chats[chatId]) {
        const entry = { type: "saved", title: "Избранное", lastMessage: "", lastTimestamp: Date.now(), readAt: Date.now() };
        await db.ref(`user_chats/${state.user.uid}/${chatId}`).set(entry);
        state.chats[chatId] = entry;
    }
    closeDrawer();
    closeSearch();
    openChat(chatId);
}

async function createGroup(title, memberUsers, avatarUrl = "") {
    const groupId = `g_${db.ref().push().key}`;
    const now = Date.now();
    const members = { [state.user.uid]: true };
    memberUsers.forEach((u) => { members[u.uid] = true; });
    const base = { type: "group", title, avatarUrl, ownerId: state.user.uid, members, createdAt: now, lastMessage: "Группа создана", lastTimestamp: now, lastSenderId: "system" };
    try {
        await db.ref(`user_chats/${state.user.uid}/${groupId}`).set({ ...base, readAt: now });
        await Promise.all(memberUsers.map((u) => db.ref(`user_chats/${u.uid}/${groupId}`).set(base).catch(() => {})));
        await db.ref(`private_messages/${groupId}`).push({ type: "system", text: `${state.profile.nickname} создал(а) группу «${title}»`, senderId: "system", timestamp: now });
        state.chats[groupId] = { ...base, readAt: now };
        closeModal();
        openChat(groupId);
    } catch (error) {
        toast(friendlyError(error));
    }
}

async function addGroupMembers(groupId, users) {
    const entry = state.chats[groupId];
    if (!entry || !users.length) return;
    const members = { ...(entry.members || {}) };
    users.forEach((u) => { members[u.uid] = true; });
    const updates = {};
    Object.keys(entry.members || {}).forEach((uid) => {
        users.forEach((u) => { updates[`user_chats/${uid}/${groupId}/members/${u.uid}`] = true; });
    });
    try {
        await db.ref().update(updates);
        const base = { type: "group", title: entry.title, avatarUrl: entry.avatarUrl || "", ownerId: entry.ownerId, members, createdAt: entry.createdAt || Date.now(), lastMessage: entry.lastMessage || "", lastTimestamp: Date.now() };
        await Promise.all(users.map((u) => db.ref(`user_chats/${u.uid}/${groupId}`).set(base).catch(() => {})));
        const names = users.map((u) => u.nickname || u.username).join(", ");
        await pushMessage(groupId, { type: "system", text: `${state.profile.nickname} добавил(а) ${names}` });
        toast(users.length > 1 ? "Участники добавлены" : "Участник добавлен");
    } catch (error) {
        toast(friendlyError(error));
    }
}

async function leaveGroup(groupId) {
    const entry = state.chats[groupId];
    if (!entry) return;
    const ok = await confirmDialog({ title: "Покинуть группу", text: `Вы уверены, что хотите покинуть «${entry.title}»?`, ok: "Покинуть", danger: true });
    if (!ok) return;
    try {
        await pushMessage(groupId, { type: "system", text: `${state.profile.nickname} покинул(а) группу` });
        const updates = {};
        Object.keys(entry.members || {}).forEach((uid) => {
            if (uid !== state.user.uid) updates[`user_chats/${uid}/${groupId}/members/${state.user.uid}`] = null;
        });
        await db.ref().update(updates).catch(() => {});
        if (groupId === state.activeChatId) closeChat();
        await db.ref(`user_chats/${state.user.uid}/${groupId}`).remove();
    } catch (error) {
        toast(friendlyError(error));
    }
}

/* ===== SEARCH ===== */

const runGlobalSearch = debounce(async (query) => {
    const box = $("globalResults");
    if (!box) return;
    const username = normalizeUsername(query);
    if (username.length < 3) {
        box.replaceChildren(h("div", { class: "list-empty", text: "Введите username (от 3 символов) для глобального поиска." }));
        return;
    }
    try {
        const user = await findUserByUsername(username);
        if ($("searchInput").value.trim() !== query) return;
        if (!user) {
            box.replaceChildren(h("div", { class: "list-empty", text: `Пользователь @${username} не найден.` }));
            return;
        }
        box.replaceChildren(userRow(user, () => startPrivateChat(user)));
    } catch (error) {
        box.replaceChildren(h("div", { class: "list-empty", text: friendlyError(error) }));
    }
}, 300);

function userRow(user, onClick, extra) {
    return h("button", { class: "member-row", onclick: onClick },
        avatarEl(user.nickname || user.username, user.avatarUrl, "", { key: user.uid }),
        h("span", { class: "m-text" }, h("strong", { text: user.nickname || user.username }), h("small", { text: `@${user.username}` })),
        extra || null);
}

function renderSearch() {
    const query = $("searchInput").value.trim();
    const panel = $("searchPanel");
    const q = query.toLowerCase().replace(/^@/, "");

    if (!query) {
        const recent = sortedChats(() => true).slice(0, 12);
        panel.replaceChildren(
            h("div", { class: "section-title", text: "Недавние" }),
            ...recent.map(([id, e]) => h("button", { class: "member-row", onclick: () => { closeSearch(); openChat(id); } },
                chatAvatar(e), h("span", { class: "m-text" }, h("strong", { text: chatTitle(e) }), h("small", { text: e.type === "group" ? `${Object.keys(e.members || {}).length} участников` : e.partnerUsername ? `@${e.partnerUsername}` : "" })))),
            recent.length ? null : h("div", { class: "list-empty", text: "Найдите людей по username." }));
        return;
    }

    const local = sortedChats((id, e) => chatTitle(e).toLowerCase().includes(q) || (e.partnerUsername || "").toLowerCase().includes(q));
    panel.replaceChildren(
        local.length ? h("div", { class: "section-title", text: "Чаты" }) : null,
        ...local.map(([id, e]) => h("button", { class: "member-row", onclick: () => { closeSearch(); openChat(id); } },
            chatAvatar(e), h("span", { class: "m-text" }, h("strong", { text: chatTitle(e) }), h("small", { text: e.partnerUsername ? `@${e.partnerUsername}` : e.type === "group" ? "группа" : "" })))),
        h("div", { class: "section-title", text: "Глобальный поиск" }),
        h("div", { id: "globalResults" }, h("div", { class: "list-empty", text: "Поиск…" })));
    runGlobalSearch(query);
}

function openSearch() {
    $("searchPanel").classList.remove("hidden");
    $("chatList").classList.add("hidden");
    $("folders").classList.add("hidden");
    $("menuBtn").classList.add("hidden");
    $("searchBackBtn").classList.remove("hidden");
    renderSearch();
}

function closeSearch() {
    $("searchInput").value = "";
    $("searchPanel").classList.add("hidden");
    $("chatList").classList.remove("hidden");
    $("folders").classList.remove("hidden");
    $("menuBtn").classList.remove("hidden");
    $("searchBackBtn").classList.add("hidden");
}

/* ===== NOTIFICATIONS ===== */

function notifyNewMessage(chatId, entry) {
    if (!state.settings.notifications || !("Notification" in window) || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && chatId === state.activeChatId) return;
    try {
        const n = new Notification(chatTitle(entry), {
            body: entry.type === "group" && entry.lastSenderName ? `${entry.lastSenderName}: ${entry.lastMessage}` : entry.lastMessage,
            icon: (entry.type === "group" ? entry.avatarUrl : entry.partnerAvatarUrl) || "/icon.svg",
            tag: chatId,
        });
        n.onclick = () => { window.focus(); openChat(chatId); n.close(); };
    } catch {}
}
