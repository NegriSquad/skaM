/* =====================================================
   ADMIN PANEL
   ===================================================== */

let adminBackHandler = null;

function openAdminPanel() {
    if (!state.isAdmin) return toast("Доступ только для администратора");
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
            h("div", { class: "settings-group-title", text: "Префиксы" }),
            settingRow("star", "Управление префиксами", "Admin / Dev / Scam / Лох", function () { openAdminSub("Префиксы", renderAdminPrefixes); })
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
    const amountInput = h("input", { type: "number", placeholder: " ", min: 1, step: 1, value: 100, class: "tg-field-date", style: "height: 48px;padding: 0 14px" });
    const currentEl = h("div", { class: "admin-current" }, "Текущий баланс: ⭐ ", h("strong", { text: (state.stars || 0).toLocaleString("ru-RU") }));

    const giveBtn = h("button", { class: "tg-btn primary", onclick: async function () {
        const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
        try { await addStars(state.user.uid, n); toast("Начислено ⭐ " + n.toLocaleString("ru-RU")); renderAdminStarsSelf(); }
        catch (e) { toast("Ошибка: " + e.message); }
    }}, "Начислить");

    const takeBtn = h("button", { class: "tg-btn danger", onclick: async function () {
        const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
        try { await addStars(state.user.uid, -n); toast("Списано ⭐ " + n.toLocaleString("ru-RU")); renderAdminStarsSelf(); }
        catch (e) { toast("Ошибка: " + e.message); }
    }}, "Списать");

    const setBtn = h("button", { class: "tg-btn", onclick: async function () {
        const n = Math.max(0, Math.floor(Number(amountInput.value) || 0));
        try { await setStars(state.user.uid, n); toast("Установлено ⭐ " + n.toLocaleString("ru-RU")); renderAdminStarsSelf(); }
        catch (e) { toast("Ошибка: " + e.message); }
    }}, "Установить точно");

    const quick = function (n) { return h("button", { class: "admin-quick", text: "+" + n, onclick: function () { amountInput.value = n; } }); };

    $("adminBody").replaceChildren(
        currentEl,
        h("div", { style: "padding: 0 12px 8px" }, amountInput),
        h("div", { class: "admin-quick-buttons" }, quick(100), quick(500), quick(1000), quick(5000), quick(10000)),
        h("div", { class: "admin-actions" }, giveBtn, takeBtn, setBtn)
    );
}

/* ===== STARS: USER ===== */

function renderAdminStarsUser() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const infoBox = h("div", { class: "admin-info" });
    const amountInput = h("input", { type: "number", placeholder: " ", min: 1, step: 1, value: 100, class: "tg-field-date", style: "height: 48px;padding: 0 14px" });
    let targetUser = null;
    const actionRow = h("div", { class: "admin-actions hidden" });

    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { infoBox.replaceChildren(); actionRow.classList.add("hidden"); return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: "@" + q + " не найден" }));
            actionRow.classList.add("hidden");
            return;
        }
        targetUser = user;
        const starsSnap = await db.ref("users/" + user.uid + "/stars").once("value");
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
            h("button", { class: "tg-btn primary", onclick: async function () {
                if (!targetUser) return;
                const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
                await addStars(targetUser.uid, n);
                toast("@" + targetUser.username + ": +" + n);
                search();
            }}, "Начислить"),
            h("button", { class: "tg-btn danger", onclick: async function () {
                if (!targetUser) return;
                const n = Math.max(1, Math.floor(Number(amountInput.value) || 0));
                await addStars(targetUser.uid, -n);
                toast("@" + targetUser.username + ": -" + n);
                search();
            }}, "Списать"),
            h("button", { class: "tg-btn", onclick: async function () {
                if (!targetUser) return;
                const n = Math.max(0, Math.floor(Number(amountInput.value) || 0));
                await setStars(targetUser.uid, n);
                toast("@" + targetUser.username + ": ⭐ " + n);
                search();
            }}, "Установить")
        );
    }, 400);
    input.addEventListener("input", search);

    const quick = function (n) { return h("button", { class: "admin-quick", text: "+" + n, onclick: function () { amountInput.value = n; } }); };

    $("adminBody").replaceChildren(
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username" })),
        infoBox,
        h("div", { style: "padding: 0 12px 8px" }, amountInput),
        h("div", { class: "admin-quick-buttons" }, quick(100), quick(500), quick(1000), quick(5000), quick(10000)),
        actionRow
    );
}

