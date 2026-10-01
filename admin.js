/* =====================================================
   ADMIN PANEL — only for ADMIN_USERNAMES
   ===================================================== */

let adminBackHandler = null;

function openAdminPanel() {
    if (!state.isAdmin) {
        return toast("Доступ только для администратора");
    }
    closeDrawer();
    closeSettings();
    adminBackHandler = null;
    $("adminPanel").classList.add("open");
    $("adminPanel").setAttribute("aria-hidden", "false");
    $("adminOverlay").classList.remove("hidden");
    renderAdminMain();
}

function closeAdminPanel() {
    $("adminPanel").classList.remove("open");
    $("adminPanel").setAttribute("aria-hidden", "true");
    $("adminOverlay").classList.add("hidden");
}

function openAdminSub(title, renderFn) {
    adminBackHandler = renderAdminMain;
    $("adminTitle").textContent = title;
    $("adminBackBtn").classList.remove("hidden");
    renderFn();
}

function renderAdminMain() {
    adminBackHandler = null;
    $("adminTitle").textContent = "Админ-панель";
    $("adminBackBtn").classList.add("hidden");

    $("adminBody").replaceChildren(
        h("div", { class: "admin-hero" },
            h("div", { class: "admin-badge" }, "👑 ADMIN"),
            h("p", { class: "field-hint", text: "Вы вошли как @" + state.profile.username })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Звёзды" }),
            settingRow("star", "Себе звёзды", "Выдать или забрать себе", function () { openAdminSub("Себе звёзды", renderAdminStarsSelf); }),
            settingRow("user", "Звёзды пользователю", "По @username", function () { openAdminSub("Звёзды пользователю", renderAdminStarsUser); })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Подарки" }),
            settingRow("star", "Подарить себе", "Бесплатно, без списания", function () { openAdminSub("Подарить себе", renderAdminGiftSelf); }),
            settingRow("forward", "Подарить пользователю", "Бесплатно, по @username", function () { openAdminSub("Подарить пользователю", renderAdminGiftUser); })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "NFT-подарки" }),
            settingRow("star", "NFT себе", "С выбором редкости (1-5)", function () { openAdminSub("NFT себе", renderAdminNFTSelf); }),
            settingRow("forward", "NFT пользователю", "По @username + редкость", function () { openAdminSub("NFT пользователю", renderAdminNFTUser); })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Верификация" }),
            settingRow("check", "Управление галочками", "Добавить / убрать верификацию", function () { openAdminSub("Верификация", renderAdminVerify); })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Система" }),
            settingRow("info", "Статистика", "Пользователи, чаты, сообщения", function () { openAdminSub("Статистика", renderAdminStats); }),
            settingRow("message", "Рассылка", "Отправить сообщение всем", function () { openAdminSub("Рассылка", renderAdminBroadcast); })
        )
    );
}

/* ===== STARS: SELF ===== */

