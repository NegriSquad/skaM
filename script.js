// ==================== КОНФИГ FIREBASE (ваши данные) ====================
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

// Глобальные переменные
let currentUser = null;           // объект Firebase User
let currentUserData = null;       // { username, nickname, uid }
let activeChatId = null;           // текущий открытый диалог (chatId)
let activeChatPartner = null;      // данные собеседника
let messagesListener = null;
let typingListener = null;
let typingTimeout = null;
let isAtBottom = true;

// DOM элементы (авторизация)
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const mainAppScreen = document.getElementById('mainAppScreen');
const doLoginBtn = document.getElementById('doLoginBtn');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginFromRegBtn = document.getElementById('showLoginFromRegBtn');
const doRegisterBtn = document.getElementById('doRegisterBtn');
const regEmail = document.getElementById('regEmail');
const regUsername = document.getElementById('regUsername');
const regNickname = document.getElementById('regNickname');
const regPassword = document.getElementById('regPassword');
const globalLogoutBtn = document.getElementById('globalLogoutBtn');
const sidebarUsername = document.getElementById('sidebarUsername');

// DOM элементы (диалоги и чат)
const dialogsList = document.getElementById('dialogsList');
const searchUserInput = document.getElementById('searchUserInput');
const searchUserBtn = document.getElementById('searchUserBtn');
const searchResults = document.getElementById('searchResults');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCounterSpan = document.getElementById('charCounter');
const typingIndicator = document.getElementById('typingIndicatorContainer');
const typingText = document.getElementById('typingText');
const currentChatTitle = document.getElementById('currentChatTitle');
const backToDialogsBtn = document.getElementById('backToDialogsBtn');

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function formatDateGroup(timestamp) {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    const msgDate = new Date(timestamp);
    if (msgDate.toDateString() === today.toDateString()) return "Сегодня";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Вчера";
    return msgDate.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
}

