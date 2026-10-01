function openChatMoreMenu() {
    const entry = state.activeChat;
    if (!entry) return;
    const chatId = state.activeChatId;
    const ref = db.ref("user_chats/" + state.user.uid + "/" + chatId);
    showMenu([
        { label: "Поиск", icon: "search", onClick: openChatSearch },
        entry.type !== "saved" ? { label: entry.muted ? "Включить уведомления" : "Отключить уведомления", icon: entry.muted ? "unmute" : "mute", onClick: function () { ref.update({ muted: entry.muted ? null : true }); } } : null,
        { label: entry.pinnedAt ? "Открепить чат" : "Закрепить чат", icon: "pin", onClick: function () { ref.update({ pinnedAt: entry.pinnedAt ? null : Date.now() }); } },
        { label: entry.archived ? "Вернуть из архива" : "Архивировать", icon: "archive", onClick: function () { ref.update({ archived: entry.archived ? null : true }); } },
        entry.type === "group" ? { label: "Добавить участников", icon: "addUser", onClick: function () { openAddMembers(chatId); } } : null,
        entry.type === "private" ? { label: "Подарить звёзды", icon: "star", onClick: function () {
            const partner = partnerProfile || {
                uid: entry.partnerId,
                nickname: entry.partnerName,
                username: entry.partnerUsername,
                avatarUrl: entry.partnerAvatarUrl,
            };
            if (!partner.uid) return toast("Не удалось определить получателя");
            openGiftsPanel({ uid: partner.uid, nickname: partner.nickname, username: partner.username, avatarUrl: partner.avatarUrl });
        }} : null,
        "sep",
        entry.type !== "group" || entry.ownerId === state.user.uid ? { label: "Очистить историю", icon: "broom", danger: true, onClick: function () { clearHistory(chatId); } } : null,
        entry.type === "group"
            ? { label: "Покинуть группу", icon: "logout", danger: true, onClick: function () { leaveGroup(chatId); } }
            : { label: "Удалить чат", icon: "trash", danger: true, onClick: function () { deleteChat(chatId); } },
    ], { anchor: $("chatMoreBtn") });
}

async function clearHistory(chatId) {
    const entry = state.chats[chatId];
    const forBoth = entry.type !== "saved";
    const res = await confirmDialog({
        title: "Очистить историю",
        text: forBoth ? "Все сообщения будут удалены для всех участников чата." : "Все сообщения будут удалены.",
        ok: "Очистить",
        danger: true,
    });
    if (!res) return;
    try {
        await db.ref("private_messages/" + chatId).remove();
        const members = chatMembers(entry, chatId);
        await Promise.all(members.map(function (u) {
            return db.ref("user_chats/" + u + "/" + chatId).update({ lastMessage: "", lastSenderId: null, lastSenderName: null, pinnedMsg: null }).catch(function () {});
        }));
        toast("История очищена");
    } catch (error) {
        toast(friendlyError(error));
    }
}

/**
 * Безопасно навешивает listener, если элемент существует.
 */
function on(id, event, handler, opts) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn("[localgram] элемент #" + id + " не найден, пропускаю " + event);
        return null;
    }
    el.addEventListener(event, handler, opts);
    return el;
}