function renderAdminStarsSelf() {
    const current = state.stars || 0;
    const amountInput = h("input", { type: "number", placeholder: " ", min: 1, step: 1, value: 100 });
    const currentEl = h("div", { class: "admin-current" }, "Текущий баланс: ⭐ ", h("strong", { text: current.toLocaleString("ru-RU") }));

    const giveBtn = h("button", { class: "tg-btn primary", onclick: async () => {
        const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
        try {
            await addStars(state.user.uid, n);
            toast(`Начислено ⭐ ${n.toLocaleString("ru-RU")}`);
            renderAdminStarsSelf();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Начислить");

    const takeBtn = h("button", { class: "tg-btn danger", onclick: async () => {
        const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
        try {
            await addStars(state.user.uid, -n);
            toast(`Списано ⭐ ${n.toLocaleString("ru-RU")}`);
            renderAdminStarsSelf();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Списать");

    const setBtn = h("button", { class: "tg-btn", onclick: async () => {
        const n = Math.max(0, Math.floor(Number(amountInput.value) || 0));
        try {
            await setStars(state.user.uid, n);
            toast(`Установлено ⭐ ${n.toLocaleString("ru-RU")}`);
            renderAdminStarsSelf();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Установить точно");

    $("adminBody").replaceChildren(
        currentEl,
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, amountInput, h("span", { text: "Сколько звёзд" })),
        h("div", { class: "admin-quick-buttons" },
            quickBtn(100), quickBtn(500), quickBtn(1000), quickBtn(5000), quickBtn(10000)
        ),
        h("div", { class: "admin-actions" }, giveBtn, takeBtn, setBtn)
    );

    function quickBtn(n) {
        return h("button", { class: "admin-quick", text: "+" + n, onclick: () => { amountInput.value = n; } });
    }
}

/* ===== STARS: USER ===== */

function renderAdminStarsUser() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const infoBox = h("div", { class: "admin-info" });
    const amountInput = h("input", { type: "number", placeholder: " ", min: 1, step: 1, value: 100 });
    let targetUser = null;

    const actionRow = h("div", { class: "admin-actions hidden" });

    const search = debounce(async () => {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { infoBox.replaceChildren(); actionRow.classList.add("hidden"); return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(() => null);
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: `@${q} не найден` }));
            actionRow.classList.add("hidden");
            return;
        }
        targetUser = user;
        const starsSnap = await db.ref(`users/${user.uid}/stars`).once("value");
        const balance = Number(starsSnap.val()) || 0;
        infoBox.replaceChildren(
            h("div", { class: "admin-user-row" },
                avatarEl(user.nickname || user.username, user.avatarUrl, "small", { key: user.uid }),
                h("div", { class: "admin-user-info" },
                    h("strong", { text: user.nickname || user.username }),
                    h("small", { text: "@" + user.username })
                ),
                h("span", { class: "admin-user-balance", text: "⭐ " + balance.toLocaleString("ru-RU") })
            )
        );
        actionRow.classList.remove("hidden");
        actionRow.replaceChildren(
            h("button", { class: "tg-btn primary", onclick: async () => {
                if (!targetUser) return;
                const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
                await addStars(targetUser.uid, n);
                toast(`@${targetUser.username}: +${n} звёзд`);
                search();
            }}, "Начислить"),
            h("button", { class: "tg-btn danger", onclick: async () => {
                if (!targetUser) return;
                const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
                await addStars(targetUser.uid, -n);
                toast(`@${targetUser.username}: -${n} звёзд`);
                search();
            }}, "Списать"),
            h("button", { class: "tg-btn", onclick: async () => {
                if (!targetUser) return;
                const n = Math.max(0, Math.floor(Number(amountInput.value) || 0));
                await setStars(targetUser.uid, n);
                toast(`@${targetUser.username}: установлено ⭐ ${n}`);
                search();
            }}, "Установить")
        );
    }, 400);
    input.addEventListener("input", search);

    $("adminBody").replaceChildren(
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username" })),
        infoBox,
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, amountInput, h("span", { text: "Количество звёзд" })),
        h("div", { class: "admin-quick-buttons" },
            quickBtn(100), quickBtn(500), quickBtn(1000), quickBtn(5000), quickBtn(10000)
        ),
        actionRow
    );

    function quickBtn(n) {
        return h("button", { class: "admin-quick", text: "+" + n, onclick: () => { amountInput.value = n; } });
    }
}

/* ===== GIFT: SELF ===== */

function renderAdminGiftSelf() {
    let selectedGift = null;
    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });

    const grid = h("div", { class: "gift-grid" },
        GIFT_CATALOG.map((g) => h("button", {
            class: `gift-card tier-${g.tier}`,
            dataset: { giftId: g.id },
            onclick: () => {
                selectedGift = g;
                grid.querySelectorAll(".gift-card").forEach((n) => n.classList.remove("selected"));
                grid.querySelector(`[data-gift-id="${g.id}"]`).classList.add("selected");
            }
        },
            h("span", { class: "gift-emoji", text: g.emoji }),
            h("span", { class: "gift-name", text: g.name }),
            h("span", { class: "gift-price", text: "(бесплатно)" })
        ))
    );

    const btn = h("button", { class: "tg-btn primary", onclick: async () => {
        if (!selectedGift) return toast("Выберите подарок");
        try {
            await sendGift({
                toUid: state.user.uid,
                toName: state.profile.nickname,
                toUsername: state.profile.username,
                giftId: selectedGift.id,
                message: messageInput.value.trim(),
                free: true,
            });
            toast(`Подарок «${selectedGift.name}» добавлен вам`);
        } catch (e) { toast(e.message || "Ошибка"); }
    }}, "Добавить себе подарок");

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px", text: "Подарок запишется в вашу историю полученных без списания звёзд." }),
        grid,
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, messageInput, h("span", { text: "Сообщение (необязательно)" })),
        h("div", { style: "padding: 8px 12px 20px" }, btn)
    );
}

/* ===== GIFT: USER ===== */

function renderAdminGiftUser() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const infoBox = h("div", { class: "admin-info" });
    let targetUser = null;

    const search = debounce(async () => {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { infoBox.replaceChildren(); return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(() => null);
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: `@${q} не найден` }));
            return;
        }
        targetUser = user;
        infoBox.replaceChildren(
            h("div", { class: "admin-user-row" },
                avatarEl(user.nickname || user.username, user.avatarUrl, "small", { key: user.uid }),
                h("div", { class: "admin-user-info" },
                    h("strong", { text: user.nickname || user.username }),
                    h("small", { text: "@" + user.username })
                )
            )
        );
        renderGrid(user);
    }, 400);
    input.addEventListener("input", search);

    let selectedGift = null;
    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const gridWrap = h("div");

    function renderGrid(user) {
        selectedGift = null;
        const grid = h("div", { class: "gift-grid" },
            GIFT_CATALOG.map((g) => h("button", {
                class: `gift-card tier-${g.tier}`,
                dataset: { giftId: g.id },
                onclick: () => {
                    selectedGift = g;
                    grid.querySelectorAll(".gift-card").forEach((n) => n.classList.remove("selected"));
                    grid.querySelector(`[data-gift-id="${g.id}"]`).classList.add("selected");
                }
            },
                h("span", { class: "gift-emoji", text: g.emoji }),
                h("span", { class: "gift-name", text: g.name }),
                h("span", { class: "gift-price", text: "(бесплатно)" })
            ))
        );

        const sendBtn = h("button", { class: "tg-btn primary", onclick: async () => {
            if (!selectedGift) return toast("Выберите подарок");
            try {
                await sendGift({
                    toUid: user.uid,
                    toName: user.nickname || user.username,
                    toUsername: user.username,
                    giftId: selectedGift.id,
                    message: messageInput.value.trim(),
                    free: true,
                });
                toast(`Подарок «${selectedGift.name}» отправлен @${user.username}`);
            } catch (e) { toast(e.message || "Ошибка"); }
        }}, "Отправить");

        gridWrap.replaceChildren(
            grid,
            h("label", { class: "tg-field", style: "margin: 8px 12px" }, messageInput, h("span", { text: "Сообщение (необязательно)" })),
            h("div", { style: "padding: 8px 12px 20px" }, sendBtn)
        );
    }

    $("adminBody").replaceChildren(
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username получателя" })),
        infoBox,
        gridWrap
    );
}

