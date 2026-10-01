/* ===== ОБЫЧНЫЕ ПОДАРКИ (emoji) ===== */

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

/* ===== NFT-ПОДАРКИ ===== */

/**
 * NFT-подарки. Картинки кладутся в pic_gift/{id}_{rarity}.png
 * где rarity = 1..5 (1=обычный, 2=редкий, 3=эпический, 4=легендарный, 5=мифический).
 * Если картинки нет — fallback на emoji.
 */
const NFT_CATALOG = [
    { id: "nft_rose",     name: "Роза",       emoji: "🌹", basePrice: 100,   supply: 500 },
    { id: "nft_rocket",   name: "Ракета",     emoji: "🚀", basePrice: 500,   supply: 300 },
    { id: "nft_ring",     name: "Кольцо",     emoji: "💍", basePrice: 1000,  supply: 200 },
    { id: "nft_crown",    name: "Корона",     emoji: "👑", basePrice: 2500,  supply: 150 },
    { id: "nft_diamond",  name: "Алмаз",      emoji: "💎", basePrice: 5000,  supply: 100 },
    { id: "nft_heart",    name: "Сердце",     emoji: "💖", basePrice: 7500,  supply: 75 },
    { id: "nft_planet",   name: "Планета",    emoji: "🪐", basePrice: 10000, supply: 50 },
    { id: "nft_dragon",   name: "Дракон",     emoji: "🐉", basePrice: 25000, supply: 25 },
    { id: "nft_phoenix",  name: "Феникс",     emoji: "🔥", basePrice: 50000, supply: 15 },
    { id: "nft_galaxy",   name: "Галактика",  emoji: "🌌", basePrice: 100000, supply: 5 },
];

/**
 * Уровни редкости NFT.
 * weight — шанс выпадения при отправке (сумма = 100).
 * multiplier — множитель цены.
 * CSS применяет цвет свечения по color.
 */
const NFT_RARITY = {
    1: { level: 1, id: "common",    label: "Обычный",     color: "#8a9aab", weight: 60, multiplier: 1 },
    2: { level: 2, id: "rare",      label: "Редкий",      color: "#4a9eff", weight: 25, multiplier: 2 },
    3: { level: 3, id: "epic",      label: "Эпический",   color: "#a855f7", weight: 10, multiplier: 5 },
    4: { level: 4, id: "legendary", label: "Легендарный", color: "#f59e0b", weight: 4,  multiplier: 15 },
    5: { level: 5, id: "mythic",    label: "Мифический",  color: "#e53935", weight: 1,  multiplier: 50 },
};

function getNFTById(id) {
    return NFT_CATALOG.find(function (g) { return g.id === id; }) || null;
}

function getRarity(level) {
    return NFT_RARITY[level] || NFT_RARITY[1];
}

/**
 * Ролл редкости по весам.
 * @returns {number} уровень 1..5
 */
function rollRarity() {
    const r = Math.random() * 100;
    let acc = 0;
    const levels = [1, 2, 3, 4, 5];
    for (let i = 0; i < levels.length; i++) {
        acc += NFT_RARITY[levels[i]].weight;
        if (r < acc) return levels[i];
    }
    return 1;
}

/**
 * Резервируем следующий серийный номер для NFT подарка (atomic).
 * Возвращает { serial, total } где serial — от 1, total — всего выпущено.
 */
async function reserveNFTSerial(giftId, maxSupply) {
    const ref = db.ref("nft_counters/" + giftId);
    const result = await ref.transaction(function (current) {
        const v = Number(current) || 0;
        if (v >= maxSupply) return; // распродано
        return v + 1;
    });
    if (!result.committed) throw new Error("Все экземпляры этого NFT распроданы");
    return { serial: result.snapshot.val(), total: maxSupply };
}

/* ===== БАЛАНС ===== */

let giftsListeners = [];

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
        return Math.max(0, v + amount);
    });
}

async function setStars(uid, amount) {
    const v = Math.max(0, Math.floor(Number(amount) || 0));
    await db.ref("users/" + uid + "/stars").set(v);
}

