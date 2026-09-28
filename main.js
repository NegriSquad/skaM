function openChatMoreMenu() {
    const entry = state.activeChat;
    if (!entry) return;
    const chatId = state.activeChatId;
    const ref = db.ref(`user_chats/${state.user.uid}/${chatId}`);
    showMenu([
        { label: "Поиск", icon: "search", onClick: openChatSearch },
        entry.type !== "saved" ? { label: entry.muted ? "Включить уведомления" : "Отключить уведомления", icon: entry.muted ? "unmute" : "mute", onClick: () => ref.update({ muted: entry.muted ? null : true }) } : null,
        { label: entry.pinnedAt ? "Открепить чат" : "Закрепить чат", icon: "pin", onClick: () => ref.update({ pinnedAt: entry.pinnedAt ? null : Date.now() }) },
        { label: entry.archived ? "Вернуть из архива" : "Архивировать", icon: "archive", onClick: () => ref.update({ archived: entry.archived ? null : true }) },
        entry.type === "group" ? { label: "Добавить участников", icon: "addUser", onClick: () => openAddMembers(chatId) } : null,
        "sep",
        entry.type !== "group" || entry.ownerId === state.user.uid ? { label: "Очистить историю", icon: "broom", danger: true, onClick: () => clearHistory(chatId) } : null,
        entry.type === "group"
            ? { label: "Покинуть группу", icon: "logout", danger: true, onClick: () => leaveGroup(chatId) }
            : { label: "Удалить чат", icon: "trash", danger: true, onClick: () => deleteChat(chatId) },
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
        await db.ref(`private_messages/${chatId}`).remove();
        const members = chatMembers(entry, chatId);
        await Promise.all(members.map((u) => db.ref(`user_chats/${u}/${chatId}`).update({ lastMessage: "", lastSenderId: null, lastSenderName: null, pinnedMsg: null }).catch(() => {})));
        toast("История очищена");
    } catch (error) {
        toast(friendlyError(error));
    }
}

function bindUI() {
    $("loginForm").addEventListener("submit", handleLogin);
    $("registerForm").addEventListener("submit", handleRegister);
    document.querySelectorAll("[data-auth-switch]").forEach((b) => b.addEventListener("click", () => showAuth(b.dataset.authSwitch)));

    $("menuBtn").addEventListener("click", openDrawer);
    $("drawerOverlay").addEventListener("click", closeDrawer);
    $("drawer").addEventListener("click", (e) => {
        const action = e.target.closest("[data-drawer]")?.dataset.drawer;
        if (!action) return;
        if (action === "profile") openProfileEditor();
        if (action === "new-group") openNewGroup();
        if (action === "saved") openSaved();
        if (action === "archive") { closeDrawer(); setFolder("archive"); }
        if (action === "settings") openSettings();
    });
    $("nightToggle").addEventListener("change", (e) => { state.settings.theme = e.target.checked ? "dark" : "light"; saveSettings(); });

    $("folders").addEventListener("click", (e) => {
        const folder = e.target.closest("[data-folder]")?.dataset.folder;
        if (folder) setFolder(folder);
    });

    $("searchToggleBtn").addEventListener("click", openSearch);
    $("searchCloseBtn").addEventListener("click", closeSearch);
    const searchInput = $("searchInput");
    searchInput.addEventListener("input", renderSearch);
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearch(); });

    $("fabBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = $("fabMenu");
        menu.classList.toggle("hidden");
        $("fabBtn").classList.toggle("open", !menu.classList.contains("hidden"));
    });
    $("fabMenu").addEventListener("click", (e) => {
        const action = e.target.closest("[data-action]")?.dataset.action;
        $("fabMenu").classList.add("hidden");
        $("fabBtn").classList.remove("open");
        if (action === "new-group") openNewGroup();
        if (action === "new-chat") openNewChat();
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".fab-wrap")) { $("fabMenu").classList.add("hidden"); $("fabBtn").classList.remove("open"); }
    });

    $("chatBackBtn").addEventListener("click", closeChat);
    $("chatHeaderInfo").addEventListener("click", () => toggleInfoPanel(true));
    $("chatInfoBtn").addEventListener("click", () => toggleInfoPanel());
    $("infoCloseBtn").addEventListener("click", () => toggleInfoPanel(false));
    $("chatSearchBtn").addEventListener("click", openChatSearch);
    $("chatMoreBtn").addEventListener("click", openChatMoreMenu);

    $("chatSearchInput").addEventListener("input", debounce(runChatSearch, 150));
    $("chatSearchInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !isComposingEvent(e)) { e.preventDefault(); stepChatSearch(e.shiftKey ? 1 : -1); }
        if (e.key === "Escape") closeChatSearch();
    });
    $("chatSearchUp").addEventListener("click", () => stepChatSearch(-1));
    $("chatSearchDown").addEventListener("click", () => stepChatSearch(1));
    $("chatSearchClose").addEventListener("click", closeChatSearch);

    $("pinnedBar").addEventListener("click", (e) => {
        const pinned = state.activeChat?.pinnedMsg;
        if (!pinned) return;
        if (e.target.closest("#unpinBtn")) {
            e.stopPropagation();
            const m = state.messages.find((x) => x.id === pinned.id) || { id: pinned.id };
            togglePin(m);
            return;
        }
        scrollToMessage(pinned.id);
    });

    $("messages").addEventListener("scroll", () => {
        updateScrollDown();
        const box = $("messages");
        if (box.scrollTop < 60 && state.hasMore && !loadMoreMessages.busy) {
            loadMoreMessages.busy = true;
            loadMoreMessages();
            setTimeout(() => { loadMoreMessages.busy = false; }, 800);
        }
    }, { passive: true });
    $("scrollDownBtn").addEventListener("click", () => scrollToBottom(true));

    $("ctxBackdrop").addEventListener("click", hideMenu);
    $("ctxBackdrop").addEventListener("contextmenu", (e) => { e.preventDefault(); hideMenu(); });
    $("modalCloseBtn").addEventListener("click", closeModal);
    $("modalBackBtn").addEventListener("click", () => modalBackHandler?.());
    $("modalOverlay").addEventListener("mousedown", (e) => { if (e.target === $("modalOverlay")) closeModal(); });
    $("mediaViewerClose").addEventListener("click", closeViewer);
    $("mediaViewer").addEventListener("click", (e) => { if (e.target === $("mediaViewer") || e.target === $("mediaViewerImg")) closeViewer(); });

    $("settingsBackBtn").addEventListener("click", () => { if (typeof settingsBackHandler !== "undefined" && settingsBackHandler) settingsBackHandler(); else closeSettings(); });
    $("settingsCloseBtn").addEventListener("click", closeSettings);
    $("settingsOverlay").addEventListener("click", closeSettings);
    $("profileCloseBtn").addEventListener("click", closeProfilePanel);
    $("profileOverlay").addEventListener("click", closeProfilePanel);

    // === ЗВОНКИ: подключаем, если calls.js загрузился ===
    if (typeof bindCallUI === "function") {
        try {
            bindCallUI();
            console.log("[localgram] calls.js подключён ✓");
        } catch (e) {
            console.error("[localgram] bindCallUI error:", e);
        }
        auth.onAuthStateChanged((user) => {
            if (user) {
                setTimeout(() => {
                    if (typeof initCallSystem === "function") initCallSystem();
                }, 300);
            } else {
                if (typeof cleanupCallSystem === "function") cleanupCallSystem();
            }
        });
    } else {
        console.warn("[localgram] calls.js не загружен — звонки отключены");
    }

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!$("ctxMenu").classList.contains("hidden")) return hideMenu();
        if (!$("mediaViewer").classList.contains("hidden")) return closeViewer();
        if (!$("modalOverlay").classList.contains("hidden")) return closeModal();
        if (!$("emojiPicker").classList.contains("hidden")) return $("emojiPicker").classList.add("hidden");
        if ($("settingsPanel").classList.contains("open")) return closeSettings();
        if ($("profilePanel").classList.contains("open")) return closeProfilePanel();
        if (!$("searchView").classList.contains("hidden")) return closeSearch();
        if ($("drawer").classList.contains("open")) return closeDrawer();
        if (typeof recorder !== "undefined" && recorder) return stopRecording(true);
        if (document.activeElement === $("messageInput") && (state.replyTo || state.editing)) return;
        if (!$("chatSearch").classList.contains("hidden")) return closeChatSearch();
        if (!$("infoPanel").classList.contains("hidden")) return toggleInfoPanel(false);
        if (state.activeChatId) closeChat();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && state.activeChatId) markMessagesRead();
    });
    window.addEventListener("beforeunload", () => { clearTyping(); });

    bindComposer();
}

function boot() {
    applySettings();
    const config = window.LOCALGRAM_FIREBASE_CONFIG;
    if (!config || !config.apiKey || config.apiKey.includes("ВСТАВЬТЕ")) {
        $("configBanner").classList.remove("hidden");
        return;
    }
    try {
        initFirebase(config);
    } catch (error) {
        $("configBanner").textContent = `Ошибка инициализации Firebase: ${error.message}`;
        $("configBanner").classList.remove("hidden");
        return;
    }
    bindUI();
    auth.onAuthStateChanged((user) => {
        handleAuthState(user).catch((error) => {
            console.error("[localgram] auth state error:", error);
            toast(friendlyError(error));
            showAuth("login");
        });
    });
}

boot();