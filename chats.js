let chatsLoaded = false;
const lastSeenTs = {};
const partnerWatchers = {};

function chatTitle(entry) {
    if (!entry) return "";
    if (entry.type === "saved") return "Избранное";
    if (entry.type === "group") return entry.title || "Группа";
    return entry.partnerName || (entry.partnerUsername ? "@" + entry.partnerUsername : "Пользователь");
}

function chatAvatar(entry, cls) {
    cls = cls || "";
    if (entry.type === "saved") return avatarEl("", "", cls, { icon: "bookmark" });
    const node = avatarEl(chatTitle(entry), entry.type === "group" ? entry.avatarUrl : entry.partnerAvatarUrl, cls, { key: entry.partnerId || entry.title });
    if (entry.type !== "group" && state.presence[entry.partnerId] && state.presence[entry.partnerId].online) node.classList.add("online");
    return node;
}

function previewOf(msg) {
    if (!msg) return "";
    const kinds = {
        image: "Фото",
        voice: "Голосовое сообщение",
        video: "Видеосообщение",
        videoFile: "Видео",
        file: msg.fileName ? "Файл: " + msg.fileName : "Файл",
        gift: "🎁 " + (msg.giftName || "Подарок"),
        nft: "🎁 NFT: " + (msg.nftName || "Подарок"),
    };
    if (msg.type && kinds[msg.type]) return msg.text ? (kinds[msg.type] + ", " + msg.text) : kinds[msg.type];
    return (msg.text || "").replace(/\s+/g, " ").slice(0, 140);
}

function chatMembers(entry, chatId) {
    if (!entry) return [];
    if (entry.type === "saved") return [state.user.uid];
    if (entry.type === "group") return Object.keys(entry.members || {});
    return [state.user.uid, entry.partnerId];
}

/* ===== USERNAME LOOKUP ===== */

function extractUidFromUsernameValue(val) {
    if (!val) return null;
    if (typeof val === "string") return val;
    if (typeof val === "object" && typeof val.uid === "string") return val.uid;
    return null;
}

async function findUserByUsername(raw) {
    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) return null;
    let uid = null;
    try {
        const snap = await db.ref("usernames/" + username).once("value");
        uid = extractUidFromUsernameValue(snap.val());
    } catch (err) {}
    if (uid) {
        const user = await getUser(uid);
        if (user) return user;
    }
    const found = Object.values(state.chats).find(function (e) {
        return e.type === "private" && normalizeUsername(e.partnerUsername || "") === username;
    });
    if (found && found.partnerId) {
        try { await db.ref("usernames/" + username).set(found.partnerId); } catch (e) {}
        return getUser(found.partnerId);
    }
    return null;
}

async function repairUsernamesFromChats() {
    const updates = {};
    let count = 0;
    Object.values(state.chats).forEach(function (e) {
        if (e.type !== "private" || !e.partnerId || !e.partnerUsername) return;
        const uname = normalizeUsername(e.partnerUsername);
        if (!isValidUsername(uname)) return;
        updates["usernames/" + uname] = e.partnerId;
        count++;
    });
    if (state.profile && state.profile.username) {
        const myUname = normalizeUsername(state.profile.username);
        if (isValidUsername(myUname)) { updates["usernames/" + myUname] = state.user.uid; count++; }
    }
    if (!count) return;
    try { await db.ref().update(updates); } catch (e) {}
}

/* ===== CHATS LIST ===== */

