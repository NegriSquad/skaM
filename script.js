// ==================== КОНФИГ FIREBASE (ТВОИ ДАННЫЕ) ====================
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
let currentUser = null;
let currentUserData = null;
let activeChatId = null;
let activeChatPartner = null;
let messagesListener = null;
let typingListener = null;
let typingTimeout = null;
let isAtBottom = true;

// DOM элементы
let loginScreen, registerScreen, mainAppScreen;
let doLoginBtn, loginEmail, loginPassword, showRegisterBtn;
let doRegisterBtn, regEmail, regUsername, regNickname, regPassword, showLoginFromRegBtn;
let globalLogoutBtn, sidebarUsername;
let dialogsList, searchUserInput, searchUserBtn, searchResults;
let messagesContainer, messageInput, sendBtn, charCounterSpan;
let typingIndicator, typingText, currentChatTitle, backToDialogsBtn;

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function formatDateGroup(ts) {
    const d = new Date(ts), today = new Date(), yest = new Date(today); yest.setDate(today.getDate()-1);
    if(d.toDateString()===today.toDateString()) return "Сегодня";
    if(d.toDateString()===yest.toDateString()) return "Вчера";
    return d.toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
}
function autoScroll() {
    if(!messagesContainer) return;
    const {scrollTop, scrollHeight, clientHeight} = messagesContainer;
    if(scrollHeight-scrollTop-clientHeight<50 || isAtBottom)
        messagesContainer.scrollTo({top:scrollHeight, behavior:'smooth'});
}
function updateCharCounter() { if(charCounterSpan) charCounterSpan.innerText = `${messageInput.value.length}/500`; }

