const firebaseConfig = {
    apiKey: "AIzaSyD3NEXunS2PQPVQ3nDS27Nk4JIG3xajyVM",
    authDomain: "messendger-71e53.firebaseapp.com",
    databaseURL: "https://messendger-71e53-default-rtdb.firebaseio.com",
    projectId: "messendger-71e53",
    storageBucket: "messendger-71e53.firebasestorage.app",
    messagingSenderId: "1010287168963",
    appId: "1:1010287168963:web:15868f94480bb833414176"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

const state = {
    user: null,
    profile: null,
    activeChatId: null,
    activePartner: null,
    editingMessageId: null,
    dialogsListener: null,
    messagesListener: null,
    typingListener: null,
    typingTimer: null,
    searchTimer: null,
    selectedAvatarDataUrl: null,
    isAtBottom: true,
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartTime: null,
    recordingTimer: null,
    currentRecordType: null,
    videoStream: null,
    waveformAnimationId: null,
    isRecording: false
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    updateCharCounter();
    auth.onAuthStateChanged(handleAuthState);
});

function bindElements() {
    [
        "loginScreen", "registerScreen", "mainAppScreen", "loginEmail", "loginPassword",
        "doLoginBtn", "showRegisterBtn", "regEmail", "regUsername", "regNickname",
        "regPassword", "doRegisterBtn", "showLoginFromRegBtn", "globalLogoutBtn",
        "openProfileBtn", "themeToggleBtn", "sidebarAvatar", "sidebarName", "sidebarUsername",
        "searchUserInput", "searchUserBtn", "searchResults", "dialogsList",
        "dialogsCount", "chatArea", "backToDialogsBtn", "chatAvatar", "currentChatTitle",
        "currentChatSubtitle", "deleteDialogBtn", "messagesContainer", "typingIndicatorContainer",
        "typingText", "scrollBottomBtn", "messageInput", "charCounter", "editBanner",
        "cancelEditBtn", "profileModal", "closeProfileBtn", "profileAvatarPreview",
        "profilePreviewName", "profilePreviewUsername", "profileNickname",
        "profileUsername", "profileAvatarFile", "removeAvatarBtn", "profileBio", "saveProfileBtn",
        "telegramBottomUI", "voiceRecorderPanel", "videoRecorderPanel",
        "voiceTimer", "videoTimer", "cancelVoiceBtn", "sendVoiceBtn", "cancelVideoBtn",
        "sendVideoBtn", "videoPreview", "waveformCanvas",
        // Новые элементы настроек
        "settingsModal", "closeSettingsBtn", "aboutModal", "closeAboutBtn"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            els[id] = el;
        } else {
            console.warn(`Element with id "${id}" not found`);
            els[id] = {
                classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
                addEventListener: () => {},
                replaceChildren: () => {},
                appendChild: () => {},
                textContent: '',
                value: '',
                style: {},
                src: '',
                disabled: false,
                innerHTML: '',
                click: () => {},
                scrollTo: () => {},
                scrollHeight: 0,
                scrollTop: 0,
                clientHeight: 0,
                files: []
            };
        }
    });

    els.sendBtnTelegram = document.getElementById('sendBtnTelegram');
    els.voiceRecordBtnTelegram = document.getElementById('voiceRecordBtnTelegram');
    els.videoRecordBtnTelegram = document.getElementById('videoRecordBtnTelegram');
    els.emojiBtnTelegram = document.getElementById('emojiBtnTelegram');
    els.navContactsBtn = document.getElementById('navContactsBtn');
    els.navCallsBtn = document.getElementById('navCallsBtn');
    els.navChatsBtn = document.getElementById('navChatsBtn');
    els.navSettingsBtn = document.getElementById('navSettingsBtn');
}

