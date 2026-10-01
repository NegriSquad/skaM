/* ===== DRAWER ===== */
function formatBirthday(iso) {
    if (!iso) return "Не указана";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    const formatted = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    return formatted + (age > 0 ? " (" + age + " " + plural(age, "год", "года", "лет") + ")" : "");
}

function formatBirthday(iso) {
    if (!iso) return "Не указана";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    const formatted = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    return formatted + (age > 0 ? " (" + age + " " + plural(age, "год", "года", "лет") + ")" : "");
}

function renderDrawerProfile() {
    const p = state.profile;
    if (!p) return;

    setAvatar($("drawerAvatar"), p.nickname || p.username, p.avatarUrl, { key: state.user.uid });
    const nameEl = $("drawerName");
    nameEl.replaceChildren(h("span", { text: p.nickname || p.username }));
    if (isVerifiedUser(p.username)) nameEl.appendChild(verifiedBadge(18));
    $("drawerUsername").textContent = "@" + p.username;

    const statusEl = $("drawerStatus");
    if (statusEl) statusEl.textContent = "в сети";

    const starsEl = $("drawerStarsCount");
    if (starsEl) starsEl.textContent = (state.stars || 0).toLocaleString("ru-RU");

    // ===== ПРОФИЛЬНАЯ КАРТОЧКА =====
    const profileCard = $("drawerProfileCard");
    if (profileCard) {
        const rows = [];

        rows.push(h("button", { class: "tg-row", onclick: function () {
            toast("Телефон: " + ((state.user && state.user.phoneNumber) || "не привязан"));
        }},
            h("span", { class: "tg-row-icon", style: "background:#4caf50" }, icon("unmute")),
            h("span", { class: "tg-row-text" },
                h("strong", { text: (state.user && state.user.phoneNumber) || "+ не привязан" }),
                h("small", { text: "Телефон" })
            )
        ));

        rows.push(h("button", { class: "tg-row", onclick: function () {
            navigator.clipboard.writeText("@" + p.username).then(function () { toast("Username скопирован"); });
        }},
            h("span", { class: "tg-row-icon", style: "background:#3390ec" }, icon("at")),
            h("span", { class: "tg-row-text" },
                h("strong", { text: "@" + p.username }),
                h("small", { text: "Имя пользователя" })
            )
        ));

        const birthdayText = p.birthday ? formatBirthday(p.birthday) : "Не указана";
        rows.push(h("button", { class: "tg-row", onclick: function () {
            closeDrawer();
            openProfileEditor();
        }},
            h("span", { class: "tg-row-icon", style: "background:#a855f7" }, icon("star")),
            h("span", { class: "tg-row-text" },
                h("strong", { text: birthdayText }),
                h("small", { text: "Дата рождения" })
            )
        ));

        profileCard.replaceChildren.apply(profileCard, rows);
    }

    // ===== МЕНЮШКА =====
    const menuCard = $("drawerMenuCard");
    if (menuCard) {
        const items = [];
        const rowDef = function (drawerId, bgColor, iconName, title) {
            return h("button", {
                class: "tg-row",
                onclick: function () {
                    if (drawerId === "profile") { closeDrawer(); openProfileEditor(); }
                    else if (drawerId === "gifts") { closeDrawer(); openGiftsPanel(); }
                    else if (drawerId === "new-group") { closeDrawer(); openNewGroup(); }
                    else if (drawerId === "saved") { closeDrawer(); openSaved(); }
                    else if (drawerId === "archive") { closeDrawer(); setFolder("archive"); }
                    else if (drawerId === "settings") { closeDrawer(); openSettings(); }
                    else if (drawerId === "admin") { closeDrawer(); openAdminPanel(); }
                }
            },
                h("span", { class: "tg-row-icon", style: "background:" + bgColor }, icon(iconName)),
                h("span", { class: "tg-row-text" }, h("strong", { text: title }))
            );
        };

        items.push(rowDef("profile", "#3390ec", "user", "Мой профиль"));
        items.push(rowDef("gifts", "#f59e0b", "star", "Подарки"));
        items.push(rowDef("new-group", "#4caf50", "group", "Создать группу"));
        items.push(rowDef("saved", "#f44336", "bookmark", "Избранное"));
        items.push(rowDef("archive", "#607d8b", "archive", "Архив"));
        items.push(rowDef("settings", "#9e9e9e", "lock", "Настройки"));

        if (state.isAdmin) {
            items.push(rowDef("admin", "#e53935", "lock", "Админ-панель"));
        }

        menuCard.replaceChildren.apply(menuCard, items);
    }
}


function openDrawer() {
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("drawerOverlay").classList.remove("hidden");
    renderDrawerProfile();
}

function closeDrawer() {
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("drawerOverlay").classList.add("hidden");
}

/* ===== INFO PANEL ===== */

let infoPanelTab = "media";

function toggleInfoPanel(force) {
    const panel = $("infoPanel");
    const show = force === undefined ? panel.classList.contains("hidden") : !!force;
    panel.classList.toggle("hidden", !show);
    if (show) renderInfoPanel();
}

function infoRow(iconName, value, label, onClick) {
    const tag = onClick ? "button" : "div";
    return h(tag, { class: "info-row", onclick: onClick || null },
        icon(iconName), h("span", { class: "info-row-text" }, h("span", { text: value }), h("small", { text: label })));
}

function namedTitle(name, username, tag) {
    const el = h(tag || "h3", {}, h("span", { text: name }));
    if (isVerifiedUser(username)) el.appendChild(verifiedBadge(18));
    return el;
}

/* ===== INFO TABS ===== */

function infoTabsBar() {
    const tabs = [
        { id: "media", label: "Медиа", icon: "image" },
        { id: "files", label: "Файлы", icon: "file" },
        { id: "gifts", label: "Подарки", icon: "star" },
    ];
    return h("div", { class: "info-tabs", role: "tablist" },
        ...tabs.map(function (t) {
            return h("button", {
                class: "info-tab" + (infoPanelTab === t.id ? " active" : ""),
                role: "tab",
                "aria-selected": infoPanelTab === t.id,
                onclick: function () {
                    infoPanelTab = t.id;
                    renderInfoPanel();
                }
            }, icon(t.icon), h("span", { text: t.label }));
        })
    );
}

function mediaGridContent() {
    const images = state.messages.filter(function (m) { return m.type === "image"; }).reverse();
    if (!images.length) return h("div", { class: "list-empty", text: "Здесь появятся фото из этого чата" });
    return h("div", { class: "media-grid" }, images.map(function (m) {
        return h("button", {
            style: "background-image:url('" + m.data + "')",
            "aria-label": "Открыть фото",
            onclick: function () { openViewer(m.data, m.text); }
        });
    }));
}

