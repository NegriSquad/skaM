// ========== ТВОЙ КОНФИГ FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyD3NEXunS2PQPVQ3nDS27Nk4JIG3xajyVM",
    authDomain: "messendger-71e53.firebaseapp.com",
    databaseURL: "https://messendger-71e53-default-rtdb.firebaseio.com",
    projectId: "messendger-71e53",
    storageBucket: "messendger-71e53.firebasestorage.app",
    messagingSenderId: "1010287168963",
    appId: "1:1010287168963:web:15868f94480bb833414176"
};

let db, usersRef, chatsRef, messagesRef;
let currentUser = null;          // { username }
let currentChatWith = null;      // с кем сейчас открыт чат
let messagesUnsubscribe = null;
let allUsers = [];               // массив всех ников

// DOM элементы – получаем только после загрузки страницы
let authScreen, mainScreen, loginForm, registerForm;
let tabLogin, tabRegister, btnLogin, btnRegister;
let loginUsername, loginPassword, regUsername, regPassword;
let currentUserLabel, logoutBtn, searchUserInput, usersListDiv, chatsListDiv;
let chatAreaHeaderSpan, messagesContainer, inputPanel, messageInput, sendMsgBtn, charCountSpan;

// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    usersRef = db.ref('users');
    chatsRef = db.ref('chats');
    messagesRef = db.ref('messages');
    console.log("✅ Firebase готова");
} catch(e) {
    alert("Ошибка Firebase: " + e.message);
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ----------
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m=='&'?'&amp;': m=='<'?'&lt;':'&gt;');
}
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function getChatId(userA, userB) {
    return [userA, userB].sort().join('_');
}

// ---------- АВТОРИЗАЦИЯ ----------
async function register() {
    const username = regUsername.value.trim();
    const password = regPassword.value.trim();
    if (username.length < 3 || password.length < 3) {
        alert("Ник и пароль должны быть не менее 3 символов");
        return;
    }
    const snap = await usersRef.child(username).once('value');
    if (snap.exists()) {
        alert("Пользователь уже существует");
        return;
    }
    await usersRef.child(username).set({ password, createdAt: Date.now() });
    alert("Регистрация успешна! Теперь войдите.");
    // Переключиться на вкладку входа
    tabLogin.click();
}

async function login() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
        alert("Введите ник и пароль");
        return;
    }
    const snap = await usersRef.child(username).once('value');
    const user = snap.val();
    if (!user || user.password !== password) {
        alert("Неверный ник или пароль");
        return;
    }
    currentUser = { username };
    localStorage.setItem("darkchat_user", username);
    localStorage.setItem("darkchat_pass", password);
    showMainScreen();
}

function logout() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    currentUser = null;
    currentChatWith = null;
    localStorage.removeItem("darkchat_user");
    localStorage.removeItem("darkchat_pass");
    authScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
}

async function showMainScreen() {
    authScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    currentUserLabel.innerText = currentUser.username;
    await loadUsersList();
    await loadChatsList();
    // Сбрасываем открытый чат
    if (currentChatWith) {
        currentChatWith = null;
        chatAreaHeaderSpan.innerText = "Выберите чат";
        messagesContainer.innerHTML = '<div class="empty-chat">👈 Нажмите на пользователя слева</div>';
        inputPanel.style.display = 'none';
        if (messagesUnsubscribe) messagesUnsubscribe();
    }
}

// Загрузить всех пользователей (кроме себя) и отобразить в левой колонке
async function loadUsersList() {
    const snap = await usersRef.once('value');
    const users = snap.val();
    allUsers = [];
    usersListDiv.innerHTML = '';
    for (let name in users) {
        if (name !== currentUser.username) {
            allUsers.push(name);
            const div = document.createElement('div');
            div.className = 'user-item';
            div.innerHTML = `<span class="user-avatar">👤</span><span class="user-name">${escapeHtml(name)}</span>`;
            div.onclick = () => openChatWith(name);
            usersListDiv.appendChild(div);
        }
    }
    // Поиск
    searchUserInput.oninput = () => {
        const query = searchUserInput.value.toLowerCase();
        Array.from(usersListDiv.children).forEach(item => {
            const name = item.querySelector('.user-name').innerText.toLowerCase();
            item.style.display = name.includes(query) ? 'flex' : 'none';
        });
    };
}