function bindUI() {
    // ===== AUTH =====
    on("loginForm", "submit", handleLogin);
    on("registerForm", "submit", handleRegister);
    document.querySelectorAll("[data-auth-switch]").forEach(function (b) {
        b.addEventListener("click", function () { showAuth(b.dataset.authSwitch); });
    });

    // ===== DRAWER =====
    on("menuBtn", "click", openDrawer);
    on("drawerOverlay", "click", closeDrawer);

    on("drawerBackBtn", "click", closeDrawer);

    on("drawerSearchBtn", "click", function () { closeDrawer(); openSearch(); });

    const drawerMoreBtn = document.getElementById("drawerMoreBtn");
    if (drawerMoreBtn) {
        drawerMoreBtn.addEventListener("click", function () {
            showMenu([
                { label: "Настройки", icon: "lock", onClick: function () { closeDrawer(); openSettings(); } },
                { label: "Мой профиль", icon: "user", onClick: function () { closeDrawer(); openProfileEditor(); } },
                { label: "Подарки", icon: "star", onClick: function () { closeDrawer(); openGiftsPanel(); } },
            ], { anchor: drawerMoreBtn });
        });
    }

    on("nightToggle", "change", function (e) {
        state.settings.theme = e.target.checked ? "dark" : "light";
        saveSettings();
    });

    // ===== FOLDERS =====
    on("folders", "click", function (e) {
        const folder = e.target.closest("[data-folder]");
        if (folder && folder.dataset.folder) setFolder(folder.dataset.folder);
    });

    // ===== SEARCH =====
    on("searchToggleBtn", "click", openSearch);
    on("searchCloseBtn", "click", closeSearch);

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", renderSearch);
        searchInput.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSearch(); });
    }

    // ===== FAB =====
    on("fabBtn", "click", function (e) {
        e.stopPropagation();
        const menu = document.getElementById("fabMenu");
        if (!menu) return;
        menu.classList.toggle("hidden");
        e.currentTarget.classList.toggle("open", !menu.classList.contains("hidden"));
    });

    on("fabMenu", "click", function (e) {
        const action = e.target.closest("[data-action]");
        const menu = document.getElementById("fabMenu");
        const fabBtn = document.getElementById("fabBtn");
        if (menu) menu.classList.add("hidden");
        if (fabBtn) fabBtn.classList.remove("open");
        if (!action) return;
        if (action.dataset.action === "new-group") openNewGroup();
        if (action.dataset.action === "new-chat") openNewChat();
    });

    document.addEventListener("click", function (e) {
        if (!e.target.closest(".fab-wrap")) {
            const menu = document.getElementById("fabMenu");
            const fabBtn = document.getElementById("fabBtn");
            if (menu) menu.classList.add("hidden");
            if (fabBtn) fabBtn.classList.remove("open");
        }
    });

    // ===== CHAT =====
    on("chatBackBtn", "click", closeChat);
    on("chatHeaderInfo", "click", function () { toggleInfoPanel(true); });
    on("chatInfoBtn", "click", function () { toggleInfoPanel(); });
    on("infoCloseBtn", "click", function () { toggleInfoPanel(false); });
    on("chatSearchBtn", "click", openChatSearch);
    on("chatMoreBtn", "click", openChatMoreMenu);

    const chatSearchInput = document.getElementById("chatSearchInput");
    if (chatSearchInput) {
        chatSearchInput.addEventListener("input", debounce(runChatSearch, 150));
        chatSearchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !isComposingEvent(e)) { e.preventDefault(); stepChatSearch(e.shiftKey ? 1 : -1); }
            if (e.key === "Escape") closeChatSearch();
        });
    }
    on("chatSearchUp", "click", function () { stepChatSearch(-1); });
    on("chatSearchDown", "click", function () { stepChatSearch(1); });
    on("chatSearchClose", "click", closeChatSearch);

    on("pinnedBar", "click", function (e) {
        const pinned = state.activeChat && state.activeChat.pinnedMsg;
        if (!pinned) return;
        if (e.target.closest("#unpinBtn")) {
            e.stopPropagation();
            const m = state.messages.find(function (x) { return x.id === pinned.id; }) || { id: pinned.id };
            togglePin(m);
            return;
        }
        scrollToMessage(pinned.id);
    });

    on("messages", "scroll", function () {
        updateScrollDown();
        const box = document.getElementById("messages");
        if (!box) return;
        if (box.scrollTop < 60 && state.hasMore && !loadMoreMessages.busy) {
            loadMoreMessages.busy = true;
            loadMoreMessages();
            setTimeout(function () { loadMoreMessages.busy = false; }, 800);
        }
    }, { passive: true });

    on("scrollDownBtn", "click", function () { scrollToBottom(true); });

    // ===== CONTEXT / MODAL / VIEWER =====
    on("ctxBackdrop", "click", hideMenu);
    on("ctxBackdrop", "contextmenu", function (e) { e.preventDefault(); hideMenu(); });
    on("modalCloseBtn", "click", closeModal);
    on("modalBackBtn", "click", function () { if (typeof modalBackHandler === "function" && modalBackHandler) modalBackHandler(); });
    on("modalOverlay", "mousedown", function (e) {
        if (e.target === document.getElementById("modalOverlay")) closeModal();
    });
    on("mediaViewerClose", "click", closeViewer);
    on("mediaViewer", "click", function (e) {
        if (e.target === document.getElementById("mediaViewer") || e.target === document.getElementById("mediaViewerImg")) closeViewer();
    });

    // ===== SETTINGS / PROFILE PANELS =====
    on("settingsBackBtn", "click", function () {
        if (typeof settingsBackHandler === "function" && settingsBackHandler) settingsBackHandler();
        else closeSettings();
    });
    on("settingsCloseBtn", "click", closeSettings);
    on("settingsOverlay", "click", closeSettings);
    on("profileCloseBtn", "click", closeProfilePanel);
    on("profileOverlay", "click", closeProfilePanel);

    // ===== CALLS =====
    if (typeof bindCallUI === "function") {
        try { bindCallUI(); }
        catch (e) { console.error("[localgram] bindCallUI error:", e); }
    }

    // ===== GIFTS & ADMIN =====
    if (typeof bindGiftsUI === "function") {
        try { bindGiftsUI(); }
        catch (e) { console.error("[localgram] bindGiftsUI error:", e); }
    }
    if (typeof bindAdminUI === "function") {
        try { bindAdminUI(); }
        catch (e) { console.error("[localgram] bindAdminUI error:", e); }
    }

    // ===== AUTH STATE — звонки =====
    auth.onAuthStateChanged(function (user) {
        if (user) {
            setTimeout(function () {
                if (typeof initCallSystem === "function") initCallSystem();
            }, 300);
        } else {
            if (typeof cleanupCallSystem === "function") cleanupCallSystem();
            if (typeof offGiftsGroup === "function") offGiftsGroup();
        }
    });

    // ===== ESCAPE =====
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;

        const ctxMenu = document.getElementById("ctxMenu");
        const mediaViewer = document.getElementById("mediaViewer");
        const modalOverlay = document.getElementById("modalOverlay");
        const emojiPicker = document.getElementById("emojiPicker");
        const adminPanel = document.getElementById("adminPanel");
        const giftsPanel = document.getElementById("giftsPanel");
        const settingsPanel = document.getElementById("settingsPanel");
        const profilePanel = document.getElementById("profilePanel");
        const searchView = document.getElementById("searchView");
        const drawer = document.getElementById("drawer");
        const chatSearch = document.getElementById("chatSearch");
        const infoPanel = document.getElementById("infoPanel");

        if (ctxMenu && !ctxMenu.classList.contains("hidden")) return hideMenu();
        if (mediaViewer && !mediaViewer.classList.contains("hidden")) return closeViewer();
        if (modalOverlay && !modalOverlay.classList.contains("hidden")) return closeModal();
        if (emojiPicker && !emojiPicker.classList.contains("hidden")) return emojiPicker.classList.add("hidden");
        if (adminPanel && adminPanel.classList.contains("open")) return closeAdminPanel();
        if (giftsPanel && giftsPanel.classList.contains("open")) return closeGiftsPanel();
        if (settingsPanel && settingsPanel.classList.contains("open")) return closeSettings();
        if (profilePanel && profilePanel.classList.contains("open")) return closeProfilePanel();
        if (searchView && !searchView.classList.contains("hidden")) return closeSearch();
        if (drawer && drawer.classList.contains("open")) return closeDrawer();
        if (typeof recorder !== "undefined" && recorder) return stopRecording(true);
        if (document.activeElement === document.getElementById("messageInput") && (state.replyTo || state.editing)) return;
        if (chatSearch && !chatSearch.classList.contains("hidden")) return closeChatSearch();
        if (infoPanel && !infoPanel.classList.contains("hidden")) return toggleInfoPanel(false);
        if (state.activeChatId) closeChat();
    });

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible" && state.activeChatId) markMessagesRead();
    });
    window.addEventListener("beforeunload", function () { clearTyping(); });

    bindComposer();
}

function boot() {
    applySettings();
    const config = window.LOCALGRAM_FIREBASE_CONFIG;
    if (!config || !config.apiKey || config.apiKey.indexOf("ВСТАВЬТЕ") >= 0) {
        const banner = document.getElementById("configBanner");
        if (banner) banner.classList.remove("hidden");
        return;
    }
    try {
        initFirebase(config);
    } catch (error) {
        const banner = document.getElementById("configBanner");
        if (banner) {
            banner.textContent = "Ошибка инициализации Firebase: " + error.message;
            banner.classList.remove("hidden");
        }
        return;
    }
    bindUI();
    auth.onAuthStateChanged(function (user) {
        handleAuthState(user).catch(function (error) {
            console.error("[localgram] auth state error:", error);
            toast(friendlyError(error));
            showAuth("login");
        });
    });
}

boot();