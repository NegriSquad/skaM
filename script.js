// ========== КОНФИГ FIREBASE (ТВОЙ) ==========
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
let currentChatWith = null;      // username собеседника
let messagesListener = null;
let allUsers = [];               // список всех пользователей

// DOM
const authScreen = document.getElementById('authScreen');
const mainScreen = document.getElementById('mainScreen');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const doLoginBtn = document.getElementById('doLoginBtn');
const doRegisterBtn = document.getElementById('doRegisterBtn');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');
const currentUserSidebar = document.getElementById('currentUserSidebar');
const logoutMainBtn = document.getElementById('logoutMainBtn');
const usersListDiv = document.getElementById('usersList');
const chatsListDiv = document.getElementById('chatsList');
const searchUsersInput = document.getElementById('searchUsers');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const chatHeaderSpan = document.querySelector('#chatHeader span');
const inputArea = document.getElementById('inputArea');
const charCounter = document.getElementById('charCounter');
const mentionSuggestions = document.getElementById('mentionSuggestions');

// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    usersRef = db.ref('users');
    chatsRef = db.ref('chats');      // список диалогов для каждого пользователя
    messagesRef = db.ref('messages');
    console.log("✅ Firebase подключена");
} catch(e) { alert("Ошибка Firebase: " + e.message); }

// ---------- ВСПОМОГАТЕЛЬНЫЕ ----------
function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>]/g, m => m=='&'?'&amp;': m=='<'?'&lt;':'&gt;');
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

// Получение ID чата между двумя пользователями (лексикографически)
function getChatId(userA, userB) {
    const sorted = [userA, userB].sort();
    return `${sorted[0]}_${sorted[1]}`;
}

// ---------- АВТОРИЗАЦИЯ ----------
async function register() {
    const username = regUsername.value.trim();
    const password = regPassword.value.trim();
    if(username.length < 3 || password.length < 3) {
        alert("Ник и пароль не менее 3 символов");
        return;
    }
    const snapshot = await usersRef.child(username).once('value');
    if(snapshot.exists()) {
        alert("Пользователь уже существует");
        return;
    }
    await usersRef.child(username).set({ password, createdAt: Date.now() });
    alert("Регистрация успешна! Теперь войдите.");
    loginTab.click();
}

async function login() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if(!username || !password) { alert("Введите ник и пароль"); return; }
    const snapshot = await usersRef.child(username).once('value');
    const user = snapshot.val();
    if(!user || user.password !== password) {
        alert("Неверный ник или пароль");
        return;
    }
    currentUser = { username };
    localStorage.setItem("darkchat_user", username);
    localStorage.setItem("darkchat_pass", password);
    showMainScreen();
}

function logout() {
    if(messagesListener) messagesListener.off();
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
    currentUserSidebar.innerText = currentUser.username;
    await loadUsersList();
    await loadChatsList();
    // Сбрасываем активный чат
    currentChatWith = null;
    chatHeaderSpan.innerText = "Выберите чат";
    messagesContainer.innerHTML = '<div class="empty-chat">👈 Выберите пользователя слева</div>';
    inputArea.style.display = 'none';
    if(messagesListener) messagesListener.off();
}

// Загрузка всех пользователей (кроме себя)
async function loadUsersList() {
    const snapshot = await usersRef.once('value');
    const users = snapshot.val();
    allUsers = [];
    usersListDiv.innerHTML = '';
    for(let username in users) {
        if(username !== currentUser.username) {
            allUsers.push(username);
            const div = document.createElement('div');
            div.className = 'user-item';
            div.innerHTML = `<span class="user-avatar">👤</span><span class="user-name">${escapeHtml(username)}</span>`;
            div.onclick = () => openChatWith(username);
            usersListDiv.appendChild(div);
        }
    }
    // Фильтрация по поиску
    searchUsersInput.oninput = () => {
        const query = searchUsersInput.value.toLowerCase();
        const items = usersListDiv.querySelectorAll('.user-item');
        items.forEach(item => {
            const name = item.querySelector('.user-name').innerText.toLowerCase();
            item.style.display = name.includes(query) ? 'flex' : 'none';
        });
    };
}

