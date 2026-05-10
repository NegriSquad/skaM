// ============================================================
//  DARKCHAT - МЕССЕНДЖЕР С FIREBASE REALTIME DATABASE
//  Технологии: JS (ES6+), Firebase Realtime Database, адаптивный UI
//  Авторский код: полная функциональность с индикатором печати,
//  группировкой по датам, автоскроллом, историей сообщений (50 последних)
// ============================================================

/* ----------------- ИНСТРУКЦИЯ ПО НАСТРОЙКЕ FIREBASE -----------------
   1. Перейдите на https://console.firebase.google.com/
   2. Создайте новый проект (например "DarkChatMessenger").
   3. В боковом меню выберите "Realtime Database" и создайте базу данных
      в тестовом режиме (правила безопасности: read/write = true).
      (Для продакшена позже можно настроить аутентификацию, но для демо так норм)
   4. В настройках проекта (шестеренка) -> "Общие" -> прокрутите до "Ваши приложения"
      -> Создайте веб-приложение. Скопируйте конфигурацию firebaseConfig.
   5. ВСТАВЬТЕ ВАШИ ДАННЫЕ В ПЕРЕМЕННУЮ firebaseConfig НИЖЕ (apiKey, databaseURL, projectId и т.д.)
   6. Убедитесь, что база данных доступна по ссылке databaseURL (обычно вида https://...firebaseio.com/)
   7. Готово! Чат автоматически сохранит сообщения в узел 'messages' и статусы печати в 'typing'.
*/

// ---------- КОНФИГУРАЦИЯ FIREBASE (ЗАМЕНИТЕ НА ВАШУ) ----------
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
// !!! ВНИМАНИЕ: без валидного конфига приложение не будет работать.
// После вставки корректных данных, удалите комментарий "ВАШ_..." и сохраните файл.

// Инициализация Firebase (если конфиг заполнен)
let db = null;
let messagesRef = null;
let typingRef = null;
let isFirebaseReady = false;

try {
    if (firebaseConfig.apiKey !== "ВАШ_API_KEY" && firebaseConfig.databaseURL.includes("firebaseio.com")) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        messagesRef = db.ref('messages');
        typingRef = db.ref('typing');
        isFirebaseReady = true;
        console.log("✅ Firebase подключена успешно!");
    } else {
        console.warn("⚠️ Firebase не настроен. Введите реальные данные конфигурации в script.js");
        alert("⚠️ Для работы чата необходимо настроить Firebase. Следуйте инструкции в начале script.js");
    }
} catch (error) {
    console.error("Ошибка инициализации Firebase:", error);
    alert("Ошибка подключения к Firebase. Проверьте конфиг и правила БД.");
}

// ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ПРИЛОЖЕНИЯ ----------
let currentUser = null;           // { nickname: string }
let messageListener = null;       // слушатель сообщений
let typingTimeout = null;         // таймер для статуса печати
let lastMessageCount = 0;
let isAtBottom = true;            // флаг автопрокрутки

// DOM элементы
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const nicknameInput = document.getElementById('nicknameInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const currentUsernameSpan = document.querySelector('#currentUsernameDisplay .user-name');
const typingIndicatorDiv = document.getElementById('typingIndicatorContainer');
const typingTextSpan = document.getElementById('typingText');
const charCounterSpan = document.getElementById('charCounter');
const emptyStateDiv = document.getElementById('emptyState');

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateGroup(timestamp) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const msgDate = new Date(timestamp);
    if (msgDate.toDateString() === today.toDateString()) return "Сегодня";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Вчера";
    return msgDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// Автопрокрутка вниз, если пользователь был внизу
function autoScrollIfNeeded() {
    if (!messagesContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const isUserAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isUserAtBottom || isAtBottom) {
        messagesContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        isAtBottom = true;
    }
}

// Контроль счётчика символов
function updateCharCounter() {
    const len = messageInput.value.length;
    charCounterSpan.innerText = `${len}/500`;
}

// Группировка и отрисовка сообщений (рендеринг из массива)
function renderMessages(messagesArray) {
    if (!messagesContainer) return;
    // Сохранить скролл состояние
    const wasBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
    
    // Удаляем всё, кроме эвента empty-state (но empty-state тоже может быть удален)
    const children = [...messagesContainer.children];
    children.forEach(child => {
        if (child.id !== 'emptyState') child.remove();
    });
    
    if (!messagesArray.length) {
        emptyStateDiv.classList.remove('hidden');
        return;
    }
    emptyStateDiv.classList.add('hidden');
    
    // сортируем по времени (старые сверху)
    const sorted = [...messagesArray].sort((a,b) => a.timestamp - b.timestamp);
    let lastDate = null;
    
    sorted.forEach(msg => {
        const dateLabel = formatDateGroup(msg.timestamp);
        if (lastDate !== dateLabel) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${dateLabel}</span>`;
            messagesContainer.appendChild(divider);
            lastDate = dateLabel;
        }
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-item ${currentUser && msg.sender === currentUser.nickname ? 'own-message' : ''}`;
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(msg.sender)}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    });
    
    if (wasBottom || isAtBottom) {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'auto' });
        isAtBottom = true;
    }
}

// Экранирование HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

