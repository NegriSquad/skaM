// ============================================================
// DARKCHAT - исправленная версия с обработкой ошибок Firebase
// ============================================================

/* ----------------- ИНСТРУКЦИЯ FIREBASE -----------------
   1. Создайте проект в Firebase Console.
   2. В Realtime Database установите правила: { "rules": { ".read": true, ".write": true } }
   3. Скопируйте свой конфиг (apiKey, databaseURL) и вставьте ниже.
   4. Если конфиг не заполнен, чат работает в ДЕМО-режиме (сообщения не сохраняются между сессиями).
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

// Глобальные переменные
let db, messagesRef, typingRef;
let currentUser = null;
let messagesListener = null;
let typingTimeout = null;
let firebaseReady = false;
let demoMode = false;   // если true — используем локальный массив вместо Firebase

// Локальное хранилище для демо-режима
let localMessages = [];
let localTypingUsers = {};

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

// ---------- Инициализация Firebase или переход в демо-режим ----------
try {
    // Проверяем, заполнен ли конфиг (не содержит "ВАШ_")
    const isConfigFilled = firebaseConfig.apiKey !== "ВАШ_API_KEY" && 
                           firebaseConfig.databaseURL !== "https://ВАШ_ПРОЕКТ.firebaseio.com";
    if (isConfigFilled) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        messagesRef = db.ref('messages');
        typingRef = db.ref('typing');
        firebaseReady = true;
        demoMode = false;
        console.log("✅ Firebase подключена! Чат работает в реальном времени.");
    } else {
        console.warn("⚠️ Firebase не настроен. Включён ДЕМО-РЕЖИМ (сообщения не сохраняются после перезагрузки).");
        demoMode = true;
        firebaseReady = false;
        // Загружаем демо-сообщения из localStorage, если есть
        const saved = localStorage.getItem("darkchat_demo_messages");
        if (saved) localMessages = JSON.parse(saved);
    }
} catch(e) {
    console.error("Ошибка Firebase:", e);
    demoMode = true;
    firebaseReady = false;
    alert("Ошибка подключения к Firebase. Включён демо-режим.");
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
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
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate()-1);
    if (d.toDateString() === yesterday.toDateString()) return "Вчера";
    return d.toLocaleDateString('ru-RU');
}

// Сохранение демо-сообщений в localStorage
function saveDemoMessages() {
    if (demoMode) {
        localStorage.setItem("darkchat_demo_messages", JSON.stringify(localMessages));
    }
}

// ---------- ОТРИСОВКА СООБЩЕНИЙ (общая для Firebase и демо) ----------
function renderMessages(messagesArray) {
    if (!messagesContainer) return;
    const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    // Очищаем контейнер, кроме empty-state
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
        msgDiv.setAttribute('data-msg-id', msg.id || msg._localId);
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
                ${isOwn ? `<button class="action-btn delete-btn" data-id="${msg.id || msg._localId}">🗑️ Удалить</button>` : ''}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    // Обработчики кнопок
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.getAttribute('data-text').replace(/&quot;/g, '"');
            navigator.clipboard.writeText(text).then(() => {
                const oldHTML = btn.innerHTML;
                btn.innerHTML = '✅ Скопировано';
                setTimeout(() => { if(btn) btn.innerHTML = oldHTML; }, 1000);
            }).catch(() => alert('Не удалось скопировать'));
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const msgId = btn.getAttribute('data-id');
            if (confirm('Удалить сообщение?')) {
                if (demoMode) {
                    localMessages = localMessages.filter(m => (m.id || m._localId) != msgId);
                    saveDemoMessages();
                    renderMessages(localMessages);
                } else if (messagesRef) {
                    await messagesRef.child(msgId).remove();
                }
            }
        });
    });
    if (wasAtBottom) messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
}

// ---------- ЗАГРУЗКА СООБЩЕНИЙ ----------
function loadMessages() {
    if (demoMode) {
        renderMessages(localMessages);
        // В демо-режиме нет реального времени, но можно имитировать обновление через таймер (не нужно)
        return;
    }
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

// ---------- ОТПРАВКА СООБЩЕНИЯ ----------
async function sendMessage() {
    if (!currentUser) return;
    const text = messageInput.value.trim();
    if (text === "") return;
    if (demoMode) {
        const newMsg = {
            _localId: Date.now() + Math.random(),
            sender: currentUser.nickname,
            text: text,
            timestamp: Date.now()
        };
        localMessages.push(newMsg);
        saveDemoMessages();
        renderMessages(localMessages);
        messageInput.value = "";
        updateCharCounter();
        clearTypingStatus();
    } else if (messagesRef) {
        await messagesRef.push({
            sender: currentUser.nickname,
            text: text,
            timestamp: Date.now()
        });
        messageInput.value = "";
        updateCharCounter();
        clearTypingStatus();
    }
}

// ---------- ИНДИКАТОР ПЕЧАТАЕТ (демо и Firebase) ----------
function updateTypingStatus(isTyping) {
    if (!currentUser) return;
    if (demoMode) {
        if (isTyping) {
            localTypingUsers[currentUser.nickname] = Date.now();
            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                delete localTypingUsers[currentUser.nickname];
                updateTypingDisplay();
            }, 1500);
        } else {
            delete localTypingUsers[currentUser.nickname];
        }
        updateTypingDisplay();
        return;
    }
    if (!typingRef) return;
    if (isTyping) {
        typingRef.child(currentUser.nickname).set({ name: currentUser.nickname, timestamp: Date.now() });
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => typingRef.child(currentUser.nickname).remove(), 1500);
    } else {
        typingRef.child(currentUser.nickname).remove();
    }
}

function updateTypingDisplay() {
    if (demoMode) {
        const users = Object.keys(localTypingUsers).filter(u => u !== currentUser?.nickname);
        if (users.length === 0) {
            typingDiv.classList.add('hidden');
            return;
        }
        let text = '';
        if (users.length === 1) text = `${users[0]} печатает...`;
        else if (users.length === 2) text = `${users[0]} и ${users[1]} печатают...`;
        else text = `Несколько человек печатают...`;
        typingTextSpan.innerText = text;
        typingDiv.classList.remove('hidden');
        return;
    }
    // Firebase версия
    if (!typingRef) return;
    typingRef.on('value', (snap) => {
        const usersData = snap.val();
        if (!usersData) {
            typingDiv.classList.add('hidden');
            return;
        }
        const typingList = Object.keys(usersData).filter(u => u !== currentUser?.nickname);
        if (typingList.length === 0) {
            typingDiv.classList.add('hidden');
            return;
        }
        let text = '';
        if (typingList.length === 1) text = `${typingList[0]} печатает...`;
        else if (typingList.length === 2) text = `${typingList[0]} и ${typingList[1]} печатают...`;
        else text = `Несколько человек печатают...`;
        typingTextSpan.innerText = text;
        typingDiv.classList.remove('hidden');
    });
}

function clearTypingStatus() {
    if (demoMode) {
        delete localTypingUsers[currentUser?.nickname];
        updateTypingDisplay();
        return;
    }
    if (typingRef && currentUser) typingRef.child(currentUser.nickname).remove();
    if (typingTimeout) clearTimeout(typingTimeout);
}

function listenTyping() {
    if (demoMode) {
        // В демо-режиме просто запускаем обновление отображения
        setInterval(() => {
            // Очищаем старые статусы (старше 2 сек)
            const now = Date.now();
            for (let u in localTypingUsers) {
                if (now - localTypingUsers[u] > 2000) delete localTypingUsers[u];
            }
            updateTypingDisplay();
        }, 1000);
        return;
    }
    if (typingRef) {
        updateTypingDisplay();  // первичная установка слушателя
    }
}

// ---------- ВХОД И ВЫХОД ----------
function enterChat() {
    const nick = nicknameInput.value.trim();
    if (nick.length < 2) {
        alert("Никнейм должен быть не менее 2 символов");
        return;
    }
    currentUser = { nickname: nick };
    localStorage.setItem("darkchat_user", nick);
    showChat();
}

function showChat() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUsernameSpan.innerText = currentUser.nickname;
    if (demoMode) {
        console.log("Демо-режим: сообщения хранятся только локально.");
        if (localMessages.length === 0) {
            // Добавим приветственное сообщение для демо
            localMessages.push({
                _localId: Date.now(),
                sender: "System",
                text: "Добро пожаловать в демо-чат! Для полноценной работы настройте Firebase.",
                timestamp: Date.now()
            });
            saveDemoMessages();
        }
    }
    loadMessages();
    listenTyping();
    messageInput.value = "";
    updateCharCounter();
    messageInput.focus();
}

function logout() {
    if (messagesListener && !demoMode) messagesListener.off();
    if (typingRef && !demoMode && currentUser) typingRef.child(currentUser.nickname).remove();
    currentUser = null;
    localStorage.removeItem("darkchat_user");
    loginScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    // Сбрасываем сообщения
    messagesContainer.innerHTML = `<div class="empty-state" id="emptyState"><div class="empty-emoji">💬</div><p>Нет сообщений</p></div>`;
}

function updateCharCounter() {
    charCounter.innerText = `${messageInput.value.length}/500`;
}

// Автовход
function tryAutoLogin() {
    const savedNick = localStorage.getItem("darkchat_user");
    if (savedNick && savedNick.length >= 2) {
        currentUser = { nickname: savedNick };
        showChat();
        return true;
    }
    return false;
}

// ---------- НАСТРОЙКА СОБЫТИЙ ----------
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

// Запуск при загрузке
window.addEventListener('DOMContentLoaded', () => {
    if (!tryAutoLogin()) {
        loginScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
    }
    // Если демо-режим и нет сообщений, покажем подсказку
    if (demoMode && localMessages.length === 0) {
        console.log("Демо-режим активен. Для сохранения сообщений настройте Firebase.");
    }
});
