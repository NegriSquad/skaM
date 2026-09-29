const GIFT_CATALOG = [
    { id: "heart",    emoji: "❤️",  name: "Сердце",     price: 5,     tier: "common" },
    { id: "cake",     emoji: "🎂",  name: "Тортик",     price: 10,    tier: "common" },
    { id: "flower",   emoji: "💐",  name: "Букет",      price: 15,    tier: "common" },
    { id: "choco",    emoji: "🍫",  name: "Шоколад",    price: 20,    tier: "common" },
    { id: "teddy",    emoji: "🧸",  name: "Мишка",      price: 25,    tier: "common" },
    { id: "bear",     emoji: "🐻",  name: "Медведь",    price: 40,    tier: "common" },
    { id: "ring",     emoji: "💍",  name: "Кольцо",     price: 50,    tier: "rare" },
    { id: "trophy",   emoji: "🏆",  name: "Кубок",      price: 75,    tier: "rare" },
    { id: "giftbox",  emoji: "🎁",  name: "Подарок",    price: 100,   tier: "rare" },
    { id: "guitar",   emoji: "🎸",  name: "Гитара",     price: 150,   tier: "rare" },
    { id: "painting", emoji: "🎨",  name: "Картина",    price: 200,   tier: "rare" },
    { id: "telescope",emoji: "🔭",  name: "Телескоп",   price: 250,   tier: "rare" },
    { id: "rocket",   emoji: "🚀",  name: "Ракета",     price: 300,   tier: "epic" },
    { id: "castle",   emoji: "🏰",  name: "Замок",      price: 500,   tier: "epic" },
    { id: "crown",    emoji: "👑",  name: "Корона",     price: 750,   tier: "epic" },
    { id: "car",      emoji: "🏎️",  name: "Спорткар",   price: 1000,  tier: "epic" },
    { id: "yacht",    emoji: "🛥️",  name: "Яхта",       price: 1500,  tier: "epic" },
    { id: "diamond",  emoji: "💎",  name: "Алмаз",      price: 2000,  tier: "legendary" },
    { id: "planet",   emoji: "🪐",  name: "Планета",    price: 3000,  tier: "legendary" },
    { id: "dragon",   emoji: "🐉",  name: "Дракон",     price: 5000,  tier: "legendary" },
    { id: "unicorn",  emoji: "🦄",  name: "Единорог",   price: 7500,  tier: "legendary" },
    { id: "star",     emoji: "🌟",  name: "Звезда",     price: 10000, tier: "legendary" },
];

const GIFT_TIERS = {
    common:    { label: "Обычные",     color: "#8a9aab" },
    rare:      { label: "Редкие",      color: "#4a9eff" },
    epic:      { label: "Эпические",   color: "#a855f7" },
    legendary: { label: "Легендарные", color: "#f59e0b" },
};

let giftsListeners = [];

/* ===== BALANCE ===== */

function listenStars() {
    offGiftsGroup();
    const ref = db.ref("users/" + state.user.uid + "/stars");
    const onVal = ref.on("value", function (snap) {
        state.stars = Number(snap.val()) || 0;
        renderStarsBalance();
    });
    giftsListeners.push(function () { ref.off("value", onVal); });
}

function offGiftsGroup() {
    giftsListeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    giftsListeners = [];
}

function renderStarsBalance() {
    const drawer = $("drawerStarsCount");
    if (drawer) drawer.textContent = (state.stars || 0).toLocaleString("ru-RU");
}

async function addStars(uid, amount) {
    if (!isFinite(amount) || amount === 0) return;
    const ref = db.ref("users/" + uid + "/stars");
    await ref.transaction(function (current) {
        const v = Number(current) || 0;
        const next = Math.max(0, v + amount);
        return next;
    });
}

async function setStars(uid, amount) {
    const v = Math.max(0, Math.floor(Number(amount) || 0));
    await db.ref("users/" + uid + "/stars").set(v);
}

/* ===== SEND GIFT ===== */

