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

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    updateCharCounter();
    initScrollHandler();
    auth.onAuthStateChanged(handleAuthState);
    initNotifications();
    initOnlineStatus();
});

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

    els.sendBtn.addEventListener("click", sendOrUpdateMessage);
    els.cancelEditBtn.addEventListener("click", cancelEditMessage);
    els.deleteDialogBtn.addEventListener("click", deleteCurrentDialog);
    els.scrollBottomBtn.addEventListener("click", () => scrollMessagesToBottom(true));
    els.backToDialogsBtn.addEventListener("click", () => els.chatArea.classList.remove("open"));
    
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

// ========== ONLINE STATUS ==========

async function initOnlineStatus() {
    // Update online status every minute
    setInterval(async () => {
        if (state.user) {
            await db.ref(`users/${state.user.uid}/online`).set({
                status: true,
                lastSeen: Date.now()
            });
        }
    }, 30000);
    
    // Set offline when page closes
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
    if (!els.chatStatus) return;
    
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

// ========== MESSAGE STATUS (GALOCHKI) ==========

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

// ========== NOTIFICATIONS ==========

async function initNotifications() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        state.notificationPermission = permission === 'granted';
    }
}

function showNotification(title, body, icon) {
    if (!state.notificationPermission) return;
    
    // Check if app is visible
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

function showToast(message, duration = 3000) {
    const existingToast = document.querySelector('.notification-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
        <span>🔔</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========== UPDATE MESSAGE WITH STATUS ==========

async function sendOrUpdateMessage() {
    if (!state.activeChatId || !state.activePartner) return;
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
        els.messageInput.value = "";
        updateCharCounter();
        await clearTypingIndicator();
        scrollMessagesToBottom(true);
        
    } catch (error) {
        alert(`Не удалось отправить сообщение: ${error.message}`);
    }
}

function createMessageNode(message) {
    const isOwn = message.senderId === state.user.uid;
    const item = document.createElement("article");
    item.className = `message-item ${isOwn ? "own-message" : ""}`;
    item.dataset.messageId = message.id;
    
    // Mark as read when visible
    if (!isOwn && !(message.readBy || []).includes(state.user.uid)) {
        markMessageAsRead(message.id, state.activeChatId);
    }

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
    
    // Add message status (galochki)
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
        
        // Check for new messages for notification
        messages.forEach(message => {
            if (message.senderId !== state.user.uid && message.timestamp > (state.lastReadTime || 0)) {
                showNotification(state.activePartner?.nickname || "Новое сообщение", message.text);
            }
        });
    };

    ref.on("value", callback);
    state.messagesListener = { ref, callback };
}

function openChat(chatId, partner) {
    state.activeChatId = chatId;
    state.activePartner = partner;
    state.editingMessageId = null;
    cancelEditMessage();

    els.currentChatTitle.textContent = partner.nickname || `@${partner.username}`;
    setAvatar(els.chatAvatar, partner.nickname || partner.username, partner.avatarUrl);
    if (els.chatAvatar) els.chatAvatar.classList.remove("muted");
    if (els.deleteDialogBtn) els.deleteDialogBtn.classList.remove("hidden");
    if (els.messageInput) els.messageInput.disabled = false;
    if (els.sendBtn) els.sendBtn.disabled = false;
    
    if (els.voiceCallBtn) els.voiceCallBtn.disabled = false;
    if (els.videoCallBtn) els.videoCallBtn.disabled = false;
    
    // Listen to partner online status
    if (state.onlineStatusListener) state.onlineStatusListener.off();
    state.onlineStatusListener = listenUserOnlineStatus(partner.uid, (isOnline, lastSeen) => {
        updateChatStatus(isOnline, lastSeen);
    });

    renderLoadingMessages();
    listenMessages(chatId);
    listenTyping(chatId);

    if (window.innerWidth <= 768 && els.chatArea) els.chatArea.classList.add("open");
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
    if (state.onlineStatusListener) state.onlineStatusListener.off();
}

// Voice Recording, Video Upload, Call functions (keep from previous version)...

// End of file - make sure all functions are closed
