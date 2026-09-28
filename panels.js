/* ===== DRAWER ===== */

function renderDrawerProfile() {
    const p = state.profile;
    if (!p) return;
    setAvatar($("drawerAvatar"), p.nickname || p.username, p.avatarUrl, { key: state.user.uid });
    $("drawerName").textContent = p.nickname || p.username;
    $("drawerUsername").textContent = `@${p.username}`;
}

function openDrawer() {
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("drawerOverlay").classList.remove("hidden");
}

function closeDrawer() {
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("drawerOverlay").classList.add("hidden");
}

/* ===== INFO PANEL ===== */

function toggleInfoPanel(force) {
    const panel = $("infoPanel");
    const show = force ?? panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !show);
    if (show) renderInfoPanel();
}

function infoRow(iconName, value, label, onClick) {
    const tag = onClick ? "button" : "div";
    return h(tag, { class: "info-row", onclick: onClick || null },
        icon(iconName), h("span", { class: "info-row-text" }, h("span", { text: value }), h("small", { text: label })));
}

function mediaGrid() {
    const images = state.messages.filter((m) => m.type === "image").reverse();
    if (!images.length) return h("div", { class: "list-empty", text: "Здесь появятся фото из этого чата" });
    return h("div", { class: "media-grid" }, images.map((m) =>
        h("button", { style: `background-image:url("${m.data}")`, "aria-label": "Открыть фото", onclick: () => openViewer(m.data, m.text) })));
}