/* ===== GIFT: SELF ===== */

function renderAdminGiftSelf() {
    let selectedGift = null;
    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const grid = h("div", { class: "gift-grid" }, GIFT_CATALOG.map(function (g) {
        return h("button", {
            class: "gift-card tier-" + g.tier,
            onclick: function () {
                selectedGift = g;
                grid.querySelectorAll(".gift-card").forEach(function (n) { n.classList.remove("selected"); });
                this.classList.add("selected");
            }
        },
            h("span", { class: "gift-emoji", text: g.emoji }),
            h("span", { class: "gift-name", text: g.name }),
            h("span", { class: "gift-price", text: "(бесплатно)" })
        );
    }));
    const btn = h("button", { class: "tg-btn primary", onclick: async function () {
        if (!selectedGift) return toast("Выберите подарок");
        try {
            await sendGift({ toUid: state.user.uid, toName: state.profile.nickname, toUsername: state.profile.username, giftId: selectedGift.id, message: messageInput.value.trim(), free: true });
            toast("Подарок «" + selectedGift.name + "» добавлен вам");
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
    let selectedGift = null;
    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const gridWrap = h("div");

    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { infoBox.replaceChildren(); gridWrap.replaceChildren(); targetUser = null; return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: "@" + q + " не найден" }));
            gridWrap.replaceChildren();
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

    function renderGrid(user) {
        selectedGift = null;
        const grid = h("div", { class: "gift-grid" }, GIFT_CATALOG.map(function (g) {
            return h("button", {
                class: "gift-card tier-" + g.tier,
                onclick: function () {
                    selectedGift = g;
                    grid.querySelectorAll(".gift-card").forEach(function (n) { n.classList.remove("selected"); });
                    this.classList.add("selected");
                }
            },
                h("span", { class: "gift-emoji", text: g.emoji }),
                h("span", { class: "gift-name", text: g.name }),
                h("span", { class: "gift-price", text: "(бесплатно)" })
            );
        }));
        const sendBtn = h("button", { class: "tg-btn primary", onclick: async function () {
            if (!selectedGift) return toast("Выберите подарок");
            try {
                await sendGift({ toUid: user.uid, toName: user.nickname || user.username, toUsername: user.username, giftId: selectedGift.id, message: messageInput.value.trim(), free: true });
                toast("Подарок отправлен @" + user.username);
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

/* ===== NFT: FORM ===== */

function renderAdminNFTForm(targetLabel, onSend) {
    let selectedGift = NFT_CATALOG[0];
    let selectedRarity = 5;

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
                h("img", { class: "nft-img", src: "pic_gift/" + g.id + "_" + selectedRarity + ".png", alt: g.name, onerror: function () { this.style.display = "none"; } }),
                h("span", { class: "nft-emoji-fallback", text: g.emoji })
            ),
            h("div", { class: "nft-name", text: g.name }),
            h("div", { class: "nft-price" }, "от ⭐ ", g.basePrice.toLocaleString("ru-RU"))
        );
        grid.appendChild(node);
    });

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
                grid.querySelectorAll(".nft-card").forEach(function (n, i) {
                    const g = NFT_CATALOG[i];
                    const img = n.querySelector(".nft-img");
                    if (img) { img.style.display = ""; img.src = "pic_gift/" + g.id + "_" + level + ".png"; }
                });
                updatePreview();
            }
        },
            h("span", { class: "admin-rarity-dot", style: "background:" + r.color }),
            h("span", { class: "admin-rarity-label", text: r.label })
        );
        rarityRow.appendChild(btn);
    });

    const preview = h("div", { class: "admin-nft-preview" });
    const messageInput = h("input", { type: "text", placeholder: " ", maxlength: 200 });
    const sendBtn = h("button", { class: "tg-btn primary" }, "Отправить");

    function updatePreview() {
        const r = getRarity(selectedRarity);
        const price = Math.round(selectedGift.basePrice * r.multiplier);
        preview.replaceChildren(
            h("div", { class: "admin-nft-preview-img-wrap rarity-" + r.id },
                h("img", { class: "admin-nft-preview-img", src: "pic_gift/" + selectedGift.id + "_" + selectedRarity + ".png", alt: selectedGift.name, onerror: function () { this.style.display = "none"; } }),
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
        try { await onSend(selectedGift.id, selectedRarity, messageInput.value.trim()); }
        catch (e) { toast(e.message || "Ошибка"); }
        finally { sendBtn.disabled = false; }
    });

    updatePreview();

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px;text-align:center", text: "Получатель: " + targetLabel }),
        h("div", { class: "settings-group" }, h("div", { class: "settings-group-title", text: "1. Выберите NFT" }), grid),
        h("div", { class: "settings-group" }, h("div", { class: "settings-group-title", text: "2. Выберите редкость" }), rarityRow),
        h("div", { class: "settings-group" }, h("div", { class: "settings-group-title", text: "3. Проверьте" }), preview),
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, messageInput, h("span", { text: "Сообщение (необязательно)" })),
        h("div", { style: "padding: 8px 12px 24px" }, sendBtn)
    );
}