// Загрузить список диалогов текущего пользователя
async function loadChatsList() {
    const snap = await chatsRef.child(currentUser.username).once('value');
    const chats = snap.val();
    chatsListDiv.innerHTML = '';
    if (!chats) return;
    for (let otherUser in chats) {
        const lastMsg = chats[otherUser].lastMessage || '';
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <span>💬</span>
            <div><div class="user-name">${escapeHtml(otherUser)}</div><div style="font-size:0.7rem;color:#7d828c">${escapeHtml(lastMsg.substring(0,30))}</div></div>
        `;
        div.onclick = () => openChatWith(otherUser);
        chatsListDiv.appendChild(div);
    }
}

// Открыть чат с конкретным пользователем
function openChatWith(username) {
    if (username === currentUser.username) return;
    currentChatWith = username;
    chatAreaHeaderSpan.innerText = username;
    inputPanel.style.display = 'block';
    // Подписаться на сообщения этого чата
    loadMessagesForChat(currentUser.username, username);
    // Обновить/создать запись о диалоге в базе
    updateChatsEntry(currentUser.username, username);
    messageInput.value = '';
    updateCharCount();
    messageInput.focus();
}

async function updateChatsEntry(myName, otherName) {
    const chatId = getChatId(myName, otherName);
    await chatsRef.child(myName).child(otherName).set({ lastMessage: '', timestamp: Date.now() });
    await chatsRef.child(otherName).child(myName).set({ lastMessage: '', timestamp: Date.now() });
    loadChatsList();
}

// Подписка на сообщения в реальном времени
function loadMessagesForChat(userA, userB) {
    if (messagesUnsubscribe) messagesUnsubscribe();
    const chatId = getChatId(userA, userB);
    const chatMsgsRef = messagesRef.child(chatId);
    const callback = (snapshot) => {
        const data = snapshot.val();
        const msgs = [];
        if (data) {
            Object.keys(data).forEach(key => msgs.push({ id: key, ...data[key] }));
        }
        renderMessages(msgs);
    };
    chatMsgsRef.on('value', callback);
    messagesUnsubscribe = () => chatMsgsRef.off('value', callback);
}

// Отрисовка сообщений
function renderMessages(msgsArray) {
    const wasBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    messagesContainer.innerHTML = '';
    if (!msgsArray.length) {
        messagesContainer.innerHTML = '<div class="empty-chat">Нет сообщений. Напишите первым!</div>';
        return;
    }
    const sorted = [...msgsArray].sort((a,b) => a.timestamp - b.timestamp);
    sorted.forEach(msg => {
        const isOwn = (msg.sender === currentUser.username);
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-item ${isOwn ? 'own' : ''}`;
        let textHtml = escapeHtml(msg.text);
        textHtml = textHtml.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(msg.sender)}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-text">${textHtml}</div>
            </div>
            <div class="message-actions">
                <button class="action-btn copy-btn" data-msgtext="${escapeHtml(msg.text).replace(/"/g, '&quot;')}">📋 Копировать</button>
                ${isOwn ? `<button class="action-btn delete-btn" data-msgid="${msg.id}">🗑️ Удалить</button>` : ''}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    // Обработчики для кнопок
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const txt = btn.getAttribute('data-msgtext').replace(/&quot;/g, '"');
            navigator.clipboard.writeText(txt);
            btn.innerText = '✅';
            setTimeout(() => btn.innerText = '📋 Копировать', 1000);
        };
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const msgId = btn.getAttribute('data-msgid');
            if (confirm('Удалить сообщение?')) {
                const chatId = getChatId(currentUser.username, currentChatWith);
                await messagesRef.child(chatId).child(msgId).remove();
            }
        };
    });
    if (wasBottom) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser || !currentChatWith) return;
    const text = messageInput.value.trim();
    if (!text) return;
    const chatId = getChatId(currentUser.username, currentChatWith);
    const newMsg = {
        sender: currentUser.username,
        text: text,
        timestamp: Date.now()
    };
    await messagesRef.child(chatId).push(newMsg);
    // Обновить последнее сообщение в диалогах
    await chatsRef.child(currentUser.username).child(currentChatWith).set({ lastMessage: text, timestamp: Date.now() });
    await chatsRef.child(currentChatWith).child(currentUser.username).set({ lastMessage: text, timestamp: Date.now() });
    messageInput.value = "";
    updateCharCount();
    loadChatsList();  // обновить список диалогов
}