function filesGridContent() {
    const files = state.messages.filter(function (m) {
        return m.type === "file" || m.type === "videoFile" || m.type === "voice";
    }).reverse();
    if (!files.length) return h("div", { class: "list-empty", text: "Файлы из этого чата появятся здесь" });
    return h("div", { class: "info-files-list" }, files.map(function (m) {
        const isVideo = m.type === "videoFile";
        const isVoice = m.type === "voice";
        const kindIcon = isVideo ? "video" : isVoice ? "unmute" : "file";
        const kindLabel = isVideo ? "Видео" : isVoice ? "Голосовое" : (m.fileName || "Файл");
        const extra = m.fileSize ? formatSize(m.fileSize) : (m.duration ? formatDuration(m.duration) : "");
        return h("button", {
            class: "info-file-row",
            onclick: function () {
                if (isVoice) {
                    const a = new Audio(m.data);
                    a.play().catch(function () {});
                    return;
                }
                const link = h("a", { href: m.data, download: m.fileName || "file", target: "_blank" });
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        },
            h("span", { class: "info-file-icon" + (isVoice ? " voice" : "") }, icon(kindIcon)),
            h("span", { class: "info-file-info" },
                h("strong", { text: kindLabel }),
                h("small", { text: (extra ? extra + " · " : "") + formatListTime(m.timestamp) })
            )
        );
    }));
}

function giftsGridContent() {
    const gifts = state.messages.filter(function (m) { return m.type === "gift"; }).reverse();
    if (!gifts.length) return h("div", { class: "list-empty", text: "Подарки из этого чата появятся здесь" });
    return h("div", { class: "info-gifts-grid" }, gifts.map(function (m) {
        const out = m.senderId === state.user.uid;
        return h("div", { class: "info-gift-card " + (out ? "out" : "in") },
            h("span", { class: "info-gift-emoji", text: m.giftEmoji || "🎁" }),
            h("span", { class: "info-gift-name", text: m.giftName || "Подарок" }),
            h("small", { class: "info-gift-price", text: "⭐ " + (m.giftPrice || 0).toLocaleString("ru-RU") })
        );
    }));
}

function infoTabContent() {
    if (infoPanelTab === "media") return mediaGridContent();
    if (infoPanelTab === "files") return filesGridContent();
    if (infoPanelTab === "gifts") return giftsGridContent();
    return h("div");
}

/* ===== INFO PANEL RENDER ===== */

async function renderInfoPanel() {
    const entry = state.activeChat;
    const body = $("infoBody");
    if (!entry) { body.replaceChildren(); return; }
    const chatId = state.activeChatId;
    const ref = db.ref("user_chats/" + state.user.uid + "/" + chatId);

    if (entry.type === "saved") {
        $("infoHeaderTitle").textContent = "Избранное";
        body.replaceChildren(
            h("div", { class: "info-hero" }, avatarEl("", "", "huge", { icon: "bookmark" }), h("h3", { text: "Избранное" }), h("p", { text: "Только вы видите этот чат" })),
            h("div", { class: "info-section" }, infoTabsBar(), infoTabContent())
        );
        return;
    }

    const muteInput = h("input", { type: "checkbox", class: "switch", "aria-label": "Уведомления" });
    muteInput.checked = !entry.muted;
    muteInput.addEventListener("change", function () { ref.update({ muted: muteInput.checked ? null : true }); });
    const muteRow = h("label", { class: "info-row", style: "cursor:pointer" }, icon("unmute"),
        h("span", { class: "info-row-text" }, h("span", { text: "Уведомления" }), h("small", { text: entry.muted ? "Выключены" : "Включены" })),
        muteInput);

    if (entry.type === "group") {
        $("infoHeaderTitle").textContent = "Информация о группе";
        const members = Object.keys(entry.members || {});
        const memberList = h("div", {}, h("div", { class: "list-empty", text: "Загрузка…" }));
        const avatar = avatarEl(entry.title, entry.avatarUrl, "huge", { key: entry.title });
        const hero = h("div", { class: "info-hero" }, avatar, h("h3", { text: entry.title }), h("p", { text: members.length + " " + plural(members.length, "участник", "участника", "участников") }));
        body.replaceChildren(
            hero,
            h("div", { class: "info-actions" },
                h("button", { onclick: function () { openAddMembers(chatId); } }, icon("addUser"), "Добавить"),
                h("button", { onclick: function () { ref.update({ muted: entry.muted ? null : true }); } }, icon(entry.muted ? "unmute" : "mute"), entry.muted ? "Включить" : "Без звука"),
                h("button", { onclick: function () { openEditGroup(chatId); } }, icon("edit"), "Изменить"),
                h("button", { onclick: function () { leaveGroup(chatId); } }, icon("logout"), "Выйти")),
            h("div", { class: "info-section" }, muteRow),
            h("div", { class: "info-section" },
                h("div", { class: "section-title", text: "Участники" }),
                h("button", { class: "member-row", onclick: function () { openAddMembers(chatId); } },
                    h("span", { class: "avatar small", style: "background:var(--accent)" }, icon("addUser")),
                    h("span", { class: "m-text" }, h("strong", { text: "Добавить участников", style: "color:var(--accent-2)" }))),
                memberList),
            h("div", { class: "info-section" }, infoTabsBar(), infoTabContent()));

        const users = (await Promise.all(members.map(function (uid) { return getUser(uid).catch(function () { return null; }); }))).filter(Boolean);
        if (state.activeChatId !== chatId) return;
        users.sort(function (a, b) {
            if (a.uid === entry.ownerId) return -1;
            if (b.uid === entry.ownerId) return 1;
            return Number(!!b.online) - Number(!!a.online);
        });

        const userNodes = users.map(function (u) {
            const displayName = u.uid === state.user.uid ? (u.nickname + " (вы)") : (u.nickname || u.username);
            const nameEl = h("strong", { text: displayName });
            if (isVerifiedUser(u.username)) nameEl.appendChild(verifiedBadge(14));
            return h("button", { class: "member-row", onclick: function () { openUserProfile(u.uid); } },
                avatarEl(u.nickname || u.username, u.avatarUrl, "small", { key: u.uid }),
                h("span", { class: "m-text" }, nameEl,
                    h("small", { class: u.online ? "online" : "", text: u.online ? "в сети" : formatLastSeen(u.lastSeen) })),
                u.uid === entry.ownerId ? h("span", { class: "m-role", text: "владелец" }) : null);
        });
        memberList.replaceChildren.apply(memberList, userNodes);
        return;
    }

    /* ===== ЛИЧНЫЙ ЧАТ ===== */

    $("infoHeaderTitle").textContent = "Информация";
    const p = partnerProfile || {
        nickname: entry.partnerName,
        username: entry.partnerUsername,
        avatarUrl: entry.partnerAvatarUrl,
        bio: entry.partnerBio,
    };

    // Загружаем мифические NFT собеседника
    let partnerMythics = [];
    if (entry.partnerId && typeof loadMythicNFTs === "function") {
        partnerMythics = await loadMythicNFTs(entry.partnerId).catch(function () { return []; });
    }

    // Строим аватар и оборачиваем в контейнер для орбиты
    const avatarNode = avatarEl(p.nickname || p.username, p.avatarUrl, "huge", { key: entry.partnerId });
    const avatarBox = h("div", { class: "profile-avatar-block profile-avatar-block-info" }, avatarNode);

    if (partnerMythics.length && typeof buildMythicOrbit === "function") {
        const orbit = buildMythicOrbit(partnerMythics, avatarNode);
        avatarBox.appendChild(orbit);
    }
    if (p.avatarUrl) {
        avatarNode.style.cursor = "zoom-in";
        avatarNode.addEventListener("click", function () { openViewer(p.avatarUrl, p.nickname); });
    }

    body.replaceChildren(
        h("div", { class: "info-hero" },
            avatarBox,
            namedTitle(p.nickname || p.username, p.username),
            h("p", { class: p.online ? "online" : "", text: p.online ? "в сети" : formatLastSeen(p.lastSeen) })
        ),
        partnerMythics.length ? h("p", { class: "field-hint", style: "text-align:center;padding: 0 0 8px", text: "🎖 Мифических NFT: " + partnerMythics.length }) : null,
        h("div", { class: "info-actions" },
            h("button", { onclick: function () { toggleInfoPanel(false); $("messageInput").focus(); } }, icon("message"), "Написать"),
            h("button", { onclick: function () { ref.update({ muted: entry.muted ? null : true }); } }, icon(entry.muted ? "unmute" : "mute"), entry.muted ? "Включить" : "Без звука"),
            h("button", { onclick: function () { toggleInfoPanel(false); openChatSearch(); } }, icon("search"), "Поиск"),
            h("button", { onclick: function () { deleteChat(chatId); } }, icon("trash"), "Удалить")),
        h("div", { class: "info-section" },
            p.bio ? infoRow("info", p.bio, "О себе") : null,
            infoRow("at", "@" + p.username, "Имя пользователя", function () { navigator.clipboard.writeText("@" + p.username).then(function () { toast("Username скопирован"); }); }),
            muteRow),
        h("div", { class: "info-section" }, infoTabsBar(), infoTabContent())
    );
}

/* ===== USER PROFILE ===== */

async function openUserProfile(uid) {
    if (uid === state.user.uid) return openProfileEditor();
    const user = await getUser(uid);
    if (!user) return toast("Пользователь не найден");

    // Загружаем мифические NFT
    const mythics = await loadMythicNFTs(uid);

    // Аватар
    const avatarBox = h("div", { class: "profile-avatar-block profile-avatar-block-modal" },
        avatarEl(user.nickname || user.username, user.avatarUrl, "huge", { key: uid })
    );

    if (mythics.length) {
        const orbit = buildMythicOrbit(mythics, avatarBox);
        avatarBox.appendChild(orbit);
    }

    openModal({
        title: "Профиль",
        body: [
            h("div", { class: "info-hero" },
                avatarBox,
                namedTitle(user.nickname || user.username, user.username),
                h("p", { class: user.online ? "online" : "", text: user.online ? "в сети" : formatLastSeen(user.lastSeen) })
            ),
            user.bio ? infoRow("info", user.bio, "О себе") : null,
            infoRow("at", "@" + user.username, "Имя пользователя"),
            mythics.length ? h("p", { class: "field-hint", style: "text-align:center;padding: 4px 0 8px", text: "🎖 Мифических NFT: " + mythics.length }) : null,
            h("button", { class: "tg-btn primary", onclick: function () { closeModal(); startPrivateChat(user); } }, "Написать сообщение"),
            h("button", { class: "tg-btn", onclick: function () {
                closeModal();
                openGiftsPanel({ uid: user.uid, nickname: user.nickname, username: user.username, avatarUrl: user.avatarUrl });
            }}, "🎁 Подарить звёзды"),
        ].filter(Boolean),
    });
}

async function openUserByUsername(username) {
    const user = await findUserByUsername(username).catch(function () { return null; });
    if (!user) return toast("Пользователь @" + username + " не найден");
    openUserProfile(user.uid);
}

/* ===== PROFILE PANEL ===== */

function openProfileEditor() {
    closeDrawer();
    closeSettings();
    renderProfilePanel();
    $("profilePanel").classList.add("open");
    $("profilePanel").setAttribute("aria-hidden", "false");
    $("profileOverlay").classList.remove("hidden");
}

function closeProfilePanel() {
    $("profilePanel").classList.remove("open");
    $("profilePanel").setAttribute("aria-hidden", "true");
    $("profileOverlay").classList.add("hidden");
}

function renderProfilePanel() {
    const p = state.profile;
    if (!p) return;
    let newAvatar = null;
    const avatar = avatarEl(p.nickname, p.avatarUrl, "huge", { key: state.user.uid });
    const fileInput = h("input", { type: "file", accept: "image/*", hidden: true });
    const avatarBtn = h("button", { class: "avatar-edit", type: "button", "aria-label": "Сменить фото" }, avatar);
    avatarBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", async function () {
        const file = fileInput.files[0];
        if (!file) return;
        newAvatar = (await compressImage(file, 320, 0.85)).data;
        setAvatar(avatar, p.nickname, newAvatar);
    });

    const nickname = h("input", { type: "text", placeholder: " ", maxlength: 40 });
    nickname.value = p.nickname || "";
    const username = h("input", { type: "text", placeholder: " ", maxlength: 32 });
    username.value = p.username || "";
    const bio = h("textarea", { placeholder: " ", maxlength: 140 });
    bio.value = p.bio || "";

    const birthdayInput = h("input", { type: "date", class: "tg-field-date", max: new Date().toISOString().slice(0, 10) });
    if (p.birthday) birthdayInput.value = p.birthday;

    const hint = h("p", { class: "field-hint", text: "Латиница, цифры и _, минимум 3 символа." });
    const save = h("button", { class: "tg-btn primary" }, "Сохранить");

    save.addEventListener("click", async function () {
        const nick = nickname.value.trim();
        const uname = normalizeUsername(username.value);
        if (!nick) return toast("Введите имя");
        if (!isValidUsername(uname)) {
            hint.className = "field-hint error";
            hint.textContent = "Username: латиница, цифры и _, от 3 до 32 символов.";
            return;
        }
        save.disabled = true;
        try {
            if (uname !== p.username) {
                const txResult = await db.ref("usernames/" + uname).transaction(function (current) {
                    if (current === null || current === state.user.uid) return state.user.uid;
                    return;
                });
                if (!txResult.committed) {
                    hint.className = "field-hint error";
                    hint.textContent = "Этот username уже занят.";
                    save.disabled = false;
                    return;
                }
                if (p.username && p.username !== uname) {
                    await db.ref("usernames/" + p.username).remove().catch(function () {});
                }
            }
            const updates = {
                nickname: nick,
                username: uname,
                bio: bio.value.trim(),
                birthday: birthdayInput.value || "",
                updatedAt: Date.now(),
            };
            if (newAvatar) updates.avatarUrl = newAvatar;
            await db.ref("users/" + state.user.uid).update(updates);
            state.profile = Object.assign({}, p, updates);
            state.isAdmin = isAdminUser(uname);

            const partnerUpdates = {};
            Object.entries(state.chats).forEach(function (pair) {
                const chatId = pair[0];
                const e = pair[1];
                if (e.type === "group" || e.type === "saved" || !e.partnerId) return;
                const base = "user_chats/" + e.partnerId + "/" + chatId;
                partnerUpdates[base + "/partnerName"] = nick;
                partnerUpdates[base + "/partnerUsername"] = uname;
                partnerUpdates[base + "/partnerBio"] = updates.bio;
                if (newAvatar) partnerUpdates[base + "/partnerAvatarUrl"] = newAvatar;
            });
            if (Object.keys(partnerUpdates).length) await db.ref().update(partnerUpdates).catch(function () {});
            renderDrawerProfile();
            closeProfilePanel();
            toast("Профиль сохранён");
        } catch (error) {
            toast(friendlyError(error));
            save.disabled = false;
        }
    });

    // Контейнер для аватарки с орбитой мифических NFT
    const avatarBlock = h("div", { class: "profile-avatar-block" }, avatarBtn, fileInput);

    $("profileBody").replaceChildren(
        avatarBlock,
        h("div", { class: "profile-edit-fields" },
            h("label", { class: "tg-field" }, nickname, h("span", { text: "Имя" })),
            h("label", { class: "tg-field" }, bio, h("span", { text: "О себе" })),
            h("div", {}, h("label", { class: "tg-field" }, username, h("span", { text: "Username" })), hint),
            h("div", { class: "profile-birthday-field" },
                h("label", { class: "profile-birthday-label", text: "Дата рождения" }),
                birthdayInput
            ),
            h("p", { class: "field-hint", text: "Email: " + (p.email || state.user.email || "—") })
        ),
        h("div", { class: "profile-edit-actions" }, save)
    );

    // Асинхронно подгружаем мифические NFT и рисуем вокруг аватарки
    loadMythicNFTs(state.user.uid).then(function (mythics) {
        if (!mythics.length) return;
        // Убеждаемся, что панель всё ещё открыта
        if (!$("profilePanel").classList.contains("open")) return;
        const orbit = buildMythicOrbit(mythics, avatarBtn);
        avatarBlock.appendChild(orbit);
    });
}