async function renderInfoPanel() {
    const entry = state.activeChat;
    const body = $("infoBody");
    if (!entry) return body.replaceChildren();
    const chatId = state.activeChatId;
    const ref = db.ref(`user_chats/${state.user.uid}/${chatId}`);

    if (entry.type === "saved") {
        $("infoHeaderTitle").textContent = "Избранное";
        body.replaceChildren(
            h("div", { class: "info-hero" }, avatarEl("", "", "huge", { icon: "bookmark" }), h("h3", { text: "Избранное" }), h("p", { text: "Только вы видите этот чат" })),
            h("div", { class: "info-section" }, h("div", { class: "section-title", text: "Медиа" }), mediaGrid()));
        return;
    }

    const muteRow = h("label", { class: "info-row", style: "cursor:pointer" }, icon("unmute"),
        h("span", { class: "info-row-text" }, h("span", { text: "Уведомления" }), h("small", { text: entry.muted ? "Выключены" : "Включены" })),
        (() => { const s = h("input", { type: "checkbox", class: "switch", "aria-label": "Уведомления" }); s.checked = !entry.muted; s.addEventListener("change", () => ref.update({ muted: s.checked ? null : true })); return s; })());

    if (entry.type === "group") {
        $("infoHeaderTitle").textContent = "Информация о группе";
        const members = Object.keys(entry.members || {});
        const isOwner = entry.ownerId === state.user.uid;
        const memberList = h("div", {}, h("div", { class: "list-empty", text: "Загрузка…" }));
        const avatar = avatarEl(entry.title, entry.avatarUrl, "huge", { key: entry.title });
        const hero = h("div", { class: "info-hero" }, avatar, h("h3", { text: entry.title }), h("p", { text: `${members.length} ${plural(members.length, "участник", "участника", "участников")}` }));
        body.replaceChildren(
            hero,
            h("div", { class: "info-actions" },
                h("button", { onclick: () => openAddMembers(chatId) }, icon("addUser"), "Добавить"),
                h("button", { onclick: () => ref.update({ muted: entry.muted ? null : true }) }, icon(entry.muted ? "unmute" : "mute"), entry.muted ? "Включить" : "Без звука"),
                isOwner || true ? h("button", { onclick: () => openEditGroup(chatId) }, icon("edit"), "Изменить") : null,
                h("button", { onclick: () => leaveGroup(chatId) }, icon("logout"), "Выйти")),
            h("div", { class: "info-section" }, muteRow),
            h("div", { class: "info-section" }, h("div", { class: "section-title", text: "Участники" }),
                h("button", { class: "member-row", onclick: () => openAddMembers(chatId) }, h("span", { class: "avatar small", style: "background:var(--accent)" }, icon("addUser")), h("span", { class: "m-text" }, h("strong", { text: "Добавить участников", style: "color:var(--accent-2)" }))),
                memberList),
            h("div", { class: "info-section" }, h("div", { class: "section-title", text: "Медиа" }), mediaGrid()));

        const users = (await Promise.all(members.map((uid) => getUser(uid).catch(() => null)))).filter(Boolean);
        if (state.activeChatId !== chatId) return;
        users.sort((a, b) => (a.uid === entry.ownerId ? -1 : b.uid === entry.ownerId ? 1 : Number(!!b.online) - Number(!!a.online)));
        memberList.replaceChildren(...users.map((u) => h("button", { class: "member-row", onclick: () => openUserProfile(u.uid) },
            avatarEl(u.nickname || u.username, u.avatarUrl, "small", { key: u.uid }),
            h("span", { class: "m-text" }, h("strong", { text: u.uid === state.user.uid ? `${u.nickname} (вы)` : u.nickname || u.username }),
                h("small", { class: u.online ? "online" : "", text: u.online ? "в сети" : formatLastSeen(u.lastSeen) })),
            u.uid === entry.ownerId ? h("span", { class: "m-role", text: "владелец" }) : null)));
        return;
    }

    $("infoHeaderTitle").textContent = "Информация";
    const p = partnerProfile || { nickname: entry.partnerName, username: entry.partnerUsername, avatarUrl: entry.partnerAvatarUrl, bio: entry.partnerBio };
    const avatar = avatarEl(p.nickname || p.username, p.avatarUrl, "huge", { key: entry.partnerId });
    if (p.avatarUrl) { avatar.style.cursor = "zoom-in"; avatar.addEventListener("click", () => openViewer(p.avatarUrl, p.nickname)); }
    body.replaceChildren(
        h("div", { class: "info-hero" }, avatar, h("h3", { text: p.nickname || p.username }),
            h("p", { class: p.online ? "online" : "", text: p.online ? "в сети" : formatLastSeen(p.lastSeen) })),
        h("div", { class: "info-actions" },
            h("button", { onclick: () => { toggleInfoPanel(false); $("messageInput").focus(); } }, icon("message"), "Написать"),
            h("button", { onclick: () => ref.update({ muted: entry.muted ? null : true }) }, icon(entry.muted ? "unmute" : "mute"), entry.muted ? "Включить" : "Без звука"),
            h("button", { onclick: () => { toggleInfoPanel(false); openChatSearch(); } }, icon("search"), "Поиск"),
            h("button", { onclick: () => deleteChat(chatId) }, icon("trash"), "Удалить")),
        h("div", { class: "info-section" },
            p.bio ? infoRow("info", p.bio, "О себе") : null,
            infoRow("at", `@${p.username}`, "Имя пользователя", () => navigator.clipboard.writeText(`@${p.username}`).then(() => toast("Username скопирован"))),
            muteRow),
        h("div", { class: "info-section" }, h("div", { class: "section-title", text: "Медиа" }), mediaGrid()));
}

/* ===== USER PROFILE MODAL ===== */

async function openUserProfile(uid) {
    if (uid === state.user.uid) return openProfileEditor();
    const user = await getUser(uid);
    if (!user) return toast("Пользователь не найден");
    openModal({
        title: "Профиль",
        body: [
            h("div", { class: "info-hero" }, avatarEl(user.nickname || user.username, user.avatarUrl, "huge", { key: uid }),
                h("h3", { text: user.nickname || user.username }),
                h("p", { class: user.online ? "online" : "", text: user.online ? "в сети" : formatLastSeen(user.lastSeen) })),
            user.bio ? infoRow("info", user.bio, "О себе") : null,
            infoRow("at", `@${user.username}`, "Имя пользователя"),
            h("button", { class: "tg-btn primary", onclick: () => startPrivateChat(user) }, "Написать сообщение"),
        ].filter(Boolean),
    });
}