// Упоминания (@)
let mentionActive = false;
function onMessageInput() {
    updateCharCount();
    const val = messageInput.value;
    const cursorPos = messageInput.selectionStart;
    const lastAt = val.lastIndexOf('@', cursorPos-1);
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt-1] === ' ')) {
        const query = val.substring(lastAt+1, cursorPos);
        const filtered = allUsers.filter(u => u.toLowerCase().startsWith(query.toLowerCase()));
        showMentionSuggestions(filtered, lastAt);
    } else {
        hideMentionSuggestions();
    }
}
function showMentionSuggestions(users, atPos) {
    if (!users.length) { hideMentionSuggestions(); return; }
    mentionSuggestions.innerHTML = '';
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'mention-suggestion-item';
        item.innerText = user;
        item.onclick = () => {
            const before = messageInput.value.substring(0, atPos);
            const after = messageInput.value.substring(messageInput.selectionStart);
            messageInput.value = before + user + ' ' + after;
            hideMentionSuggestions();
            messageInput.focus();
        };
        mentionSuggestions.appendChild(item);
    });
    mentionSuggestions.classList.remove('hidden');
}
function hideMentionSuggestions() {
    mentionSuggestions.classList.add('hidden');
}
function updateCharCount() {
    charCountSpan.innerText = `${messageInput.value.length}/500`;
}

// Восстановление сессии
async function tryAutoLogin() {
    const savedUser = localStorage.getItem("darkchat_user");
    const savedPass = localStorage.getItem("darkchat_pass");
    if (savedUser && savedPass) {
        const snap = await usersRef.child(savedUser).once('value');
        if (snap.val() && snap.val().password === savedPass) {
            currentUser = { username: savedUser };
            showMainScreen();
            return true;
        }
    }
    return false;
}

// -------- ЖДЁМ ПОЛНОЙ ЗАГРУЗКИ СТРАНИЦЫ, чтобы найти элементы ----------
window.addEventListener('DOMContentLoaded', async () => {
    // Получаем все DOM элементы
    authScreen = document.getElementById('authScreen');
    mainScreen = document.getElementById('mainScreen');
    tabLogin = document.getElementById('tabLogin');
    tabRegister = document.getElementById('tabRegister');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    btnLogin = document.getElementById('btnLogin');
    btnRegister = document.getElementById('btnRegister');
    loginUsername = document.getElementById('loginUsername');
    loginPassword = document.getElementById('loginPassword');
    regUsername = document.getElementById('regUsername');
    regPassword = document.getElementById('regPassword');
    currentUserLabel = document.getElementById('currentUserLabel');
    logoutBtn = document.getElementById('logoutBtnMain');
    searchUserInput = document.getElementById('searchUserInput');
    usersListDiv = document.getElementById('usersList');
    chatsListDiv = document.getElementById('chatsList');
    chatAreaHeaderSpan = document.querySelector('#chatAreaHeader span');
    messagesContainer = document.getElementById('messagesContainer');
    inputPanel = document.getElementById('inputPanel');
    messageInput = document.getElementById('messageInput');
    sendMsgBtn = document.getElementById('sendMessageBtn');
    charCountSpan = document.getElementById('charCount');
    mentionSuggestions = document.getElementById('mentionSuggestions');

    // Переключение вкладок
    tabLogin.onclick = () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    };
    tabRegister.onclick = () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    };
    btnLogin.onclick = login;
    btnRegister.onclick = register;
    logoutBtn.onclick = logout;
    sendMsgBtn.onclick = sendMessage;
    messageInput.addEventListener('input', onMessageInput);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Попытка автовхода
    if (!(await tryAutoLogin())) {
        authScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
    }
});