function bindEvents() {
    initTheme();
    els.doLoginBtn.addEventListener("click", loginUser);
    els.doRegisterBtn.addEventListener("click", registerUser);
    els.showRegisterBtn.addEventListener("click", () => showAuthScreen("register"));
    els.showLoginFromRegBtn.addEventListener("click", () => showAuthScreen("login"));
    els.globalLogoutBtn.addEventListener("click", logout);
    els.openProfileBtn.addEventListener("click", openProfileModal);
    els.themeToggleBtn.addEventListener("click", toggleTheme);
    els.closeProfileBtn.addEventListener("click", closeProfileModal);
    els.saveProfileBtn.addEventListener("click", saveProfile);
    els.profileAvatarFile.addEventListener("change", handleAvatarFileSelect);
    els.removeAvatarBtn.addEventListener("click", removeSelectedAvatar);
    els.profileModal.addEventListener("click", event => {
        if (event.target === els.profileModal) closeProfileModal();
    });

    els.searchUserBtn.addEventListener("click", () => searchUserByUsername(els.searchUserInput.value));
    els.searchUserInput.addEventListener("keydown", event => {
        if (event.key === "Enter") searchUserByUsername(els.searchUserInput.value);
    });
    els.searchUserInput.addEventListener("input", () => {
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
            if (els.searchUserInput.value.trim().length >= 3) searchUserByUsername(els.searchUserInput.value);
        }, 350);
    });

    if (els.sendBtnTelegram) {
        els.sendBtnTelegram.addEventListener("click", sendOrUpdateMessage);
    }
    
    els.cancelEditBtn.addEventListener("click", cancelEditMessage);
    els.deleteDialogBtn.addEventListener("click", deleteCurrentDialog);
    els.scrollBottomBtn.addEventListener("click", () => scrollMessagesToBottom(true));
    els.backToDialogsBtn.addEventListener("click", () => els.chatArea.classList.remove("open"));

    els.messageInput.addEventListener("input", () => {
        updateCharCounter();
        updateTyping(true);
        clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => updateTyping(false), 1200);
    });
    els.messageInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendOrUpdateMessage();
        }
    });
    els.messageInput.addEventListener("blur", () => updateTyping(false));
    els.messagesContainer.addEventListener("scroll", () => {
        updateScrollState();
    });

    if (els.voiceRecordBtnTelegram) {
        els.voiceRecordBtnTelegram.addEventListener("click", () => {
            if (!state.activeChatId) {
                alert("Сначала выберите диалог");
                return;
            }
            if (!state.isRecording) {
                startRecording('voice');
            } else if (state.isRecording && state.currentRecordType === 'voice') {
                sendVoiceRecording();
            }
        });
    }

    if (els.videoRecordBtnTelegram) {
        els.videoRecordBtnTelegram.addEventListener("click", () => {
            if (!state.activeChatId) {
                alert("Сначала выберите диалог");
                return;
            }
            if (!state.isRecording) {
                startRecording('video');
            } else if (state.isRecording && state.currentRecordType === 'video') {
                sendVideoRecording();
            }
        });
    }

    if (els.emojiBtnTelegram) {
        els.emojiBtnTelegram.addEventListener("click", () => {
            console.log('Emoji picker - можно добавить позже');
        });
    }

    if (els.navContactsBtn) {
        els.navContactsBtn.addEventListener("click", () => {
            els.searchUserInput?.focus();
        });
    }

    if (els.navCallsBtn) {
        els.navCallsBtn.addEventListener("click", () => {
            alert('Функция звонков будет добавлена в следующей версии');
        });
    }

    if (els.navChatsBtn) {
        els.navChatsBtn.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                els.chatArea.classList.remove('open');
            }
        });
    }

    // ============================================
    // КНОПКА НАСТРОЕК - ОТКРЫВАЕТ НАСТРОЙКИ, А НЕ ПРОФИЛЬ
    // ============================================
    if (els.navSettingsBtn) {
        els.navSettingsBtn.addEventListener("click", openSettingsModal);
    }

    if (els.cancelVoiceBtn) els.cancelVoiceBtn.addEventListener("click", cancelRecording);
    if (els.sendVoiceBtn) els.sendVoiceBtn.addEventListener("click", sendVoiceRecording);
    if (els.cancelVideoBtn) els.cancelVideoBtn.addEventListener("click", cancelRecording);
    if (els.sendVideoBtn) els.sendVideoBtn.addEventListener("click", sendVideoRecording);

    // ============================================
    // НАСТРОЙКИ - ОБРАБОТЧИКИ
    // ============================================
    if (els.closeSettingsBtn) {
        els.closeSettingsBtn.addEventListener("click", () => {
            if (els.settingsModal) els.settingsModal.classList.add("hidden");
        });
    }

    if (els.settingsModal) {
        els.settingsModal.addEventListener("click", (event) => {
            if (event.target === els.settingsModal) {
                els.settingsModal.classList.add("hidden");
            }
        });
    }

    // Закрытие "О приложении"
    if (els.closeAboutBtn) {
        els.closeAboutBtn.addEventListener("click", () => {
            if (els.aboutModal) els.aboutModal.classList.add("hidden");
        });
    }

    if (els.aboutModal) {
        els.aboutModal.addEventListener("click", (event) => {
            if (event.target === els.aboutModal) {
                els.aboutModal.classList.add("hidden");
            }
        });
    }

    // Обработчики для пунктов настроек
    document.getElementById('settingsFolders')?.addEventListener("click", () => {
        alert('📁 Папки\n\nФункция будет доступна в следующей версии.');
    });

    document.getElementById('settingsSecurity')?.addEventListener("click", () => {
        alert('🔒 Безопасность\n\nНастройки безопасности и конфиденциальности.');
    });

    document.getElementById('settingsDevices')?.addEventListener("click", () => {
        alert('📱 Устройства\n\nСписок активных устройств.');
    });

    document.getElementById('settingsNotifications')?.addEventListener("click", () => {
        alert('🔔 Уведомления\n\nНастройки уведомлений приложения.');
    });

    document.getElementById('settingsAppearance')?.addEventListener("click", () => {
        toggleTheme();
        alert('🎨 Оформление\n\nТема изменена на ' + (document.documentElement.dataset.theme === 'dark' ? 'тёмную' : 'светлую') + '.');
    });

    document.getElementById('settingsLanguage')?.addEventListener("click", () => {
        alert('🌐 Язык приложения\n\nРусский (RU)');
    });

    document.getElementById('settingsShortcuts')?.addEventListener("click", () => {
        alert('⌨️ Сочетания клавиш\n\nEnter - отправить сообщение\nCtrl+Enter - новая строка\nEsc - отмена редактирования');
    });

    document.getElementById('settingsBusiness')?.addEventListener("click", () => {
        alert('💼 MAX для бизнеса\n\nРасширенные возможности для бизнеса.');
    });

    document.getElementById('settingsHelp')?.addEventListener("click", () => {
        alert('❓ Помощь\n\nДокументация и поддержка Localgram.\n\nEmail: support@localgram.app');
    });

    document.getElementById('settingsAbout')?.addEventListener("click", () => {
        if (els.settingsModal) els.settingsModal.classList.add("hidden");
        if (els.aboutModal) els.aboutModal.classList.remove("hidden");
    });
}

// ============================================
// ОТКРЫТИЕ НАСТРОЕК
// ============================================
function openSettingsModal() {
    if (els.settingsModal) {
        els.settingsModal.classList.remove("hidden");
    }
}

// ============================================
// ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений)
// ============================================

async function handleAuthState(user) {
    if (!user) {
        resetSession();
        showAuthScreen("login");
        return;
    }

    state.user = user;
    try {
        const snap = await db.ref(`users/${user.uid}`).once("value");
        state.profile = snap.val();

        if (!state.profile) {
            alert("Профиль пользователя не найден.");
            await auth.signOut();
            return;
        }

        showMainApp();
    } catch (error) {
        console.error("Auth error:", error);
        alert("Ошибка загрузки профиля. Проверьте правила безопасности Firebase.");
    }
}

