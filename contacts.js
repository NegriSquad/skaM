/* =====================================================
   CONTACTS
   Firebase: user_contacts/{myUid}/{contactUid} = { addedAt, nickname, username, avatarUrl }
   ===================================================== */

let myContactsCache = {}; // { uid: { ... } }
let contactsListener = null;

function listenContacts() {
    if (contactsListener) {
        try { contactsListener(); } catch (e) {}
        contactsListener = null;
    }
    if (!state.user) return;
    const ref = db.ref("user_contacts/" + state.user.uid);
    const cb = ref.on("value", function (snap) {
        myContactsCache = snap.val() || {};
    });
    contactsListener = function () { ref.off("value", cb); };
}

function isContact(uid) {
    return !!myContactsCache[uid];
}

async function addContact(user) {
    if (!state.user || !user || !user.uid) return;
    if (user.uid === state.user.uid) return toast("Это вы");
    if (isContact(user.uid)) return toast("Уже в контактах");
    try {
        await db.ref("user_contacts/" + state.user.uid + "/" + user.uid).set({
            uid: user.uid,
            nickname: user.nickname || user.username,
            username: user.username,
            avatarUrl: user.avatarUrl || "",
            addedAt: Date.now(),
        });
        myContactsCache[user.uid] = {
            uid: user.uid,
            nickname: user.nickname || user.username,
            username: user.username,
            avatarUrl: user.avatarUrl || "",
            addedAt: Date.now(),
        };
        toast("Добавлено в контакты");
        if ($("infoPanel") && !$("infoPanel").classList.contains("hidden")) renderInfoPanel();
    } catch (e) {
        toast(friendlyError(e));
    }
}

async function removeContact(uid) {
    if (!state.user) return;
    try {
        await db.ref("user_contacts/" + state.user.uid + "/" + uid).remove();
        delete myContactsCache[uid];
        toast("Удалено из контактов");
        if ($("infoPanel") && !$("infoPanel").classList.contains("hidden")) renderInfoPanel();
    } catch (e) {
        toast(friendlyError(e));
    }
}

async function toggleContact(user) {
    if (isContact(user.uid)) await removeContact(user.uid);
    else await addContact(user);
}

/* ===== PANEL ===== */

let contactsBackHandler = null;

function openContactsPanel() {
    closeDrawer();
    closeSettings();
    contactsBackHandler = null;
    $("contactsPanel").classList.add("open");
    $("contactsPanel").setAttribute("aria-hidden", "false");
    $("contactsOverlay").classList.remove("hidden");
    renderContactsPanel();
}

function closeContactsPanel() {
    $("contactsPanel").classList.remove("open");
    $("contactsPanel").setAttribute("aria-hidden", "true");
    $("contactsOverlay").classList.add("hidden");
}

async function renderContactsPanel() {
    $("contactsBody").replaceChildren(h("div", { class: "list-empty", text: "Загрузка…" }));

    let contacts = Object.values(myContactsCache || {});
    // Обновим ники/аватары из users
    contacts = await Promise.all(contacts.map(async function (c) {
        const u = await getUser(c.uid).catch(function () { return null; });
        if (u) return Object.assign({}, c, {
            nickname: u.nickname || c.nickname,
            username: u.username || c.username,
            avatarUrl: u.avatarUrl || c.avatarUrl,
            online: u.online,
            lastSeen: u.lastSeen,
        });
        return c;
    }));

    contacts.sort(function (a, b) { return (a.nickname || "").localeCompare(b.nickname || ""); });

    const search = h("input", { type: "search", placeholder: "Поиск по имени или @" });
    const list = h("div", { class: "contacts-list" });
    const empty = h("div", { class: "list-empty hidden" }, h("strong", { text: "Пока пусто" }), "Добавляйте людей из их профиля — кнопка «В контакты».");

    const renderList = function () {
        const q = search.value.trim().toLowerCase();
        const filtered = contacts.filter(function (c) {
            if (!q) return true;
            const n = (c.nickname || "").toLowerCase();
            const u = (c.username || "").toLowerCase();
            return n.indexOf(q) >= 0 || u.indexOf(q) >= 0;
        });
        if (!filtered.length) {
            list.replaceChildren();
            empty.classList.toggle("hidden", !!q);
            return;
        }
        empty.classList.add("hidden");
        list.replaceChildren.apply(list, filtered.map(function (c) {
            const nameEl = h("strong", { text: c.nickname || c.username });
            if (isVerifiedUser(c.username)) nameEl.appendChild(verifiedBadge(14));
            return h("div", { class: "contact-row" },
                h("button", { class: "contact-row-main", onclick: function () {
                    closeContactsPanel();
                    openUserProfile(c.uid);
                }},
                    avatarEl(c.nickname || c.username, c.avatarUrl, "small", { key: c.uid }),
                    h("span", { class: "m-text" }, nameEl,
                        h("small", { text: "@" + (c.username || "—") })
                    )
                ),
                h("button", { class: "contact-row-action", title: "Написать", onclick: async function () {
                    const u = await getUser(c.uid).catch(function () { return null; });
                    if (!u) return toast("Пользователь не найден");
                    closeContactsPanel();
                    startPrivateChat(u);
                }}, icon("message")),
                h("button", { class: "contact-row-action danger", title: "Удалить", onclick: async function () {
                    const ok = await confirmDialog({
                        title: "Удалить из контактов",
                        text: "Убрать " + (c.nickname || c.username) + " из контактов?",
                        ok: "Удалить", danger: true,
                    });
                    if (ok) { await removeContact(c.uid); renderContactsPanel(); }
                }}, icon("trash"))
            );
        }));
    };

    search.addEventListener("input", renderList);
    renderList();

    $("contactsBody").replaceChildren(
        h("div", { class: "contacts-search-wrap" },
            h("label", { class: "tg-field" }, search, h("span", { text: "Поиск" }))
        ),
        h("div", { class: "field-hint", style: "padding: 0 16px 8px", text: "Всего в контактах: " + contacts.length }),
        list,
        empty
    );
}

/* ===== BIND ===== */

function bindContactsUI() {
    const overlay = $("contactsOverlay");
    const closeBtn = $("contactsCloseBtn");
    const backBtn = $("contactsBackBtn");
    if (overlay) overlay.addEventListener("click", closeContactsPanel);
    if (closeBtn) closeBtn.addEventListener("click", closeContactsPanel);
    if (backBtn) backBtn.addEventListener("click", closeContactsPanel);
}