function openSettings() {
    closeDrawer();
    settingsBackHandler = null;
    renderSettingsMain();
    $("settingsPanel").classList.add("open");
    $("settingsPanel").setAttribute("aria-hidden", "false");
    $("settingsOverlay").classList.remove("hidden");
}

function closeSettings() {
    $("settingsPanel").classList.remove("open");
    $("settingsPanel").setAttribute("aria-hidden", "true");
    $("settingsOverlay").classList.add("hidden");
}

function settingRow(iconName, title, subtitle, onClick, extra) {
    return h("button", { class: "settings-row", onclick: onClick },
        h("span", { class: "settings-icon" }, icon(iconName)),
        h("span", { class: "settings-text" },
            h("strong", { text: title }),
            subtitle ? h("small", { text: subtitle }) : null
        ),
        extra || null
    );
}

function openSettingsSub(title, renderFn) {
    settingsBackHandler = renderSettingsMain;
    $("settingsTitle").textContent = title;
    $("settingsBackBtn").classList.remove("hidden");
    renderFn();
}

function renderSettingsMain() {
    settingsBackHandler = null;
    $("settingsTitle").textContent = "Настройки";
    $("settingsBackBtn").classList.add("hidden");
    const groups = [];
    groups.push(h("div", { class: "settings-group" },
        h("div", { class: "settings-group-title", text: "Аккаунт" }),
        settingRow("user", "Профиль", "Имя, @username, фото", function () { closeSettings(); openProfileEditor(); }),
        settingRow("star", "Мои звёзды", (state.stars || 0).toLocaleString("ru-RU") + " ⭐", function () { closeSettings(); openGiftsPanel(); }),
        settingRow("lock", "Сменить пароль", "Обновить пароль аккаунта", function () { openSettingsSub("Сменить пароль", renderSettingsChangePassword); }),
        settingRow("at", "Сменить email", (state.user && state.user.email) || "—", function () { openSettingsSub("Сменить email", renderSettingsChangeEmail); }),
        settingRow("bell", "Уведомления и звуки", "Звуки, вибрация", function () { openSettingsSub("Уведомления и звуки", renderSettingsNotifications); }),
        settingRow("lock", "Конфиденциальность", "Последняя активность, пересылка", function () { openSettingsSub("Конфиденциальность", renderSettingsPrivacy); }),
        settingRow("archive", "Данные и память", "Кэш, автоскачивание", function () { openSettingsSub("Данные и память", renderSettingsData); })
    ));
    groups.push(h("div", { class: "settings-group" },
        h("div", { class: "settings-group-title", text: "Оформление" }),
        settingRow("edit", "Оформление", "Тема, цвет фона, размер текста", function () { openSettingsSub("Оформление", renderSettingsAppearance); }),
        settingRow("at", "Язык", currentLanguageLabel(), function () { openSettingsSub("Язык", renderSettingsLanguage); })
    ));
    groups.push(h("div", { class: "settings-group" },
        h("div", { class: "settings-group-title", text: "Прочее" }),
        settingRow("bookmark", "Стикеры и эмодзи", "Последние и предложения", function () { openSettingsSub("Стикеры и эмодзи", renderSettingsStickers); }),
        settingRow("star", "Localgram Premium", "Уникальные функции", function () { openSettingsSub("Localgram Premium", renderSettingsPremium); }),
        settingRow("info", "О приложении", "Localgram Web 2.0", function () { openSettingsSub("О приложении", renderSettingsAbout); })
    ));
    if (state.isAdmin) {
        groups.push(h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Администрирование" }),
            settingRow("lock", "Админ-панель", "Звёзды, подарки, верификация", function () {
                closeSettings();
                openAdminPanel();
            })
        ));
    }
    groups.push(h("div", { class: "settings-group" },
        h("button", { class: "settings-row danger", onclick: async function () {
            const ok = await confirmDialog({ title: "Выход", text: "Вы уверены, что хотите выйти?", ok: "Выйти", danger: true });
            if (ok) logout();
        }},
            h("span", { class: "settings-icon" }, icon("logout")),
            h("span", { class: "settings-text" }, h("strong", { text: "Выйти из аккаунта" })))
    ));
    $("settingsBody").replaceChildren.apply($("settingsBody"), groups);
}