async function openUserByUsername(username) {
    const user = await findUserByUsername(username).catch(() => null);
    if (!user) return toast(`Пользователь @${username} не найден`);
    openUserProfile(user.uid);
}

/* ===== PROFILE PANEL (slide-in) ===== */

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
    avatarBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
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
    const hint = h("p", { class: "field-hint", text: "Латиница, цифры и _, минимум 3 символа. По username вас смогут найти." });
    const save = h("button", { class: "tg-btn primary" }, "Сохранить");

    save.addEventListener("click", async () => {
        const nick = nickname.value.trim();
        const uname = normalizeUsername(username.value);
        if (!nick) return toast("Введите имя");
        if (!isValidUsername(uname)) { hint.className = "field-hint error"; return; }
        save.disabled = true;
        try {
            if (uname !== p.username) {
                const taken = (await db.ref(`usernames/${uname}`).once("value")).val();
                if (taken && taken !== state.user.uid) { hint.className = "field-hint error"; hint.textContent = "Этот username уже занят."; save.disabled = false; return; }
                await db.ref(`usernames/${uname}`).set(state.user.uid);
                if (p.username) await db.ref(`usernames/${p.username}`).remove().catch(() => {});
            }
            const updates = { nickname: nick, username: uname, bio: bio.value.trim(), updatedAt: Date.now() };
            if (newAvatar) updates.avatarUrl = newAvatar;
            await db.ref(`users/${state.user.uid}`).update(updates);
            state.profile = { ...p, ...updates };

            const partnerUpdates = {};
            Object.entries(state.chats).forEach(([chatId, e]) => {
                if (e.type === "group" || e.type === "saved" || !e.partnerId) return;
                const base = `user_chats/${e.partnerId}/${chatId}`;
                partnerUpdates[`${base}/partnerName`] = nick;
                partnerUpdates[`${base}/partnerUsername`] = uname;
                partnerUpdates[`${base}/partnerBio`] = updates.bio;
                if (newAvatar) partnerUpdates[`${base}/partnerAvatarUrl`] = newAvatar;
            });
            if (Object.keys(partnerUpdates).length) await db.ref().update(partnerUpdates).catch(() => {});
            renderDrawerProfile();
            closeProfilePanel();
            toast("Профиль сохранён");
        } catch (error) {
            toast(friendlyError(error));
            save.disabled = false;
        }
    });

    $("profileBody").replaceChildren(
        h("div", { class: "profile-edit-hero" }, avatarBtn, fileInput),
        h("div", { class: "profile-edit-fields" },
            h("label", { class: "tg-field" }, nickname, h("span", { text: "Имя" })),
            h("label", { class: "tg-field" }, bio, h("span", { text: "О себе" })),
            h("div", {}, h("label", { class: "tg-field" }, username, h("span", { text: "Username" })), hint),
            h("p", { class: "field-hint", text: `Email: ${p.email || state.user.email || "—"}` })
        ),
        h("div", { class: "profile-edit-actions" }, save)
    );
}

/* ===== SETTINGS (slide-in панель) ===== */