/* ===== ОТПРАВКА ОБЫЧНОГО ПОДАРКА ===== */

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

    if (toUid !== state.user.uid) {
        await publishGiftMessage(toUid, {
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

/* ===== ОТПРАВКА NFT-ПОДАРКА ===== */

/**
 * Отправка NFT-подарка.
 * - Роллит редкость по весам.
 * - Резервирует серийный номер.
 * - Списывает звёзды у отправителя (basePrice × multiplier).
 * - Пишет в nft_items.
 * - Публикует сообщение в чат.
 */
async function sendNFTGift(params) {
    const toUid = params.toUid;
    const gift = getNFTById(params.giftId);
    if (!gift) throw new Error("NFT подарок не найден");
    if (!toUid) throw new Error("Получатель не указан");
    const free = !!params.free;
    if (toUid === state.user.uid && !free) throw new Error("Нельзя дарить подарки себе");

    
 // 1. Ролл редкости (если передан forcedRarity — используем его)
    const rarityLevel = params.forcedRarity ? Number(params.forcedRarity) : rollRarity();
    const rarity = getRarity(rarityLevel);
    const price = Math.round(gift.basePrice * rarity.multiplier);

    if (!free && (state.stars || 0) < price) throw new Error("Недостаточно звёзд: нужно ⭐ " + price.toLocaleString("ru-RU"));

    // 2. Резерв серийника
    const reserved = await reserveNFTSerial(gift.id, gift.supply);
    const serial = reserved.serial;
    const total = reserved.total;

    const now = Date.now();
    const itemId = db.ref("nft_items").push().key;
    const messageText = (params.message || "").trim().slice(0, 200);

    const item = {
        itemId: itemId,
        giftId: gift.id,
        giftName: gift.name,
        rarityLevel: rarityLevel,
        rarityId: rarity.id,
        rarityLabel: rarity.label,
        rarityColor: rarity.color,
        serial: serial,
        supply: total,
        price: price,
        ownerUid: toUid,
        fromUid: state.user.uid,
        fromName: state.profile.nickname || state.profile.username,
        fromUsername: state.profile.username,
        message: messageText,
        createdAt: now,
        free: free,
    };

    // 3. Списание звёзд
    if (!free && price > 0) {
        const myRef = db.ref("users/" + state.user.uid + "/stars");
        const result = await myRef.transaction(function (cur) {
            const v = Number(cur) || 0;
            if (v < price) return;
            return v - price;
        });
        if (!result.committed) throw new Error("Недостаточно звёзд");
    }

    // 4. Запись в базу
    const updates = {};
    updates["nft_items/" + itemId] = item;
    updates["nft_sent/" + state.user.uid + "/" + itemId] = { itemId: itemId, timestamp: now };
    updates["nft_received/" + toUid + "/" + itemId] = { itemId: itemId, timestamp: now };
    await db.ref().update(updates);

    // 5. Начисление звёзд получателю (опционально — можно половину)
    if (!free && price > 0) {
        await addStars(toUid, Math.round(price * 0.5));
    }

    // 6. Сообщение в чат
    if (toUid !== state.user.uid) {
        await publishGiftMessage(toUid, {
            type: "nft",
            nftItemId: itemId,
            nftId: gift.id,
            nftName: gift.name,
            nftEmoji: gift.emoji,
            nftRarity: rarityLevel,
            nftRarityId: rarity.id,
            nftRarityLabel: rarity.label,
            nftRarityColor: rarity.color,
            nftSerial: serial,
            nftSupply: total,
            nftPrice: price,
            nftMessage: messageText,
        });
    }

    return { itemId: itemId, gift: gift, rarity: rarity, serial: serial, price: price };
}

/**
 * Публикует сообщение-подарок в чат. Если чата нет — создаёт.
 */
async function publishGiftMessage(toUid, payload) {
    const chatId = [state.user.uid, toUid].sort().join("_");
    const myChatRef = db.ref("user_chats/" + state.user.uid + "/" + chatId);
    const snap = await myChatRef.once("value");
    if (!snap.exists()) {
        const entry = {
            type: "private",
            partnerId: toUid,
            partnerName: payload.giftName ? "" : "",
            partnerUsername: "",
            partnerAvatarUrl: "",
            partnerBio: "",
            lastMessage: "",
            lastTimestamp: Date.now(),
            readAt: Date.now(),
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
    await pushMessage(chatId, payload);
}

/* ===== ПАНЕЛЬ ПОДАРКОВ ===== */

let giftsBackHandler = null;
let giftsTab = "regular"; // regular | nft

function openGiftsPanel(targetUser) {
    closeDrawer();
    giftsBackHandler = null;
    $("giftsPanel").classList.add("open");
    $("giftsPanel").setAttribute("aria-hidden", "false");
    $("giftsOverlay").classList.remove("hidden");

    if (targetUser) renderGiftSend(targetUser);
    else renderGiftsMain();
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

    const tabs = h("div", { class: "gifts-tabs" },
        h("button", { class: "gifts-tab " + (giftsTab === "regular" ? "active" : ""), onclick: function () { giftsTab = "regular"; renderGiftsMain(); } }, "Обычные"),
        h("button", { class: "gifts-tab " + (giftsTab === "nft" ? "active" : ""), onclick: function () { giftsTab = "nft"; renderGiftsMain(); } }, "NFT")
    );

    const body = [
        h("div", { class: "gift-balance-hero" },
            h("div", { class: "gift-stars-icon" }, "⭐"),
            h("div", { class: "gift-balance-value", text: (state.stars || 0).toLocaleString("ru-RU") }),
            h("div", { class: "gift-balance-label", text: "звёзд на балансе" })
        ),
        tabs
    ];

    if (giftsTab === "nft") {
        body.push(h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "NFT-коллекция" }),
            settingRow("star", "Магазин NFT", "Уникальные подарки с редкостью", function () { openGiftsSub("NFT-магазин", renderNFTShop); }),
            settingRow("archive", "Мои NFT", "Что я собрал", function () { openGiftsSub("Мои NFT", renderMyNFTs); })
        ));
        body.push(h("p", { class: "field-hint", style: "padding: 0 16px 20px;text-align:center", text: "NFT-подарки имеют 5 уровней редкости и уникальный серийный номер. Редкость определяется случайно при отправке." }));
    } else {
        body.push(h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Мои подарки" }),
            settingRow("star", "Отправить подарок", "Выбрать получателя по @username", function () { openGiftsSub("Отправить подарок", renderGiftCompose); }),
            settingRow("archive", "История отправленных", "Что я подарил", function () { openGiftsSub("Отправленные", renderGiftsSent); }),
            settingRow("bookmark", "История полученных", "Что подарили мне", function () { openGiftsSub("Полученные", renderGiftsReceived); })
        ));
    }

    $("giftsBody").replaceChildren.apply($("giftsBody"), body);
}

/* --- ОБЫЧНЫЕ: отправить --- */

function renderGiftCompose() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});
    const contacts = contactsFromChats();
    const contactList = h("div", { class: "pick-list" }, contacts.map(function (u) {
        return userRow(u, function () { openGiftSendTo({ uid: u.uid, nickname: u.nickname, username: u.username, avatarUrl: u.avatarUrl }); });
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
            toast("Подарок отправлен");
            closeGiftsPanel();
        } catch (e) {
            toast(e.message || "Ошибка");
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

/* --- ОБЫЧНЫЕ: истории --- */

async function renderGiftsSent() {
    $("giftsBody").replaceChildren(h("div", { class: "list-empty", text: "Загрузка…" }));
    const snap = await db.ref("gifts_sent/" + state.user.uid).orderByChild("timestamp").limitToLast(100).once("value");
    const items = [];
    snap.forEach(function (child) { items.push(Object.assign({ id: child.key }, child.val())); });
    items.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    if (!items.length) {
        $("giftsBody").replaceChildren(h("div", { class: "list-empty" }, h("strong", { text: "Пока пусто" }), "Вы ещё никому не дарили подарки."));
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
        $("giftsBody").replaceChildren(h("div", { class: "list-empty" }, h("strong", { text: "Пока пусто" }), "Вам ещё никто не дарил подарки."));
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
                h("small", {}, arrow + " ", getName(g) || "—", " · ",
                    new Date(g.timestamp || 0).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })),
                g.message ? h("em", { class: "gift-history-msg", text: '"' + g.message + '"' }) : null
            ),
            h("span", { class: "gift-history-price", text: "⭐ " + (g.price || 0).toLocaleString("ru-RU") })
        );
    };
}