function currentLanguageLabel() {
    const l = state.settings.language || "ru";
    const map = { ru: "Русский", en: "English", uk: "Українська", de: "Deutsch" };
    return map[l] || "Русский";
}

/* ===== SETTINGS: CHANGE PASSWORD ===== */

function renderSettingsChangePassword() {
    const currentInput = h("input", { type: "password", placeholder: " ", autocomplete: "current-password" });
    const newInput = h("input", { type: "password", placeholder: " ", autocomplete: "new-password" });
    const confirmInput = h("input", { type: "password", placeholder: " ", autocomplete: "new-password" });
    const hint = h("p", { class: "field-hint", text: "Пароль — минимум 6 символов. Введите текущий пароль." });
    const save = h("button", { class: "tg-btn primary" }, "Сменить пароль");

    save.addEventListener("click", async function () {
        const cur = currentInput.value;
        const nw = newInput.value;
        const cf = confirmInput.value;

        hint.className = "field-hint";
        hint.textContent = "";

        if (!cur || !nw || !cf) {
            hint.className = "field-hint error";
            hint.textContent = "Заполните все поля.";
            return;
        }
        if (nw.length < 6) {
            hint.className = "field-hint error";
            hint.textContent = "Новый пароль — минимум 6 символов.";
            return;
        }
        if (nw !== cf) {
            hint.className = "field-hint error";
            hint.textContent = "Новые пароли не совпадают.";
            return;
        }
        if (nw === cur) {
            hint.className = "field-hint error";
            hint.textContent = "Новый пароль совпадает с текущим.";
            return;
        }

        const user = auth.currentUser;
        if (!user || !user.email) {
            hint.className = "field-hint error";
            hint.textContent = "Не удалось определить пользователя.";
            return;
        }

        save.disabled = true;
        try {
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, cur);
            await user.reauthenticateWithCredential(credential);
            await user.updatePassword(nw);
            toast("Пароль успешно изменён");
            currentInput.value = "";
            newInput.value = "";
            confirmInput.value = "";
        } catch (error) {
            console.error("[password change]", error);
            hint.className = "field-hint error";
            hint.textContent = friendlyError(error);
        } finally {
            save.disabled = false;
        }
    });

    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Смена пароля" }),
            h("label", { class: "tg-field" }, currentInput, h("span", { text: "Текущий пароль" })),
            h("label", { class: "tg-field" }, newInput, h("span", { text: "Новый пароль" })),
            h("label", { class: "tg-field" }, confirmInput, h("span", { text: "Повторите новый пароль" })),
            hint
        ),
        h("div", { style: "padding: 8px 12px 20px" }, save)
    );
}