/* ===== VERIFY ===== */

function renderAdminVerify() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const infoBox = h("div", { class: "admin-info" });
    let targetUser = null;

    const verifyBtn = h("button", { class: "tg-btn primary", onclick: async () => {
        if (!targetUser) return;
        try {
            await db.ref(`config/verified/${targetUser.username}`).set(true);
            state.verifiedUsers.add(targetUser.username);
            toast(`@${targetUser.username} верифицирован`);
            renderAdminVerify();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Выдать галочку");

    const unverifyBtn = h("button", { class: "tg-btn danger", onclick: async () => {
        if (!targetUser) return;
        try {
            await db.ref(`config/verified/${targetUser.username}`).remove();
            state.verifiedUsers.delete(targetUser.username);
            toast(`@${targetUser.username}: галочка убрана`);
            renderAdminVerify();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Убрать галочку");

    const search = debounce(async () => {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { infoBox.replaceChildren(); return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(() => null);
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: `@${q} не найден` }));
            return;
        }
        targetUser = user;
        const isV = state.verifiedUsers.has(user.username);
        infoBox.replaceChildren(
            h("div", { class: "admin-user-row" },
                avatarEl(user.nickname || user.username, user.avatarUrl, "small", { key: user.uid }),
                h("div", { class: "admin-user-info" },
                    h("strong", { text: user.nickname || user.username }),
                    h("small", { text: "@" + user.username + (isV ? " · верифицирован" : "") })
                )
            )
        );
    }, 400);
    input.addEventListener("input", search);

    $("adminBody").replaceChildren(
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username" })),
        infoBox,
        h("div", { class: "admin-actions" }, verifyBtn, unverifyBtn),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Текущие верифицированные" }),
            h("div", { id: "adminVerifiedList", class: "admin-list" }, ...renderVerifiedList())
        )
    );
}

function renderVerifiedList() {
    return [...state.verifiedUsers].map((u) =>
        h("div", { class: "admin-list-row" },
            h("span", { text: "@" + u }),
            h("button", { class: "admin-list-remove", text: "✕", onclick: async () => {
                try {
                    await db.ref(`config/verified/${u}`).remove();
                    state.verifiedUsers.delete(u);
                    toast(`@${u} снят`);
                    renderAdminVerify();
                } catch (e) { toast("Ошибка"); }
            }})
        )
    );
}

/* ===== STATS ===== */

async function renderAdminStats() {
    $("adminBody").replaceChildren(h("div", { class: "list-empty", text: "Считаем…" }));
    try {
        const [usersSnap, chatsSnap] = await Promise.all([
            db.ref("users").once("value"),
            db.ref("user_chats").once("value"),
        ]);
        const usersCount = usersSnap.numChildren();
        const chatsCount = chatsSnap.numChildren();

        // Считаем сообщения — обходим все приватные чаты (может быть медленно на больших базах)
        let messagesCount = 0;
        const msgsSnap = await db.ref("private_messages").once("value");
        msgsSnap.forEach((child) => { messagesCount += child.numChildren(); });

        // Всего звёзд в системе
        let totalStars = 0;
        usersSnap.forEach((u) => { totalStars += Number(u.child("stars").val()) || 0; });

        $("adminBody").replaceChildren(
            h("div", { class: "admin-stats" },
                statCard("👥", usersCount.toLocaleString("ru-RU"), "пользователей"),
                statCard("💬", chatsCount.toLocaleString("ru-RU"), "чатов"),
                statCard("✉️", messagesCount.toLocaleString("ru-RU"), "сообщений"),
                statCard("⭐", totalStars.toLocaleString("ru-RU"), "звёзд в системе")
            ),
            h("div", { class: "settings-group" },
                h("div", { class: "settings-group-title", text: "Последние пользователи" }),
                ...topUsers(usersSnap, 10)
            )
        );
    } catch (e) {
        $("adminBody").replaceChildren(h("div", { class: "list-empty", text: "Ошибка: " + e.message }));
    }
}

function statCard(emoji, value, label) {
    return h("div", { class: "admin-stat-card" },
        h("span", { class: "admin-stat-emoji", text: emoji }),
        h("span", { class: "admin-stat-value", text: value }),
        h("span", { class: "admin-stat-label", text: label })
    );
}

function topUsers(snap, limit) {
    const arr = [];
    snap.forEach((u) => arr.push({ uid: u.key, ...u.val() }));
    arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return arr.slice(0, limit).map((u) =>
        h("div", { class: "admin-list-row" },
            h("span", { text: (u.nickname || u.username || "—") + " · @" + (u.username || "—") }),
            h("span", { class: "admin-list-meta", text: "⭐ " + (Number(u.stars) || 0) })
        )
    );
}

/* ===== BROADCAST ===== */

function renderAdminBroadcast() {
    const input = h("textarea", { placeholder: " ", maxlength: 2000, style: "height: 120px" });
    const btn = h("button", { class: "tg-btn primary", onclick: async () => {
        const text = input.value.trim();
        if (!text) return toast("Введите текст");
        const ok = await confirmDialog({ title: "Рассылка", text: "Отправить сообщение всем пользователям?", ok: "Отправить" });
        if (!ok) return;
        btn.disabled = true;
        try {
            const usersSnap = await db.ref("users").once("value");
            const updates = {};
            const now = Date.now();
            let count = 0;
            usersSnap.forEach((u) => {
                const uid = u.key;
                if (uid === state.user.uid) return;
                const id = db.ref(`notifications/${uid}/broadcast_${now}_${Math.random().toString(36).slice(2, 6)}`).key;
                updates[`notifications/${uid}/${id}`] = {
                    senderId: state.user.uid,
                    senderName: state.profile.nickname,
                    message: text,
                    timestamp: now,
                    read: false,
                    broadcast: true,
                };
                count++;
            });
            await db.ref().update(updates);
            toast(`Отправлено ${count} пользователям`);
            input.value = "";
        } catch (e) {
            toast("Ошибка: " + e.message);
        }
        btn.disabled = false;
    }}, "Отправить всем");

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px", text: "Сообщение придёт всем зарегистрированным пользователям во вкладку уведомлений." }),
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Текст рассылки" })),
        h("div", { style: "padding: 8px 12px 20px" }, btn)
    );
}

/* ===== BIND ===== */

function bindAdminUI() {
    const overlay = $("adminOverlay");
    const closeBtn = $("adminCloseBtn");
    const backBtn = $("adminBackBtn");
    const drawerBtn = $("drawerAdminBtn");
    if (overlay) overlay.addEventListener("click", closeAdminPanel);
    if (closeBtn) closeBtn.addEventListener("click", closeAdminPanel);
    if (backBtn) backBtn.addEventListener("click", () => {
        if (typeof adminBackHandler === "function" && adminBackHandler) adminBackHandler();
        else closeAdminPanel();
    });
    if (drawerBtn) drawerBtn.addEventListener("click", () => { closeDrawer(); openAdminPanel(); });
}
/* =====================================================
   ADMIN: NFT ПОДАРКИ С ВЫБОРОМ РЕДКОСТИ
   ===================================================== */

/**
 * Общая форма: сетка NFT + выбор редкости 1-5 + сообщение + кнопка.
 * @param {string} targetLabel
 * @param {function(giftId, rarityLevel, message): Promise} onSend
 */
function renderAdminNFTForm(targetLabel, onSend) {
    let selectedGift = NFT_CATALOG[0];
    let selectedRarity = 5;

    // Сетка NFT
    const grid = h("div", { class: "nft-grid nft-grid-admin" });
    NFT_CATALOG.forEach(function (g) {
        const node = h("button", {
            class: "nft-card" + (g.id === selectedGift.id ? " selected" : ""),
            onclick: function () {
                selectedGift = g;
                grid.querySelectorAll(".nft-card").forEach(function (n) { n.classList.remove("selected"); });
                node.classList.add("selected");
                updatePreview();
            }
        },
            h("div", { class: "nft-img-wrap" },
                h("img", {
                    class: "nft-img",
                    src: "pic_gift/" + g.id + "_" + selectedRarity + ".png",
                    alt: g.name,
                    onerror: function () { this.style.display = "none"; }
                }),
                h("span", { class: "nft-emoji-fallback", text: g.emoji })
            ),
            h("div", { class: "nft-name", text: g.name }),
            h("div", { class: "nft-price" }, "от ⭐ ", g.basePrice.toLocaleString("ru-RU"))
        );
        grid.appendChild(node);
    });

    // Выбор редкости
    const rarityRow = h("div", { class: "admin-rarity-row" });
    [1, 2, 3, 4, 5].forEach(function (level) {
        const r = getRarity(level);
        const btn = h("button", {
            class: "admin-rarity-btn" + (level === selectedRarity ? " active" : ""),
            style: "--rarity-color:" + r.color,
            onclick: function () {
                selectedRarity = level;
                rarityRow.querySelectorAll(".admin-rarity-btn").forEach(function (n) { n.classList.remove("active"); });
                btn.classList.add("active");
                // Обновляем картинки в сетке
                grid.querySelectorAll(".nft-card").forEach(function (n, i) {
                    const g = NFT_CATALOG[i];
                    const img = n.querySelector(".nft-img");
                    if (img) {
                        img.style.display = "";
                        img.src = "pic_gift/" + g.id + "_" + level + ".png";
                    }
                });
                updatePreview();
            }
        },
            h("span", { class: "admin-rarity-dot", style: "background:" + r.color }),
            h("span", { class: "admin-rarity-label", text: r.label })
        );
        rarityRow.appendChild(btn);
    });

    // Превью
    const preview = h("div", { class: "admin-nft-preview" });

    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const sendBtn = h("button", { class: "tg-btn primary" }, "Отправить");

    function updatePreview() {
        const r = getRarity(selectedRarity);
        const price = Math.round(selectedGift.basePrice * r.multiplier);
        preview.replaceChildren(
            h("div", { class: "admin-nft-preview-img-wrap rarity-" + r.id },
                h("img", {
                    class: "admin-nft-preview-img",
                    src: "pic_gift/" + selectedGift.id + "_" + selectedRarity + ".png",
                    alt: selectedGift.name,
                    onerror: function () { this.style.display = "none"; }
                }),
                h("span", { class: "admin-nft-preview-emoji", text: selectedGift.emoji })
            ),
            h("div", { class: "admin-nft-preview-info" },
                h("strong", { text: selectedGift.name }),
                h("span", { style: "color:" + r.color + ";font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px", text: r.label }),
                h("small", { text: "Цена: ⭐ " + price.toLocaleString("ru-RU") + " · бесплатно для админа" })
            )
        );
        sendBtn.textContent = "Отправить · " + r.label;
    }

    sendBtn.addEventListener("click", async function () {
        sendBtn.disabled = true;
        try {
            await onSend(selectedGift.id, selectedRarity, messageInput.value.trim());
        } catch (e) {
            toast(e.message || "Ошибка");
        } finally {
            sendBtn.disabled = false;
        }
    });

    updatePreview();

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px;text-align:center", text: "Получатель: " + targetLabel }),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "1. Выберите NFT" }),
            grid
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "2. Выберите редкость" }),
            rarityRow
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "3. Проверьте" }),
            preview
        ),
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, messageInput, h("span", { text: "Сообщение (необязательно)" })),
        h("div", { style: "padding: 8px 12px 24px" }, sendBtn)
    );
}