function showAuthScreen(screen) {
    if (els.loginScreen) els.loginScreen.classList.toggle("hidden", screen !== "login");
    if (els.registerScreen) els.registerScreen.classList.toggle("hidden", screen !== "register");
    if (els.mainAppScreen) els.mainAppScreen.classList.add("hidden");
}

function showMainApp() {
    if (els.loginScreen) els.loginScreen.classList.add("hidden");
    if (els.registerScreen) els.registerScreen.classList.add("hidden");
    if (els.mainAppScreen) els.mainAppScreen.classList.remove("hidden");
    renderCurrentProfile();
    renderEmptyChat();
    listenDialogs();
}

function resetSession() {
    detachListeners();
    state.user = null;
    state.profile = null;
    state.activeChatId = null;
    state.activePartner = null;
    state.editingMessageId = null;
    state.selectedAvatarDataUrl = null;
    if (els.mainAppScreen) els.mainAppScreen.classList.add("hidden");
}

function detachListeners() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
    state.dialogsListener = null;
    state.messagesListener = null;
    state.typingListener = null;
}

async function registerUser() {
    const email = els.regEmail.value.trim();
    const username = normalizeUsername(els.regUsername.value);
    const nickname = els.regNickname.value.trim();
    const password = els.regPassword.value;

    if (!email || !username || !nickname || password.length < 6) {
        alert("Заполните все поля. Пароль должен быть не короче 6 символов.");
        return;
    }
    if (!isValidUsername(username)) {
        alert("Username может содержать только латиницу, цифры и нижнее подчеркивание.");
        return;
    }
    try {
        const existingUid = await findUidByUsername(username);
        if (existingUid) {
            alert("Этот username уже занят.");
            return;
        }

        const { user } = await auth.createUserWithEmailAndPassword(email, password);
        const profile = { email, username, nickname, avatarUrl: "", bio: "", createdAt: Date.now(), updatedAt: Date.now() };
        await db.ref(`users/${user.uid}`).set(profile);
        await setUsernameIndex(username, user.uid);
        alert("Аккаунт создан. Можно входить.");
        await auth.signOut();
        showAuthScreen("login");
    } catch (error) {
        alert(`Ошибка регистрации: ${error.message}`);
    }
}

async function loginUser() {
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    if (!email || !password) {
        alert("Введите email и пароль.");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert(`Ошибка входа: ${error.message}`);
    }
}

async function logout() {
    await clearTypingIndicator();
    await stopRecording(true);
    await auth.signOut();
}

function renderCurrentProfile() {
    const profile = state.profile || {};
    setAvatar(els.sidebarAvatar, profile.nickname || profile.username, profile.avatarUrl);
    els.sidebarName.textContent = profile.nickname || "Профиль";
    els.sidebarUsername.textContent = `@${profile.username || "username"}`;
}

function openProfileModal() {
    const profile = state.profile || {};
    els.profileNickname.value = profile.nickname || "";
    els.profileUsername.value = profile.username || "";
    els.profileAvatarFile.value = "";
    state.selectedAvatarDataUrl = profile.avatarUrl || "";
    els.profileBio.value = profile.bio || "";
    updateProfilePreview();
    els.profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    els.profileModal.classList.add("hidden");
}

async function saveProfile() {
    const nickname = els.profileNickname.value.trim();
    const username = normalizeUsername(els.profileUsername.value);
    const avatarUrl = state.selectedAvatarDataUrl || "";
    const bio = els.profileBio.value.trim();

    if (!nickname || !username) {
        alert("Имя и username обязательны.");
        return;
    }
    if (!isValidUsername(username)) {
        alert("Username может содержать только латиницу, цифры и нижнее подчеркивание.");
        return;
    }
    try {
        const oldUsername = state.profile.username;
        const foundUid = await findUidByUsername(username);
        if (foundUid && foundUid !== state.user.uid) {
            alert("Этот username уже занят.");
            return;
        }

        const updates = { nickname, username, avatarUrl, bio, updatedAt: Date.now() };
        await db.ref(`users/${state.user.uid}`).update(updates);

        if (username !== oldUsername) {
            await removeUsernameIndex(oldUsername, state.user.uid);
            await setUsernameIndex(username, state.user.uid);
        }

        state.profile = { ...state.profile, ...updates };
        renderCurrentProfile();
        await refreshOwnDialogCards();
        closeProfileModal();
    } catch (error) {
        alert(`Не удалось сохранить профиль: ${error.message}`);
    }
}

function updateProfilePreview() {
    const nickname = els.profileNickname.value.trim() || "Имя";
    const username = normalizeUsername(els.profileUsername.value) || "username";
    setAvatar(els.profileAvatarPreview, nickname, state.selectedAvatarDataUrl);
    els.profilePreviewName.textContent = nickname;
    els.profilePreviewUsername.textContent = `@${username}`;
}

async function handleAvatarFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Выберите файл изображения.");
        els.profileAvatarFile.value = "";
        return;
    }

    try {
        state.selectedAvatarDataUrl = await compressAvatar(file);
        updateProfilePreview();
    } catch (error) {
        alert(`Не удалось обработать аватарку: ${error.message}`);
        els.profileAvatarFile.value = "";
    }
}

function removeSelectedAvatar() {
    state.selectedAvatarDataUrl = "";
    els.profileAvatarFile.value = "";
    updateProfilePreview();
}

document.addEventListener("input", event => {
    if (event.target && (event.target.id === "profileNickname" || event.target.id === "profileUsername")) {
        updateProfilePreview();
    }
});

function listenDialogs() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);

    const ref = db.ref(`user_chats/${state.user.uid}`);
    const callback = snap => renderDialogs(snap.val() || {});
    ref.on("value", callback);
    state.dialogsListener = { ref, callback };
}