async function sendGift(params) {
    const toUid = params.toUid;
    const gift = GIFT_CATALOG.find(function (g) { return g.id === params.giftId; });
    if (!gift) throw new Error("Подарок не найден");
    if (!toUid) throw new Error("Получатель не указан");
    const free = !!params.free;
    if (toUid === state.user.uid && !free) throw new Error("Нельзя дарить подарки себе");

    const price = Number(gift.price) || 0;
    if (!free && (state.stars || 0) < price) throw new Error("Недостаточно звёзд");

    const giftPushId = db.ref("gifts_sent/" + state.user.uid).push().key;
    const now = Date.now();
    const messageText = (params.message || "").trim().slice(0, 200);

    const payloadSent = {
        toUid: toUid,
        toName: params.toName || "",
        toUsername: params.toUsername || "",
        giftId: gift.id, giftEmoji: gift.emoji, giftName: gift.name,
        price: price, message: messageText,
        timestamp: now, free: free,
    };
    const payloadReceived = {
        fromUid: state.user.uid,
        fromName: state.profile.nickname || state.profile.username,
        fromUsername: state.profile.username,
        giftId: gift.id, giftEmoji: gift.emoji, giftName: gift.name,
        price: price, message: messageText,
        timestamp: now, seen: false, free: free,
    };

    const updates = {};
    updates["gifts_sent/" + state.user.uid + "/" + giftPushId] = payloadSent;
    updates["gifts_received/" + toUid + "/" + giftPushId] = payloadReceived;

    if (!free && price > 0) {
        const myRef = db.ref("users/" + state.user.uid + "/stars");
        const result = await myRef.transaction(function (cur) {
            const v = Number(cur) || 0;
            if (v < price) return;
            return v - price;
        });
        if (!result.committed) throw new Error("Недостаточно звёзд");
    }

    await db.ref().update(updates);

    if (!free && price > 0) {
        await addStars(toUid, price);
        await db.ref("users/" + toUid + "/starsReceived").transaction(function (c) { return (Number(c) || 0) + price; });
    }

    // Публикуем сообщение в чат, чтобы подарок был виден
    if (toUid !== state.user.uid) {
        const chatId = [state.user.uid, toUid].sort().join("_");
        const myChatRef = db.ref("user_chats/" + state.user.uid + "/" + chatId);
        const snap = await myChatRef.once("value");
        if (!snap.exists()) {
            const entry = {
                type: "private",
                partnerId: toUid,
                partnerName: params.toName || params.toUsername || "Пользователь",
                partnerUsername: params.toUsername || "",
                partnerAvatarUrl: "",
                partnerBio: "",
                lastMessage: "",
                lastTimestamp: now,
                readAt: now,
            };
            await myChatRef.set(entry);
            await db.ref("user_chats/" + toUid + "/" + chatId).update({
                type: "private",
                partnerId: state.user.uid,
                partnerName: state.profile.nickname,
                partnerUsername: state.profile.username,
                partnerAvatarUrl: state.profile.avatarUrl || "",
                partnerBio: state.profile.bio || "",
            }).catch(function () {});
            state.chats[chatId] = entry;
        }
        await pushMessage(chatId, {
            type: "gift",
            giftId: gift.id,
            giftEmoji: gift.emoji,
            giftName: gift.name,
            giftPrice: price,
            giftMessage: messageText,
        });
    }

    return { giftPushId: giftPushId, gift: gift };
}

/* ===== PANEL ===== */

let giftsBackHandler = null;

function openGiftsPanel(targetUser) {
    closeDrawer();
    giftsBackHandler = null;
    $("giftsPanel").classList.add("open");
    $("giftsPanel").setAttribute("aria-hidden", "false");
    $("giftsOverlay").classList.remove("hidden");

    if (targetUser) {
        renderGiftSend(targetUser);
    } else {
        renderGiftsMain();
    }
}

function closeGiftsPanel() {
    $("giftsPanel").classList.remove("open");
    $("giftsPanel").setAttribute("aria-hidden", "true");
    $("giftsOverlay").classList.add("hidden");
}

function openGiftsSub(title, renderFn) {
    giftsBackHandler = renderGiftsMain;
    $("giftsTitle").textContent = title;
    $("giftsBackBtn").classList.remove("hidden");
    renderFn();
}

