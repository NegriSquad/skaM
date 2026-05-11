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
const storage = firebase.storage();

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
    audioChunks: [],
    isRecording: false,
    recordingStartTime: null,
    currentCall: null,
    peerConnection: null,
    localStream: null,
    callType: null,
    callListener: null,
    selectedVideoFile: null,
    onlineStatusListener: null,
    notificationPermission: false,
    unreadMessages: {}
};

const els = {};

// ========== INITIALIZATION ==========
document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    initTheme(); // Define this first
    bindEvents();
    updateCharCounter();
    initScrollHandler();
    auth.onAuthStateChanged(handleAuthState);
    initNotifications();
    initOnlineStatus();
});

// ========== THEME FUNCTIONS (defined first) ==========
function initTheme() {
    const saved = localStorage.getItem("skam-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("skam-theme", nextTheme);
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (els.themeToggleBtn) els.themeToggleBtn.classList.toggle("active", theme === "dark");
}

// ========== DOM ELEMENTS ==========
function bindElements() {
    const ids = [
        "loginScreen", "registerScreen", "mainAppScreen", "loginEmail", "loginPassword",
        "doLoginBtn", "showRegisterBtn", "regEmail", "regUsername", "regNickname",
        "regPassword", "doRegisterBtn", "showLoginFromRegBtn", "globalLogoutBtn",
        "openProfileBtn", "themeToggleBtn", "sidebarAvatar", "sidebarName", "sidebarUsername",
        "searchUserInput", "searchUserBtn", "searchResults", "dialogsList",
        "dialogsCount", "chatArea", "backToDialogsBtn", "chatAvatar", "currentChatTitle",
        "currentChatSubtitle", "deleteDialogBtn", "messagesContainer", "typingIndicatorContainer",
        "typingText", "scrollBottomBtn", "messageInput", "sendBtn", "charCounter", "editBanner",
        "cancelEditBtn", "profileModal", "closeProfileBtn", "profileAvatarPreview",
        "profilePreviewName", "profilePreviewUsername", "profileNickname",
        "profileUsername", "profileAvatarFile", "removeAvatarBtn", "profileBio", "saveProfileBtn",
        "voiceCallBtn", "videoCallBtn", "callModal", "callAvatar", "callerName", "callStatus",
        "videoContainer", "localVideo", "remoteVideo", "toggleMicBtn", "toggleVideoBtn", "endCallBtn", "closeCallBtn",
        "attachBtn", "voiceRecordBtn", "recordingStatus", "videoUploadModal", "videoFileInput", "videoPreview", "sendVideoBtn", "cancelVideoBtn",
        "sidebarStatus", "chatStatus"
    ];
    
    ids.forEach(id => {
        els[id] = document.getElementById(id);
    });
}

// ========== EVENT BINDINGS ==========
function bindEvents() {
    if (els.doLoginBtn) els.doLoginBtn.addEventListener("click", loginUser);
    if (els.doRegisterBtn) els.doRegisterBtn.addEventListener("click", registerUser);
    if (els.showRegisterBtn) els.showRegisterBtn.addEventListener("click", () => showAuthScreen("register"));
    if (els.showLoginFromRegBtn) els.showLoginFromRegBtn.addEventListener("click", () => showAuthScreen("login"));
    if (els.globalLogoutBtn) els.globalLogoutBtn.addEventListener("click", logout);
    if (els.openProfileBtn) els.openProfileBtn.addEventListener("click", openProfileModal);
    if (els.themeToggleBtn) els.themeToggleBtn.addEventListener("click", toggleTheme);
    if (els.closeProfileBtn) els.closeProfileBtn.addEventListener("click", closeProfileModal);
    if (els.saveProfileBtn) els.saveProfileBtn.addEventListener("click", saveProfile);
    if (els.profileAvatarFile) els.profileAvatarFile.addEventListener("change", handleAvatarFileSelect);
    if (els.removeAvatarBtn) els.removeAvatarBtn.addEventListener("click", removeSelectedAvatar);
    if (els.profileModal) els.profileModal.addEventListener("click", event => {
        if (event.target === els.profileModal) closeProfileModal();
    });

    if (els.searchUserBtn) els.searchUserBtn.addEventListener("click", () => searchUserByUsername(els.searchUserInput.value));
    if (els.searchUserInput) {
        els.searchUserInput.addEventListener("keydown", event => {
            if (event.key === "Enter") searchUserByUsername(els.searchUserInput.value);
        });
        els.searchUserInput.addEventListener("input", () => {
            clearTimeout(state.searchTimer);
            state.searchTimer = setTimeout(() => {
                if (els.searchUserInput.value.trim().length >= 3) searchUserByUsername(els.searchUserInput.value);
            }, 350);
        });
    }

    if (els.sendBtn) els.sendBtn.addEventListener("click", sendOrUpdateMessage);
    if (els.cancelEditBtn) els.cancelEditBtn.addEventListener("click", cancelEditMessage);
    if (els.deleteDialogBtn) els.deleteDialogBtn.addEventListener("click", deleteCurrentDialog);
    if (els.scrollBottomBtn) els.scrollBottomBtn.addEventListener("click", () => scrollMessagesToBottom(true));
    if (els.backToDialogsBtn) els.backToDialogsBtn.addEventListener("click", () => {
        if (els.chatArea) els.chatArea.classList.remove("open");
    });
    
    if (els.voiceCallBtn) els.voiceCallBtn.addEventListener("click", () => startCall('audio'));
    if (els.videoCallBtn) els.videoCallBtn.addEventListener("click", () => startCall('video'));
    if (els.endCallBtn) els.endCallBtn.addEventListener("click", endCall);
    if (els.closeCallBtn) els.closeCallBtn.addEventListener("click", closeCallModal);
    if (els.toggleMicBtn) els.toggleMicBtn.addEventListener("click", toggleMicrophone);
    if (els.toggleVideoBtn) els.toggleVideoBtn.addEventListener("click", toggleVideo);
    
    if (els.attachBtn) els.attachBtn.addEventListener("click", openVideoUpload);
    if (els.voiceRecordBtn) els.voiceRecordBtn.addEventListener("click", toggleVoiceRecording);
    if (els.sendVideoBtn) els.sendVideoBtn.addEventListener("click", sendVideoMessage);
    if (els.cancelVideoBtn) els.cancelVideoBtn.addEventListener("click", closeVideoUpload);
    if (els.videoFileInput) els.videoFileInput.addEventListener("change", previewVideo);

    if (els.messageInput) {
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
    }
}

function initScrollHandler() {
    if (els.messagesContainer) {
        els.messagesContainer.addEventListener("scroll", () => {
            updateScrollState();
        });
        updateScrollState();
    }
}

// ========== AUTH FUNCTIONS ==========
async function handleAuthState(user) {
    if (!user) {
        resetSession();
        showAuthScreen("login");
        return;
    }

    state.user = user;
    const snap = await db.ref(`users/${user.uid}`).once("value");
    state.profile = snap.val();

    if (!state.profile) {
        alert("Профиль пользователя не найден.");
        await auth.signOut();
        return;
    }

    showMainApp();
    listenForCalls();
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
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }
}