let settingsBackHandler = null;

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
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Аккаунт" }),
            settingRow("user", "Профиль", "Имя, @username, фото", () => { closeSettings(); openProfileEditor(); }),
            settingRow("bell", "Уведомления и звуки", "Звуки, вибрация", () => openSettingsSub("Уведомления и звуки", renderSettingsNotifications)),
            settingRow("lock", "Конфиденциальность", "Последняя активность, пересылка", () => openSettingsSub("Конфиденциальность", renderSettingsPrivacy)),
            settingRow("archive", "Данные и память", "Кэш, автоскачивание", () => openSettingsSub("Данные и память", renderSettingsData))
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Оформление" }),
            settingRow("edit", "Оформление", "Тема, размер текста", () => openSettingsSub("Оформление", renderSettingsAppearance)),
            settingRow("at", "Язык", currentLanguageLabel(), () => openSettingsSub("Язык", renderSettingsLanguage))
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Прочее" }),
            settingRow("bookmark", "Стикеры и эмодзи", "Последние и предложения", () => openSettingsSub("Стикеры и эмодзи", renderSettingsStickers)),
            settingRow("star", "Localgram Premium", "Уникальные функции", () => openSettingsSub("Localgram Premium", renderSettingsPremium)),
            settingRow("info", "О приложении", "Localgram Web 2.0", () => openSettingsSub("О приложении", renderSettingsAbout))
        ),
        h("div", { class: "settings-group" },
            h("button", { class: "settings-row danger", onclick: async () => {
                const ok = await confirmDialog({ title: "Выход", text: "Вы уверены, что хотите выйти?", ok: "Выйти", danger: true });
                if (ok) logout();
            }},
                h("span", { class: "settings-icon" }, icon("logout")),
                h("span", { class: "settings-text" }, h("strong", { text: "Выйти из аккаунта" })))
        )
    );
}

function currentLanguageLabel() {
    const l = state.settings.language || "ru";
    return { ru: "Русский", en: "English", uk: "Українська", de: "Deutsch" }[l] || "Русский";
}

/* --- Notifications --- */

function renderSettingsNotifications() {
    const s = state.settings;
    const toggle = (key, label, sub, def) => {
        const input = h("input", { type: "checkbox", class: "switch" });
        input.checked = s[key] !== undefined ? s[key] : def;
        input.addEventListener("change", () => { state.settings[key] = input.checked; saveSettings(); });
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
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "В приложении" }),
            toggle("inAppSound", "Звуки в приложении", null, true),
            toggle("inAppVibrate", "Вибрация в приложении", null, true),
            toggle("inAppPreview", "Показывать предпросмотр", null, true)
        )
    );
}

/* --- Privacy --- */