/* --- NFT себе --- */

function renderAdminNFTSelf() {
    renderAdminNFTForm("себе (@" + state.profile.username + ")", async function (giftId, rarity, message) {
        await sendNFTGift({
            toUid: state.user.uid,
            toName: state.profile.nickname,
            toUsername: state.profile.username,
            giftId: giftId,
            message: message,
            free: true,
            forcedRarity: rarity,
        });
        const gift = getNFTById(giftId);
        const r = getRarity(rarity);
        toast("Себе: " + gift.name + " · " + r.label);
    });
}

/* --- NFT пользователю --- */

function renderAdminNFTUser() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});

    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { result.replaceChildren(); return; }
        result.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (normalizeUsername(input.value) !== q) return;
        result.replaceChildren(user
            ? userRow(user, function () { openNFTSendToUser(user); })
            : h("p", { class: "field-hint error", text: "Пользователь @" + q + " не найден" }));
    }, 300);
    input.addEventListener("input", search);

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px;text-align:center", text: "Введите @username получателя" }),
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username" })),
        result
    );
    setTimeout(function () { input.focus(); }, 100);
}

function openNFTSendToUser(user) {
    adminBackHandler = function () { openAdminSub("NFT пользователю", renderAdminNFTUser); };
    $("adminTitle").textContent = "NFT для @" + user.username;
    $("adminBackBtn").classList.remove("hidden");

    renderAdminNFTForm("@" + user.username, async function (giftId, rarity, message) {
        await sendNFTGift({
            toUid: user.uid,
            toName: user.nickname || user.username,
            toUsername: user.username,
            giftId: giftId,
            message: message,
            free: true,
            forcedRarity: rarity,
        });
        const gift = getNFTById(giftId);
        const r = getRarity(rarity);
        toast(gift.name + " · " + r.label + " → @" + user.username);
    });
}