function detachListeners() {
    if (state.dialogsListener) state.dialogsListener.ref?.off("value", state.dialogsListener.callback);
    if (state.messagesListener) state.messagesListener.ref?.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref?.off("value", state.typingListener.callback);
    if (state.callListener) state.callListener?.off();
    if (state.onlineStatusListener) state.onlineStatusListener?.off();
    state.dialogsListener = null;
    state.messagesListener = null;
    state.typingListener = null;
    state.callListener = null;
    state.onlineStatusListener = null;
}

// ========== REGISTER/LOGIN ==========
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
    await auth.signOut();
}

// ========== PROFILE FUNCTIONS ==========
function renderCurrentProfile() {
    const profile = state.profile || {};
    setAvatar(els.sidebarAvatar, profile.nickname || profile.username, profile.avatarUrl);
    if (els.sidebarName) els.sidebarName.textContent = profile.nickname || "Профиль";
    if (els.sidebarUsername) els.sidebarUsername.textContent = `@${profile.username || "username"}`;
}

function openProfileModal() {
    const profile = state.profile || {};
    if (els.profileNickname) els.profileNickname.value = profile.nickname || "";
    if (els.profileUsername) els.profileUsername.value = profile.username || "";
    if (els.profileAvatarFile) els.profileAvatarFile.value = "";
    state.selectedAvatarDataUrl = profile.avatarUrl || "";
    if (els.profileBio) els.profileBio.value = profile.bio || "";
    updateProfilePreview();
    if (els.profileModal) els.profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    if (els.profileModal) els.profileModal.classList.add("hidden");
}