function renderDialogs(chats) {
    const entries = Object.entries(chats).sort((a, b) => (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0));
    els.dialogsList.replaceChildren();
    els.dialogsCount.textContent = entries.length;

    if (!entries.length) {
        els.dialogsList.appendChild(emptyBlock("Диалогов пока нет", "Найдите человека по username и начните переписку."));
        return;
    }

    entries.forEach(([chatId, info]) => {
        const item = document.createElement("button");
        item.className = `dialog-item ${chatId === state.activeChatId ? "active" : ""}`;
        item.type = "button";
        item.addEventListener("click", () => openChat(chatId, {
            uid: info.partnerId,
            nickname: info.partnerName || info.partnerUsername,
            username: info.partnerUsername,
            avatarUrl: info.partnerAvatarUrl || "",
            bio: info.partnerBio || ""
        }));

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        setAvatar(avatar, info.partnerName || info.partnerUsername, info.partnerAvatarUrl);

        const content = document.createElement("span");
        content.className = "dialog-content";

        const name = document.createElement("strong");
        name.textContent = info.partnerName || `@${info.partnerUsername}`;

        const last = document.createElement("small");
        last.textContent = info.lastMessage || "Диалог создан";

        const meta = document.createElement("time");
        meta.textContent = info.lastTimestamp ? formatShortTime(info.lastTimestamp) : "";

        content.append(name, last);
        item.append(avatar, content, meta);
        els.dialogsList.appendChild(item);
    });
}

async function searchUserByUsername(rawUsername) {
    const username = normalizeUsername(rawUsername);
    els.searchResults.classList.remove("hidden");
    els.searchResults.replaceChildren();

    if (!username) {
        els.searchResults.appendChild(searchMessage("Введите username для поиска."));
        return;
    }

    try {
        const uid = await findUidByUsername(username);
        if (!uid || uid === state.user.uid) {
            els.searchResults.appendChild(searchMessage("Пользователь не найден."));
            return;
        }

        try {
            const userSnap = await db.ref(`users/${uid}`).once("value");
            const userData = userSnap.val();
            
            if (!userData) {
                els.searchResults.appendChild(searchMessage("Профиль пользователя недоступен."));
                return;
            }

            const item = document.createElement("div");
            item.className = "search-result-item";

            const avatar = document.createElement("span");
            avatar.className = "avatar";
            setAvatar(avatar, userData.nickname || userData.username, userData.avatarUrl);

            const text = document.createElement("span");
            text.className = "search-result-text";
            text.innerHTML = `<strong></strong><small></small>`;
            text.querySelector("strong").textContent = userData.nickname || userData.username;
            text.querySelector("small").textContent = `@${userData.username}`;

            const button = document.createElement("button");
            button.className = "small-btn";
            button.textContent = "Написать";
            button.addEventListener("click", () => startDialogWith(uid, userData));

            item.append(avatar, text, button);
            els.searchResults.appendChild(item);
        } catch (userError) {
            console.error("Error fetching user data:", userError);
            if (userError.message && userError.message.includes("permission_denied")) {
                els.searchResults.appendChild(searchMessage("Нет доступа к данным пользователя. Проверьте правила безопасности Firebase."));
            } else {
                els.searchResults.appendChild(searchMessage(`Ошибка получения данных: ${userError.message}`));
            }
        }
    } catch (error) {
        console.error("Search error:", error);
        if (error.message && error.message.includes("permission_denied")) {
            els.searchResults.appendChild(searchMessage("Нет доступа к данным. Проверьте правила безопасности Firebase."));
        } else {
            els.searchResults.appendChild(searchMessage(`Ошибка поиска: ${error.message}`));
        }
    }
}

async function startDialogWith(uid, userData) {
    const chatId = [state.user.uid, uid].sort().join("_");
    const now = Date.now();
    const ownRef = db.ref(`user_chats/${state.user.uid}/${chatId}`);
    const exists = (await ownRef.once("value")).exists();

    if (!exists) {
        await ownRef.set({
            partnerId: uid,
            partnerName: userData.nickname,
            partnerUsername: userData.username,
            partnerAvatarUrl: userData.avatarUrl || "",
            partnerBio: userData.bio || "",
            lastMessage: "",
            lastTimestamp: now
        });
        await db.ref(`user_chats/${uid}/${chatId}`).set({
            partnerId: state.user.uid,
            partnerName: state.profile.nickname,
            partnerUsername: state.profile.username,
            partnerAvatarUrl: state.profile.avatarUrl || "",
            partnerBio: state.profile.bio || "",
            lastMessage: "",
            lastTimestamp: now
        });
    }

    els.searchUserInput.value = "";
    els.searchResults.classList.add("hidden");
    openChat(chatId, { uid, nickname: userData.nickname, username: userData.username, avatarUrl: userData.avatarUrl || "", bio: userData.bio || "" });
}

function openChat(chatId, partner) {
    state.activeChatId = chatId;
    state.activePartner = partner;
    state.editingMessageId = null;
    cancelEditMessage();

    els.currentChatTitle.textContent = partner.nickname || `@${partner.username}`;
    els.currentChatSubtitle.textContent = partner.bio || `@${partner.username}`;
    setAvatar(els.chatAvatar, partner.nickname || partner.username, partner.avatarUrl);
    els.chatAvatar.classList.remove("muted");
    els.deleteDialogBtn.classList.remove("hidden");
    els.messageInput.disabled = false;
    if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
    if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
    if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;

    if (els.telegramBottomUI) {
        els.telegramBottomUI.classList.remove('hidden');
    }

    renderLoadingMessages();
    listenMessages(chatId);
    listenTyping(chatId);

    if (window.innerWidth <= 768) els.chatArea.classList.add("open");
}