/* --- NFT: магазин --- */

function renderNFTShop() {
    const grid = h("div", { class: "nft-grid" }, NFT_CATALOG.map(function (g) {
        const img = h("img", { class: "nft-img", src: "pic_gift/" + g.id + "_1.png", alt: g.name, onerror: function () { this.style.display = "none"; } });
        return h("button", {
            class: "nft-card",
            onclick: function () { renderNFTSend(g); }
        },
            h("div", { class: "nft-img-wrap" },
                img,
                h("span", { class: "nft-emoji-fallback", text: g.emoji })
            ),
            h("div", { class: "nft-name", text: g.name }),
            h("div", { class: "nft-price" }, "от ⭐ ", g.basePrice.toLocaleString("ru-RU"))
        );
    }));

    $("giftsBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 16px 12px;text-align:center", text: "Редкость выпадает случайно: 60% / 25% / 10% / 4% / 1%. Чем выше — тем дороже и красивее." }),
        grid
    );
}

/* --- NFT: отправка --- */

function renderNFTSend(gift) {
    giftsBackHandler = function () { openGiftsSub("NFT-магазин", renderNFTShop); };
    $("giftsTitle").textContent = gift.name;
    $("giftsBackBtn").classList.remove("hidden");

    // Роллим редкость заранее, чтобы показать цену
    const previewRarity = rollRarity();
    const previewRarityInfo = getRarity(previewRarity);

    const img = h("img", { class: "nft-preview-img", src: "pic_gift/" + gift.id + "_" + previewRarity + ".png", alt: gift.name, onerror: function () { this.style.display = "none"; } });
    const emojiFallback = h("span", { class: "nft-preview-emoji", text: gift.emoji });

    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});
    let targetUser = null;

    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { result.replaceChildren(); targetUser = null; updateBtn(); return; }
        result.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (normalizeUsername(input.value) !== q) return;
        targetUser = user;
        result.replaceChildren(user
            ? userRow(user, function () { targetUser = user; })
            : h("p", { class: "field-hint error", text: "Пользователь @" + q + " не найден" }));
        updateBtn();
    }, 300);
    input.addEventListener("input", search);

    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const btn = h("button", { class: "tg-btn primary", disabled: true }, "Отправить за ⭐ " + (gift.basePrice * previewRarityInfo.multiplier).toLocaleString("ru-RU"));

    function updateBtn() {
        const price = gift.basePrice * previewRarityInfo.multiplier;
        const can = targetUser && (state.stars || 0) >= price;
        btn.disabled = !can;
        btn.textContent = "Отправить за ⭐ " + price.toLocaleString("ru-RU") +
            (!can && targetUser ? " (недостаточно)" : "");
    }

    btn.addEventListener("click", async function () {
        if (!targetUser) return;
        btn.disabled = true;
        try {
            const res = await sendNFTGift({
                toUid: targetUser.uid,
                toName: targetUser.nickname || targetUser.username,
                toUsername: targetUser.username,
                giftId: gift.id,
                message: messageInput.value.trim(),
            });
            toast("Подарок выпал: " + res.rarity.label + " #" + res.serial);
            closeGiftsPanel();
        } catch (e) {
            toast(e.message || "Ошибка");
            btn.disabled = false;
        }
    });

    $("giftsBody").replaceChildren(
        h("div", { class: "nft-preview-card rarity-" + previewRarityInfo.id },
            h("div", { class: "nft-preview-img-wrap" }, img, emojiFallback),
            h("div", { class: "nft-preview-name", text: gift.name }),
            h("div", { class: "nft-preview-rarity", style: "color:" + previewRarityInfo.color, text: previewRarityInfo.label }),
            h("div", { class: "nft-preview-hint", text: "Редкость будет выбрана случайно при отправке" })
        ),
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username получателя" })),
        result,
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, messageInput, h("span", { text: "Сообщение (необязательно)" })),
        h("div", { style: "padding: 8px 12px 20px" }, btn)
    );
}