function listenChats() {
    chatsLoaded = false;
    listen("global", db.ref("user_chats/" + state.user.uid), "value", function (snap) {
        const chats = snap.val() || {};
        const prev = state.chats;
        state.chats = chats;

        Object.entries(chats).forEach(function (pair) {
            const chatId = pair[0], entry = pair[1];
            const last = entry.lastTimestamp || 0;
            const incoming = entry.lastSenderId && entry.lastSenderId !== state.user.uid;
            const isNew = chatsLoaded && prev[chatId] && last > (prev[chatId].lastTimestamp || 0) && incoming;
            const viewing = chatId === state.activeChatId && document.visibilityState === "visible";

            if (isNew && entry.archived && !entry.muted) db.ref("user_chats/" + state.user.uid + "/" + chatId + "/archived").set(false);
            if (isNew && !viewing && !entry.muted) notifyNewMessage(chatId, entry);
            if (lastSeenTs[chatId] !== last || !chatsLoaded) {
                lastSeenTs[chatId] = last;
                refreshUnread(chatId, entry);
            }
            if (entry.type !== "group" && entry.type !== "saved" && entry.partnerId) watchPartner(entry.partnerId);
        });

        chatsLoaded = true;

        if (!listenChats.repaired) {
            listenChats.repaired = true;
            repairUsernamesFromChats();
        }

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
    listen("global", db.ref("users/" + uid + "/online"), "value", function (snap) {
        const prev = state.presence[uid] || {};
        state.presence[uid] = Object.assign({}, prev, { online: snap.val() === true });
        document.querySelectorAll('.chat-item[data-partner="' + uid + '"] .avatar').forEach(function (n) {
            n.classList.toggle("online", snap.val() === true);
        });
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
        const snap = await db.ref("private_messages/" + chatId).orderByChild("timestamp").startAt(readAt + 1).limitToLast(100).once("value");
        let count = 0;
        snap.forEach(function (child) {
            const m = child.val();
            if (m.senderId !== state.user.uid && m.type !== "system" && !(m.deletedFor && m.deletedFor[state.user.uid])) count++;
        });
        state.unread[chatId] = Math.max(count, 1);
    } catch (e) { state.unread[chatId] = 1; }
    renderChatList();
}

function markChatRead(chatId) {
    const entry = state.chats[chatId];
    if (!entry) return;
    state.unread[chatId] = 0;
    if ((entry.readAt || 0) < (entry.lastTimestamp || 0) || entry.markedUnread) {
        db.ref("user_chats/" + state.user.uid + "/" + chatId).update({ readAt: Date.now(), markedUnread: null }).catch(function () {});
    }
}

function totalUnread() {
    return Object.entries(state.chats).reduce(function (sum, pair) {
        const id = pair[0], e = pair[1];
        return sum + ((!e.muted && !e.archived) ? unreadOf(id) : 0);
    }, 0);
}

function unreadOf(chatId) {
    const entry = state.chats[chatId];
    return state.unread[chatId] || (entry && entry.markedUnread ? 1 : 0);
}

function sortedChats(filter) {
    return Object.entries(state.chats)
        .filter(function (pair) { return filter(pair[0], pair[1]); })
        .sort(function (a, b) {
            const pa = a[1].pinnedAt || 0;
            const pb = b[1].pinnedAt || 0;
            if (pa || pb) return pb - pa;
            return (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0);
        });
}

function folderFilter(folder) {
    return function (id, e) {
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
        const archived = Object.entries(state.chats).filter(function (pair) { return pair[1].archived; });
        if (archived.length) {
            const unread = archived.reduce(function (s, pair) { return s + unreadOf(pair[0]); }, 0);
            nodes.push(h("button", { class: "chat-item archive-row", onclick: function () { setFolder("archive"); } },
                avatarEl("", "", "", { icon: "archive", bg: "var(--muted)" }),
                h("span", { class: "ci-body" },
                    h("span", { class: "ci-row" }, h("span", { class: "ci-title" }, h("span", { text: "Архив" }))),
                    h("span", { class: "ci-row" },
                        h("span", { class: "ci-preview", text: archived.map(function (pair) { return chatTitle(pair[1]); }).join(", ") }),
                        unread ? h("span", { class: "ci-badge muted", text: unread }) : null))));
        }
    }

    items.forEach(function (pair) { nodes.push(chatItem(pair[0], pair[1])); });

    if (!items.length) {
        const text = {
            all: ["Здесь пока пусто", "Нажмите на карандаш внизу, чтобы найти человека по username."],
            personal: ["Нет личных чатов", "Начните переписку через «Новое сообщение»."],
            groups: ["Нет групп", "Создайте группу через меню или кнопку внизу."],
            unread: ["Всё прочитано", "Новые сообщения появятся здесь."],
            archive: ["Архив пуст", "Архивируйте чат через контекстное меню."],
        }[state.folder] || ["Пусто", ""];
        nodes.push(h("div", { class: "list-empty" }, h("strong", { text: text[0] }), text[1]));
    }

    list.replaceChildren.apply(list, nodes);
    list.scrollTop = scroll;

    const unread = totalUnread();
    const badge = $("unreadFolderBadge");
    if (badge) {
        badge.textContent = unread;
        badge.classList.toggle("hidden", !unread);
    }
    document.title = unread ? "(" + unread + ") Localgram" : "Localgram";
}

function chatItem(chatId, entry) {
    const unread = unreadOf(chatId);
    const typingUsers = state.typing[chatId];
    let preview;
    if (typingUsers) {
        preview = h("span", { class: "typing", text: typingUsers });
    } else {
        const own = entry.lastSenderId === state.user.uid;
        const sender = own && entry.type !== "saved" ? "Вы: " : (entry.type === "group" && entry.lastSenderName ? entry.lastSenderName + ": " : "");
        preview = [
            sender ? h("span", { class: "ci-sender", text: sender }) : null,
            entry.lastMessage || (entry.type === "group" ? "Группа создана" : "Нет сообщений")
        ];
    }

    const titleEl = h("span", { class: "ci-title-name" });
    if (entry.type === "private" && entry.partnerId && typeof prefixBadge === "function") {
        const pref = prefixBadge(entry.partnerId);
        if (pref) titleEl.appendChild(pref);
    }
    titleEl.appendChild(h("span", { text: chatTitle(entry) }));
    if (entry.type === "private" && isVerifiedUser(entry.partnerUsername)) {
        titleEl.appendChild(verifiedBadge(14));
    }

    const node = h("button", {
        class: "chat-item " + (chatId === state.activeChatId ? "active" : ""),
        role: "listitem",
        dataset: { chatId: chatId, partner: entry.partnerId || "" },
        onclick: function () { openChat(chatId); },
    },
        chatAvatar(entry),
        h("span", { class: "ci-body" },
            h("span", { class: "ci-row" },
                h("span", { class: "ci-title" },
                    entry.type === "group" ? icon("group", "ci-icon") : null,
                    titleEl,
                    entry.muted ? icon("mute", "ci-icon") : null),
                entry.lastSenderId === state.user.uid && entry.type !== "saved" ? icon("check", "ci-icon check") : null,
                h("span", { class: "ci-time", text: formatListTime(entry.lastTimestamp) })),
            h("span", { class: "ci-row" },
                h("span", { class: "ci-preview" }, preview),
                unread ? h("span", { class: "ci-badge " + (entry.muted ? "muted" : ""), text: unread > 99 ? "99+" : unread })
                    : (entry.pinnedAt ? icon("pin", "ci-icon") : null))));

    onLongPress(node, function (e) { openChatMenu(chatId, e); });
    return node;
}

function setFolder(folder) {
    state.folder = folder;
    document.querySelectorAll(".folder").forEach(function (b) {
        const active = b.dataset.folder === folder;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active);
    });
    renderChatList();
}

function openChatMenu(chatId, e) {
    const entry = state.chats[chatId];
    if (!entry) return;
    const ref = db.ref("user_chats/" + state.user.uid + "/" + chatId);
    const unread = unreadOf(chatId) > 0;
    showMenu([
        { label: entry.pinnedAt ? "Открепить" : "Закрепить", icon: "pin", onClick: function () { ref.update({ pinnedAt: entry.pinnedAt ? null : Date.now() }); } },
        entry.type !== "saved" ? { label: entry.muted ? "Включить уведомления" : "Отключить уведомления", icon: entry.muted ? "unmute" : "mute", onClick: function () { ref.update({ muted: entry.muted ? null : true }); } } : null,
        { label: entry.archived ? "Вернуть из архива" : "Архивировать", icon: "archive", onClick: function () { ref.update({ archived: entry.archived ? null : true, pinnedAt: null }); } },
        unread
            ? { label: "Пометить как прочитанное", icon: "checks", onClick: function () { ref.update({ readAt: Date.now(), markedUnread: null }); state.unread[chatId] = 0; renderChatList(); } }
            : { label: "Пометить как непрочитанное", icon: "unread", onClick: function () { ref.update({ markedUnread: true }); } },
        "sep",
        entry.type === "group"
            ? { label: "Покинуть группу", icon: "logout", danger: true, onClick: function () { leaveGroup(chatId); } }
            : { label: "Удалить чат", icon: "trash", danger: true, onClick: function () { deleteChat(chatId); } },
    ], { x: e.clientX, y: e.clientY });
}

async function deleteChat(chatId) {
    const entry = state.chats[chatId];
    if (!entry) return;
    const isPrivate = entry.type !== "saved";
    const res = await confirmDialog({
        title: "Удалить чат",
        text: "Вы точно хотите удалить чат " + (isPrivate ? "с " + chatTitle(entry) : "«Избранное»") + "?",
        ok: "Удалить", danger: true,
        checkbox: isPrivate ? "Также удалить для " + chatTitle(entry) : null,
    });
    if (!res) return;
    try {
        if (chatId === state.activeChatId) closeChat();
        await db.ref("user_chats/" + state.user.uid + "/" + chatId).remove();
        if (res.checked || !isPrivate) {
            await db.ref("private_messages/" + chatId).remove().catch(function () {});
            if (res.checked) await db.ref("user_chats/" + entry.partnerId + "/" + chatId).remove().catch(function () {});
        }
        toast("Чат удалён");
    } catch (error) { toast(friendlyError(error)); }
}

async function startPrivateChat(user) {
    if (user.uid === state.user.uid) return openSaved();
    const chatId = [state.user.uid, user.uid].sort().join("_");
    const now = Date.now();
    if (!state.chats[chatId]) {
        try {
            await db.ref("user_chats/" + state.user.uid + "/" + chatId).set({
                type: "private",
                partnerId: user.uid,
                partnerName: user.nickname || user.username,
                partnerUsername: user.username,
                partnerAvatarUrl: user.avatarUrl || "",
                partnerBio: user.bio || "",
                lastMessage: "", lastTimestamp: now, readAt: now,
            });
            await db.ref("user_chats/" + user.uid + "/" + chatId).update({
                type: "private",
                partnerId: state.user.uid,
                partnerName: state.profile.nickname,
                partnerUsername: state.profile.username,
                partnerAvatarUrl: state.profile.avatarUrl || "",
                partnerBio: state.profile.bio || "",
            }).catch(function () {});
            state.chats[chatId] = (await db.ref("user_chats/" + state.user.uid + "/" + chatId).once("value")).val();
        } catch (error) { return toast(friendlyError(error)); }
    }
    closeSearch();
    closeModal();
    openChat(chatId);
}

async function openSaved() {
    const chatId = "saved_" + state.user.uid;
    if (!state.chats[chatId]) {
        const entry = { type: "saved", title: "Избранное", lastMessage: "", lastTimestamp: Date.now(), readAt: Date.now() };
        await db.ref("user_chats/" + state.user.uid + "/" + chatId).set(entry);
        state.chats[chatId] = entry;
    }
    closeDrawer();
    closeSearch();
    openChat(chatId);
}

async function createGroup(title, memberUsers, avatarUrl) {
    avatarUrl = avatarUrl || "";
    const groupId = "g_" + db.ref().push().key;
    const now = Date.now();
    const members = {};
    members[state.user.uid] = true;
    memberUsers.forEach(function (u) { members[u.uid] = true; });
    const base = { type: "group", title: title, avatarUrl: avatarUrl, ownerId: state.user.uid, members: members, createdAt: now, lastMessage: "Группа создана", lastTimestamp: now, lastSenderId: "system" };
    try {
        await db.ref("user_chats/" + state.user.uid + "/" + groupId).set(Object.assign({}, base, { readAt: now }));
        await Promise.all(memberUsers.map(function (u) { return db.ref("user_chats/" + u.uid + "/" + groupId).set(base).catch(function () {}); }));
        await db.ref("private_messages/" + groupId).push({ type: "system", text: state.profile.nickname + " создал(а) группу «" + title + "»", senderId: "system", timestamp: now });
        state.chats[groupId] = Object.assign({}, base, { readAt: now });
        closeModal();
        openChat(groupId);
    } catch (error) { toast(friendlyError(error)); }
}

async function addGroupMembers(groupId, users) {
    const entry = state.chats[groupId];
    if (!entry || !users.length) return;
    const members = Object.assign({}, entry.members || {});
    users.forEach(function (u) { members[u.uid] = true; });
    const updates = {};
    Object.keys(entry.members || {}).forEach(function (uid) {
        users.forEach(function (u) { updates["user_chats/" + uid + "/" + groupId + "/members/" + u.uid] = true; });
    });
    try {
        await db.ref().update(updates);
        const base = { type: "group", title: entry.title, avatarUrl: entry.avatarUrl || "", ownerId: entry.ownerId, members: members, createdAt: entry.createdAt || Date.now(), lastMessage: entry.lastMessage || "", lastTimestamp: Date.now() };
        await Promise.all(users.map(function (u) { return db.ref("user_chats/" + u.uid + "/" + groupId).set(base).catch(function () {}); }));
        const names = users.map(function (u) { return u.nickname || u.username; }).join(", ");
        await pushMessage(groupId, { type: "system", text: state.profile.nickname + " добавил(а) " + names });
        toast(users.length > 1 ? "Участники добавлены" : "Участник добавлен");
    } catch (error) { toast(friendlyError(error)); }
}

async function leaveGroup(groupId) {
    const entry = state.chats[groupId];
    if (!entry) return;
    const ok = await confirmDialog({ title: "Покинуть группу", text: "Вы уверены, что хотите покинуть «" + entry.title + "»?", ok: "Покинуть", danger: true });
    if (!ok) return;
    try {
        await pushMessage(groupId, { type: "system", text: state.profile.nickname + " покинул(а) группу" });
        const updates = {};
        Object.keys(entry.members || {}).forEach(function (uid) {
            if (uid !== state.user.uid) updates["user_chats/" + uid + "/" + groupId + "/members/" + state.user.uid] = null;
        });
        await db.ref().update(updates).catch(function () {});
        if (groupId === state.activeChatId) closeChat();
        await db.ref("user_chats/" + state.user.uid + "/" + groupId).remove();
    } catch (error) { toast(friendlyError(error)); }
}

/* ===== SEARCH ===== */

const runGlobalSearch = debounce(async function (query) {
    const box = $("globalResults");
    if (!box) return;
    const username = normalizeUsername(query);
    const input = $("searchInput");
    if (!input) return;
    if (username.length < 3) {
        box.replaceChildren(h("div", { class: "list-empty", text: "Введите username (от 3 символов)." }));
        return;
    }
    box.replaceChildren(h("div", { class: "list-empty", text: "Поиск…" }));
    try {
        const user = await findUserByUsername(username);
        if ($("searchInput").value.trim() !== query) return;
        if (!user) {
            box.replaceChildren(h("div", { class: "list-empty" }, h("strong", { text: "@" + username + " не найден" }), "Пользователь не зарегистрирован."));
            return;
        }
        box.replaceChildren(userRow(user, function () { startPrivateChat(user); }));
    } catch (error) {
        box.replaceChildren(h("div", { class: "list-empty", text: friendlyError(error) }));
    }
}, 300);

function userRow(user, onClick, extra) {
    const nameEl = h("strong", {});
    if (typeof prefixBadge === "function") {
        const pref = prefixBadge(user.uid);
        if (pref) nameEl.appendChild(pref);
    }
    nameEl.appendChild(h("span", { text: user.nickname || user.username }));
    if (isVerifiedUser(user.username)) nameEl.appendChild(verifiedBadge(15));
    return h("button", { class: "member-row", onclick: onClick },
        avatarEl(user.nickname || user.username, user.avatarUrl, "", { key: user.uid }),
        h("span", { class: "m-text" }, nameEl, h("small", { text: "@" + user.username })),
        extra || null);
}

function renderSearch() {
    const input = $("searchInput");
    const panel = $("searchPanel");
    if (!input || !panel) return;
    const query = input.value.trim();
    const q = query.toLowerCase().replace(/^@/, "");

    if (!query) {
        const recent = sortedChats(function () { return true; }).slice(0, 12);
        if (!recent.length) {
            panel.replaceChildren(h("div", { class: "list-empty" }, h("strong", { text: "Ничего нет" }), "Найдите человека по @username."));
            return;
        }
        const nodes = [h("div", { class: "section-title", text: "Недавние" })];
        recent.forEach(function (pair) {
            const id = pair[0], e = pair[1];
            const nameEl = h("strong", {});
            if (e.type === "private" && e.partnerId && typeof prefixBadge === "function") {
                const pref = prefixBadge(e.partnerId);
                if (pref) nameEl.appendChild(pref);
            }
            nameEl.appendChild(h("span", { text: chatTitle(e) }));
            if (e.type === "private" && isVerifiedUser(e.partnerUsername)) nameEl.appendChild(verifiedBadge(14));
            nodes.push(h("button", { class: "member-row", onclick: function () { closeSearch(); openChat(id); } },
                chatAvatar(e),
                h("span", { class: "m-text" }, nameEl,
                    h("small", { text: e.type === "group" ? Object.keys(e.members || {}).length + " участников" : (e.partnerUsername ? "@" + e.partnerUsername : "") }))));
        });
        panel.replaceChildren.apply(panel, nodes);
        return;
    }

    const local = sortedChats(function (id, e) {
        return chatTitle(e).toLowerCase().indexOf(q) >= 0 || (e.partnerUsername || "").toLowerCase().indexOf(q) >= 0;
    });

    const nodes = [];
    if (local.length) {
        nodes.push(h("div", { class: "section-title", text: "Чаты" }));
        local.forEach(function (pair) {
            const id = pair[0], e = pair[1];
            const nameEl = h("strong", {});
            if (e.type === "private" && e.partnerId && typeof prefixBadge === "function") {
                const pref = prefixBadge(e.partnerId);
                if (pref) nameEl.appendChild(pref);
            }
            nameEl.appendChild(h("span", { text: chatTitle(e) }));
            if (e.type === "private" && isVerifiedUser(e.partnerUsername)) nameEl.appendChild(verifiedBadge(14));
            nodes.push(h("button", { class: "member-row", onclick: function () { closeSearch(); openChat(id); } },
                chatAvatar(e),
                h("span", { class: "m-text" }, nameEl,
                    h("small", { text: e.partnerUsername ? "@" + e.partnerUsername : (e.type === "group" ? "группа" : "") }))));
        });
    }

    nodes.push(h("div", { class: "section-title", text: "Глобальный поиск" }));
    nodes.push(h("div", { id: "globalResults" }, h("div", { class: "list-empty", text: "Поиск…" })));

    panel.replaceChildren.apply(panel, nodes);
    runGlobalSearch(query);
}

function openSearch() {
    const sv = $("searchView");
    if (!sv) { toast("Ошибка: панель поиска не найдена"); return; }
    sv.classList.remove("hidden");
    const input = $("searchInput");
    if (input) input.value = "";
    renderSearch();
    setTimeout(function () { if (input) input.focus(); }, 80);
}

function closeSearch() {
    const sv = $("searchView");
    if (sv) sv.classList.add("hidden");
    const input = $("searchInput");
    if (input) input.value = "";
    const panel = $("searchPanel");
    if (panel) panel.replaceChildren();
}

/* ===== NOTIFICATIONS ===== */

function notifyNewMessage(chatId, entry) {
    if (!state.settings.notifications || !("Notification" in window) || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && chatId === state.activeChatId) return;
    try {
        const n = new Notification(chatTitle(entry), {
            body: entry.type === "group" && entry.lastSenderName ? entry.lastSenderName + ": " + entry.lastMessage : entry.lastMessage,
            icon: (entry.type === "group" ? entry.avatarUrl : entry.partnerAvatarUrl) || "icon.svg",
            tag: chatId,
        });
        n.onclick = function () { window.focus(); openChat(chatId); n.close(); };
    } catch (e) {}
}