function renderSettingsPrivacy() {
    const s = state.settings;
    const dropdown = (key, label, options, def) => {
        const value = s[key] !== undefined ? s[key] : def;
        const select = h("select", { class: "settings-select" });
        options.forEach(([v, text]) => {
            const opt = h("option", { value: v, text });
            if (v === value) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener("change", () => { state.settings[key] = select.value; saveSettings(); });
        return h("div", { class: "settings-row" },
            h("span", { class: "settings-text" }, h("strong", { text: label })),
            select);
    };
    const toggle = (key, label, sub, def) => {
        const input = h("input", { type: "checkbox", class: "switch" });
        input.checked = s[key] !== undefined ? s[key] : def;
        input.addEventListener("change", () => { state.settings[key] = input.checked; saveSettings(); });
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
            dropdown("callsFrom", "Звонки", opts, "everyone"),
            dropdown("groupsFrom", "Группы и каналы", [["everyone", "Все"], ["contacts", "Мои контакты"]], "everyone")
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Сообщения" }),
            toggle("readReceipts", "Отчёты о прочтении", "Отправлять галочки о прочтении", true),
            toggle("forwardLink", "Ссылка на профиль при пересылке", "Показывать @username при пересылке", true),
            toggle("sensitiveContent", "Деликатный контент", "Показывать контент 18+", false)
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Безопасность" }),
            settingRow("lock", "Двухэтапная аутентификация", "Облачный пароль", () => toast("В разработке")),
            settingRow("eye", "Активные сессии", "Устройства со входом", () => toast("В разработке")),
            settingRow("trash", "Удалить аккаунт", "Безвозвратно", async () => {
                const ok = await confirmDialog({ title: "Удалить аккаунт", text: "Это действие нельзя отменить. Продолжить?", ok: "Удалить", danger: true });
                if (ok) toast("В разработке");
            }, null)
        )
    );
}

/* --- Data --- */

function renderSettingsData() {
    const s = state.settings;
    const dropdown = (key, label, options, def) => {
        const value = s[key] !== undefined ? s[key] : def;
        const select = h("select", { class: "settings-select" });
        options.forEach(([v, text]) => {
            const opt = h("option", { value: v, text });
            if (v === value) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener("change", () => { state.settings[key] = select.value; saveSettings(); });
        return h("div", { class: "settings-row" },
            h("span", { class: "settings-text" }, h("strong", { text: label })),
            select);
    };
    const auto = [["wifi", "Только Wi-Fi"], ["always", "Всегда"], ["never", "Никогда"]];
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Использование памяти" }),
            settingRow("archive", "Размер кэша", "~12 МБ", () => toast("Кэш: ~12 МБ")),
            h("button", { class: "settings-row danger", onclick: () => { localStorage.removeItem("localgram_recent_emoji"); toast("Кэш очищен"); } },
                h("span", { class: "settings-icon" }, icon("trash")),
                h("span", { class: "settings-text" }, h("strong", { text: "Очистить кэш" }))),
            dropdown("cacheLifetime", "Хранить кэш", [["3d", "3 дня"], ["1w", "1 неделя"], ["1m", "1 месяц"], ["forever", "Всегда"]], "1w")
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Автоскачивание медиа" }),
            dropdown("autoDownloadPhotos", "Фото", auto, "always"),
            dropdown("autoDownloadVideos", "Видео", auto, "wifi"),
            dropdown("autoDownloadFiles", "Файлы", auto, "wifi"),
            dropdown("autoDownloadVoice", "Голосовые", auto, "always")
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Экономия" }),
            (() => {
                const input = h("input", { type: "checkbox", class: "switch" });
                input.checked = s.saveTraffic === true;
                input.addEventListener("change", () => { state.settings.saveTraffic = input.checked; saveSettings(); });
                return h("label", { class: "settings-row" },
                    h("span", { class: "settings-text" }, h("strong", { text: "Экономия трафика" }), h("small", { text: "Снижение расхода интернета при звонках" })),
                    input);
            })()
        )
    );
}

/* --- Appearance --- */

function renderSettingsAppearance() {
    const s = state.settings;
    const themeInput = h("input", { type: "checkbox", class: "switch" });
    themeInput.checked = s.theme === "dark";
    themeInput.addEventListener("change", () => { state.settings.theme = themeInput.checked ? "dark" : "light"; saveSettings(); });

    const size = h("input", { type: "range", min: 13, max: 20, step: 1 });
    size.value = s.fontSize;
    const sizeLabel = h("span", { text: `${s.fontSize}px`, style: "min-width:40px;text-align:right" });
    size.addEventListener("input", () => { state.settings.fontSize = Number(size.value); sizeLabel.textContent = `${size.value}px`; saveSettings(); });

    const radius = h("input", { type: "range", min: 6, max: 22, step: 1 });
    radius.value = s.cornerRadius || 12;
    const radiusLabel = h("span", { text: `${radius.value}px`, style: "min-width:40px;text-align:right" });
    radius.addEventListener("input", () => {
        state.settings.cornerRadius = Number(radius.value);
        radiusLabel.textContent = `${radius.value}px`;
        document.documentElement.style.setProperty("--radius", `${radius.value}px`);
        saveSettings();
    });

    const wallpaperColors = ["#0e1621", "#17212b", "#2b5278", "#d4e3b4", "#93c19a", "#b7c9a1", "#f2e9d8", "#e0e0e0"];
    const wallpapers = h("div", { class: "wallpaper-grid" }, wallpaperColors.map((c) =>
        h("button", {
            class: `wallpaper-swatch ${s.chatWallpaper === c ? "active" : ""}`,
            style: `background: ${c}`,
            onclick: () => {
                state.settings.chatWallpaper = c;
                document.documentElement.style.setProperty("--chat-bg", c);
                saveSettings();
                renderSettingsAppearance();
            }
        })));

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
            h("div", { class: "settings-group-title", text: "Обои чата" }),
            wallpapers
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Жесты" }),
            h("div", { class: "settings-row" },
                h("span", { class: "settings-icon" }, icon("forward")),
                h("span", { class: "settings-text" }, h("strong", { text: "Свайп в списке чатов" })),
                (() => {
                    const select = h("select", { class: "settings-select" });
                    [["archive", "Архивировать"], ["delete", "Удалить"], ["read", "Прочитать"], ["pin", "Закрепить"]].forEach(([v, t]) => {
                        const o = h("option", { value: v, text: t });
                        if ((s.swipeAction || "archive") === v) o.selected = true;
                        select.appendChild(o);
                    });
                    select.addEventListener("change", () => { state.settings.swipeAction = select.value; saveSettings(); });
                    return select;
                })())
        )
    );
}