/* --- NFT: мои --- */

async function renderMyNFTs() {
    $("giftsBody").replaceChildren(h("div", { class: "list-empty", text: "Загрузка…" }));
    const snap = await db.ref("nft_items").orderByChild("ownerUid").equalTo(state.user.uid).once("value");
    const items = [];
    snap.forEach(function (c) { items.push(Object.assign({ id: c.key }, c.val())); });
    items.sort(function (a, b) { return (b.rarityLevel || 0) - (a.rarityLevel || 0) || (b.createdAt || 0) - (a.createdAt || 0); });

    if (!items.length) {
        $("giftsBody").replaceChildren(h("div", { class: "list-empty" },
            h("strong", { text: "Пока пусто" }),
            "Вам ещё не дарили NFT. Откройте магазин, чтобы подарить кому-то."));
        return;
    }
    $("giftsBody").replaceChildren.apply($("giftsBody"), items.map(function (it) {
        const r = getRarity(it.rarityLevel);
        const img = h("img", { class: "nft-history-img", src: "pic_gift/" + it.giftId + "_" + it.rarityLevel + ".png", alt: it.giftName, onerror: function () { this.style.display = "none"; } });
        return h("div", { class: "nft-history-row" },
            h("div", { class: "nft-history-img-wrap rarity-" + r.id }, img),
            h("div", { class: "nft-history-info" },
                h("strong", { text: it.giftName }),
                h("small", { style: "color:" + r.color, text: r.label }),
                h("small", { text: "Серийный №" + it.serial + "/" + it.supply }),
                it.fromName ? h("small", { text: "от " + it.fromName }) : null
            )
        );
    }));
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