function renderGiftsMain() {
    giftsBackHandler = null;
    $("giftsTitle").textContent = "Подарки";
    $("giftsBackBtn").classList.add("hidden");
    $("giftsBody").replaceChildren(
        h("div", { class: "gift-balance-hero" },
            h("div", { class: "gift-stars-icon" }, "⭐"),
            h("div", { class: "gift-balance-value", text: (state.stars || 0).toLocaleString("ru-RU") }),
            h("div", { class: "gift-balance-label", text: "звёзд на балансе" })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Мои подарки" }),
            settingRow("star", "Отправить подарок", "Выбрать получателя по @username", function () { openGiftsSub("Отправить подарок", renderGiftCompose); }),
            settingRow("archive", "История отправленных", "Что я подарил", function () { openGiftsSub("Отправленные", renderGiftsSent); }),
            settingRow("bookmark", "История полученных", "Что подарили мне", function () { openGiftsSub("Полученные", renderGiftsReceived); })
        ),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Купить звёзды" }),
            h("p", { class: "field-hint", style: "padding: 0 14px 8px", text: "Звёзды можно получить только от других пользователей или от администратора." })
        )
    );
}

function renderGiftCompose() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});
    const contacts = contactsFromChats();
    const contactList = h("div", { class: "pick-list" }, contacts.map(function (u) {
        return userRow(u, function () {
            openGiftSendTo({ uid: u.uid, nickname: u.nickname, username: u.username, avatarUrl: u.avatarUrl });
        });
    }));
    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { result.replaceChildren(); return; }
        result.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (normalizeUsername(input.value) !== q) return;
        result.replaceChildren(user
            ? userRow(user, function () { openGiftSendTo(user); })
            : h("p", { class: "field-hint", text: "Пользователь @" + q + " не найден" }));
    }, 300);
    input.addEventListener("input", search);

    const body = [
        h("label", { class: "tg-field" }, input, h("span", { text: "Username получателя" })),
        result
    ];
    if (contacts.length) {
        body.push(h("div", { class: "section-title", style: "padding-left:12px", text: "Контакты" }));
        body.push(contactList);
    }
    $("giftsBody").replaceChildren.apply($("giftsBody"), body);
    setTimeout(function () { input.focus(); }, 100);
}

function openGiftSendTo(user) {
    giftsBackHandler = renderGiftsMain;
    $("giftsTitle").textContent = "Подарить " + (user.nickname || user.username);
    $("giftsBackBtn").classList.remove("hidden");
    renderGiftSend(user);
}

function renderGiftSend(user) {
    let selectedGift = null;

    const grid = h("div", { class: "gift-grid" }, GIFT_CATALOG.map(function (g) {
        const available = (state.stars || 0) >= g.price;
        const node = h("button", {
            class: "gift-card tier-" + g.tier + (available ? "" : " disabled"),
            dataset: { giftId: g.id },
            onclick: function () {
                if (!available) return toast("Недостаточно звёзд");
                selectedGift = g;
                grid.querySelectorAll(".gift-card").forEach(function (n) { n.classList.remove("selected"); });
                node.classList.add("selected");
                updatePreview();
            }
        },
            h("span", { class: "gift-emoji", text: g.emoji }),
            h("span", { class: "gift-name", text: g.name }),
            h("span", { class: "gift-price" }, "⭐ ", g.price.toLocaleString("ru-RU"))
        );
        return node;
    }));

    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const preview = h("div", { class: "gift-preview" }, h("span", { class: "field-hint", text: "Выберите подарок выше" }));
    const sendBtn = h("button", { class: "tg-btn primary", disabled: true }, "Отправить подарок");

    function updatePreview() {
        preview.replaceChildren();
        if (!selectedGift) {
            preview.appendChild(h("span", { class: "field-hint", text: "Выберите подарок выше" }));
            sendBtn.disabled = true;
            return;
        }
        preview.append(
            h("span", { class: "gift-preview-emoji", text: selectedGift.emoji }),
            h("div", { class: "gift-preview-info" },
                h("strong", { text: selectedGift.name }),
                h("small", {}, "Будет списано ⭐ " + selectedGift.price.toLocaleString("ru-RU"))
            )
        );
        sendBtn.disabled = false;
    }

    sendBtn.addEventListener("click", async function () {
        if (!selectedGift) return;
        sendBtn.disabled = true;
        try {
            await sendGift({
                toUid: user.uid,
                toName: user.nickname || user.username,
                toUsername: user.username,
                giftId: selectedGift.id,
                message: messageInput.value.trim(),
            });
            toast("Подарок отправлен " + (user.nickname || user.username));
            closeGiftsPanel();
        } catch (e) {
            toast(e.message || "Ошибка отправки");
            sendBtn.disabled = false;
        }
    });

    $("giftsBody").replaceChildren(
        h("div", { class: "gift-recipient" },
            avatarEl(user.nickname || user.username, user.avatarUrl, "large", { key: user.uid }),
            h("div", { class: "gift-recipient-info" },
                h("strong", { text: user.nickname || user.username }),
                h("small", {}, "@" + user.username)
            )
        ),
        h("div", { class: "gift-balance-mini" }, "⭐ Ваш баланс: ", h("strong", { text: (state.stars || 0).toLocaleString("ru-RU") })),
        grid,
        h("label", { class: "tg-field", style: "margin: 8px 12px 4px" }, messageInput, h("span", { text: "Сообщение (необязательно)" })),
        preview,
        h("div", { style: "padding: 8px 12px 20px" }, sendBtn)
    );
}