async function saveProfile() {
    const nickname = els.profileNickname?.value.trim() || "";
    const username = normalizeUsername(els.profileUsername?.value || "");
    const avatarUrl = state.selectedAvatarDataUrl || "";
    const bio = els.profileBio?.value.trim() || "";

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
    const nickname = els.profileNickname?.value.trim() || "Имя";
    const username = normalizeUsername(els.profileUsername?.value || "") || "username";
    setAvatar(els.profileAvatarPreview, nickname, state.selectedAvatarDataUrl);
    if (els.profilePreviewName) els.profilePreviewName.textContent = nickname;
    if (els.profilePreviewUsername) els.profilePreviewUsername.textContent = `@${username}`;
}

async function handleAvatarFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Выберите файл изображения.");
        if (els.profileAvatarFile) els.profileAvatarFile.value = "";
        return;
    }

    try {
        state.selectedAvatarDataUrl = await compressAvatar(file);
        updateProfilePreview();
    } catch (error) {
        alert(`Не удалось обработать аватарку: ${error.message}`);
        if (els.profileAvatarFile) els.profileAvatarFile.value = "";
    }
}

function removeSelectedAvatar() {
    state.selectedAvatarDataUrl = "";
    if (els.profileAvatarFile) els.profileAvatarFile.value = "";
    updateProfilePreview();
}

// ========== DIALOGS ==========
function listenDialogs() {
    if (state.dialogsListener) state.dialogsListener.ref?.off("value", state.dialogsListener.callback);

    const ref = db.ref(`user_chats/${state.user.uid}`);
    const callback = snap => renderDialogs(snap.val() || {});
    ref.on("value", callback);
    state.dialogsListener = { ref, callback };
}

function renderDialogs(chats) {
    const entries = Object.entries(chats).sort((a, b) => (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0));
    if (!els.dialogsList) return;
    els.dialogsList.replaceChildren();
    if (els.dialogsCount) els.dialogsCount.textContent = entries.length;

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

        const avatarWrapper = document.createElement("div");
        avatarWrapper.className = "avatar-wrapper";
        
        const avatar = document.createElement("span");
        avatar.className = "avatar";
        setAvatar(avatar, info.partnerName || info.partnerUsername, info.partnerAvatarUrl);
        
        const statusDot = document.createElement("span");
        statusDot.className = "status-dot offline";
        
        avatarWrapper.append(avatar, statusDot);

        const content = document.createElement("span");
        content.className = "dialog-content";

        const name = document.createElement("strong");
        name.textContent = info.partnerName || `@${info.partnerUsername}`;

        const last = document.createElement("small");
        last.textContent = info.lastMessage || "Диалог создан";

        const meta = document.createElement("time");
        meta.textContent = info.lastTimestamp ? formatShortTime(info.lastTimestamp) : "";

        content.append(name, last);
        item.append(avatarWrapper, content, meta);
        els.dialogsList.appendChild(item);
        
        // Listen to online status for this dialog
        listenUserOnlineStatus(info.partnerId, (isOnline) => {
            statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        });
    });
}

// ========== ONLINE STATUS ==========
async function initOnlineStatus() {
    setInterval(async () => {
        if (state.user) {
            await db.ref(`users/${state.user.uid}/online`).set({
                status: true,
                lastSeen: Date.now()
            });
        }
    }, 30000);
    
    window.addEventListener('beforeunload', async () => {
        if (state.user) {
            await db.ref(`users/${state.user.uid}/online`).set({
                status: false,
                lastSeen: Date.now()
            });
        }
    });
}

function listenUserOnlineStatus(userId, callback) {
    const statusRef = db.ref(`users/${userId}/online`);
    statusRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data.status, data.lastSeen);
        } else {
            callback(false, null);
        }
    });
    return statusRef;
}

function updateChatStatus(isOnline, lastSeen) {
    if (!els.chatStatus || !els.currentChatSubtitle) return;
    
    if (isOnline) {
        els.chatStatus.className = "status-dot online";
        els.currentChatSubtitle.textContent = "онлайн";
    } else if (lastSeen) {
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diff = now - lastSeenDate;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) {
            els.currentChatSubtitle.textContent = "был(а) только что";
        } else if (minutes < 60) {
            els.currentChatSubtitle.textContent = `был(а) ${minutes} мин назад`;
        } else if (minutes < 1440) {
            const hours = Math.floor(minutes / 60);
            els.currentChatSubtitle.textContent = `был(а) ${hours} ч назад`;
        } else {
            const days = Math.floor(minutes / 1440);
            els.currentChatSubtitle.textContent = `был(а) ${days} дн назад`;
        }
        els.chatStatus.className = "status-dot offline";
    } else {
        els.currentChatSubtitle.textContent = "не в сети";
        els.chatStatus.className = "status-dot offline";
    }
}