function renderAdminNFTSelf() {
    renderAdminNFTForm("себе (@" + state.profile.username + ")", async function (giftId, rarity, message) {
        await sendNFTGift({ toUid: state.user.uid, toName: state.profile.nickname, toUsername: state.profile.username, giftId: giftId, message: message, free: true, forcedRarity: rarity });
        const gift = getNFTById(giftId);
        const r = getRarity(rarity);
        toast("Себе: " + gift.name + " · " + r.label);
    });
}

function renderAdminNFTUser() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const result = h("div", {});
    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { result.replaceChildren(); return; }
        result.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (normalizeUsername(input.value) !== q) return;
        result.replaceChildren(user ? userRow(user, function () { openNFTSendToUser(user); }) : h("p", { class: "field-hint error", text: "Пользователь @" + q + " не найден" }));
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
        await sendNFTGift({ toUid: user.uid, toName: user.nickname || user.username, toUsername: user.username, giftId: giftId, message: message, free: true, forcedRarity: rarity });
        const gift = getNFTById(giftId);
        const r = getRarity(rarity);
        toast(gift.name + " · " + r.label + " → @" + user.username);
    });
}

/* ===== PREFIXES ===== */

function renderAdminPrefixes() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const infoBox = h("div", { class: "admin-info" });
    let targetUser = null;

    const currentPrefixLabel = function (uid) {
        const key = state.prefixes && state.prefixes[uid];
        if (!key || !PREFIX_DEFS[key]) return "нет";
        return PREFIX_DEFS[key].label;
    };

    const actionRow = h("div", { class: "prefix-actions hidden" });

    const refreshUserInfo = async function () {
        if (!targetUser) { infoBox.replaceChildren(); return; }
        const u = await getUser(targetUser.uid).catch(function () { return null; });
        if (!u) return;
        const pref = prefixBadge(targetUser.uid);
        const nameEl = h("strong", {});
        if (pref) nameEl.appendChild(pref);
        nameEl.appendChild(h("span", { text: u.nickname || u.username }));
        infoBox.replaceChildren(
            h("div", { class: "admin-user-row" },
                avatarEl(u.nickname || u.username, u.avatarUrl, "small", { key: u.uid }),
                h("div", { class: "admin-user-info" },
                    nameEl,
                    h("small", { text: "@" + u.username + " · префикс: " + currentPrefixLabel(u.uid) })
                )
            )
        );
    };

    const updateActions = function () {
        if (!targetUser) { actionRow.classList.add("hidden"); actionRow.replaceChildren(); return; }
        actionRow.classList.remove("hidden");
        actionRow.replaceChildren();
        actionRow.appendChild(h("button", {
            class: "prefix-btn prefix-btn-none",
            onclick: async function () {
                try {
                    await db.ref("user_prefixes/" + targetUser.uid).remove();
                    delete state.prefixes[targetUser.uid];
                    toast("Префикс убран");
                    updateActions(); refreshUserInfo();
                } catch (e) { toast(friendlyError(e)); }
            }
        }, "Убрать"));
        Object.keys(PREFIX_DEFS).forEach(function (key) {
            const def = PREFIX_DEFS[key];
            const active = state.prefixes && state.prefixes[targetUser.uid] === key;
            actionRow.appendChild(h("button", {
                class: "prefix-btn" + (active ? " active" : ""),
                style: "background:" + def.color + ";",
                onclick: async function () {
                    try {
                        await db.ref("user_prefixes/" + targetUser.uid).set(key);
                        state.prefixes[targetUser.uid] = key;
                        toast("Префикс " + def.label + " выдан @" + targetUser.username);
                        updateActions(); refreshUserInfo();
                    } catch (e) { toast(friendlyError(e)); }
                }
            }, def.label));
        });
    };

    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { targetUser = null; infoBox.replaceChildren(); actionRow.classList.add("hidden"); return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: "Пользователь @" + q + " не найден" }));
            actionRow.classList.add("hidden");
            return;
        }
        targetUser = user;
        await refreshUserInfo();
        updateActions();
    }, 400);
    input.addEventListener("input", search);

    const allList = h("div", { class: "admin-list" });
    const renderAllList = async function () {
        const entries = Object.entries(state.prefixes || {});
        if (!entries.length) {
            allList.replaceChildren(h("div", { class: "list-empty", text: "Никому ещё не выдан префикс" }));
            return;
        }
        const users = await Promise.all(entries.map(async function (pair) {
            const u = await getUser(pair[0]).catch(function () { return null; });
            return { uid: pair[0], key: pair[1], user: u };
        }));
        allList.replaceChildren.apply(allList, users.filter(function (x) { return x.user && PREFIX_DEFS[x.key]; }).map(function (x) {
            const def = PREFIX_DEFS[x.key];
            return h("div", { class: "admin-list-row" },
                h("span", { style: "display:inline-flex;align-items:center;gap:6px" },
                    h("span", { class: "user-prefix", style: "background:" + def.color, text: def.label }),
                    h("span", { text: "@" + x.user.username })
                ),
                h("button", { class: "admin-list-remove", text: "✕", onclick: async function () {
                    try {
                        await db.ref("user_prefixes/" + x.uid).remove();
                        delete state.prefixes[x.uid];
                        toast("Убран");
                        renderAdminPrefixes();
                    } catch (e) { toast(friendlyError(e)); }
                }})
            );
        }));
    };
    renderAllList();

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px;text-align:center", text: "Префикс отображается в чатах и профиле пользователя" }),
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username" })),
        infoBox,
        actionRow,
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Уже с префиксами" }),
            allList
        )
    );
    setTimeout(function () { input.focus(); }, 100);
}