// ========== ОТРИСОВКА СООБЩЕНИЙ ==========
function renderMessages(messagesArray, currentUserId, partnerNick) {
    if(!messagesContainer) return;
    const wasBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    [...messagesContainer.children].forEach(c => { if(c.id !== 'emptyState') c.remove(); });
    const emptyState = document.getElementById('emptyState');
    if(!messagesArray.length) { if(emptyState) emptyState.classList.remove('hidden'); return; }
    if(emptyState) emptyState.classList.add('hidden');
    const sorted = [...messagesArray].sort((a,b)=>a.timestamp - b.timestamp);
    let lastDate = null;
    sorted.forEach(msg => {
        const dl = formatDateGroup(msg.timestamp);
        if(lastDate !== dl) {
            const div = document.createElement('div'); div.className = 'date-divider';
            div.innerHTML = `<span>${dl}</span>`;
            messagesContainer.appendChild(div);
            lastDate = dl;
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
    if(wasBottom || isAtBottom) messagesContainer.scrollTo({top:messagesContainer.scrollHeight});
}

function startListeningMessages(chatId, partnerData) {
    if(messagesListener) messagesListener.off();
    const ref = db.ref(`private_messages/${chatId}`);
    messagesListener = ref.orderByChild('timestamp').limitToLast(50).on('value', snap => {
        const data = snap.val();
        const list = data ? Object.keys(data).map(k=>({id:k,...data[k]})) : [];
        renderMessages(list, currentUser.uid, partnerData.nickname);
        autoScroll();
    });
}

async function sendPrivateMessage() {
    if(!activeChatId || !currentUser) return;
    const text = messageInput.value.trim();
    if(!text) return;
    const msg = { senderId: currentUser.uid, text, timestamp: Date.now() };
    try {
        await db.ref(`private_messages/${activeChatId}`).push(msg);
        messageInput.value = '';
        updateCharCounter();
        await db.ref(`user_chats/${currentUser.uid}/${activeChatId}`).update({
            lastMessage: text, lastTimestamp: Date.now(),
            partnerId: activeChatPartner.uid, partnerName: activeChatPartner.nickname, partnerUsername: activeChatPartner.username
        });
        await db.ref(`user_chats/${activeChatPartner.uid}/${activeChatId}`).update({
            lastMessage: text, lastTimestamp: Date.now(),
            partnerId: currentUser.uid, partnerName: currentUserData.nickname, partnerUsername: currentUserData.username
        });
        clearTypingIndicator();
    } catch(e) { alert("Ошибка: "+e.message); }
}

function updateTyping(isTyping) {
    if(!activeChatId || !currentUser) return;
    const typingRef = db.ref(`typing/${activeChatId}`);
    if(isTyping) {
        typingRef.child(currentUser.uid).set({ name: currentUserData.nickname, timestamp: Date.now() });
        if(typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => typingRef.child(currentUser.uid).remove(), 1500);
    } else { typingRef.child(currentUser.uid).remove(); if(typingTimeout) clearTimeout(typingTimeout); }
}
function clearTypingIndicator() { if(activeChatId && currentUser) db.ref(`typing/${activeChatId}/${currentUser.uid}`).remove(); }
function listenTyping(chatId) {
    if(typingListener) typingListener.off();
    const typingRef = db.ref(`typing/${chatId}`);
    typingListener = typingRef.on('value', snap => {
        if(!activeChatId || activeChatId !== chatId) return;
        const data = snap.val();
        if(!data) { typingIndicator.classList.add('hidden'); return; }
        const users = Object.keys(data).filter(uid => uid !== currentUser.uid);
        if(users.length===0) { typingIndicator.classList.add('hidden'); return; }
        typingText.innerText = users.length===1 ? `${data[users[0]].name} печатает...` : 'Несколько печатают...';
        typingIndicator.classList.remove('hidden');
    });
}

// ========== ДИАЛОГИ ==========
async function loadDialogs() {
    if(!currentUser) return;
    db.ref(`user_chats/${currentUser.uid}`).on('value', snap => {
        const chats = snap.val();
        dialogsList.innerHTML = '';
        if(!chats) { dialogsList.innerHTML = '<div class="empty-dialogs">Нет диалогов</div>'; return; }
        const sorted = Object.entries(chats).sort((a,b)=>(b[1].lastTimestamp||0)-(a[1].lastTimestamp||0));
        sorted.forEach(([chatId, info]) => {
            const partnerName = info.partnerName || info.partnerUsername;
            const lastMsg = info.lastMessage || '...';
            const div = document.createElement('div');
            div.className = 'dialog-item';
            div.innerHTML = `<div class="dialog-avatar">👤</div><div class="dialog-info"><div class="dialog-name">${escapeHtml(partnerName)}</div><div class="dialog-last">${escapeHtml(lastMsg.substring(0,40))}</div></div>`;
            div.onclick = () => openChat(chatId, { uid: info.partnerId, nickname: info.partnerName, username: info.partnerUsername });
            dialogsList.appendChild(div);
        });
    });
}

async function searchUserByUsername(username) {
    const clean = username.trim().toLowerCase();
    if(!clean) return;
    const usersMap = (await db.ref('usernames').once('value')).val() || {};
    let foundUid = null;
    for(let [uid, uname] of Object.entries(usersMap)) if(uname === clean && uid !== currentUser.uid) { foundUid = uid; break; }
    if(!foundUid) {
        searchResults.innerHTML = '<div class="search-result-item">Пользователь не найден</div>';
        searchResults.classList.remove('hidden');
        return;
    }
    const userData = (await db.ref(`users/${foundUid}`).once('value')).val();
    searchResults.innerHTML = `<div class="search-result-item"><span>@${userData.username} — ${userData.nickname}</span><button class="start-chat-btn">Написать</button></div>`;
    searchResults.classList.remove('hidden');
    // Используем делегирование или безопасное добавление
    const btn = searchResults.querySelector('.start-chat-btn');
    if(btn) {
        // Убираем предыдущие слушатели, чтобы не дублировать
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => startDialogWith(foundUid, userData));
    }
}

async function startDialogWith(uid, userData) {
    const chatId = [currentUser.uid, uid].sort().join('_');
    const exists = (await db.ref(`user_chats/${currentUser.uid}/${chatId}`).once('value')).exists();
    if(!exists) {
        await db.ref(`user_chats/${currentUser.uid}/${chatId}`).set({ partnerId: uid, partnerName: userData.nickname, partnerUsername: userData.username, lastTimestamp: Date.now(), lastMessage: '' });
        await db.ref(`user_chats/${uid}/${chatId}`).set({ partnerId: currentUser.uid, partnerName: currentUserData.nickname, partnerUsername: currentUserData.username, lastTimestamp: Date.now(), lastMessage: '' });
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
    if(window.innerWidth <= 550) document.querySelector('.chats-sidebar')?.classList.remove('mobile-open');
}

// ========== АВТОРИЗАЦИЯ ==========
function switchToLogin() { loginScreen.classList.remove('hidden'); registerScreen.classList.add('hidden'); }
function switchToRegister() { loginScreen.classList.add('hidden'); registerScreen.classList.remove('hidden'); }
function logout() {
    auth.signOut();
    currentUser = null; currentUserData = null;
    if(messagesListener) messagesListener.off();
    if(typingListener) typingListener.off();
    loginScreen.classList.remove('hidden');
    mainAppScreen.classList.add('hidden');
}
async function registerUser() {
    const email = regEmail.value.trim(), username = regUsername.value.trim().toLowerCase(), nickname = regNickname.value.trim(), password = regPassword.value;
    if(!email || !username || !nickname || password.length<6) return alert('Заполните все поля, пароль ≥6 символов');
    if(!/^[a-z0-9_]+$/.test(username)) return alert('Только латиница, цифры, _');
    try {
        const {user} = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref(`users/${user.uid}`).set({ email, username, nickname, createdAt: Date.now() });
        await db.ref(`usernames/${user.uid}`).set(username);
        alert('Регистрация успешна! Теперь войдите.');
        switchToLogin();
    } catch(e) { alert('Ошибка: '+e.message); }
}
async function loginUser() {
    const email = loginEmail.value.trim(), pwd = loginPassword.value;
    try {
        const {user} = await auth.signInWithEmailAndPassword(email, pwd);
        currentUser = user;
        const snap = await db.ref(`users/${user.uid}`).once('value');
        currentUserData = snap.val();
        if(!currentUserData) throw new Error('Нет данных пользователя');
        sidebarUsername.innerText = `@${currentUserData.username}`;
        loginScreen.classList.add('hidden');
        mainAppScreen.classList.remove('hidden');
        loadDialogs();
        activeChatId = null;
        messagesContainer.innerHTML = '<div class="empty-state" id="emptyState"><div class="empty-emoji">💬</div><p>Выберите диалог</p></div>';
        currentChatTitle.innerText = 'Выберите диалог';
    } catch(e) { alert('Ошибка входа: '+e.message); }
}

// ========== СТАРТ ПОСЛЕ ЗАГРУЗКИ DOM ==========
document.addEventListener('DOMContentLoaded', () => {
    // Привязываем DOM-элементы
    loginScreen = document.getElementById('loginScreen');
    registerScreen = document.getElementById('registerScreen');
    mainAppScreen = document.getElementById('mainAppScreen');
    doLoginBtn = document.getElementById('doLoginBtn');
    loginEmail = document.getElementById('loginEmail');
    loginPassword = document.getElementById('loginPassword');
    showRegisterBtn = document.getElementById('showRegisterBtn');
    doRegisterBtn = document.getElementById('doRegisterBtn');
    regEmail = document.getElementById('regEmail');
    regUsername = document.getElementById('regUsername');
    regNickname = document.getElementById('regNickname');
    regPassword = document.getElementById('regPassword');
    showLoginFromRegBtn = document.getElementById('showLoginFromRegBtn');
    globalLogoutBtn = document.getElementById('globalLogoutBtn');
    sidebarUsername = document.getElementById('sidebarUsername');
    dialogsList = document.getElementById('dialogsList');
    searchUserInput = document.getElementById('searchUserInput');
    searchUserBtn = document.getElementById('searchUserBtn');
    searchResults = document.getElementById('searchResults');
    messagesContainer = document.getElementById('messagesContainer');
    messageInput = document.getElementById('messageInput');
    sendBtn = document.getElementById('sendBtn');
    charCounterSpan = document.getElementById('charCounter');
    typingIndicator = document.getElementById('typingIndicatorContainer');
    typingText = document.getElementById('typingText');
    currentChatTitle = document.getElementById('currentChatTitle');
    backToDialogsBtn = document.getElementById('backToDialogsBtn');

    // Проверка наличия критических элементов
    if(!loginScreen || !registerScreen || !mainAppScreen) {
        alert("Ошибка: не найдены основные экраны. Проверь index.html");
        return;
    }

    // Навешиваем события
    if(doLoginBtn) doLoginBtn.addEventListener('click', loginUser);
    if(doRegisterBtn) doRegisterBtn.addEventListener('click', registerUser);
    if(showRegisterBtn) showRegisterBtn.addEventListener('click', switchToRegister);
    if(showLoginFromRegBtn) showLoginFromRegBtn.addEventListener('click', switchToLogin);
    if(globalLogoutBtn) globalLogoutBtn.addEventListener('click', logout);
    if(sendBtn) sendBtn.addEventListener('click', sendPrivateMessage);
    if(searchUserBtn) searchUserBtn.addEventListener('click', () => searchUserByUsername(searchUserInput.value));
    if(searchUserInput) searchUserInput.addEventListener('keypress', e => { if(e.key==='Enter') searchUserByUsername(searchUserInput.value); });
    if(messageInput) {
        messageInput.addEventListener('input', () => { updateCharCounter(); updateTyping(true); clearTimeout(typingTimeout); typingTimeout = setTimeout(() => updateTyping(false), 1200); });
        messageInput.addEventListener('keypress', e => { if(e.key==='Enter') sendPrivateMessage(); });
        messageInput.addEventListener('blur', () => updateTyping(false));
    }
    if(messagesContainer) messagesContainer.addEventListener('scroll', () => { const {scrollTop,scrollHeight,clientHeight}=messagesContainer; isAtBottom = scrollHeight-scrollTop-clientHeight<30; });
    if(backToDialogsBtn) backToDialogsBtn.addEventListener('click', () => { if(window.innerWidth<=550) document.querySelector('.chats-sidebar')?.classList.add('mobile-open'); });
    updateCharCounter();

    // Слушаем выход
    auth.onAuthStateChanged(user => { if(!user && currentUser) logout(); });
});
// ========== МОБИЛЬНАЯ НАВИГАЦИЯ (TELEGRAM-STYLE) ==========
const backBtn = document.getElementById('backToDialogsBtn');
const sidebar2 = document.getElementById('chatsSidebar');
const overlay = document.getElementById('sidebarOverlay');

function openSidebar() {
    if (window.innerWidth <= 768) {
        sidebar2.classList.add('open');
        overlay.classList.add('active');
    }
}

function closeSidebar() {
    sidebar2.classList.remove('open');
    overlay.classList.remove('active');
}

// Кнопка назад показывает список диалогов
if (backBtn) {
    backBtn.addEventListener('click', openSidebar);
}

// Закрытие по оверлею
if (overlay) {
    overlay.addEventListener('click', closeSidebar);
}

// При выборе диалога - закрываем меню и показываем чат
const originalOpenChatMobile = openChat;
window.openChat = function(chatId, partner) {
    originalOpenChatMobile(chatId, partner);
    closeSidebar();
};
openChat = window.openChat;

// Свайп вправо для открытия меню (опционально)
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = touchEndX - touchStartX;
    // Свайп вправо больше 50px
    if (swipeDistance > 50 && window.innerWidth <= 768 && !sidebar2.classList.contains('open')) {
        openSidebar();
    }
    // Свайп влево для закрытия
    if (swipeDistance < -50 && window.innerWidth <= 768 && sidebar2.classList.contains('open')) {
        closeSidebar();
    }
}, false);