// ========== SEARCH ==========
async function searchUserByUsername(rawUsername) {
    const username = normalizeUsername(rawUsername);
    if (!els.searchResults) return;
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

        const userData = (await db.ref(`users/${uid}`).once("value")).val();
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
        text.querySelector("strong").textContent = userData.nickname;
        text.querySelector("small").textContent = `@${userData.username}`;

        const button = document.createElement("button");
        button.className = "small-btn";
        button.textContent = "Написать";
        button.addEventListener("click", () => startDialogWith(uid, userData));

        item.append(avatar, text, button);
        els.searchResults.appendChild(item);
    } catch (error) {
        els.searchResults.appendChild(searchMessage(`Ошибка поиска: ${error.message}`));
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

    if (els.searchUserInput) els.searchUserInput.value = "";
    if (els.searchResults) els.searchResults.classList.add("hidden");
    openChat(chatId, { uid, nickname: userData.nickname, username: userData.username, avatarUrl: userData.avatarUrl || "", bio: userData.bio || "" });
}

// ========== CHAT FUNCTIONS ==========
function openChat(chatId, partner) {
    state.activeChatId = chatId;
    state.activePartner = partner;
    state.editingMessageId = null;
    cancelEditMessage();

    if (els.currentChatTitle) els.currentChatTitle.textContent = partner.nickname || `@${partner.username}`;
    setAvatar(els.chatAvatar, partner.nickname || partner.username, partner.avatarUrl);
    if (els.chatAvatar) els.chatAvatar.classList.remove("muted");
    if (els.deleteDialogBtn) els.deleteDialogBtn.classList.remove("hidden");
    if (els.messageInput) els.messageInput.disabled = false;
    if (els.sendBtn) els.sendBtn.disabled = false;
    
    if (els.voiceCallBtn) els.voiceCallBtn.disabled = false;
    if (els.videoCallBtn) els.videoCallBtn.disabled = false;
    
    if (state.onlineStatusListener) state.onlineStatusListener.off();
    state.onlineStatusListener = listenUserOnlineStatus(partner.uid, (isOnline, lastSeen) => {
        updateChatStatus(isOnline, lastSeen);
    });

    renderLoadingMessages();
    listenMessages(chatId);
    listenTyping(chatId);

    if (window.innerWidth <= 768 && els.chatArea) els.chatArea.classList.add("open");
}

function listenMessages(chatId) {
    if (state.messagesListener) state.messagesListener.ref?.off("value", state.messagesListener.callback);

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
        if (els.messagesContainer) {
            els.messagesContainer.replaceChildren(emptyBlock("Сообщений пока нет", "Напишите первым и начните диалог."));
        }
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
        
        // Mark message as read
        if (message.senderId !== state.user.uid && (!message.readBy || !message.readBy.includes(state.user.uid))) {
            markMessageAsRead(message.id, state.activeChatId);
        }
    });

    if (els.messagesContainer) {
        els.messagesContainer.replaceChildren(fragment);
        if (wasAtBottom) scrollMessagesToBottom(false);
        requestAnimationFrame(updateScrollState);
    }
}

async function markMessageAsRead(messageId, chatId) {
    if (!state.user) return;
    
    const messageRef = db.ref(`private_messages/${chatId}/${messageId}/readBy`);
    const readBy = (await messageRef.once('value')).val() || [];
    
    if (!readBy.includes(state.user.uid)) {
        readBy.push(state.user.uid);
        await messageRef.set(readBy);
    }
}

function getMessageStatus(message) {
    if (!message) return '';
    
    const isOwn = message.senderId === state.user?.uid;
    if (!isOwn) return '';
    
    const readBy = message.readBy || [];
    const isRead = readBy.length > 0 && readBy.includes(state.activePartner?.uid);
    const isDelivered = message.delivered || readBy.length > 0;
    
    if (isRead) {
        return '<span class="message-status"><span class="read">✓✓</span></span>';
    } else if (isDelivered) {
        return '<span class="message-status"><span class="delivered">✓✓</span></span>';
    } else {
        return '<span class="message-status"><span class="sent">✓</span></span>';
    }
}