/* --- Language --- */

function renderSettingsLanguage() {
    const langs = [["ru", "🇷🇺 Русский"], ["en", "🇬🇧 English"], ["uk", "🇺🇦 Українська"], ["de", "🇩🇪 Deutsch"]];
    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Выберите язык" }),
            ...langs.map(([code, label]) =>
                h("button", {
                    class: `settings-row ${(state.settings.language || "ru") === code ? "active" : ""}`,
                    onclick: () => {
                        state.settings.language = code;
                        saveSettings();
                        toast(`Язык: ${label.split(" ")[1]}`);
                        renderSettingsLanguage();
                    }
                },
                    h("span", { class: "settings-text" }, h("strong", { text: label })),
                    (state.settings.language || "ru") === code ? h("span", { class: "settings-icon" }, icon("check")) : null))
        )
    );
}

/* --- Stickers --- */

function renderSettingsStickers() {
    const s = state.settings;
    const recent = (() => { try { return JSON.parse(localStorage.getItem("localgram_recent_emoji") || "[]"); } catch { return []; } })();
    const suggestions = h("input", { type: "checkbox", class: "switch" });
    suggestions.checked = s.stickerSuggestions !== false;
    suggestions.addEventListener("change", () => { state.settings.stickerSuggestions = suggestions.checked; saveSettings(); });

    $("settingsBody").replaceChildren(
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Недавние" }),
            h("div", { class: "emoji-grid", style: "padding:8px" },
                ...(recent.length ? recent.map((e) => h("button", { text: e, style: "font-size:24px" })) : [h("p", { class: "field-hint", text: "Здесь появятся недавние эмодзи" })]))
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Настройки" }),
            h("label", { class: "settings-row" },
                h("span", { class: "settings-text" }, h("strong", { text: "Предлагать стикеры" }), h("small", { text: "Показывать стикеры при вводе текста" })),
                suggestions),
            h("button", { class: "settings-row danger", onclick: () => { localStorage.removeItem("localgram_recent_emoji"); toast("История эмодзи очищена"); renderSettingsStickers(); } },
                h("span", { class: "settings-icon" }, icon("trash")),
                h("span", { class: "settings-text" }, h("strong", { text: "Очистить недавние" })))
        )
    );
}

/* --- Premium --- */

