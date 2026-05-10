// ============================================================
// DARKCHAT - только ник, удаление и копирование сообщений
// ============================================================

/* ----------------- ИНСТРУКЦИЯ FIREBASE -----------------
   1. Создайте проект в Firebase Console.
   2. В Realtime Database установите правила: { "rules": { ".read": true, ".write": true } }
   3. Скопируйте свой конфиг (apiKey, databaseURL) и вставьте ниже.
*/

const firebaseConfig = {
    apiKey: "AIzaSyD3NEXunS2PQPVQ3nDS27Nk4JIG3xajyVM",
  authDomain: "messendger-71e53.firebaseapp.com",
  databaseURL: "https://messendger-71e53-default-rtdb.firebaseio.com",
  projectId: "messendger-71e53",
  storageBucket: "messendger-71e53.firebasestorage.app",
  messagingSenderId: "1010287168963",
  appId: "1:1010287168963:web:15868f94480bb833414176",
  measurementId: "G-6RYMEGSKNM"
};

let db, messagesRef, typingRef;
let currentUser = null;          // { nickname }
let messagesListener = null;
let typingTimeout = null;

// DOM элементы
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const nicknameInput = document.getElementById('nicknameInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const currentUsernameSpan = document.getElementById('currentUsernameDisplay');
const typingDiv = document.getElementById('typingIndicatorContainer');
const typingTextSpan = document.getElementById('typingText');
const charCounter = document.getElementById('charCounter');

// Инициализация Firebase
let firebaseReady = false;
try {
    if (firebaseConfig.apiKey !== "ВАШ_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        messagesRef = db.ref('messages');
        typingRef = db.ref('typing');
        firebaseReady = true;
        console.log("✅ Firebase готова");
    } else {
        alert("⚠️ Настройте Firebase в script.js (укажите apiKey и databaseURL)");
    }
} catch(e) { console.error(e); }

// Вспомогательные функции
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function formatDateGroup(ts) {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Сегодня";
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    if (d.toDateString() === yesterday.toDateString()) return "Вчера";
    return d.toLocaleDateString('ru-RU');
}

// Вход по нику
function enterChat() {
    if (!firebaseReady) return alert("Firebase не инициализирована");
    const nick = nicknameInput.value.trim();
    if (nick.length < 2) return alert("Никнейм должен быть не менее 2 символов");
    currentUser = { nickname: nick };
    localStorage.setItem("darkchat_user", nick);
    showChat();
}

function showChat() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUsernameSpan.innerText = currentUser.nickname;
    loadMessages();
    listenTyping();
    messageInput.value = "";
    updateCharCounter();
    messageInput.focus();
}

function logout() {
    if (messagesListener) messagesListener.off();
    if (typingRef && currentUser) typingRef.child(currentUser.nickname).remove();
    currentUser = null;
    localStorage.removeItem("darkchat_user");
    loginScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    messagesContainer.innerHTML = `<div class="empty-state" id="emptyState"><div class="empty-emoji">💬</div><p>Нет сообщений</p></div>`;
}