/* ===== SETTINGS: CHANGE EMAIL ===== */

function renderSettingsChangeEmail() {
    const currentEmail = (state.user && state.user.email) || (state.profile && state.profile.email) || "—";
    const passwordInput = h("input", { type: "password", placeholder: " ", autocomplete: "current-password" });
    const emailInput = h("input", { type: "email", placeholder: " ", autocomplete: "email" });
    const hint = h("p", { class: "field-hint", text: "Для смены email нужен текущий пароль." });
    const save = h("button", { class: "tg-btn primary" }, "Сменить email");

    save.addEventListener("click", async function () {
        const pwd = passwordInput.value;
        const newEmail = emailInput.value.trim();

        hint.className = "field-hint";
        hint.textContent = "";

        if (!pwd || !newEmail) {
            hint.className = "field-hint error";
            hint.textContent = "Заполните все поля.";
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            hint.className = "field-hint error";
            hint.textContent = "Некорректный email.";
            return;
        }
        if (newEmail === currentEmail) {
            hint.className = "field-hint error";
            hint.textContent = "Это уже ваш текущий email.";
            return;
        }

        const user = auth.currentUser;
        if (!user || !user.email) {
            hint.className = "field-hint error";
            hint.textContent = "Не удалось определить пользователя.";
            return;
        }

        save.disabled = true;
        try {
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, pwd);
            await user.reauthenticateWithCredential(credential);
            await user.updateEmail(newEmail);

            await db.ref("users/" + state.user.uid + "/email").set(newEmail);
            if (state.profile) state.profile.email = newEmail;

            toast("Email успешно изменён на " + newEmail);
            passwordInput.value = "";
            emailInput.value = "";
            $("settingsTitle").textContent = "Сменить email";
        } catch (error) {
            console.error("[email change]", error);
            hint.className = "field-hint error";
            hint.textContent = friendlyError(error);
        } finally {
            save.disabled = false;
        }
    });

    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Текущий email" }),
            h("div", { class: "settings-row" },
                h("span", { class: "settings-icon" }, icon("at")),
                h("span", { class: "settings-text" }, h("strong", { text: currentEmail }), h("small", { text: "Подтверждён" }))
            )
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Новый email" }),
            h("label", { class: "tg-field" }, emailInput, h("span", { text: "Новый email" })),
            h("label", { class: "tg-field" }, passwordInput, h("span", { text: "Текущий пароль" })),
            hint
        ),
        h("div", { style: "padding: 8px 12px 20px" }, save)
    );
}

function renderSettingsNotifications() {
    const s = state.settings;
    const toggle = function (key, label, sub, def) {
        const input = h("input", { type: "checkbox", class: "switch" });
        input.checked = s[key] !== undefined ? s[key] : def;
        input.addEventListener("change", function () { state.settings[key] = input.checked; saveSettings(); });
        return h("label", { class: "settings-row" },
            h("span", { class: "settings-text" }, h("strong", { text: label }), sub ? h("small", { text: sub }) : null),
            input);
    };
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Общие" }),
            toggle("notifications", "Показывать уведомления", "Всплывающие уведомления о новых сообщениях", true),
            toggle("sound", "Звук", "Звуковое сопровождение", true),
            toggle("vibrate", "Вибрация", "Вибрировать при новом сообщении", true),
            toggle("preview", "Предпросмотр", "Показывать текст в уведомлении", true)
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Типы чатов" }),
            toggle("notifyPrivate", "Личные чаты", "Уведомления о личных сообщениях", true),
            toggle("notifyGroups", "Группы", "Уведомления из групп", true),
            toggle("notifySaved", "Избранное", null, false)
        )
    );
}

function renderSettingsPrivacy() {
    const s = state.settings;
    const dropdown = function (key, label, options, def) {
        const value = s[key] !== undefined ? s[key] : def;
        const select = h("select", { class: "settings-select" });
        options.forEach(function (pair) {
            const opt = h("option", { value: pair[0], text: pair[1] });
            if (pair[0] === value) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener("change", function () { state.settings[key] = select.value; saveSettings(); });
        return h("div", { class: "settings-row" },
            h("span", { class: "settings-text" }, h("strong", { text: label })),
            select);
    };
    const toggle = function (key, label, sub, def) {
        const input = h("input", { type: "checkbox", class: "switch" });
        input.checked = s[key] !== undefined ? s[key] : def;
        input.addEventListener("change", function () { state.settings[key] = input.checked; saveSettings(); });
        return h("label", { class: "settings-row" },
            h("span", { class: "settings-text" }, h("strong", { text: label }), sub ? h("small", { text: sub }) : null),
            input);
    };
    const opts = [["everyone", "Все"], ["contacts", "Мои контакты"], ["nobody", "Никто"]];
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Кто видит мои данные" }),
            dropdown("lastSeen", "Последняя активность", opts, "everyone"),
            dropdown("profilePhoto", "Фото профиля", opts, "everyone"),
            dropdown("bioVisibility", "О себе", opts, "everyone"),
            dropdown("callsFrom", "Звонки", opts, "everyone")
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Сообщения" }),
            toggle("readReceipts", "Отчёты о прочтении", "Отправлять галочки о прочтении", true),
            toggle("forwardLink", "Ссылка на профиль при пересылке", "Показывать @username при пересылке", true),
            toggle("sensitiveContent", "Деликатный контент", "Показывать контент 18+", false)
        )
    );
}

function renderSettingsData() {
    const s = state.settings;
    const dropdown = function (key, label, options, def) {
        const value = s[key] !== undefined ? s[key] : def;
        const select = h("select", { class: "settings-select" });
        options.forEach(function (pair) {
            const opt = h("option", { value: pair[0], text: pair[1] });
            if (pair[0] === value) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener("change", function () { state.settings[key] = select.value; saveSettings(); });
        return h("div", { class: "settings-row" },
            h("span", { class: "settings-text" }, h("strong", { text: label })),
            select);
    };
    const auto = [["wifi", "Только Wi-Fi"], ["always", "Всегда"], ["never", "Никогда"]];
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Использование памяти" }),
            h("button", { class: "settings-row danger", onclick: function () { localStorage.removeItem("localgram_recent_emoji"); toast("Кэш очищен"); } },
                h("span", { class: "settings-icon" }, icon("trash")),
                h("span", { class: "settings-text" }, h("strong", { text: "Очистить кэш" })))
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Автоскачивание медиа" }),
            dropdown("autoDownloadPhotos", "Фото", auto, "always"),
            dropdown("autoDownloadVideos", "Видео", auto, "wifi"),
            dropdown("autoDownloadFiles", "Файлы", auto, "wifi"),
            dropdown("autoDownloadVoice", "Голосовые", auto, "always")
        )
    );
}