function renderSettingsPremium() {
    const features = [
        ["⭐", "Уникальные стикеры", "Эксклюзивные наборы для подписчиков"],
        ["📁", "Больше папок", "До 20 папок вместо 10"],
        ["📤", "Загрузка до 4 ГБ", "Отправляйте большие файлы"],
        ["🎙", "Перевод в текст", "Голосовые в текст одним касанием"],
        ["🚫", "Без рекламы", "Никаких спонсорских каналов"],
        ["🎨", "Уникальные реакции", "Больше эмодзи-реакций"],
        ["⚡", "Быстрая загрузка", "Приоритетная скорость скачивания"]
    ];
    $("settingsBody").replaceChildren(
        h("div", { class: "premium-hero" },
            h("div", { class: "premium-badge" }, "⭐ Localgram Premium"),
            h("p", { text: "Откройте уникальные функции за небольшую подписку" })),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Что вы получите" }),
            ...features.map(([emoji, title, sub]) =>
                h("div", { class: "settings-row" },
                    h("span", { class: "settings-icon", style: "font-size:20px" }, emoji),
                    h("span", { class: "settings-text" }, h("strong", { text: title }), h("small", { text: sub }))))
        ),
        h("div", { class: "settings-group" },
            h("button", { class: "tg-btn primary", onclick: () => toast("В разработке") }, "Подписаться за 199 ₽/мес"),
            h("button", { class: "tg-btn link", onclick: () => toast("В разработке") }, "Подарить Premium")
        )
    );
}

/* --- About --- */

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
            settingRow("user", "Разработчик", "aylppcel", () => toast("aylppcel")),
            settingRow("info", "Версия", "2.0.0", () => toast("Localgram Web 2.0")),
            settingRow("file", "Лицензия", "MIT", () => toast("MIT License")),
            settingRow("message", "Обратная связь", "Сообщить о проблеме", () => toast("В разработке"))
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Технологии" }),
            h("p", { class: "field-hint", style: "padding: 8px 14px", text: "Firebase · Vanilla JS · CSS3" })
        ),
        h("p", { class: "field-hint", style: "text-align:center;margin-top:20px", text: "© 2025 Localgram" })
    );
}

/* ===== NEW CHAT / GROUP ===== */

function contactsFromChats() {
    return Object.entries(state.chats)
        .filter(([, e]) => e.type !== "group" && e.type !== "saved" && e.partnerId)
        .map(([, e]) => ({ uid: e.partnerId, nickname: e.partnerName, username: e.partnerUsername, avatarUrl: e.partnerAvatarUrl }));
}

function openNewChat() {
    closeDrawer();
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});
    const contacts = contactsFromChats();
    const contactList = h("div", { class: "pick-list" }, contacts.map((u) => userRow(u, () => startPrivateChat(u))));
    const search = debounce(async () => {
        const q = normalizeUsername(input.value);
        if (q.length < 3) return result.replaceChildren();
        result.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(() => null);
        if (normalizeUsername(input.value) !== q) return;
        result.replaceChildren(user ? userRow(user, () => startPrivateChat(user)) : h("p", { class: "field-hint", text: `Пользователь @${q} не найден` }));
    }, 300);
    input.addEventListener("input", search);
    openModal({
        title: "Новое сообщение",
        body: [
            h("label", { class: "tg-field" }, input, h("span", { text: "Username собеседника" })),
            result,
            h("button", { class: "member-row", onclick: openSaved }, avatarEl("", "", "small", { icon: "bookmark" }), h("span", { class: "m-text" }, h("strong", { text: "Избранное" }), h("small", { text: "Заметки для себя" }))),
            contacts.length ? h("div", { class: "section-title", style: "padding-left:0", text: "Контакты" }) : null,
            contacts.length ? contactList : null,
        ].filter(Boolean),
    });
}