function autoScroll() {
    if (!messagesContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    if (scrollHeight - scrollTop - clientHeight < 50 || isAtBottom) {
        messagesContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        isAtBottom = true;
    }
}

// ==================== РАБОТА С ЧАТОМ (СООБЩЕНИЯ) ====================
function renderMessages(messagesArray, currentUserId, partnerNick) {
    if (!messagesContainer) return;
    const wasBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    const children = [...messagesContainer.children];
    children.forEach(c => { if(c.id !== 'emptyState') c.remove(); });
    if (!messagesArray.length) {
        document.getElementById('emptyState').classList.remove('hidden');
        return;
    }
    document.getElementById('emptyState').classList.add('hidden');
    const sorted = [...messagesArray].sort((a,b)=>a.timestamp - b.timestamp);
    let lastDate = null;
    sorted.forEach(msg => {
        const dateLabel = formatDateGroup(msg.timestamp);
        if(lastDate !== dateLabel) {
            const div = document.createElement('div'); div.className = 'date-divider';
            div.innerHTML = `<span>${dateLabel}</span>`;
            messagesContainer.appendChild(div);
            lastDate = dateLabel;
        }
        const isOwn = msg.senderId === currentUserId;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-item ${isOwn ? 'own-message' : ''}`;
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(isOwn ? currentUserData.nickname : partnerNick)}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    if(wasBottom || isAtBottom) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight });
}

function startListeningMessages(chatId, partnerData) {
    if(messagesListener) messagesListener.off();
    const messagesRef = db.ref(`private_messages/${chatId}`);
    messagesListener = messagesRef.orderByChild('timestamp').limitToLast(50).on('value', snapshot => {
        const data = snapshot.val();
        const list = [];
        if(data) Object.keys(data).forEach(key => list.push({ id:key, ...data[key] }));
        renderMessages(list, currentUser.uid, partnerData.nickname);
        autoScroll();
    });
}

async function sendPrivateMessage() {
    if(!activeChatId || !currentUser) return;
    const text = messageInput.value.trim();
    if(!text) return;
    const msg = {
        senderId: currentUser.uid,
        text: text,
        timestamp: Date.now()
    };
    try {
        await db.ref(`private_messages/${activeChatId}`).push(msg);
        messageInput.value = '';
        updateCharCounter();
        // обновить последнее сообщение в диалогах
        await db.ref(`user_chats/${currentUser.uid}/${activeChatId}`).update({
            lastMessage: text,
            lastTimestamp: Date.now(),
            partnerId: activeChatPartner.uid,
            partnerName: activeChatPartner.nickname,
            partnerUsername: activeChatPartner.username
        });
        await db.ref(`user_chats/${activeChatPartner.uid}/${activeChatId}`).update({
            lastMessage: text,
            lastTimestamp: Date.now(),
            partnerId: currentUser.uid,
            partnerName: currentUserData.nickname,
            partnerUsername: currentUserData.username
        });
        clearTypingIndicator();
    } catch(e) { console.error(e); }
}

// Индикатор печати (для активного чата)
function updateTyping(isTyping) {
    if(!activeChatId || !currentUser) return;
    const typingRef = db.ref(`typing/${activeChatId}`);
    if(isTyping) {
        typingRef.child(currentUser.uid).set({ name: currentUserData.nickname, timestamp: Date.now() });
        if(typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => typingRef.child(currentUser.uid).remove(), 1500);
    } else {
        typingRef.child(currentUser.uid).remove();
        if(typingTimeout) clearTimeout(typingTimeout);
    }
}

function clearTypingIndicator() {
    if(activeChatId && currentUser) db.ref(`typing/${activeChatId}/${currentUser.uid}`).remove();
}

function listenTyping(chatId) {
    if(typingListener) typingListener.off();
    const typingRef = db.ref(`typing/${chatId}`);
    typingListener = typingRef.on('value', snapshot => {
        if(!activeChatId || activeChatId !== chatId) return;
        const data = snapshot.val();
        if(!data) { typingIndicator.classList.add('hidden'); return; }
        const users = Object.keys(data).filter(uid => uid !== currentUser.uid);
        if(users.length === 0) { typingIndicator.classList.add('hidden'); return; }
        let text = users.length === 1 ? `${data[users[0]].name} печатает...` : 'Несколько печатают...';
        typingText.innerText = text;
        typingIndicator.classList.remove('hidden');
    });
}

// ==================== ДИАЛОГИ И ПОИСК ====================
async function loadDialogs() {
    if(!currentUser) return;
    const userChatsRef = db.ref(`user_chats/${currentUser.uid}`);
    userChatsRef.on('value', async (snapshot) => {
        const chats = snapshot.val();
        dialogsList.innerHTML = '';
        if(!chats) { dialogsList.innerHTML = '<div class="empty-dialogs">Нет диалогов</div>'; return; }
        const sorted = Object.entries(chats).sort((a,b) => (b[1].lastTimestamp||0) - (a[1].lastTimestamp||0));
        for(let [chatId, chatInfo] of sorted) {
            const partnerName = chatInfo.partnerName || chatInfo.partnerUsername;
            const lastMsg = chatInfo.lastMessage || '...';
            const div = document.createElement('div');
            div.className = 'dialog-item';
            div.innerHTML = `
                <div class="dialog-avatar">👤</div>
                <div class="dialog-info">
                    <div class="dialog-name">${escapeHtml(partnerName)}</div>
                    <div class="dialog-last">${escapeHtml(lastMsg.substring(0,40))}</div>
                </div>
            `;
            div.onclick = () => openChat(chatId, { uid: chatInfo.partnerId, nickname: chatInfo.partnerName, username: chatInfo.partnerUsername });
            dialogsList.appendChild(div);
        }
    });
}

async function searchUserByUsername(username) {
    const clean = username.trim().toLowerCase();
    if(!clean) return;
    const usernamesRef = db.ref('usernames');
    const snapshot = await usernamesRef.once('value');
    const usersMap = snapshot.val();
    let foundUid = null;
    for(let [uid, uname] of Object.entries(usersMap || {})) {
        if(uname === clean) { foundUid = uid; break; }
    }
    if(!foundUid || foundUid === currentUser.uid) {
        searchResults.innerHTML = '<div class="search-result-item">Пользователь не найден</div>';
        searchResults.classList.remove('hidden');
        return;
    }
    const userDataSnap = await db.ref(`users/${foundUid}`).once('value');
    const userData = userDataSnap.val();
    searchResults.innerHTML = `
        <div class="search-result-item">
            <span>@${userData.username} — ${userData.nickname}</span>
            <button class="start-chat-btn">Написать</button>
        </div>
    `;
    searchResults.classList.remove('hidden');
    document.querySelector('.start-chat-btn').onclick = () => startDialogWith(foundUid, userData);
}

async function startDialogWith(uid, userData) {
    const chatId = [currentUser.uid, uid].sort().join('_');
    // Создаём запись в user_chats для обоих, если нет
    const chatRef = db.ref(`user_chats/${currentUser.uid}/${chatId}`);
    const chatExists = (await chatRef.once('value')).exists();
    if(!chatExists) {
        await chatRef.set({
            partnerId: uid,
            partnerName: userData.nickname,
            partnerUsername: userData.username,
            lastTimestamp: Date.now(),
            lastMessage: ''
        });
        await db.ref(`user_chats/${uid}/${chatId}`).set({
            partnerId: currentUser.uid,
            partnerName: currentUserData.nickname,
            partnerUsername: currentUserData.username,
            lastTimestamp: Date.now(),
            lastMessage: ''
        });
    }
    openChat(chatId, { uid, nickname: userData.nickname, username: userData.username });
    searchResults.classList.add('hidden');
    searchUserInput.value = '';
}

function openChat(chatId, partner) {
    activeChatId = chatId;
    activeChatPartner = partner;
    currentChatTitle.innerText = partner.nickname;
    messagesContainer.innerHTML = '<div class="empty-state" id="emptyState"><div class="empty-emoji">💬</div><p>Напишите первое сообщение</p></div>';
    startListeningMessages(chatId, partner);
    listenTyping(chatId);
    // мобильная навигация
    if(window.innerWidth <= 550) {
        document.querySelector('.chats-sidebar').classList.remove('mobile-open');
    }
}

// ==================== АВТОРИЗАЦИЯ ====================
function switchToLogin() { loginScreen.classList.remove('hidden'); registerScreen.classList.add('hidden'); }
function switchToRegister() { loginScreen.classList.add('hidden'); registerScreen.classList.remove('hidden'); }
function logout() {
    auth.signOut();
    currentUser = null;
    currentUserData = null;
    if(messagesListener) messagesListener.off();
    if(typingListener) typingListener.off();
    loginScreen.classList.remove('hidden');
    mainAppScreen.classList.add('hidden');
}

async function registerUser() {
    const email = regEmail.value.trim();
    const username = regUsername.value.trim().toLowerCase();
    const nickname = regNickname.value.trim();
    const password = regPassword.value;
    if(!email || !username || !nickname || password.length<6) {
        alert('Заполните все поля, пароль минимум 6 символов');
        return;
    }
    if(!/^[a-z0-9_]+$/.test(username)) { alert('Только латиница, цифры, _'); return; }
    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;
        // Проверка уникальности username через usernames узел
        const usernameCheck = await db.ref(`usernames/${uid}`).once('value');
        if(usernameCheck.exists()) throw new Error('Username уже занят');
        await db.ref(`users/${uid}`).set({
            email, username, nickname, createdAt: Date.now()
        });
        await db.ref(`usernames/${uid}`).set(username);
        alert('Регистрация успешна! Войдите.');
        switchToLogin();
    } catch(e) { alert('Ошибка: '+e.message); }
}

async function loginUser() {
    const email = loginEmail.value.trim();
    const pwd = loginPassword.value;
    try {
        const cred = await auth.signInWithEmailAndPassword(email, pwd);
        currentUser = cred.user;
        const snap = await db.ref(`users/${currentUser.uid}`).once('value');
        currentUserData = snap.val();
        if(!currentUserData) throw new Error('Данные пользователя не найдены');
        sidebarUsername.innerText = `@${currentUserData.username}`;
        loginScreen.classList.add('hidden');
        mainAppScreen.classList.remove('hidden');
        loadDialogs();
        // Если был активный чат - сбросить
        activeChatId = null;
        messagesContainer.innerHTML = '<div class="empty-state" id="emptyState"><div class="empty-emoji">💬</div><p>Выберите диалог</p></div>';
        currentChatTitle.innerText = 'Выберите диалог';
    } catch(e) { alert('Ошибка входа: '+e.message); }
}

// ==================== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ====================
doLoginBtn.onclick = loginUser;
doRegisterBtn.onclick = registerUser;
showRegisterBtn.onclick = switchToRegister;
showLoginFromRegBtn.onclick = switchToLogin;
globalLogoutBtn.onclick = logout;
sendBtn.onclick = sendPrivateMessage;
searchUserBtn.onclick = () => searchUserByUsername(searchUserInput.value);
searchUserInput.addEventListener('keypress', (e) => { if(e.key==='Enter') searchUserByUsername(searchUserInput.value); });
messageInput.addEventListener('input', () => {
    updateCharCounter();
    updateTyping(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => updateTyping(false), 1200);
});
messageInput.addEventListener('keypress', (e) => { if(e.key==='Enter') sendPrivateMessage(); });
messageInput.addEventListener('blur', () => updateTyping(false));
messagesContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
});
backToDialogsBtn.onclick = () => {
    if(window.innerWidth <= 550) document.querySelector('.chats-sidebar').classList.add('mobile-open');
    else alert('Кликните на диалог слева');
};
function updateCharCounter() {
    charCounterSpan.innerText = `${messageInput.value.length}/500`;
}
updateCharCounter();
// Авто-выход при изменении аутентификации
auth.onAuthStateChanged(user => {
    if(!user && currentUser) logout();
});