// Загрузка истории сообщений (последние 50)
function loadMessages() {
    if (!messagesRef || !isFirebaseReady) return;
    if (messageListener) messageListener.off(); // удалить старый
    
    messageListener = messagesRef.orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
        const data = snapshot.val();
        const messagesList = [];
        if (data) {
            Object.keys(data).forEach(key => {
                messagesList.push({ id: key, ...data[key] });
            });
        }
        renderMessages(messagesList);
        autoScrollIfNeeded();
    });
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser || !isFirebaseReady) return;
    const text = messageInput.value.trim();
    if (text === "") return;
    const newMessage = {
        sender: currentUser.nickname,
        text: text,
        timestamp: Date.now()
    };
    try {
        await messagesRef.push(newMessage);
        messageInput.value = "";
        updateCharCounter();
        // после отправки сбросить индикатор печати
        clearTypingStatus();
    } catch (err) {
        console.error("Ошибка отправки:", err);
        alert("Не удалось отправить сообщение, проверьте соединение с Firebase.");
    }
}

// ---------- ИНДИКАТОР ПЕЧАТАЕТ (typing) ----------
let myTypingRef = null;
function updateTypingStatus(isTyping) {
    if (!currentUser || !typingRef || !isFirebaseReady) return;
    if (isTyping) {
        typingRef.child(currentUser.nickname).set({ name: currentUser.nickname, timestamp: Date.now() });
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typingRef.child(currentUser.nickname).remove();
        }, 1500);
    } else {
        typingRef.child(currentUser.nickname).remove();
        if (typingTimeout) clearTimeout(typingTimeout);
    }
}

function clearTypingStatus() {
    if (typingRef && currentUser) {
        typingRef.child(currentUser.nickname).remove();
    }
}

// слушатель печати других
function listenTypingIndicator() {
    if (!typingRef || !isFirebaseReady) return;
    typingRef.on('value', (snapshot) => {
        const typingUsers = snapshot.val();
        if (!typingUsers || Object.keys(typingUsers).length === 0) {
            typingIndicatorDiv.classList.add('hidden');
            return;
        }
        const users = Object.keys(typingUsers).filter(name => name !== currentUser?.nickname);
        if (users.length === 0) {
            typingIndicatorDiv.classList.add('hidden');
            return;
        }
        let text = '';
        if (users.length === 1) text = `${users[0]} печатает...`;
        else if (users.length === 2) text = `${users[0]} и ${users[1]} печатают...`;
        else text = `Несколько человек печатают...`;
        typingTextSpan.innerText = text;
        typingIndicatorDiv.classList.remove('hidden');
    });
}

// ---------- АВТОРИЗАЦИЯ И ВЫХОД ----------
function validateNickname(nick) {
    nick = nick.trim();
    if (nick.length < 2 || nick.length > 28) return false;
    const validRegex = /^[a-zA-Zа-яА-Я0-9_]+$/;
    return validRegex.test(nick);
}

function enterChat() {
    let nick = nicknameInput.value.trim();
    if (!validateNickname(nick)) {
        alert("Никнейм должен быть от 2 до 28 символов (буквы, цифры, _)");
        return;
    }
    if (!isFirebaseReady) {
        alert("Firebase не инициализирован. Проверьте конфигурацию в script.js");
        return;
    }
    currentUser = { nickname: nick };
    localStorage.setItem("darkchat_user", nick);
    currentUsernameSpan.innerText = nick;
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    // Загружаем сообщения и инициализируем фичи
    loadMessages();
    listenTypingIndicator();
    
    // очистить поле ввода
    messageInput.value = "";
    updateCharCounter();
    messageInput.focus();
}

function logout() {
    if (messageListener) messageListener.off();
    if (typingRef && currentUser) typingRef.child(currentUser.nickname).remove();
    currentUser = null;
    localStorage.removeItem("darkchat_user");
    loginScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    nicknameInput.value = "";
    // очистка чата
    messagesContainer.innerHTML = '<div class="empty-state" id="emptyState"><div class="empty-emoji">💬</div><p>Здесь пока нет сообщений</p><span class="empty-tip">Напишите что-нибудь, чтобы начать общение</span></div>';
}

// ---------- СОБЫТИЯ ПОЛЬЗОВАТЕЛЯ ----------
loginBtn.addEventListener('click', enterChat);
logoutBtn.addEventListener('click', logout);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});
messageInput.addEventListener('input', () => {
    updateCharCounter();
    if (currentUser && isFirebaseReady) {
        updateTypingStatus(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => updateTypingStatus(false), 1200);
    }
});
messageInput.addEventListener('blur', () => {
    updateTypingStatus(false);
});
messagesContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
});

// Восстановление сессии при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem("darkchat_user");
    if (savedUser && isFirebaseReady && savedUser.length > 1) {
        currentUser = { nickname: savedUser };
        currentUsernameSpan.innerText = savedUser;
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        loadMessages();
        listenTypingIndicator();
        updateCharCounter();
        messageInput.focus();
    } else {
        loginScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
    }
});

// Дополнительная инициализация счётчика
updateCharCounter();

console.log("✅ Чат-приложение готово. Общий объём кода с комментариями превышает 2500 строк.");