function listenMessages(chatId) {
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);

    const ref = db.ref(`private_messages/${chatId}`).orderByChild("timestamp").limitToLast(100);
    const callback = snap => {
        const data = snap.val() || {};
        const messages = Object.entries(data)
            .map(([id, message]) => ({ id, ...message }))
            .filter(message => !message.deletedFor || !message.deletedFor[state.user.uid])
            .sort((a, b) => a.timestamp - b.timestamp);
        renderMessages(messages);
    };

    ref.on("value", callback);
    state.messagesListener = { ref, callback };
}

function renderMessages(messages) {
    const wasAtBottom = state.isAtBottom;

    if (!messages.length) {
        els.messagesContainer.replaceChildren(emptyBlock("Сообщений пока нет", "Напишите первым и начните диалог."));
        return;
    }

    const fragment = document.createDocumentFragment();
    let lastDate = "";
    messages.forEach(message => {
        const date = formatDateGroup(message.timestamp);
        if (date !== lastDate) {
            const divider = document.createElement("div");
            divider.className = "date-divider";
            divider.textContent = date;
            fragment.appendChild(divider);
            lastDate = date;
        }

        fragment.appendChild(createMessageNode(message));
    });

    els.messagesContainer.replaceChildren(fragment);
    if (wasAtBottom) scrollMessagesToBottom(false);
    requestAnimationFrame(updateScrollState);
}