function createMessageNode(message) {
    const isOwn = message.senderId === state.user.uid;
    const item = document.createElement("article");
    item.className = `message-item ${isOwn ? "own-message" : ""}`;
    item.dataset.messageId = message.id;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    let content;
    
    if (message.type === 'video' && message.videoUrl) {
        content = document.createElement("div");
        content.className = "message-video";
        const video = document.createElement("video");
        video.src = message.videoUrl;
        video.controls = true;
        video.preload = "metadata";
        video.style.maxWidth = "250px";
        video.style.borderRadius = "8px";
        content.appendChild(video);
    } else if (message.type === 'voice' && message.voiceUrl) {
        content = document.createElement("div");
        content.className = "message-voice";
        const playBtn = document.createElement("button");
        playBtn.className = "voice-play-btn";
        playBtn.innerHTML = "▶";
        playBtn.onclick = () => {
            const audio = new Audio(message.voiceUrl);
            audio.play();
        };
        const wave = document.createElement("div");
        wave.className = "voice-wave";
        for (let i = 0; i < 5; i++) wave.appendChild(document.createElement("span"));
        const duration = document.createElement("span");
        duration.className = "voice-duration";
        duration.textContent = message.duration || "0:00";
        content.append(playBtn, wave, duration);
    } else {
        const text = document.createElement("p");
        text.className = "message-text";
        text.textContent = message.deleted ? "Сообщение удалено" : (message.text || "");
        if (message.deleted) text.classList.add("muted-text");
        content = text;
    }

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("time");
    time.textContent = `${formatShortTime(message.timestamp)}${message.editedAt ? " · изменено" : ""}`;
    meta.appendChild(time);
    
    if (isOwn && !message.deleted) {
        const statusSpan = document.createElement("span");
        statusSpan.innerHTML = getMessageStatus(message);
        meta.appendChild(statusSpan);
    }

    if (isOwn && !message.deleted && !message.type) {
        const actions = document.createElement("span");
        actions.className = "message-actions";

        const editBtn = messageAction("Изменить", "edit");
        editBtn.addEventListener("click", () => beginEditMessage(message));

        const deleteBtn = messageAction("Удалить", "delete");
        deleteBtn.addEventListener("click", () => deleteMessage(message.id));

        actions.append(editBtn, deleteBtn);
        meta.appendChild(actions);
    }

    bubble.append(content, meta);
    item.appendChild(bubble);
    return item;
}

async function sendOrUpdateMessage() {
    if (!state.activeChatId || !state.activePartner) return;
    const text = els.messageInput?.value.trim();
    if (!text) return;

    try {
        if (state.editingMessageId) {
            await db.ref(`private_messages/${state.activeChatId}/${state.editingMessageId}`).update({
                text,
                editedAt: Date.now()
            });
            await updateChatLastMessage(text);
            cancelEditMessage();
            scrollMessagesToBottom(true);
            return;
        }

        const newMessageRef = db.ref(`private_messages/${state.activeChatId}`).push();
        await newMessageRef.set({
            senderId: state.user.uid,
            text,
            timestamp: Date.now(),
            editedAt: null,
            deleted: false,
            readBy: [state.user.uid]
        });
        
        await updateChatLastMessage(text);
        if (els.messageInput) els.messageInput.value = "";
        updateCharCounter();
        await clearTypingIndicator();
        scrollMessagesToBottom(true);
        
        // Send notification to partner
        await db.ref(`user_chats/${state.activePartner.uid}/${state.activeChatId}/unread`).set(true);
        
    } catch (error) {
        alert(`Не удалось отправить сообщение: ${error.message}`);
    }
}

async function updateChatLastMessage(text, timestamp = Date.now()) {
    if (!state.activeChatId || !state.activePartner) return;
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
        partnerBio: state.profile.bio || "",
        unread: false
    });
}

function beginEditMessage(message) {
    state.editingMessageId = message.id;
    if (els.messageInput) els.messageInput.value = message.text;
    if (els.messageInput) els.messageInput.focus();
    if (els.editBanner) els.editBanner.classList.remove("hidden");
    updateCharCounter();
}

function cancelEditMessage() {
    state.editingMessageId = null;
    if (els.editBanner) els.editBanner.classList.add("hidden");
    if (els.messageInput) {
        els.messageInput.value = "";
        updateCharCounter();
    }
}

async function deleteMessage(messageId) {
    if (!confirm("Удалить сообщение?")) return;
    await db.ref(`private_messages/${state.activeChatId}/${messageId}`).update({
        deleted: true,
        text: "",
        deletedAt: Date.now()
    });
    await syncLastMessageAfterDelete();
}

async function syncLastMessageAfterDelete() {
    if (!state.activeChatId || !state.activePartner) return;
    const snap = await db.ref(`private_messages/${state.activeChatId}`).orderByChild("timestamp").limitToLast(30).once("value");
    const messages = Object.values(snap.val() || {})
        .filter(message => !message.deleted)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const latest = messages[0];
    await updateChatLastMessage(latest ? latest.text : "Сообщений нет", latest ? latest.timestamp : Date.now());
}