// Отрисовка сообщений с кнопками копирования и удаления (только для своих)
function renderMessages(messagesArray) {
    if (!messagesContainer) return;
    const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    // очищаем, кроме empty-state
    const children = [...messagesContainer.children];
    children.forEach(c => { if (c.id !== 'emptyState') c.remove(); });
    const emptyDiv = document.getElementById('emptyState');
    if (!messagesArray.length) {
        if (emptyDiv) emptyDiv.classList.remove('hidden');
        return;
    }
    if (emptyDiv) emptyDiv.classList.add('hidden');
    const sorted = [...messagesArray].sort((a,b) => a.timestamp - b.timestamp);
    let lastDate = null;
    sorted.forEach(msg => {
        const dateLabel = formatDateGroup(msg.timestamp);
        if (lastDate !== dateLabel) {
            const divDate = document.createElement('div');
            divDate.className = 'date-divider';
            divDate.innerHTML = `<span>${dateLabel}</span>`;
            messagesContainer.appendChild(divDate);
            lastDate = dateLabel;
        }
        const isOwn = (currentUser && msg.sender === currentUser.nickname);
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-item ${isOwn ? 'own-message' : ''}`;
        msgDiv.setAttribute('data-msg-id', msg.id);
        // Экранируем текст для атрибута data-text (чтобы кавычки не ломали)
        const escapedText = escapeHtml(msg.text).replace(/"/g, '&quot;');
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(msg.sender)}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
            <div class="message-actions">
                <button class="action-btn copy-btn" data-text="${escapedText}">📋 Копировать</button>
                ${isOwn ? `<button class="action-btn delete-btn" data-id="${msg.id}">🗑️ Удалить</button>` : ''}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    // Назначаем обработчики после вставки
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.getAttribute('data-text');
            // восстанавливаем экранированные кавычки (если были)
            const originalText = text.replace(/&quot;/g, '"');
            navigator.clipboard.writeText(originalText).then(() => {
                const oldText = btn.innerHTML;
                btn.innerHTML = '✅ Скопировано';
                setTimeout(() => { if(btn) btn.innerHTML = oldText; }, 1000);
            }).catch(() => alert('Не удалось скопировать'));
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const msgId = btn.getAttribute('data-id');
            if (confirm('Удалить это сообщение?')) {
                await messagesRef.child(msgId).remove();
            }
        });
    });
    if (wasAtBottom) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

// Загрузка сообщений из БД (реалтайм)
function loadMessages() {
    if (!messagesRef) return;
    if (messagesListener) messagesListener.off();
    messagesListener = messagesRef.orderByChild('timestamp').limitToLast(50).on('value', (snap) => {
        const data = snap.val();
        const list = [];
        if (data) {
            Object.keys(data).forEach(key => list.push({ id: key, ...data[key] }));
        }
        renderMessages(list);
    });
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser) return;
    const text = messageInput.value.trim();
    if (text === "") return;
    await messagesRef.push({
        sender: currentUser.nickname,
        text: text,
        timestamp: Date.now()
    });
    messageInput.value = "";
    updateCharCounter();
    clearTypingStatus();
}

// Индикатор "печатает"
function updateTypingStatus(isTyping) {
    if (!currentUser || !typingRef) return;
    if (isTyping) {
        typingRef.child(currentUser.nickname).set({ name: currentUser.nickname, timestamp: Date.now() });
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => typingRef.child(currentUser.nickname).remove(), 1500);
    } else {
        typingRef.child(currentUser.nickname).remove();
    }
}
function clearTypingStatus() {
    if (typingRef && currentUser) typingRef.child(currentUser.nickname).remove();
    if (typingTimeout) clearTimeout(typingTimeout);
}
function listenTyping() {
    if (!typingRef) return;
    typingRef.on('value', (snap) => {
        const users = snap.val();
        if (!users || Object.keys(users).length === 0) {
            typingDiv.classList.add('hidden');
            return;
        }
        const typingList = Object.keys(users).filter(u => u !== currentUser?.nickname);
        if (typingList.length === 0) { typingDiv.classList.add('hidden'); return; }
        let text = '';
        if (typingList.length === 1) text = `${typingList[0]} печатает...`;
        else if (typingList.length === 2) text = `${typingList[0]} и ${typingList[1]} печатают...`;
        else text = `Несколько человек печатают...`;
        typingTextSpan.innerText = text;
        typingDiv.classList.remove('hidden');
    });
}

function updateCharCounter() {
    charCounter.innerText = `${messageInput.value.length}/500`;
}

// Автовосстановление сессии
function tryAutoLogin() {
    const savedNick = localStorage.getItem("darkchat_user");
    if (savedNick && firebaseReady) {
        currentUser = { nickname: savedNick };
        showChat();
        return true;
    }
    return false;
}

// События
loginBtn.addEventListener('click', enterChat);
logoutBtn.addEventListener('click', logout);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
messageInput.addEventListener('input', () => {
    updateCharCounter();
    if (currentUser) {
        updateTypingStatus(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => updateTypingStatus(false), 1200);
    }
});
messageInput.addEventListener('blur', () => updateTypingStatus(false));
messagesContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    window._isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
});

// Запуск
window.addEventListener('DOMContentLoaded', () => {
    if (firebaseReady) {
        if (!tryAutoLogin()) {
            loginScreen.classList.remove('hidden');
            chatScreen.classList.add('hidden');
        }
    } else {
        loginScreen.classList.remove('hidden');
    }
});