const WALLPAPER_COLORS = [
    "#0e1621", "#17212b", "#1a2531", "#202b3c", "#0d1a2b", "#221f30",
    "#2b5278", "#3a6ea5", "#1e3a5f", "#4a6fa5", "#264f78", "#2c3e50",
    "#1f3a2e", "#2d4a3e", "#1b4332", "#4a7c59", "#3d5a40", "#6f9e7a",
    "#d4e3b4", "#b7c9a1", "#c7b299", "#e8d8c3",
    "#4a2532", "#4a1f3a", "#5a2d3a", "#6b2d4a"
];

function renderSettingsAppearance() {
    const s = state.settings;

    const themeInput = h("input", { type: "checkbox", class: "switch" });
    themeInput.checked = s.theme === "dark";
    themeInput.addEventListener("change", function () { state.settings.theme = themeInput.checked ? "dark" : "light"; saveSettings(); });

    const size = h("input", { type: "range", min: 13, max: 20, step: 1 });
    size.value = s.fontSize;
    const sizeLabel = h("span", { text: s.fontSize + "px", style: "min-width:40px;text-align:right" });
    size.addEventListener("input", function () {
        state.settings.fontSize = Number(size.value);
        sizeLabel.textContent = size.value + "px";
        saveSettings();
    });

    const radius = h("input", { type: "range", min: 6, max: 22, step: 1 });
    radius.value = s.cornerRadius || 12;
    const radiusLabel = h("span", { text: (s.cornerRadius || 12) + "px", style: "min-width:40px;text-align:right" });
    radius.addEventListener("input", function () {
        state.settings.cornerRadius = Number(radius.value);
        radiusLabel.textContent = radius.value + "px";
        document.documentElement.style.setProperty("--radius", radius.value + "px");
        saveSettings();
    });

    const currentWallpaper = s.chatWallpaper || "";
    const wallpapers = h("div", { class: "wallpaper-grid" }, WALLPAPER_COLORS.map(function (c) {
        return h("button", {
            class: "wallpaper-swatch" + (currentWallpaper === c ? " active" : ""),
            style: "background: " + c,
            title: c,
            "aria-label": "Обои " + c,
            onclick: function () {
                state.settings.chatWallpaper = c;
                applyWallpaperColors(c);
                saveSettings();
                renderSettingsAppearance();
            }
        });
    }));

    const resetBtn = h("button", {
        class: "settings-row",
        onclick: function () {
            state.settings.chatWallpaper = "";
            applyWallpaperColors("");
            saveSettings();
            renderSettingsAppearance();
            toast("Обои сброшены");
        }
    },
        h("span", { class: "settings-icon" }, icon("broom")),
        h("span", { class: "settings-text" }, h("strong", { text: "Сбросить обои" }), h("small", { text: "Вернуть стандартный фон чата" }))
    );

    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Тема" }),
            h("label", { class: "settings-row" },
                h("span", { class: "settings-icon" }, icon("edit")),
                h("span", { class: "settings-text" }, h("strong", { text: "Ночной режим" }), h("small", { text: "Тёмная тема оформления" })),
                themeInput)
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Текст" }),
            h("div", { class: "settings-row" },
                h("span", { class: "settings-icon" }, icon("at")),
                h("span", { class: "settings-text" }, h("strong", { text: "Размер текста" }), h("small", { text: "Размер шрифта в сообщениях" })),
                h("div", { class: "range-row", style: "flex:0 0 130px" }, size, sizeLabel)),
            h("div", { class: "settings-row" },
                h("span", { class: "settings-icon" }, icon("message")),
                h("span", { class: "settings-text" }, h("strong", { text: "Углы сообщений" }), h("small", { text: "Округлость блоков сообщений" })),
                h("div", { class: "range-row", style: "flex:0 0 130px" }, radius, radiusLabel))
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Цвет фона чата" }),
            h("p", { class: "field-hint", style: "padding: 0 12px 8px", text: "Тема полностью подстроится под выбранный цвет." }),
            wallpapers
        ),
        h("div", { class: "settings-group" }, resetBtn)
    );
}

function renderSettingsLanguage() {
    const langs = [["ru", "🇷🇺 Русский"], ["en", "🇬🇧 English"], ["uk", "🇺🇦 Українська"], ["de", "🇩🇪 Deutsch"]];
    const current = state.settings.language || "ru";
    const rows = langs.map(function (pair) {
        return h("button", {
            class: "settings-row" + (current === pair[0] ? " active" : ""),
            onclick: function () {
                state.settings.language = pair[0];
                saveSettings();
                toast("Язык: " + pair[1]);
                renderSettingsLanguage();
            }
        },
            h("span", { class: "settings-text" }, h("strong", { text: pair[1] })),
            current === pair[0] ? h("span", { class: "settings-icon" }, icon("check")) : null);
    });
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Выберите язык" }),
            ...rows
        )
    );
}

function renderSettingsStickers() {
    const s = state.settings;
    const recent = (function () { try { return JSON.parse(localStorage.getItem("localgram_recent_emoji") || "[]"); } catch (e) { return []; } })();
    const suggestions = h("input", { type: "checkbox", class: "switch" });
    suggestions.checked = s.stickerSuggestions !== false;
    suggestions.addEventListener("change", function () { state.settings.stickerSuggestions = suggestions.checked; saveSettings(); });

    const recentNodes = recent.length
        ? recent.map(function (e) { return h("button", { text: e, style: "font-size:24px" }); })
        : [h("p", { class: "field-hint", text: "Здесь появятся недавние эмодзи" })];

    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Недавние" }),
            h("div", { class: "emoji-grid", style: "padding:8px" }, ...recentNodes)
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Настройки" }),
            h("label", { class: "settings-row" },
                h("span", { class: "settings-text" }, h("strong", { text: "Предлагать стикеры" }), h("small", { text: "Показывать стикеры при вводе текста" })),
                suggestions)
        )
    );
}

function renderSettingsPremium() {
    const features = [
        ["⭐", "Уникальные стикеры", "Эксклюзивные наборы"],
        ["📁", "Больше папок", "До 20 папок вместо 10"],
        ["📤", "Загрузка до 4 ГБ", "Большие файлы"],
        ["🎙", "Перевод в текст", "Голосовые в текст"],
        ["🚫", "Без рекламы", "Никаких спонсорских каналов"],
        ["⚡", "Быстрая загрузка", "Приоритетная скорость"]
    ];
    const featureRows = features.map(function (item) {
        return h("div", { class: "settings-row" },
            h("span", { class: "settings-icon", style: "font-size:20px" }, item[0]),
            h("span", { class: "settings-text" }, h("strong", { text: item[1] }), h("small", { text: item[2] })));
    });
    $("settingsBody").replaceChildren(
        h("div", { class: "premium-hero" },
            h("div", { class: "premium-badge" }, "⭐ Localgram Premium"),
            h("p", { text: "Откройте уникальные функции за небольшую подписку" })),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Что вы получите" }),
            ...featureRows
        )
    );
}