async function deleteCurrentDialog() {
    if (!state.activeChatId || !confirm("Удалить диалог из списка? Сообщения у собеседника останутся.")) return;
    await db.ref(`user_chats/${state.user.uid}/${state.activeChatId}`).remove();
    renderEmptyChat();
}

function renderEmptyChat() {
    state.activeChatId = null;
    state.activePartner = null;
    if (els.currentChatTitle) els.currentChatTitle.textContent = "Выберите диалог";
    if (els.currentChatSubtitle) els.currentChatSubtitle.textContent = "Сообщения появятся здесь";
    if (els.chatAvatar) {
        els.chatAvatar.textContent = "sM";
        els.chatAvatar.style.backgroundImage = "";
        els.chatAvatar.classList.add("muted");
    }
    if (els.chatStatus) els.chatStatus.className = "status-dot offline";
    if (els.deleteDialogBtn) els.deleteDialogBtn.classList.add("hidden");
    if (els.messageInput) els.messageInput.disabled = true;
    if (els.sendBtn) els.sendBtn.disabled = true;
    
    if (els.voiceCallBtn) els.voiceCallBtn.disabled = true;
    if (els.videoCallBtn) els.videoCallBtn.disabled = true;
    
    if (els.messagesContainer) {
        els.messagesContainer.replaceChildren(emptyBlock("Добро пожаловать", "Найдите пользователя по username или откройте существующий диалог."));
    }
    updateScrollState();
    if (state.messagesListener) state.messagesListener.ref?.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref?.off("value", state.typingListener.callback);
    if (state.onlineStatusListener) state.onlineStatusListener?.off();
}

function renderLoadingMessages() {
    if (els.messagesContainer) {
        els.messagesContainer.replaceChildren(emptyBlock("Загрузка", "Получаем историю сообщений."));
    }
}

// ========== TYPING ==========
function listenTyping(chatId) {
    if (state.typingListener) state.typingListener.ref?.off("value", state.typingListener.callback);

    const ref = db.ref(`typing/${chatId}`);
    const callback = snap => {
        const data = snap.val() || {};
        const typingUsers = Object.entries(data).filter(([uid]) => uid !== state.user.uid);
        if (els.typingIndicatorContainer) {
            els.typingIndicatorContainer.classList.toggle("hidden", typingUsers.length === 0);
        }
        if (typingUsers.length && els.typingText) {
            els.typingText.textContent = `${typingUsers[0][1].name || "Собеседник"} печатает...`;
        }
    };
    ref.on("value", callback);
    state.typingListener = { ref, callback };
}