function memberPicker(excludeIds = []) {
    const selected = new Map();
    const chips = h("div", { class: "chips" });
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const hint = h("p", { class: "field-hint", text: "Введите username и нажмите Enter" });
    const list = h("div", { class: "pick-list" });

    const renderChips = () => chips.replaceChildren(...[...selected.values()].map((u) =>
        h("button", { class: "chip", type: "button", onclick: () => { selected.delete(u.uid); renderChips(); renderList(); } },
            avatarEl(u.nickname || u.username, u.avatarUrl, "", { key: u.uid }), u.nickname || u.username, " ×")));
    const renderList = () => {
        const contacts = contactsFromChats().filter((u) => !excludeIds.includes(u.uid));
        list.replaceChildren(...contacts.map((u) => {
            const check = h("input", { type: "checkbox", "aria-label": u.nickname });
            check.checked = selected.has(u.uid);
            check.addEventListener("change", () => { check.checked ? selected.set(u.uid, u) : selected.delete(u.uid); renderChips(); });
            return h("label", { class: "pick-row" }, avatarEl(u.nickname || u.username, u.avatarUrl, "small", { key: u.uid }),
                h("span", { class: "m-text" }, h("strong", { text: u.nickname || u.username }), h("small", { text: `@${u.username}` })), check);
        }));
    };
    input.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter" || isComposingEvent(e)) return;
        e.preventDefault();
        const q = normalizeUsername(input.value);
        const user = await findUserByUsername(q).catch(() => null);
        if (!user) { hint.className = "field-hint error"; hint.textContent = `Пользователь @${q} не найден`; return; }
        if (user.uid === state.user.uid || excludeIds.includes(user.uid)) { hint.className = "field-hint error"; hint.textContent = "Этот пользователь уже в группе"; return; }
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
        selected: () => [...selected.values()],
    };
}

function openNewGroup() {
    closeDrawer();
    const title = h("input", { type: "text", placeholder: " ", maxlength: 64 });
    let groupAvatar = "";
    const avatar = avatarEl("", "", "huge", { icon: "camera", bg: "var(--accent)" });
    const fileInput = h("input", { type: "file", accept: "image/*", hidden: true });
    const avatarBtn = h("button", { class: "avatar-edit", type: "button", "aria-label": "Фото группы", onclick: () => fileInput.click() }, avatar);
    fileInput.addEventListener("change", async () => {
        if (!fileInput.files[0]) return;
        groupAvatar = (await compressImage(fileInput.files[0], 320, 0.85)).data;
        setAvatar(avatar, "", groupAvatar);
    });
    const picker = memberPicker();
    const create = h("button", { class: "tg-btn primary" }, "Создать группу");
    create.addEventListener("click", async () => {
        const name = title.value.trim();
        if (!name) return toast("Введите название группы");
        create.disabled = true;
        await createGroup(name, picker.selected(), groupAvatar);
        create.disabled = false;
    });
    openModal({
        title: "Новая группа",
        body: [avatarBtn, fileInput, h("label", { class: "tg-field" }, title, h("span", { text: "Название группы" })), ...picker.nodes, create],
    });
}

function openAddMembers(groupId) {
    const entry = state.chats[groupId];
    const picker = memberPicker(Object.keys(entry?.members || {}));
    const add = h("button", { class: "tg-btn primary" }, "Добавить");
    add.addEventListener("click", async () => {
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
    const avatarBtn = h("button", { class: "avatar-edit", type: "button", "aria-label": "Сменить фото группы", onclick: () => fileInput.click() }, avatar);
    fileInput.addEventListener("change", async () => {
        if (!fileInput.files[0]) return;
        newAvatar = (await compressImage(fileInput.files[0], 320, 0.85)).data;
        setAvatar(avatar, "", newAvatar);
    });
    const save = h("button", { class: "tg-btn primary" }, "Сохранить");
    save.addEventListener("click", async () => {
        const name = title.value.trim();
        if (!name) return toast("Введите название");
        save.disabled = true;
        const updates = {};
        Object.keys(entry.members || {}).forEach((uid) => {
            updates[`user_chats/${uid}/${groupId}/title`] = name;
            if (newAvatar) updates[`user_chats/${uid}/${groupId}/avatarUrl`] = newAvatar;
        });
        try {
            await db.ref().update(updates);
            if (name !== entry.title) await pushMessage(groupId, { type: "system", text: `${state.profile.nickname} изменил(а) название на «${name}»` });
            closeModal();
        } catch (error) {
            toast(friendlyError(error));
            save.disabled = false;
        }
    });
    openModal({ title: "Изменить группу", body: [avatarBtn, fileInput, h("label", { class: "tg-field" }, title, h("span", { text: "Название группы" })), save] });
}

/* ===== MEDIA VIEWER ===== */

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