function renderSettingsAbout() {
    $("settingsBody").replaceChildren(
        h("div", { class: "about-hero" },
            h("div", { class: "about-logo" },
                h("svg", { viewBox: "0 0 24 24" }, h("path", { d: "M2.5 11.2 20.3 4.4c.8-.3 1.6.4 1.3 1.3l-3 14.2c-.2.9-1.2 1.2-1.9.7l-4.6-3.4-2.3 2.2c-.3.3-.8.1-.8-.3l.2-3.5 7.7-7c.3-.3 0-.7-.4-.5l-9.6 6-4.1-1.3c-.9-.3-.9-1.5 0-1.8z" }))),
            h("h3", { text: "Localgram" }),
            h("p", { class: "field-hint", text: "Версия Web 2.0" })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Информация" }),
            settingRow("user", "Разработчик", "aylppcel", function () { toast("aylppcel"); }),
            settingRow("info", "Версия", "2.0.0", function () { toast("Localgram Web 2.0"); }),
            settingRow("file", "Лицензия", "MIT", function () { toast("MIT License"); })
        ),
        h("p", { class: "field-hint", style: "text-align:center;margin-top:20px", text: "© 2025 Localgram" })
    );
}

/* ===== NEW CHAT / GROUP ===== */

function contactsFromChats() {
    return Object.entries(state.chats)
        .filter(function (pair) { return pair[1].type !== "group" && pair[1].type !== "saved" && pair[1].partnerId; })
        .map(function (pair) {
            return { uid: pair[1].partnerId, nickname: pair[1].partnerName, username: pair[1].partnerUsername, avatarUrl: pair[1].partnerAvatarUrl };
        });
}

function openNewChat() {
    closeDrawer();
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});
    const contacts = contactsFromChats();
    const contactList = h("div", { class: "pick-list" }, contacts.map(function (u) {
        return userRow(u, function () { startPrivateChat(u); });
    }));
    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { result.replaceChildren(); return; }
        result.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (normalizeUsername(input.value) !== q) return;
        result.replaceChildren(user
            ? userRow(user, function () { startPrivateChat(user); })
            : h("p", { class: "field-hint", text: "Пользователь @" + q + " не найден" }));
    }, 300);
    input.addEventListener("input", search);

    const body = [
        h("label", { class: "tg-field" }, input, h("span", { text: "Username собеседника" })),
        result,
        h("button", { class: "member-row", onclick: openSaved },
            avatarEl("", "", "small", { icon: "bookmark" }),
            h("span", { class: "m-text" }, h("strong", { text: "Избранное" }), h("small", { text: "Заметки для себя" })))
    ];
    if (contacts.length) {
        body.push(h("div", { class: "section-title", style: "padding-left:0", text: "Контакты" }));
        body.push(contactList);
    }
    openModal({ title: "Новое сообщение", body: body });
}

function memberPicker(excludeIds) {
    excludeIds = excludeIds || [];
    const selected = new Map();
    const chips = h("div", { class: "chips" });
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const hint = h("p", { class: "field-hint", text: "Введите username и нажмите Enter" });
    const list = h("div", { class: "pick-list" });

    const renderChips = function () {
        const chipNodes = [];
        selected.forEach(function (u) {
            chipNodes.push(h("button", { class: "chip", type: "button", onclick: function () { selected.delete(u.uid); renderChips(); renderList(); } },
                avatarEl(u.nickname || u.username, u.avatarUrl, "", { key: u.uid }), u.nickname || u.username, " ×"));
        });
        chips.replaceChildren.apply(chips, chipNodes);
    };

    const renderList = function () {
        const contacts = contactsFromChats().filter(function (u) { return excludeIds.indexOf(u.uid) < 0; });
        const rows = contacts.map(function (u) {
            const check = h("input", { type: "checkbox", "aria-label": u.nickname });
            check.checked = selected.has(u.uid);
            check.addEventListener("change", function () {
                if (check.checked) selected.set(u.uid, u);
                else selected.delete(u.uid);
                renderChips();
            });
            const nameEl = h("strong", { text: u.nickname || u.username });
            if (isVerifiedUser(u.username)) nameEl.appendChild(verifiedBadge(13));
            return h("label", { class: "pick-row" },
                avatarEl(u.nickname || u.username, u.avatarUrl, "small", { key: u.uid }),
                h("span", { class: "m-text" }, nameEl, h("small", { text: "@" + u.username })),
                check);
        });
        list.replaceChildren.apply(list, rows);
    };

    input.addEventListener("keydown", async function (e) {
        if (e.key !== "Enter" || isComposingEvent(e)) return;
        e.preventDefault();
        const q = normalizeUsername(input.value);
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (!user) {
            hint.className = "field-hint error";
            hint.textContent = "Пользователь @" + q + " не найден";
            return;
        }
        if (user.uid === state.user.uid || excludeIds.indexOf(user.uid) >= 0) {
            hint.className = "field-hint error";
            hint.textContent = "Этот пользователь уже в группе";
            return;
        }
        selected.set(user.uid, user);
        input.value = "";
        hint.className = "field-hint";
        hint.textContent = "Введите username и нажмите Enter";
        renderChips();
        renderList();
    });

    renderList();
    return {
        nodes: [chips, h("div", {}, h("label", { class: "tg-field" }, input, h("span", { text: "Добавить по username" })), hint), list],
        selected: function () { return Array.from(selected.values()); }
    };
}

function openNewGroup() {
    closeDrawer();
    const title = h("input", { type: "text", placeholder: " ", maxlength: 64 });
    let groupAvatar = "";
    const avatar = avatarEl("", "", "huge", { icon: "camera", bg: "var(--accent)" });
    const fileInput = h("input", { type: "file", accept: "image/*", hidden: true });
    const avatarBtn = h("button", { class: "avatar-edit", type: "button", "aria-label": "Фото группы", onclick: function () { fileInput.click(); } }, avatar);
    fileInput.addEventListener("change", async function () {
        if (!fileInput.files[0]) return;
        groupAvatar = (await compressImage(fileInput.files[0], 320, 0.85)).data;
        setAvatar(avatar, "", groupAvatar);
    });
    const picker = memberPicker();
    const create = h("button", { class: "tg-btn primary" }, "Создать группу");
    create.addEventListener("click", async function () {
        const name = title.value.trim();
        if (!name) return toast("Введите название группы");
        create.disabled = true;
        await createGroup(name, picker.selected(), groupAvatar);
        create.disabled = false;
    });
    openModal({
        title: "Новая группа",
        body: [avatarBtn, fileInput, h("label", { class: "tg-field" }, title, h("span", { text: "Название группы" })), ...picker.nodes, create]
    });
}