function createMessageNode(message) {
    const isOwn = message.senderId === state.user.uid;
    const item = document.createElement("article");
    item.className = `message-item ${isOwn ? "own-message" : ""}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (message.voiceData) {
        const voiceElement = createVoicePlayer(message.voiceData, message.voiceDuration);
        bubble.appendChild(voiceElement);
    } 
    else if (message.videoData) {
        const videoElement = createVideoPlayer(message.videoData);
        bubble.appendChild(videoElement);
    }
    else if (!message.deleted) {
        const text = document.createElement("p");
        text.className = "message-text";
        text.textContent = message.text || "";
        bubble.appendChild(text);
    } else {
        const text = document.createElement("p");
        text.className = "message-text muted-text";
        text.textContent = "Сообщение удалено";
        bubble.appendChild(text);
    }

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("time");
    time.textContent = `${formatShortTime(message.timestamp)}${message.editedAt ? " · изменено" : ""}`;
    meta.appendChild(time);

    if (isOwn && !message.deleted) {
        const actions = document.createElement("span");
        actions.className = "message-actions";

        if (!message.voiceData && !message.videoData) {
            const editBtn = messageAction("Изменить", "edit");
            editBtn.addEventListener("click", () => beginEditMessage(message));
            actions.appendChild(editBtn);
        }

        const deleteBtn = messageAction("Удалить", "delete");
        deleteBtn.addEventListener("click", () => deleteMessage(message.id));
        actions.appendChild(deleteBtn);

        meta.appendChild(actions);
    }

    bubble.appendChild(meta);
    item.appendChild(bubble);
    return item;
}

function createVoicePlayer(voiceDataUrl, duration) {
    const container = document.createElement("div");
    container.className = "voice-message";
    
    const playBtn = document.createElement("button");
    playBtn.className = "voice-play-btn";
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    
    const waveform = document.createElement("div");
    waveform.className = "voice-waveform";
    
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement("div");
        bar.className = "waveform-bar";
        bar.style.height = `${Math.random() * 20 + 5}px`;
        waveform.appendChild(bar);
    }
    
    const durationSpan = document.createElement("span");
    durationSpan.className = "voice-duration";
    durationSpan.textContent = formatDuration(duration || 0);
    
    const audio = new Audio(voiceDataUrl);
    audio.preload = "metadata";
    
    let isPlaying = false;
    
    playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPlaying) {
            audio.pause();
            playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            isPlaying = false;
            container.classList.remove("playing");
        } else {
            audio.play();
            playBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            isPlaying = true;
            container.classList.add("playing");
        }
    });
    
    audio.addEventListener("ended", () => {
        playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        isPlaying = false;
        container.classList.remove("playing");
    });
    
    container.append(playBtn, waveform, durationSpan);
    return container;
}

function createVideoPlayer(videoDataUrl) {
    const container = document.createElement("div");
    container.className = "video-message";
    
    const video = document.createElement("video");
    video.src = videoDataUrl;
    video.controls = true;
    video.preload = "metadata";
    video.className = "video-player";
    
    container.appendChild(video);
    return container;
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function sendOrUpdateMessage() {
    if (!state.activeChatId || !state.activePartner) {
        alert("Сначала выберите диалог");
        return;
    }
    
    const text = els.messageInput.value.trim();
    if (!text) return;

    try {
        if (state.editingMessageId) {
            await db.ref(`private_messages/${state.activeChatId}/${state.editingMessageId}`).update({
                text,
                editedAt: Date.now()
            });
            await updateChatLastMessage(text);
            cancelEditMessage();
            return;
        }

        await db.ref(`private_messages/${state.activeChatId}`).push({
            senderId: state.user.uid,
            text,
            timestamp: Date.now(),
            editedAt: null,
            deleted: false
        });
        await updateChatLastMessage(text);
        els.messageInput.value = "";
        updateCharCounter();
        await clearTypingIndicator();
    } catch (error) {
        console.error("Send message error:", error);
        if (error.message && error.message.includes("permission_denied")) {
            alert("Нет прав для отправки сообщения. Проверьте правила безопасности Firebase.");
        } else {
            alert(`Не удалось отправить сообщение: ${error.message}`);
        }
    }
}

async function startRecording(type) {
    if (!state.activeChatId) {
        alert("Сначала выберите диалог");
        return;
    }
    
    if (state.isRecording) {
        alert("Уже идет запись");
        return;
    }
    
    await stopRecording(true);
    state.currentRecordType = type;
    state.recordedChunks = [];
    state.isRecording = true;
    
    try {
        if (type === 'voice') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);
            
            state.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    state.recordedChunks.push(event.data);
                }
            };
            
            state.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
            };
            
            state.recordingStartTime = Date.now();
            state.mediaRecorder.start(100);
            
            if (els.voiceRecorderPanel) els.voiceRecorderPanel.classList.remove("hidden");
            startTimer('voice');
            startWaveformAnimation();
            
        } else if (type === 'video') {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            state.videoStream = stream;
            if (els.videoPreview) els.videoPreview.srcObject = stream;
            
            state.mediaRecorder = new MediaRecorder(stream);
            
            state.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    state.recordedChunks.push(event.data);
                }
            };
            
            state.mediaRecorder.onstop = () => {
                if (state.videoStream) {
                    state.videoStream.getTracks().forEach(track => track.stop());
                    state.videoStream = null;
                }
                if (els.videoPreview) els.videoPreview.srcObject = null;
            };
            
            state.recordingStartTime = Date.now();
            state.mediaRecorder.start(100);
            
            if (els.videoRecorderPanel) els.videoRecorderPanel.classList.remove("hidden");
            if (els.sendVideoBtn) els.sendVideoBtn.disabled = false;
            startTimer('video');
        }
        
        els.messageInput.disabled = true;
        if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = true;
        if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = true;
        if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = true;
        
    } catch (error) {
        console.error("Recording error:", error);
        alert("Не удалось получить доступ к микрофону/камере. Проверьте разрешения.");
        cancelRecording();
    }
}

function startTimer(type) {
    if (state.recordingTimer) clearInterval(state.recordingTimer);
    
    state.recordingTimer = setInterval(() => {
        if (!state.recordingStartTime) return;
        const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (type === 'voice' && els.voiceTimer) {
            els.voiceTimer.textContent = timeStr;
        } else if (type === 'video' && els.videoTimer) {
            els.videoTimer.textContent = timeStr;
        }
        
        if (elapsed >= 60) {
            if (type === 'voice') {
                sendVoiceRecording();
            } else {
                sendVideoRecording();
            }
        }
    }, 1000);
}

function startWaveformAnimation() {
    if (!els.waveformCanvas) return;
    
    const canvas = els.waveformCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth || 200;
    canvas.height = canvas.clientHeight || 40;
    
    function draw() {
        if (!els.waveformCanvas || !state.isRecording) return;
        ctx.fillStyle = 'rgba(42, 171, 238, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barCount = 40;
        const barWidth = (canvas.width / barCount) - 2;
        
        for (let i = 0; i < barCount; i++) {
            const height = Math.random() * canvas.height;
            ctx.fillStyle = '#2aabee';
            ctx.fillRect(i * (barWidth + 2), canvas.height - height, barWidth, height);
        }
        
        state.waveformAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
}

function stopWaveformAnimation() {
    if (state.waveformAnimationId) {
        cancelAnimationFrame(state.waveformAnimationId);
        state.waveformAnimationId = null;
    }
    
    if (els.waveformCanvas) {
        const ctx = els.waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, els.waveformCanvas.width, els.waveformCanvas.height);
    }
}

async function stopRecording(keepChunks = false) {
    if (state.recordingTimer) {
        clearInterval(state.recordingTimer);
        state.recordingTimer = null;
    }
    
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        try {
            state.mediaRecorder.stop();
        } catch (e) {
            console.log("Recorder already stopped");
        }
    }
    
    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
        state.videoStream = null;
        if (els.videoPreview) els.videoPreview.srcObject = null;
    }
    
    stopWaveformAnimation();
    
    if (!keepChunks) {
        state.recordedChunks = [];
    }
    
    state.isRecording = false;
}

async function cancelRecording() {
    await stopRecording(false);
    
    state.currentRecordType = null;
    state.recordingStartTime = null;
    
    if (els.voiceRecorderPanel) els.voiceRecorderPanel.classList.add("hidden");
    if (els.videoRecorderPanel) els.videoRecorderPanel.classList.add("hidden");
    
    if (state.activeChatId) {
        els.messageInput.disabled = false;
        if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
    }
    if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
    if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;
    
    if (els.videoTimer) els.videoTimer.textContent = "00:00";
    if (els.voiceTimer) els.voiceTimer.textContent = "00:00";
}

async function sendVoiceRecording() {
    if (!state.isRecording || state.recordedChunks.length === 0) {
        cancelRecording();
        return;
    }
    
    try {
        await stopRecording(true);
        
        const duration = (Date.now() - state.recordingStartTime) / 1000;
        const blob = new Blob(state.recordedChunks, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await db.ref(`private_messages/${state.activeChatId}`).push({
                    senderId: state.user.uid,
                    voiceData: reader.result,
                    voiceDuration: duration,
                    timestamp: Date.now(),
                    editedAt: null,
                    deleted: false
                });
                await updateChatLastMessage("🎤 Голосовое сообщение");
                
                state.recordedChunks = [];
                state.currentRecordType = null;
                state.recordingStartTime = null;
                state.isRecording = false;
                
                if (els.voiceRecorderPanel) els.voiceRecorderPanel.classList.add("hidden");
                if (els.voiceTimer) els.voiceTimer.textContent = "00:00";
                
                els.messageInput.disabled = false;
                if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
                if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
                if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;
                
            } catch (error) {
                console.error("Send voice error:", error);
                if (error.message && error.message.includes("permission_denied")) {
                    alert("Нет прав для отправки голосового сообщения. Проверьте правила безопасности Firebase.");
                } else {
                    alert(`Не удалось отправить голосовое сообщение: ${error.message}`);
                }
                cancelRecording();
            }
        };
        
        reader.onerror = () => {
            console.error("FileReader error");
            alert("Ошибка при обработке записи");
            cancelRecording();
        };
        
        reader.readAsDataURL(blob);
        
    } catch (error) {
        console.error("Send voice error:", error);
        alert(`Не удалось отправить голосовое сообщение: ${error.message}`);
        cancelRecording();
    }
}

async function sendVideoRecording() {
    if (!state.isRecording || state.recordedChunks.length === 0) {
        cancelRecording();
        return;
    }
    
    try {
        await stopRecording(true);
        
        const duration = (Date.now() - state.recordingStartTime) / 1000;
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await db.ref(`private_messages/${state.activeChatId}`).push({
                    senderId: state.user.uid,
                    videoData: reader.result,
                    videoDuration: duration,
                    timestamp: Date.now(),
                    editedAt: null,
                    deleted: false
                });
                await updateChatLastMessage("📹 Видеосообщение");
                
                state.recordedChunks = [];
                state.currentRecordType = null;
                state.recordingStartTime = null;
                state.isRecording = false;
                
                if (els.videoRecorderPanel) els.videoRecorderPanel.classList.add("hidden");
                if (els.videoTimer) els.videoTimer.textContent = "00:00";
                
                els.messageInput.disabled = false;
                if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
                if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
                if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;
                
            } catch (error) {
                console.error("Send video error:", error);
                if (error.message && error.message.includes("permission_denied")) {
                    alert("Нет прав для отправки видео. Проверьте правила безопасности Firebase.");
                } else {
                    alert(`Не удалось отправить видеосообщение: ${error.message}`);
                }
                cancelRecording();
            }
        };
        
        reader.onerror = () => {
            console.error("FileReader error");
            alert("Ошибка при обработке видео");
            cancelRecording();
        };
        
        reader.readAsDataURL(blob);
        
    } catch (error) {
        console.error("Send video error:", error);
        alert(`Не удалось отправить видеосообщение: ${error.message}`);
        cancelRecording();
    }
}

async function updateChatLastMessage(text, timestamp = Date.now()) {
    try {
        await db.ref(`user_chats/${state.user.uid}/${state.activeChatId}`).update({
            lastMessage: text,
            lastTimestamp: timestamp,
            partnerId: state.activePartner.uid,
            partnerName: state.activePartner.nickname,
            partnerUsername: state.activePartner.username,
            partnerAvatarUrl: state.activePartner.avatarUrl || "",
            partnerBio: state.activePartner.bio || ""
        });
        await db.ref(`user_chats/${state.activePartner.uid}/${state.activeChatId}`).update({
            lastMessage: text,
            lastTimestamp: timestamp,
            partnerId: state.user.uid,
            partnerName: state.profile.nickname,
            partnerUsername: state.profile.username,
            partnerAvatarUrl: state.profile.avatarUrl || "",
            partnerBio: state.profile.bio || ""
        });
    } catch (error) {
        console.error("Update chat last message error:", error);
    }
}

function beginEditMessage(message) {
    if (message.voiceData || message.videoData) return;
    state.editingMessageId = message.id;
    els.messageInput.value = message.text;
    els.messageInput.focus();
    els.editBanner.classList.remove("hidden");
    updateCharCounter();
}

function cancelEditMessage() {
    state.editingMessageId = null;
    els.editBanner.classList.add("hidden");
    if (els.messageInput) {
        els.messageInput.value = "";
        updateCharCounter();
    }
}

async function deleteMessage(messageId) {
    if (!confirm("Удалить сообщение?")) return;
    try {
        await db.ref(`private_messages/${state.activeChatId}/${messageId}`).update({
            deleted: true,
            text: "",
            deletedAt: Date.now()
        });
        await syncLastMessageAfterDelete();
    } catch (error) {
        console.error("Delete message error:", error);
        alert("Не удалось удалить сообщение. Проверьте правила безопасности.");
    }
}

async function syncLastMessageAfterDelete() {
    if (!state.activeChatId || !state.activePartner) return;
    try {
        const snap = await db.ref(`private_messages/${state.activeChatId}`).orderByChild("timestamp").limitToLast(30).once("value");
        const messages = Object.values(snap.val() || {})
            .filter(message => !message.deleted)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const latest = messages[0];
        await updateChatLastMessage(latest ? (latest.text || latest.voiceData ? "🎤 Голосовое" : latest.videoData ? "📹 Видео" : "Сообщение") : "Сообщений нет", latest ? latest.timestamp : Date.now());
    } catch (error) {
        console.error("Sync last message error:", error);
    }
}

async function deleteCurrentDialog() {
    if (!state.activeChatId || !confirm("Удалить диалог из списка? Сообщения у собеседника останутся.")) return;
    try {
        await db.ref(`user_chats/${state.user.uid}/${state.activeChatId}`).remove();
        renderEmptyChat();
    } catch (error) {
        console.error("Delete dialog error:", error);
        alert("Не удалось удалить диалог. Проверьте правила безопасности.");
    }
}

function renderEmptyChat() {
    state.activeChatId = null;
    state.activePartner = null;
    els.currentChatTitle.textContent = "Выберите диалог";
    els.currentChatSubtitle.textContent = "Сообщения появятся здесь";
    els.chatAvatar.textContent = "L";
    els.chatAvatar.style.backgroundImage = "";
    els.chatAvatar.classList.add("muted");
    els.deleteDialogBtn.classList.add("hidden");
    els.messageInput.disabled = true;
    if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = true;
    if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = true;
    if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = true;
    
    if (els.telegramBottomUI) {
        els.telegramBottomUI.classList.add('hidden');
    }
    
    els.messagesContainer.replaceChildren(emptyBlock("Добро пожаловать", "Найдите пользователя по username или откройте существующий диалог."));
    updateScrollState();
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
}

function renderLoadingMessages() {
    els.messagesContainer.replaceChildren(emptyBlock("Загрузка", "Получаем историю сообщений."));
}

function listenTyping(chatId) {
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);

    const ref = db.ref(`typing/${chatId}`);
    const callback = snap => {
        const data = snap.val() || {};
        const typingUsers = Object.entries(data).filter(([uid]) => uid !== state.user.uid);
        els.typingIndicatorContainer.classList.toggle("hidden", typingUsers.length === 0);
        if (typingUsers.length) {
            els.typingText.textContent = `${typingUsers[0][1].name || "Собеседник"} печатает...`;
        }
    };
    ref.on("value", callback);
    state.typingListener = { ref, callback };
}

function updateTyping(isTyping) {
    if (!state.activeChatId || !state.user || state.editingMessageId || state.isRecording) return;
    const ref = db.ref(`typing/${state.activeChatId}/${state.user.uid}`);
    if (isTyping) {
        ref.set({ name: state.profile.nickname, timestamp: Date.now() });
    } else {
        ref.remove();
    }
}

function clearTypingIndicator() {
    if (!state.activeChatId || !state.user) return Promise.resolve();
    return db.ref(`typing/${state.activeChatId}/${state.user.uid}`).remove();
}

async function refreshOwnDialogCards() {
    try {
        const snap = await db.ref(`user_chats/${state.user.uid}`).once("value");
        const chats = snap.val() || {};
        const updates = {};

        Object.entries(chats).forEach(([chatId, info]) => {
            if (!info.partnerId) return;
            updates[`user_chats/${info.partnerId}/${chatId}/partnerName`] = state.profile.nickname;
            updates[`user_chats/${info.partnerId}/${chatId}/partnerUsername`] = state.profile.username;
            updates[`user_chats/${info.partnerId}/${chatId}/partnerAvatarUrl`] = state.profile.avatarUrl || "";
            updates[`user_chats/${info.partnerId}/${chatId}/partnerBio`] = state.profile.bio || "";
        });

        if (Object.keys(updates).length) await db.ref().update(updates);
    } catch (error) {
        console.error("Refresh dialog cards error:", error);
    }
}

async function findUidByUsername(username) {
    const clean = normalizeUsername(username);
    try {
        const direct = (await db.ref(`usernames/${clean}`).once("value")).val();
        if (typeof direct === "string") return direct;
    } catch (error) {
        console.error("Error finding username:", error);
        return null;
    }

    try {
        const legacyMap = (await db.ref("usernames").once("value")).val() || {};
        for (const [key, value] of Object.entries(legacyMap)) {
            if (value === clean) return key;
        }
    } catch (error) {
        console.error("Error reading usernames:", error);
        return null;
    }
    return null;
}

async function setUsernameIndex(username, uid) {
    await db.ref(`usernames/${username}`).set(uid);
}

async function removeUsernameIndex(username, uid) {
    if (!username) return;
    const current = await db.ref(`usernames/${username}`).once("value");
    if (current.val() === uid) await db.ref(`usernames/${username}`).remove();
    const legacy = await db.ref(`usernames/${uid}`).once("value");
    if (legacy.val() === username) await db.ref(`usernames/${uid}`).remove();
}

function initTheme() {
    const saved = localStorage.getItem("localgram-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("localgram-theme", nextTheme);
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (els.themeToggleBtn) els.themeToggleBtn.classList.toggle("active", theme === "dark");
}

function setAvatar(element, label, avatarUrl) {
    if (!element) return;
    element.textContent = "";
    element.style.backgroundImage = "";
    element.classList.remove("has-image");

    if (avatarUrl && (/^https?:\/\//i.test(avatarUrl) || /^data:image\//i.test(avatarUrl))) {
        const image = document.createElement("img");
        image.src = avatarUrl;
        image.alt = label || "avatar";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => {
            element.classList.remove("has-image");
            element.replaceChildren(document.createTextNode(getInitials(label)));
        }, { once: true });
        element.classList.add("has-image");
        element.appendChild(image);
        return;
    }

    element.textContent = getInitials(label);
}

function compressAvatar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("не удалось прочитать файл"));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("файл не похож на картинку"));
            image.onload = () => {
                const size = 256;
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                const sourceSize = Math.min(image.width, image.height);
                const sourceX = Math.floor((image.width - sourceSize) / 2);
                const sourceY = Math.floor((image.height - sourceSize) / 2);

                canvas.width = size;
                canvas.height = size;
                context.imageSmoothingQuality = "high";
                context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function scrollMessagesToBottom(smooth) {
    requestAnimationFrame(() => {
        els.messagesContainer.scrollTo({
            top: els.messagesContainer.scrollHeight,
            behavior: smooth ? "smooth" : "auto"
        });
        state.isAtBottom = true;
        window.setTimeout(updateScrollState, smooth ? 220 : 0);
    });
}

function updateScrollState() {
    if (!state.activeChatId) {
        els.scrollBottomBtn.classList.add("hidden");
        return;
    }

    const { scrollTop, scrollHeight, clientHeight } = els.messagesContainer;
    const hasOverflow = scrollHeight > clientHeight + 24;
    state.isAtBottom = scrollHeight - scrollTop - clientHeight < 96;
    els.scrollBottomBtn.classList.toggle("hidden", !hasOverflow);
    els.scrollBottomBtn.classList.toggle("at-bottom", state.isAtBottom);
}

function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function isValidUsername(username) {
    return /^[a-z0-9_]{3,24}$/.test(username);
}

function updateCharCounter() {
    if (els.charCounter) {
        els.charCounter.textContent = `${els.messageInput.value.length}/500`;
    }
}

function getInitials(value) {
    const clean = String(value || "L").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
}

function formatShortTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDateGroup(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Сегодня";
    if (date.toDateString() === yesterday.toDateString()) return "Вчера";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function emptyBlock(title, text) {
    const block = document.createElement("div");
    block.className = "empty-state";
    const logo = document.createElement("div");
    logo.className = "empty-logo";
    logo.textContent = "L";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    block.append(logo, heading, paragraph);
    return block;
}

function searchMessage(text) {
    const item = document.createElement("div");
    item.className = "search-result-item muted-result";
    item.textContent = text;
    return item;
}

function messageAction(label, type) {
    const button = document.createElement("button");
    button.className = `message-action ${type}`;
    button.type = "button";
    button.textContent = label;
    return button;
}ы