function updateTyping(isTyping) {
    if (!state.activeChatId || !state.user || state.editingMessageId) return;
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

// ========== REFRESH ==========
async function refreshOwnDialogCards() {
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
}

// ========== USERNAME INDEX ==========
async function findUidByUsername(username) {
    const clean = normalizeUsername(username);
    const direct = (await db.ref(`usernames/${clean}`).once("value")).val();
    if (typeof direct === "string") return direct;

    const legacyMap = (await db.ref("usernames").once("value")).val() || {};
    for (const [key, value] of Object.entries(legacyMap)) {
        if (value === clean) return key;
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

// ========== AVATAR ==========
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

// ========== SCROLL ==========
function scrollMessagesToBottom(smooth) {
    requestAnimationFrame(() => {
        if (!els.messagesContainer) return;
        els.messagesContainer.scrollTo({
            top: els.messagesContainer.scrollHeight,
            behavior: smooth ? "smooth" : "auto"
        });
        state.isAtBottom = true;
        setTimeout(updateScrollState, smooth ? 200 : 0);
    });
}

function updateScrollState() {
    if (!state.activeChatId) {
        if (els.scrollBottomBtn) els.scrollBottomBtn.classList.add("hidden");
        return;
    }

    if (!els.messagesContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = els.messagesContainer;
    const hasOverflow = scrollHeight > clientHeight + 24;
    const isBottom = scrollHeight - scrollTop - clientHeight < 96;
    state.isAtBottom = isBottom;
    
    if (els.scrollBottomBtn) {
        els.scrollBottomBtn.classList.toggle("hidden", !hasOverflow || isBottom);
    }
}

// ========== UTILITIES ==========
function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function isValidUsername(username) {
    return /^[a-z0-9_]{3,24}$/.test(username);
}

function updateCharCounter() {
    if (els.charCounter && els.messageInput) {
        els.charCounter.textContent = `${els.messageInput.value.length}/500`;
    }
}

function getInitials(value) {
    const clean = String(value || "sM").trim();
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
    logo.textContent = "sM";
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
}

// ========== NOTIFICATIONS ==========
async function initNotifications() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        state.notificationPermission = permission === 'granted';
    }
}

function showNotification(title, body, icon) {
    if (!state.notificationPermission) return;
    if (document.visibilityState === 'visible') return;
    
    const notification = new Notification(title, {
        body: body,
        icon: icon || 'https://via.placeholder.com/64',
        silent: false,
        vibrate: [200, 100, 200]
    });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

// ========== VOICE RECORDING FIXED ==========
async function toggleVoiceRecording() {
    if (state.isRecording) {
        await stopVoiceRecording();
    } else {
        await startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        // Запрашиваем разрешение на микрофон
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Проверяем поддержку форматов
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
            ? 'audio/webm' 
            : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/webm';
        
        state.mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        state.audioChunks = [];
        
        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };
        
        state.mediaRecorder.onstop = async () => {
            // Создаем blob из записанных данных
            const audioBlob = new Blob(state.audioChunks, { type: mimeType });
            await sendVoiceMessage(audioBlob);
            
            // Останавливаем все треки
            stream.getTracks().forEach(track => track.stop());
        };
        
        state.mediaRecorder.start(1000); // Записываем кусками по 1 секунде
        state.isRecording = true;
        state.recordingStartTime = Date.now();
        
        // Обновляем UI
        if (els.voiceRecordBtn) {
            els.voiceRecordBtn.classList.add("recording");
            els.voiceRecordBtn.title = "Остановить запись";
        }
        if (els.recordingStatus) {
            els.recordingStatus.classList.remove("hidden");
            els.recordingStatus.textContent = "🎤 Запись... 0:00";
            
            // Таймер для отображения длительности
            state.recordingTimer = setInterval(() => {
                if (state.isRecording) {
                    const duration = Math.floor((Date.now() - state.recordingStartTime) / 1000);
                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;
                    els.recordingStatus.textContent = `🎤 Запись... ${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 1000);
        }
        
        // Авто-остановка через 60 секунд
        setTimeout(() => {
            if (state.isRecording) {
                stopVoiceRecording();
            }
        }, 60000);
        
    } catch (error) {
        console.error("Microphone error:", error);
        alert("Не удалось получить доступ к микрофону. Пожалуйста, проверьте разрешения.");
    }
}

async function stopVoiceRecording() {
    if (state.mediaRecorder && state.isRecording) {
        // Останавливаем запись
        state.mediaRecorder.stop();
        state.isRecording = false;
        
        // Очищаем таймер
        if (state.recordingTimer) {
            clearInterval(state.recordingTimer);
            state.recordingTimer = null;
        }
        
        // Обновляем UI
        if (els.voiceRecordBtn) {
            els.voiceRecordBtn.classList.remove("recording");
            els.voiceRecordBtn.title = "Голосовое сообщение";
        }
        if (els.recordingStatus) {
            els.recordingStatus.classList.add("hidden");
        }
    }
}

async function sendVoiceMessage(audioBlob) {
    if (!state.activeChatId) {
        console.error("No active chat");
        return;
    }
    
    // Проверяем размер аудио (максимум 10MB)
    if (audioBlob.size > 10 * 1024 * 1024) {
        alert("Голосовое сообщение слишком большое (максимум 10MB)");
        return;
    }
    
    // Минимальная длительность 1 секунда
    const duration = Math.round((Date.now() - (state.recordingStartTime || Date.now())) / 1000);
    if (duration < 1) {
        alert("Сообщение слишком короткое");
        return;
    }
    
    try {
        // Показываем индикатор загрузки
        const loadingToast = document.createElement('div');
        loadingToast.className = 'notification-toast';
        loadingToast.innerHTML = '<span>⏳</span><span>Отправка голосового сообщения...</span>';
        document.body.appendChild(loadingToast);
        
        // Форматируем длительность
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Создаем уникальное имя файла
        const fileName = `voice_${Date.now()}_${state.user.uid}.webm`;
        const filePath = `voice_messages/${state.activeChatId}/${fileName}`;
        
        // Загружаем в Storage
        const storageRef = storage.ref(filePath);
        const uploadTask = storageRef.put(audioBlob);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                // Прогресс загрузки
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload progress: ${progress}%`);
            },
            (error) => {
                console.error("Upload error:", error);
                loadingToast.remove();
                alert("Ошибка при загрузке голосового сообщения. Попробуйте еще раз.");
            },
            async () => {
                // Получаем URL загруженного файла
                const downloadURL = await storageRef.getDownloadURL();
                
                // Сохраняем сообщение в базу данных
                const messageData = {
                    senderId: state.user.uid,
                    type: 'voice',
                    voiceUrl: downloadURL,
                    duration: durationStr,
                    timestamp: Date.now(),
                    deleted: false,
                    readBy: [state.user.uid]
                };
                
                await db.ref(`private_messages/${state.activeChatId}`).push(messageData);
                await updateChatLastMessage("🎤 Голосовое сообщение");
                scrollMessagesToBottom(true);
                
                // Убираем индикатор загрузки
                loadingToast.remove();
                
                // Показываем успех
                const successToast = document.createElement('div');
                successToast.className = 'notification-toast';
                successToast.innerHTML = '<span>✓</span><span>Голосовое сообщение отправлено</span>';
                document.body.appendChild(successToast);
                setTimeout(() => {
                    successToast.classList.add('hide');
                    setTimeout(() => successToast.remove(), 300);
                }, 2000);
            }
        );
        
    } catch (error) {
        console.error("Send voice error:", error);
        alert("Не удалось отправить голосовое сообщение: " + error.message);
    }
}

// Обработчик клавиш для голосового сообщения (удержание)
function initVoiceRecordButton() {
    if (!els.voiceRecordBtn) return;
    
    let pressTimer = null;
    
    // Начинаем запись при долгом нажатии
    els.voiceRecordBtn.addEventListener('mousedown', () => {
        pressTimer = setTimeout(() => {
            startVoiceRecording();
        }, 200);
    });
    
    // Останавливаем запись при отпускании
    els.voiceRecordBtn.addEventListener('mouseup', () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (state.isRecording) {
            stopVoiceRecording();
        }
    });
    
    // Для touch устройств
    els.voiceRecordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pressTimer = setTimeout(() => {
            startVoiceRecording();
        }, 200);
    });
    
    els.voiceRecordBtn.addEventListener('touchend', () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (state.isRecording) {
            stopVoiceRecording();
        }
    });
    
    // Отмена при уходе с кнопки
    els.voiceRecordBtn.addEventListener('mouseleave', () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (state.isRecording) {
            stopVoiceRecording();
        }
    });
}