function openAddMembers(groupId) {
    const entry = state.chats[groupId];
    const picker = memberPicker(Object.keys((entry && entry.members) || {}));
    const add = h("button", { class: "tg-btn primary" }, "Добавить");
    add.addEventListener("click", async function () {
        const users = picker.selected();
        if (!users.length) return toast("Выберите участников");
        add.disabled = true;
        await addGroupMembers(groupId, users);
        closeModal();
    });
    openModal({ title: "Добавить участников", body: [...picker.nodes, add] });
}

function openEditGroup(groupId) {
    const entry = state.chats[groupId];
    if (!entry) return;
    const title = h("input", { type: "text", placeholder: " ", maxlength: 64 });
    title.value = entry.title || "";
    let newAvatar = null;
    const avatar = avatarEl(entry.title, entry.avatarUrl, "huge", { key: entry.title });
    const fileInput = h("input", { type: "file", accept: "image/*", hidden: true });
    const avatarBtn = h("button", { class: "avatar-edit", type: "button", "aria-label": "Сменить фото группы", onclick: function () { fileInput.click(); } }, avatar);
    fileInput.addEventListener("change", async function () {
        if (!fileInput.files[0]) return;
        newAvatar = (await compressImage(fileInput.files[0], 320, 0.85)).data;
        setAvatar(avatar, "", newAvatar);
    });
    const save = h("button", { class: "tg-btn primary" }, "Сохранить");
    save.addEventListener("click", async function () {
        const name = title.value.trim();
        if (!name) return toast("Введите название");
        save.disabled = true;
        const updates = {};
        Object.keys(entry.members || {}).forEach(function (uid) {
            updates["user_chats/" + uid + "/" + groupId + "/title"] = name;
            if (newAvatar) updates["user_chats/" + uid + "/" + groupId + "/avatarUrl"] = newAvatar;
        });
        try {
            await db.ref().update(updates);
            if (name !== entry.title) await pushMessage(groupId, { type: "system", text: state.profile.nickname + " изменил(а) название на «" + name + "»" });
            closeModal();
        } catch (error) {
            toast(friendlyError(error));
            save.disabled = false;
        }
    });
    openModal({
        title: "Изменить группу",
        body: [avatarBtn, fileInput, h("label", { class: "tg-field" }, title, h("span", { text: "Название группы" })), save]
    });
}

function openViewer(src, caption) {
    $("mediaViewerImg").src = src;
    $("mediaViewerImg").alt = caption || "Изображение";
    $("mediaViewerCaption").textContent = caption || "";
    $("mediaViewerDownload").href = src;
    $("mediaViewer").classList.remove("hidden");
    $("mediaViewerClose").focus();
}

function closeViewer() {
    $("mediaViewer").classList.add("hidden");
    $("mediaViewerImg").removeAttribute("src");
}
/* ===== MYTHIC NFT AROUND AVATAR ===== */

/**
 * Загружает мифические (rarity 5) NFT пользователя.
 */
async function loadMythicNFTs(uid) {
    try {
        const snap = await db.ref("nft_items").orderByChild("ownerUid").equalTo(uid).once("value");
        const items = [];
        snap.forEach(function (c) {
            const it = c.val();
            if (!it) return;
            if (Number(it.rarityLevel) !== 5) return; // только мифические
            items.push(Object.assign({ id: c.key }, it));
        });
        // Сортируем по дате (сначала новые)
        items.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        return items;
    } catch (e) {
        console.warn("[mythic-nft] load failed:", e.message);
        return [];
    }
}

/**
 * Создаёт "облако" мифических NFT вокруг аватарки.
 * Возвращает .mythic-orbit с 8 слотами по кругу.
 */
function buildMythicOrbit(items, avatarNode) {
    const orbit = h("div", { class: "mythic-orbit" });
    // Максимум 8 слотов — больше не влезет красиво
    const slots = [
        { x: -95, y: -20, r: -12, z: 1 },   // левый
        { x: -70, y: -70, r: -20, z: 2 },   // левый верх
        { x: -20, y: -95, r: -8, z: 3 },    // верх
        { x: 30,  y: -85, r: 10, z: 4 },    // правый верх
        { x: 85,  y: -40, r: 18, z: 5 },    // правый
        { x: 90,  y: 30,  r: 15, z: 6 },    // правый низ
        { x: 20,  y: 90,  r: 5, z: 7 },     // низ
        { x: -75, y: 70,  r: -10, z: 8 },   // левый низ
    ];

    items.slice(0, 8).forEach(function (it, i) {
        const s = slots[i];
        const wrap = h("div", {
            class: "mythic-item",
            style: "transform: translate(" + s.x + "px," + s.y + "px) rotate(" + s.r + "deg); z-index:" + s.z + ";",
            title: it.giftName + " · №" + it.serial + "/" + it.supply,
            onclick: function (e) {
                e.stopPropagation();
                openMythicViewer(it);
            }
        });

        const img = h("img", {
            class: "mythic-item-img",
            src: "pic_gift/" + it.giftId + "_5.png",
            alt: it.giftName,
            onerror: function () {
                this.style.display = "none";
                wrap.classList.add("no-img");
            }
        });
        wrap.appendChild(img);

        // Фолбэк-эмодзи
        const nft = (typeof getNFTById === "function") ? getNFTById(it.giftId) : null;
        const emoji = h("span", { class: "mythic-item-emoji", text: (nft && nft.emoji) || "🎁" });
        wrap.appendChild(emoji);

        orbit.appendChild(wrap);
    });

    return orbit;
}

/**
 * Модалка с подробностями мифического NFT.
 */
function openMythicViewer(item) {
    const r = (typeof getRarity === "function") ? getRarity(5) : { label: "Мифический", color: "#e53935", id: "mythic" };
    const wrap = h("div", { class: "mythic-viewer rarity-" + r.id });

    const imgWrap = h("div", { class: "mythic-viewer-img-wrap" });
    const img = h("img", {
        class: "mythic-viewer-img",
        src: "pic_gift/" + item.giftId + "_5.png",
        alt: item.giftName,
        onerror: function () { this.style.display = "none"; }
    });
    const nft = (typeof getNFTById === "function") ? getNFTById(item.giftId) : null;
    const emoji = h("span", { class: "mythic-viewer-emoji", text: (nft && nft.emoji) || "🎁" });
    imgWrap.append(img, emoji);

    const body = [
        h("div", { class: "mythic-viewer-hero" },
            imgWrap,
            h("div", { class: "mythic-viewer-name", text: item.giftName || "NFT" }),
            h("div", { class: "mythic-viewer-rarity", style: "color:" + r.color, text: "МИФИЧЕСКИЙ" }),
            h("div", { class: "mythic-viewer-serial", text: "Серийный №" + (item.serial || "?") + "/" + (item.supply || "?") })
        ),
        item.fromName ? h("div", { class: "info-row" },
            h("span", { class: "info-row-text" }, h("span", { text: item.fromName }), h("small", { text: "От кого" }))
        ) : null,
        item.message ? h("p", { class: "field-hint", style: "font-style:italic;text-align:center;padding: 8px 16px", text: '"' + item.message + '"' }) : null,
        h("p", { class: "field-hint", style: "text-align:center;padding: 0 16px 16px", text: "Получен " + new Date(item.createdAt || 0).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) })
    ].filter(Boolean);

    openModal({ title: "Мифический NFT", body: body });
}