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
    // Voice recording
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingStartTime: null,
    // Call state
    currentCall: null,
    peerConnection: null,
    localStream: null,
    callType: null,
    callListener: null
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    updateCharCounter();
    initScrollHandler();
    auth.onAuthStateChanged(handleAuthState);
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
        "attachBtn", "voiceRecordBtn", "recordingStatus", "videoUploadModal", "videoFileInput", "videoPreview", "sendVideoBtn", "cancelVideoBtn"
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
    
    // Call buttons
    if (els.voiceCallBtn) els.voiceCallBtn.addEventListener("click", () => startCall('audio'));
    if (els.videoCallBtn) els.videoCallBtn.addEventListener("click", () => startCall('video'));
    if (els.endCallBtn) els.endCallBtn.addEventListener("click", endCall);
    if (els.closeCallBtn) els.closeCallBtn.addEventListener("click", closeCallModal);
    if (els.toggleMicBtn) els.toggleMicBtn.addEventListener("click", toggleMicrophone);
    if (els.toggleVideoBtn) els.toggleVideoBtn.addEventListener("click", toggleVideo);
    
    // Media buttons
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

function initScrollHandler() {
    if (els.messagesContainer) {
        els.messagesContainer.addEventListener("scroll", () => {
            updateScrollState();
        });
        updateScrollState();
    }
}

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
    els.loginScreen.classList.toggle("hidden", screen !== "login");
    els.registerScreen.classList.toggle("hidden", screen !== "register");
    els.mainAppScreen.classList.add("hidden");
}

function showMainApp() {
    els.loginScreen.classList.add("hidden");
    els.registerScreen.classList.add("hidden");
    els.mainAppScreen.classList.remove("hidden");
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
    els.mainAppScreen.classList.add("hidden");
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }
}

function detachListeners() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
    if (state.callListener) state.callListener.off();
    state.dialogsListener = null;
    state.messagesListener = null;
    state.typingListener = null;
    state.callListener = null;
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
    await