async function renderGiftsSent() {
    $("giftsBody").replaceChildren(h("div", { class: "list-empty", text: "Загрузка…" }));
    const snap = await db.ref("gifts_sent/" + state.user.uid).orderByChild("timestamp").limitToLast(100).once("value");
    const items = [];
    snap.forEach(function (child) { items.push(Object.assign({ id: child.key }, child.val())); });
    items.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    if (!items.length) {
        $("giftsBody").replaceChildren(h("div", { class: "list-empty" },
            h("strong", { text: "Пока пусто" }),
            "Вы ещё никому не дарили подарки."));
        return;
    }
    $("giftsBody").replaceChildren.apply($("giftsBody"), items.map(giftHistoryRow("→", function (g) { return g.toName || g.toUsername; })));
}

async function renderGiftsReceived() {
    $("giftsBody").replaceChildren(h("div", { class: "list-empty", text: "Загрузка…" }));
    const snap = await db.ref("gifts_received/" + state.user.uid).orderByChild("timestamp").limitToLast(100).once("value");
    const items = [];
    snap.forEach(function (child) { items.push(Object.assign({ id: child.key }, child.val())); });
    items.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    if (!items.length) {
        $("giftsBody").replaceChildren(h("div", { class: "list-empty" },
            h("strong", { text: "Пока пусто" }),
            "Вам ещё никто не дарил подарки."));
        return;
    }
    $("giftsBody").replaceChildren.apply($("giftsBody"), items.map(giftHistoryRow("←", function (g) { return g.fromName || g.fromUsername; })));
}

function giftHistoryRow(arrow, getName) {
    return function (g) {
        return h("div", { class: "gift-history-row" },
            h("span", { class: "gift-history-emoji", text: g.giftEmoji || "🎁" }),
            h("div", { class: "gift-history-info" },
                h("strong", { text: g.giftName || "Подарок" }),
                h("small", {},
                    arrow + " ",
                    getName(g) || "—",
                    " · ",
                    new Date(g.timestamp || 0).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                ),
                g.message ? h("em", { class: "gift-history-msg", text: '"' + g.message + '"' }) : null
            ),
            h("span", { class: "gift-history-price", text: "⭐ " + (g.price || 0).toLocaleString("ru-RU") })
        );
    };
}

/* ===== BIND ===== */

function bindGiftsUI() {
    const overlay = $("giftsOverlay");
    const closeBtn = $("giftsCloseBtn");
    const backBtn = $("giftsBackBtn");
    if (overlay) overlay.addEventListener("click", closeGiftsPanel);
    if (closeBtn) closeBtn.addEventListener("click", closeGiftsPanel);
    if (backBtn) backBtn.addEventListener("click", function () {
        if (typeof giftsBackHandler === "function" && giftsBackHandler) giftsBackHandler();
        else closeGiftsPanel();
    });

    const chatGiftBtn = $("chatGiftBtn");
    if (chatGiftBtn) chatGiftBtn.addEventListener("click", function () {
        const entry = state.activeChat;
        if (!entry || entry.type !== "private" || !entry.partnerId) {
            return toast("Подарки можно дарить только в личных чатах");
        }
        const partner = partnerProfile || {
            uid: entry.partnerId,
            nickname: entry.partnerName,
            username: entry.partnerUsername,
            avatarUrl: entry.partnerAvatarUrl,
        };
        openGiftsPanel({ uid: partner.uid, nickname: partner.nickname, username: partner.username, avatarUrl: partner.avatarUrl });
    });
}