/* ===== VERIFY ===== */

function renderAdminVerify() {
    const input = h("input", { type: "text", placeholder: " ", autocomplete: "off" });
    const infoBox = h("div", { class: "admin-info" });
    let targetUser = null;

    const verifyBtn = h("button", { class: "tg-btn primary", onclick: async function () {
        if (!targetUser) return;
        try {
            await db.ref("config/verified/" + targetUser.username).set(true);
            state.verifiedUsers.add(targetUser.username);
            toast("@" + targetUser.username + " верифицирован");
            renderAdminVerify();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Выдать галочку");

    const unverifyBtn = h("button", { class: "tg-btn danger", onclick: async function () {
        if (!targetUser) return;
        try {
            await db.ref("config/verified/" + targetUser.username).remove();
            state.verifiedUsers.delete(targetUser.username);
            toast("@" + targetUser.username + ": галочка убрана");
            renderAdminVerify();
        } catch (e) { toast("Ошибка: " + e.message); }
    }}, "Убрать галочку");

    const search = debounce(async function () {
        const q = normalizeUsername(input.value);
        if (q.length < 3) { infoBox.replaceChildren(); return; }
        infoBox.replaceChildren(h("p", { class: "field-hint", text: "Поиск…" }));
        const user = await findUserByUsername(q).catch(function () { return null; });
        if (!user) {
            targetUser = null;
            infoBox.replaceChildren(h("p", { class: "field-hint error", text: "@" + q + " не найден" }));
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

    const listItems = [...state.verifiedUsers].map(function (u) {
        return h("div", { class: "admin-list-row" },
            h("span", { text: "@" + u }),
            h("button", { class: "admin-list-remove", text: "✕", onclick: async function () {
                try {
                    await db.ref("config/verified/" + u).remove();
                    state.verifiedUsers.delete(u);
                    toast("@" + u + " снят");
                    renderAdminVerify();
                } catch (e) { toast("Ошибка"); }
            }})
        );
    });

    $("adminBody").replaceChildren(
        h("label", { class: "tg-field", style: "margin: 8px 12px" }, input, h("span", { text: "Username" })),
        infoBox,
        h("div", { class: "admin-actions" }, verifyBtn, unverifyBtn),
        h("div", { class: "settings-group" },
            h("div", { class: "settings-group-title", text: "Текущие верифицированные" }),
            h("div", { class: "admin-list" }, ...listItems)
        )
    );
}

/* ===== STATS ===== */

async function renderAdminStats() {
    $("adminBody").replaceChildren(h("div", { class: "list-empty", text: "Считаем…" }));
    try {
        const usersSnap = await db.ref("users").once("value");
        const chatsSnap = await db.ref("user_chats").once("value");
        const usersCount = usersSnap.numChildren();
        const chatsCount = chatsSnap.numChildren();
        let messagesCount = 0;
        const msgsSnap = await db.ref("private_messages").once("value");
        msgsSnap.forEach(function (child) { messagesCount += child.numChildren(); });
        let totalStars = 0;
        usersSnap.forEach(function (u) { totalStars += Number(u.child("stars").val()) || 0; });

        const statCard = function (emoji, value, label) {
            return h("div", { class: "admin-stat-card" },
                h("span", { class: "admin-stat-emoji", text: emoji }),
                h("span", { class: "admin-stat-value", text: value }),
                h("span", { class: "admin-stat-label", text: label })
            );
        };

        const arr = [];
        usersSnap.forEach(function (u) { arr.push(Object.assign({ uid: u.key }, u.val())); });
        arr.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        const top = arr.slice(0, 10).map(function (u) {
            return h("div", { class: "admin-list-row" },
                h("span", { text: (u.nickname || u.username || "—") + " · @" + (u.username || "—") }),
                h("span", { class: "admin-list-meta", text: "⭐ " + (Number(u.stars) || 0) })
            );
        });

        $("adminBody").replaceChildren(
            h("div", { class: "admin-stats" },
                statCard("👥", usersCount.toLocaleString("ru-RU"), "пользователей"),
                statCard("💬", chatsCount.toLocaleString("ru-RU"), "чатов"),
                statCard("✉️", messagesCount.toLocaleString("ru-RU"), "сообщений"),
                statCard("⭐", totalStars.toLocaleString("ru-RU"), "звёзд в системе")
            ),
            h("div", { class: "settings-group" },
                h("div", { class: "settings-group-title", text: "Последние пользователи" }),
                ...top
            )
        );
    } catch (e) {
        $("adminBody").replaceChildren(h("div", { class: "list-empty", text: "Ошибка: " + e.message }));
    }
}

/* ===== BROADCAST ===== */

function renderAdminBroadcast() {
    const input = h("textarea", { placeholder: " ", maxlength: 2000, style: "height: 120px" });
    const btn = h("button", { class: "tg-btn primary", onclick: async function () {
        const text = input.value.trim();
        if (!text) return toast("Введите текст");
        const ok = await confirmDialog({ title: "Рассылка", text: "Отправить всем пользователям?", ok: "Отправить" });
        if (!ok) return;
        btn.disabled = true;
        try {
            const usersSnap = await db.ref("users").once("value");
            const updates = {};
            const now = Date.now();
            let count = 0;
            usersSnap.forEach(function (u) {
                const uid = u.key;
                if (uid === state.user.uid) return;
                const id = db.ref("notifications/" + uid + "/broadcast_" + now + "_" + Math.random().toString(36).slice(2, 6)).key;
                updates["notifications/" + uid + "/" + id] = {
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
            toast("Отправлено " + count + " пользователям");
            input.value = "";
        } catch (e) { toast("Ошибка: " + e.message); }
        btn.disabled = false;
    }}, "Отправить всем");

    $("adminBody").replaceChildren(
        h("p", { class: "field-hint", style: "padding: 0 14px 12px", text: "Сообщение придёт всем зарегистрированным." }),
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
    if (backBtn) backBtn.addEventListener("click", function () {
        if (typeof adminBackHandler === "function" && adminBackHandler) adminBackHandler();
        else closeAdminPanel();
    });
    if (drawerBtn) drawerBtn.addEventListener("click", function () { closeDrawer(); openAdminPanel(); });
}