// Добавь вызов этой функции в bindEvents
// В конце bindEvents() добавь:
// initVoiceRecordButton();

// ========== VIDEO MESSAGE ==========
function openVideoUpload() {
    if (els.videoUploadModal) els.videoUploadModal.classList.remove("hidden");
}

function closeVideoUpload() {
    if (els.videoUploadModal) els.videoUploadModal.classList.add("hidden");
    if (els.videoFileInput) els.videoFileInput.value = "";
    if (els.videoPreview) els.videoPreview.src = "";
    state.selectedVideoFile = null;
}

function previewVideo(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith("video/")) {
        alert("Пожалуйста, выберите видео файл");
        return;
    }
    
    state.selectedVideoFile = file;
    if (els.videoPreview) {
        els.videoPreview.src = URL.createObjectURL(file);
    }
}

async function sendVideoMessage() {
    if (!state.selectedVideoFile || !state.activeChatId) return;
    
    try {
        const fileName = `video_${Date.now()}.mp4`;
        const filePath = `video_messages/${state.activeChatId}/${fileName}`;
        
        const uploadTask = storage.ref(filePath).put(state.selectedVideoFile);
        
        uploadTask.on('state_changed',
            null,
            (error) => console.error("Upload error:", error),
            async () => {
                const downloadURL = await storage.ref(filePath).getDownloadURL();
                
                await db.ref(`private_messages/${state.activeChatId}`).push({
                    senderId: state.user.uid,
                    type: 'video',
                    videoUrl: downloadURL,
                    timestamp: Date.now(),
                    deleted: false,
                    readBy: [state.user.uid]
                });
                
                await updateChatLastMessage("📹 Видеосообщение");
                scrollMessagesToBottom(true);
                closeVideoUpload();
            }
        );
    } catch (error) {
        console.error("Send video error:", error);
        alert("Не удалось отправить видео");
    }
}

// ========== CALL FUNCTIONS (placeholder) ==========
async function startCall(type) {
    alert(`Функция звонков в разработке. Вы выбрали ${type === 'video' ? 'видеозвонок' : 'голосовой звонок'}`);
}

function listenForCalls() {}

function closeCallModal() {
    if (els.callModal) els.callModal.classList.add("hidden");
}

function toggleMicrophone() {
    alert("Функция в разработке");
}

function toggleVideo() {
    alert("Функция в разработке");
}

async function endCall() {
    closeCallModal();
}