// Загрузка списка диалогов (чатов) для текущего пользователя
async function loadChatsList() {
    const snapshot = await chatsRef.child(currentUser.username).once('value');
    const chats = snapshot.val();
    chatsListDiv.innerHTML = '';
    if(!chats) return;
    for(let otherUser in chats) {
        const lastMsg = chats[otherUser].lastMessage || '';
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <span class="user-avatar">💬</span>
            <div><div class="user-name">${escapeHtml(otherUser)}</div><div style="font-size:0.7rem;color:#7d828c">${escapeHtml(lastMsg.substring(0,30))}</div></div>
        `;
        div.onclick = () => openChatWith(otherUser);
        chatsListDiv.appendChild(div);
    }
}

// Открыть чат с пользователем
function openChatWith(username) {
    if(username === currentUser.username) return;
    currentChatWith = username;
    chatHeaderSpan.innerText = username;
    inputArea.style.display = 'block';
    // Подгружаем сообщения
    loadMessagesForChat(currentUser.username, username);
    // Добавляем в список чатов (если нет, создаём запись в chats)
    updateChatsList(currentUser.username, username);
    messageInput.focus();
}

// Обновить/создать запись о диалоге в базе
async function updateChatsList(myName, otherName) {
    const chatId = getChatId(myName, otherName);
    // Для меня
    await chatsRef.child(myName).child(otherName).set({ lastMessage: '', timestamp: Date.now() });
    // Для собеседника
    await chatsRef.child(otherName).child(myName).set({ lastMessage: '', timestamp: Date.now() });
    loadChatsList(); // перезагрузить список
}

// Загрузка сообщений из конкретного чата
function loadMessagesForChat(userA, userB) {
    if(messagesListener) messagesListener.off();
    const chatId = getChatId(userA, userB);
    const chatMessagesRef = messagesRef.child(chatId);
    messagesListener = chatMessagesRef.orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
        const data = snapshot.val();
        const messagesList = [];
        if(data) {
            Object.keys(data).forEach(key => messagesList.push({ id: key, ...data[key] }));
        }
        renderChatMessages(messagesList);
    });
}

// Отрисовка сообщений в выбранном чате
function renderChatMessages(messagesArray) {
    if(!messagesContainer) return;
    const wasBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    messagesContainer.innerHTML = '';
    if(!messagesArray.length) {
        messagesContainer.innerHTML = '<div class="empty-chat">Нет сообщений. Напишите первым!</div>';
        return;
    }
    const sorted = [...messagesArray].sort((a,b) => a.timestamp - b.timestamp);
    sorted.forEach(msg => {
        const isOwn = (msg.sender === currentUser.username);
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-item ${isOwn ? 'own' : ''}`;
        // Обработка упоминаний в тексте: подсветка @username
        let textHtml = escapeHtml(msg.text);
        textHtml = textHtml.replace(/@(\w+)/g, (match, name) => {
            return `<span class="mention">@${escapeHtml(name)}</span>`;
        });
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(msg.sender)}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-text">${textHtml}</div>
            </div>
            <div class="message-actions">
                <button class="action-btn copy-btn" data-text="${escapeHtml(msg.text).replace(/"/g, '&quot;')}">📋 Копировать</button>
                ${isOwn ? `<button class="action-btn delete-btn" data-id="${msg.id}">🗑️ Удалить</button>` : ''}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    // Обработчики кнопок
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const txt = btn.getAttribute('data-text').replace(/&quot;/g, '"');
            navigator.clipboard.writeText(txt);
            btn.innerHTML = '✅';
            setTimeout(() => btn.innerHTML = '📋 Копировать', 1000);
        };
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const msgId = btn.getAttribute('data-id');
            if(confirm('Удалить сообщение?')) {
                const chatId = getChatId(currentUser.username, currentChatWith);
                await messagesRef.child(chatId).child(msgId).remove();
            }
        };
    });
    if(wasBottom) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

// Отправка сообщения
async function sendMessage() {
    if(!currentUser || !currentChatWith) return;
    const text = messageInput.value.trim();
    if(text === "") return;
    const chatId = getChatId(currentUser.username, currentChatWith);
    const newMsg = {
        sender: currentUser.username,
        text: text,
        timestamp: Date.now()
    };
    const newMsgRef = await messagesRef.child(chatId).push(newMsg);
    // Обновляем последнее сообщение в списке чатов
    await chatsRef.child(currentUser.username).child(currentChatWith).set({ lastMessage: text, timestamp: Date.now() });
    await chatsRef.child(currentChatWith).child(currentUser.username).set({ lastMessage: text, timestamp: Date.now() });
    messageInput.value = "";
    updateCharCounter();
    // Автоскролл будет после рендера
    loadChatsList();
}

// Упоминания: при вводе @ показывать список пользователей
let mentionActive = false;
let mentionStartPos = -1;

messageInput.addEventListener('input', (e) => {
    updateCharCounter();
    const val = messageInput.value;
    const cursorPos = messageInput.selectionStart;
    // Ищем последний @ перед курсором
    const lastAtIndex = val.lastIndexOf('@', cursorPos-1);
    if(lastAtIndex !== -1 && (lastAtIndex === 0 || val[lastAtIndex-1] === ' ')) {
        const query = val.substring(lastAtIndex+1, cursorPos);
        if(query.length <= 20) {
            const filtered = allUsers.filter(u => u.toLowerCase().startsWith(query.toLowerCase()));
            showMentionSuggestions(filtered, lastAtIndex);
            mentionActive = true;
            mentionStartPos = lastAtIndex;
            return;
        }
    }
    hideMentionSuggestions();
    mentionActive = false;
});

function showMentionSuggestions(users, startPos) {
    if(users.length === 0) { hideMentionSuggestions(); return; }
    mentionSuggestions.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'mention-suggestion-item';
        div.innerText = user;
        div.onclick = () => {
            const before = messageInput.value.substring(0, startPos);
            const after = messageInput.value.substring(messageInput.selectionStart);
            messageInput.value = before + user + ' ' + after;
            hideMentionSuggestions();
            messageInput.focus();
        };
        mentionSuggestions.appendChild(div);
    });
    mentionSuggestions.classList.remove('hidden');
}
function hideMentionSuggestions() { mentionSuggestions.classList.add('hidden'); }

function updateCharCounter() {
    charCounter.innerText = `${messageInput.value.length}/500`;
}

// Отправка по Enter
messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
sendMsgBtn.addEventListener('click', sendMessage);

// Восстановление сессии
async function tryAutoLogin() {
    const savedUser = localStorage.getItem("darkchat_user");
    const savedPass = localStorage.getItem("darkchat_pass");
    if(savedUser && savedPass) {
        const snap = await usersRef.child(savedUser).once('value');
        if(snap.val() && snap.val().password === savedPass) {
            currentUser = { username: savedUser };
            showMainScreen();
            return true;
        }
    }
    return false;
}

// Переключение вкладок
loginTab.onclick = () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
};
registerTab.onclick = () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
};
doLoginBtn.onclick = login;
doRegisterBtn.onclick = register;
logoutMainBtn.onclick = logout;

// Запуск
window.addEventListener('DOMContentLoaded', async () => {
    if(!(await tryAutoLogin())) {
        authScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
    }
});
