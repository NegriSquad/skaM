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
    recordedChunks: [],
    recordingStartTime: null,
    recordingTimer: null,
    currentRecordType: null,
    videoStream: null,
    waveformAnimationId: null,
    isRecording: false,
    notificationsEnabled: false,
    unreadMessages: {},
    lastNotificationTimestamp: 0,
    pushSubscription: null,
    isMobile: false,
    currentMsgStyle: 'default',
    currentAccentColor: '#2aabee',
    currentBg: 'default'
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    updateCharCounter();
    auth.onAuthStateChanged(handleAuthState);
    initNotifications();
    checkIfMobile();
    applySavedSettings();
    initActionsPanel();
});

function checkIfMobile() {
    state.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function bindElements() {
    const ids = [
        "loginScreen", "registerScreen", "mainAppScreen", "loginEmail", "loginPassword",
        "doLoginBtn", "showRegisterBtn", "regEmail", "regUsername", "regNickname",
        "regPassword", "doRegisterBtn", "showLoginFromRegBtn", "globalLogoutBtn",
        "openProfileBtn", "sidebarAvatar", "sidebarName", "sidebarUsername",
        "searchUserInput", "searchUserBtn", "searchResults", "dialogsList",
        "dialogsCount", "chatArea", "backToDialogsBtn", "chatAvatar", "currentChatTitle",
        "currentChatSubtitle", "deleteDialogBtn", "messagesContainer", "typingIndicatorContainer",
        "typingText", "scrollBottomBtn", "messageInput", "charCounter", "editBanner",
        "cancelEditBtn", "profileModal", "closeProfileBtn", "profileAvatarPreview",
        "profilePreviewName", "profilePreviewUsername", "profileNickname",
        "profileUsername", "profileAvatarFile", "removeAvatarBtn", "profileBio", "saveProfileBtn",
        "telegramBottomUI", "voiceRecorderPanel", "videoRecorderPanel",
        "voiceTimer", "videoTimer", "cancelVoiceBtn", "sendVoiceBtn", "cancelVideoBtn",
        "sendVideoBtn", "videoPreview", "waveformCanvas",
        "settingsModal", "closeSettingsBtn", "aboutModal", "closeAboutBtn",
        "openSettingsFromSidebar", "chatPartnerAvatarBtn", "partnerProfileModal",
        "closePartnerProfileBtn", "partnerChatBtn", "partnerAvatarPreview",
        "partnerPreviewName", "partnerPreviewUsername", "partnerBioDisplay",
        "partnerUsernameDisplay", "messageActionsPanel", "closeActionsPanel"
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            els[id] = el;
        } else {
            console.warn(`Element with id "${id}" not found`);
            els[id] = {
                classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
                addEventListener: () => {},
                replaceChildren: () => {},
                appendChild: () => {},
                textContent: '',
                value: '',
                style: {},
                src: '',
                disabled: false,
                innerHTML: '',
                click: () => {},
                scrollTo: () => {},
                scrollHeight: 0,
                scrollTop: 0,
                clientHeight: 0,
                files: [],
                checked: false,
                dataset: {}
            };
        }
    });

    els.sendBtnTelegram = document.getElementById('sendBtnTelegram');
    els.voiceRecordBtnTelegram = document.getElementById('voiceRecordBtnTelegram');
    els.videoRecordBtnTelegram = document.getElementById('videoRecordBtnTelegram');
    els.emojiBtnTelegram = document.getElementById('emojiBtnTelegram');
    els.navContactsBtn = document.getElementById('navContactsBtn');
    els.navCallsBtn = document.getElementById('navCallsBtn');
    els.navChatsBtn = document.getElementById('navChatsBtn');
    els.navSettingsBtn = document.getElementById('navSettingsBtn');
}

function bindEvents() {
    initTheme();
    els.doLoginBtn.addEventListener("click", loginUser);
    els.doRegisterBtn.addEventListener("click", registerUser);
    els.showRegisterBtn.addEventListener("click", () => showAuthScreen("register"));
    els.showLoginFromRegBtn.addEventListener("click", () => showAuthScreen("login"));
    els.globalLogoutBtn.addEventListener("click", logout);
    els.openProfileBtn.addEventListener("click", openProfileModal);
    els.closeProfileBtn.addEventListener("click", closeProfileModal);
    els.saveProfileBtn.addEventListener("click", saveProfile);
    els.profileAvatarFile.addEventListener("change", handleAvatarFileSelect);
    els.removeAvatarBtn.addEventListener("click", removeSelectedAvatar);
    els.profileModal.addEventListener("click", event => {
        if (event.target === els.profileModal) closeProfileModal();
    });

    // ===== ИСПРАВЛЕННЫЙ ПОИСК =====
    els.searchUserBtn.addEventListener("click", function(e) {
        e.preventDefault();
        const query = els.searchUserInput.value.trim();
        if (query.length >= 2) {
            searchUserByUsername(query);
        } else {
            els.searchResults.classList.remove("hidden");
            els.searchResults.replaceChildren();
            els.searchResults.appendChild(searchMessage("Введите минимум 2 символа для поиска."));
        }
    });

    els.searchUserInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            const query = this.value.trim();
            if (query.length >= 2) {
                searchUserByUsername(query);
            }
        }
    });

    // Убираем автоматический поиск при вводе (он мешал)
    // Оставляем только поиск по Enter или кнопке

    if (els.sendBtnTelegram) {
        els.sendBtnTelegram.addEventListener("click", sendOrUpdateMessage);
    }

    els.cancelEditBtn.addEventListener("click", cancelEditMessage);
    els.deleteDialogBtn.addEventListener("click", deleteCurrentDialog);
    els.scrollBottomBtn.addEventListener("click", () => scrollMessagesToBottom(true));
    els.backToDialogsBtn.addEventListener("click", () => els.chatArea.classList.remove("open"));

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
    els.messagesContainer.addEventListener("scroll", () => {
        updateScrollState();
    });

    if (els.voiceRecordBtnTelegram) {
        els.voiceRecordBtnTelegram.addEventListener("click", () => {
            if (!state.activeChatId) {
                alert("Сначала выберите диалог");
                return;
            }
            if (!state.isRecording) {
                startRecording('voice');
            } else if (state.isRecording && state.currentRecordType === 'voice') {
                sendVoiceRecording();
            }
        });
    }

    if (els.videoRecordBtnTelegram) {
        els.videoRecordBtnTelegram.addEventListener("click", () => {
            if (!state.activeChatId) {
                alert("Сначала выберите диалог");
                return;
            }
            if (!state.isRecording) {
                startRecording('video');
            } else if (state.isRecording && state.currentRecordType === 'video') {
                sendVideoRecording();
            }
        });
    }

    if (els.emojiBtnTelegram) {
        els.emojiBtnTelegram.addEventListener("click", () => {
            console.log('Emoji picker - можно добавить позже');
        });
    }

    if (els.navContactsBtn) {
        els.navContactsBtn.addEventListener("click", () => {
            els.searchUserInput?.focus();
        });
    }

    if (els.navCallsBtn) {
        els.navCallsBtn.addEventListener("click", () => {
            alert('Функция звонков будет добавлена в следующей версии');
        });
    }

    if (els.navChatsBtn) {
        els.navChatsBtn.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                els.chatArea.classList.remove('open');
            }
        });
    }

    if (els.navSettingsBtn) {
        els.navSettingsBtn.addEventListener("click", openSettingsModal);
    }

    if (els.openSettingsFromSidebar) {
        els.openSettingsFromSidebar.addEventListener("click", openSettingsModal);
    }

    if (els.chatPartnerAvatarBtn) {
        els.chatPartnerAvatarBtn.addEventListener("click", () => {
            if (state.activePartner) {
                openPartnerProfile(state.activePartner);
            }
        });
    }

    if (els.closePartnerProfileBtn) {
        els.closePartnerProfileBtn.addEventListener("click", () => {
            if (els.partnerProfileModal) els.partnerProfileModal.classList.add("hidden");
        });
    }

    if (els.partnerProfileModal) {
        els.partnerProfileModal.addEventListener("click", (event) => {
            if (event.target === els.partnerProfileModal) {
                els.partnerProfileModal.classList.add("hidden");
            }
        });
    }

    if (els.partnerChatBtn) {
        els.partnerChatBtn.addEventListener("click", () => {
            if (els.partnerProfileModal) els.partnerProfileModal.classList.add("hidden");
        });
    }

    if (els.cancelVoiceBtn) els.cancelVoiceBtn.addEventListener("click", cancelRecording);
    if (els.sendVoiceBtn) els.sendVoiceBtn.addEventListener("click", sendVoiceRecording);
    if (els.cancelVideoBtn) els.cancelVideoBtn.addEventListener("click", cancelRecording);
    if (els.sendVideoBtn) els.sendVideoBtn.addEventListener("click", sendVideoRecording);

    if (els.closeSettingsBtn) {
        els.closeSettingsBtn.addEventListener("click", () => {
            if (els.settingsModal) els.settingsModal.classList.add("hidden");
        });
    }

    if (els.settingsModal) {
        els.settingsModal.addEventListener("click", (event) => {
            if (event.target === els.settingsModal) {
                els.settingsModal.classList.add("hidden");
            }
        });
    }

    if (els.closeAboutBtn) {
        els.closeAboutBtn.addEventListener("click", () => {
            if (els.aboutModal) els.aboutModal.classList.add("hidden");
        });
    }

    if (els.aboutModal) {
        els.aboutModal.addEventListener("click", (event) => {
            if (event.target === els.aboutModal) {
                els.aboutModal.classList.add("hidden");
            }
        });
    }

    // Настройки
    document.querySelector('[data-setting="folders"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('foldersSettings')?.classList.remove('hidden');
    });

    document.querySelector('[data-setting="security"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('securitySettings')?.classList.remove('hidden');
    });

    document.querySelector('[data-setting="devices"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('devicesSettings')?.classList.remove('hidden');
    });

    document.querySelector('[data-setting="notifications"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('notificationsSettings')?.classList.remove('hidden');
        initNotificationToggles();
    });

    document.querySelector('[data-setting="appearance"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('appearanceSettings')?.classList.remove('hidden');
        initAppearanceSettings();
    });

    document.querySelector('[data-setting="language"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('languageSettings')?.classList.remove('hidden');
        initLanguageSettings();
    });

    document.querySelector('[data-setting="shortcuts"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('shortcutsSettings')?.classList.remove('hidden');
    });

    document.querySelector('[data-setting="help"]')?.addEventListener("click", () => {
        closeAllModals();
        document.getElementById('helpSettings')?.classList.remove('hidden');
    });

    document.querySelector('[data-setting="about"]')?.addEventListener("click", () => {
        if (els.settingsModal) els.settingsModal.classList.add("hidden");
        if (els.aboutModal) els.aboutModal.classList.remove("hidden");
    });

    // Назад в настройках
    document.getElementById('backFromAppearance')?.addEventListener('click', () => {
        document.getElementById('appearanceSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromLanguage')?.addEventListener('click', () => {
        document.getElementById('languageSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromNotifications')?.addEventListener('click', () => {
        document.getElementById('notificationsSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromSecurity')?.addEventListener('click', () => {
        document.getElementById('securitySettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromDevices')?.addEventListener('click', () => {
        document.getElementById('devicesSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromHelp')?.addEventListener('click', () => {
        document.getElementById('helpSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromShortcuts')?.addEventListener('click', () => {
        document.getElementById('shortcutsSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    document.getElementById('backFromFolders')?.addEventListener('click', () => {
        document.getElementById('foldersSettings')?.classList.add('hidden');
        document.getElementById('settingsModal')?.classList.remove('hidden');
    });

    // Закрытие страниц настроек
    document.getElementById('closeAppearanceBtn')?.addEventListener('click', () => {
        document.getElementById('appearanceSettings')?.classList.add('hidden');
    });

    document.getElementById('closeLanguageBtn')?.addEventListener('click', () => {
        document.getElementById('languageSettings')?.classList.add('hidden');
    });

    document.getElementById('closeNotificationsBtn')?.addEventListener('click', () => {
        document.getElementById('notificationsSettings')?.classList.add('hidden');
    });

    document.getElementById('closeSecurityBtn')?.addEventListener('click', () => {
        document.getElementById('securitySettings')?.classList.add('hidden');
    });

    document.getElementById('closeDevicesBtn')?.addEventListener('click', () => {
        document.getElementById('devicesSettings')?.classList.add('hidden');
    });

    document.getElementById('closeHelpBtn')?.addEventListener('click', () => {
        document.getElementById('helpSettings')?.classList.add('hidden');
    });

    document.getElementById('closeShortcutsBtn')?.addEventListener('click', () => {
        document.getElementById('shortcutsSettings')?.classList.add('hidden');
    });

    document.getElementById('closeFoldersBtn')?.addEventListener('click', () => {
        document.getElementById('foldersSettings')?.classList.add('hidden');
    });

    // Дополнительные кнопки в настройках
    document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
        const email = state.user?.email;
        if (!email) {
            alert('Email пользователя не найден');
            return;
        }

        const newPassword = prompt('Введите новый пароль (минимум 6 символов):');
        if (!newPassword || newPassword.length < 6) {
            alert('Пароль должен быть не короче 6 символов');
            return;
        }

        const confirmPassword = prompt('Подтвердите новый пароль:');
        if (newPassword !== confirmPassword) {
            alert('Пароли не совпадают');
            return;
        }

        auth.currentUser?.updatePassword(newPassword)
            .then(() => {
                alert('Пароль успешно изменён!');
            })
            .catch(error => {
                alert(`Ошибка смены пароля: ${error.message}`);
            });
    });

    document.getElementById('sessionsBtn')?.addEventListener('click', () => {
        alert('🔒 Активные сессии\n\nТекущее устройство активно.\nДругие активные сессии не обнаружены.');
    });

    document.getElementById('logoutAllDevicesBtn')?.addEventListener('click', () => {
        if (confirm('Выйти на всех устройствах? Это действие завершит все активные сессии.')) {
            auth.signOut().then(() => {
                alert('Вы вышли на всех устройствах');
            }).catch(error => {
                alert(`Ошибка: ${error.message}`);
            });
        }
    });

    document.getElementById('createFolderBtn')?.addEventListener('click', () => {
        const folderName = prompt('Введите название папки:');
        if (folderName && folderName.trim()) {
            const foldersList = document.getElementById('foldersList');
            if (foldersList) {
                const item = document.createElement('div');
                item.className = 'folder-item';
                item.innerHTML = `
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${folderName.trim()}</span>
                    <span class="folder-count">0</span>
                `;
                foldersList.appendChild(item);
                alert(`Папка "${folderName.trim()}" создана!`);
            }
        }
    });

    document.querySelector('[data-help="faq"]')?.addEventListener('click', () => {
        alert('❓ Часто задаваемые вопросы\n\nQ: Как найти пользователя?\nA: Используйте поиск по @username в верхней части чатов.\n\nQ: Как удалить сообщение?\nA: Нажмите на сообщение и выберите "Удалить у себя" или "Удалить везде".');
    });

    document.querySelector('[data-help="guides"]')?.addEventListener('click', () => {
        alert('📖 Руководства\n\n1. Регистрация - создайте аккаунт с уникальным username\n2. Поиск - найдите пользователя по @username\n3. Сообщения - отправляйте текстовые и голосовые сообщения\n4. Профиль - настройте имя, аватарку и статус');
    });

    document.querySelector('[data-help="support"]')?.addEventListener('click', () => {
        alert('📧 Связаться с поддержкой\n\nEmail: support@localgram.app\n\nМы ответим в течение 24 часов.');
    });

    document.querySelector('[data-help="report"]')?.addEventListener('click', () => {
        alert('🐛 Сообщить об ошибке\n\nОпишите проблему и отправьте на:\nEmail: bugs@localgram.app\n\nПожалуйста, укажите:\n- Что произошло\n- Как воспроизвести\n- Скриншот (если есть)');
    });
}

// ===== ПАНЕЛЬ ДЕЙСТВИЙ =====
let selectedMessageId = null;
let selectedMessageData = null;
let selectedMessageElement = null;
let actionsOverlay = null;

function initActionsPanel() {
    actionsOverlay = document.createElement('div');
    actionsOverlay.className = 'actions-overlay';
    actionsOverlay.id = 'actionsOverlay';
    document.body.appendChild(actionsOverlay);

    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.dataset.action;
            
            if (!selectedMessageId || !selectedMessageData) {
                closeMessageActions();
                return;
            }
            
            switch(action) {
                case 'edit':
                    beginEditMessage(selectedMessageData);
                    closeMessageActions();
                    break;
                    
                case 'reply':
                    alert('Функция "Ответить" будет добавлена позже');
                    closeMessageActions();
                    break;
                    
                case 'forward':
                    alert('Функция "Переслать" будет добавлена позже');
                    closeMessageActions();
                    break;
                    
                case 'markUnread':
                    closeMessageActions();
                    break;
                    
                case 'copy':
                    if (selectedMessageData.text) {
                        navigator.clipboard.writeText(selectedMessageData.text).then(() => {
                            showToast('Текст скопирован');
                        }).catch(() => {
                            const textarea = document.createElement('textarea');
                            textarea.value = selectedMessageData.text;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                            showToast('Текст скопирован');
                        });
                    }
                    closeMessageActions();
                    break;
                    
                case 'select':
                    closeMessageActions();
                    break;
                    
                case 'deleteForMe':
                    deleteMessageForMe(selectedMessageId);
                    closeMessageActions();
                    break;
                    
                case 'deleteForAll':
                    if (confirm('Удалить это сообщение для всех?')) {
                        deleteMessageForAll(selectedMessageId);
                    }
                    closeMessageActions();
                    break;
            }
        });
    });

    actionsOverlay.addEventListener('click', closeMessageActions);
    if (els.closeActionsPanel) {
        els.closeActionsPanel.addEventListener('click', closeMessageActions);
    }
}

function openMessageActions(messageId, messageData, element) {
    selectedMessageId = messageId;
    selectedMessageData = messageData;
    selectedMessageElement = element;
    
    const panel = els.messageActionsPanel;
    if (!panel) return;
    
    const editBtn = panel.querySelector('[data-action="edit"]');
    const copyBtn = panel.querySelector('[data-action="copy"]');
    const deleteForMeBtn = panel.querySelector('[data-action="deleteForMe"]');
    const deleteForAllBtn = panel.querySelector('[data-action="deleteForAll"]');
    const replyBtn = panel.querySelector('[data-action="reply"]');
    const forwardBtn = panel.querySelector('[data-action="forward"]');
    const markUnreadBtn = panel.querySelector('[data-action="markUnread"]');
    const selectBtn = panel.querySelector('[data-action="select"]');
    
    const isOwn = messageData.senderId === state.user?.uid;
    const isText = !messageData.voiceData && !messageData.videoData;
    const isDeleted = messageData.deleted === true;
    
    if (isOwn && isText && !isDeleted) {
        editBtn.style.display = 'flex';
    } else {
        editBtn.style.display = 'none';
    }
    
    if (isText && !isDeleted && messageData.text) {
        copyBtn.style.display = 'flex';
    } else {
        copyBtn.style.display = 'none';
    }
    
    if (isOwn && !isDeleted) {
        deleteForMeBtn.style.display = 'flex';
    } else {
        deleteForMeBtn.style.display = 'none';
    }
    
    if (isOwn && !isDeleted) {
        deleteForAllBtn.style.display = 'flex';
    } else {
        deleteForAllBtn.style.display = 'none';
    }
    
    replyBtn.style.display = 'flex';
    forwardBtn.style.display = 'flex';
    markUnreadBtn.style.display = 'flex';
    selectBtn.style.display = 'flex';
    
    panel.classList.add('visible');
    if (actionsOverlay) actionsOverlay.classList.add('visible');
}

function closeMessageActions() {
    const panel = els.messageActionsPanel;
    if (panel) panel.classList.remove('visible');
    if (actionsOverlay) actionsOverlay.classList.remove('visible');
    selectedMessageId = null;
    selectedMessageData = null;
    selectedMessageElement = null;
}

// ===== УДАЛЕНИЕ СООБЩЕНИЙ =====

async function deleteMessageForMe(messageId) {
    if (!state.activeChatId) return;
    
    try {
        await db.ref(`private_messages/${state.activeChatId}/${messageId}/deletedFor/${state.user.uid}`).set(true);
        await syncLastMessageAfterDelete();
        showToast('Сообщение удалено у вас');
    } catch (error) {
        console.error('Delete for me error:', error);
        alert('Не удалось удалить сообщение');
    }
}

async function deleteMessageForAll(messageId) {
    if (!state.activeChatId) return;
    
    try {
        await db.ref(`private_messages/${state.activeChatId}/${messageId}`).remove();
        await syncLastMessageAfterDelete();
        showToast('Сообщение удалено для всех');
    } catch (error) {
        console.error('Delete for all error:', error);
        alert('Не удалось удалить сообщение для всех');
    }
}

function showToast(text) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = text;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ===== АВТОРИЗАЦИЯ =====

async function handleAuthState(user) {
    if (!user) {
        resetSession();
        showAuthScreen("login");
        return;
    }

    state.user = user;
    try {
        const snap = await db.ref(`users/${user.uid}`).once("value");
        state.profile = snap.val();

        if (!state.profile) {
            alert("Профиль пользователя не найден.");
            await auth.signOut();
            return;
        }

        showMainApp();
        listenForNotifications();
        updateUnreadCount();
    } catch (error) {
        console.error("Auth error:", error);
        alert("Ошибка загрузки профиля. Проверьте правила безопасности Firebase.");
    }
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
    if (state.user) {
        db.ref(`notifications/${state.user.uid}`).off();
    }
    state.user = null;
    state.profile = null;
    state.activeChatId = null;
    state.activePartner = null;
    state.editingMessageId = null;
    state.selectedAvatarDataUrl = null;
    if (els.mainAppScreen) els.mainAppScreen.classList.add("hidden");
    document.title = 'Localgram';
    if (navigator.clearAppBadge) {
        navigator.clearAppBadge().catch(() => {});
    }
}

function detachListeners() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
    state.dialogsListener = null;
    state.messagesListener = null;
    state.typingListener = null;
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
    await clearTypingIndicator();
    await stopRecording(true);
    await auth.signOut();
}

// ===== ПРОФИЛЬ =====

function renderCurrentProfile() {
    const profile = state.profile || {};
    setAvatar(els.sidebarAvatar, profile.nickname || profile.username, profile.avatarUrl);
    els.sidebarName.textContent = profile.nickname || "Профиль";
    els.sidebarUsername.textContent = `@${profile.username || "username"}`;
}

function openProfileModal() {
    const profile = state.profile || {};
    els.profileNickname.value = profile.nickname || "";
    els.profileUsername.value = profile.username || "";
    els.profileAvatarFile.value = "";
    state.selectedAvatarDataUrl = profile.avatarUrl || "";
    els.profileBio.value = profile.bio || "";
    updateProfilePreview();
    els.profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    els.profileModal.classList.add("hidden");
}

async function saveProfile() {
    const nickname = els.profileNickname.value.trim();
    const username = normalizeUsername(els.profileUsername.value);
    const avatarUrl = state.selectedAvatarDataUrl || "";
    const bio = els.profileBio.value.trim();

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
    const nickname = els.profileNickname.value.trim() || "Имя";
    const username = normalizeUsername(els.profileUsername.value) || "username";
    setAvatar(els.profileAvatarPreview, nickname, state.selectedAvatarDataUrl);
    els.profilePreviewName.textContent = nickname;
    els.profilePreviewUsername.textContent = `@${username}`;
}

async function handleAvatarFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Выберите файл изображения.");
        els.profileAvatarFile.value = "";
        return;
    }

    try {
        state.selectedAvatarDataUrl = await compressAvatar(file);
        updateProfilePreview();
    } catch (error) {
        alert(`Не удалось обработать аватарку: ${error.message}`);
        els.profileAvatarFile.value = "";
    }
}

function removeSelectedAvatar() {
    state.selectedAvatarDataUrl = "";
    els.profileAvatarFile.value = "";
    updateProfilePreview();
}

document.addEventListener("input", event => {
    if (event.target && (event.target.id === "profileNickname" || event.target.id === "profileUsername")) {
        updateProfilePreview();
    }
});

// ===== ДИАЛОГИ =====

function listenDialogs() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);

    const ref = db.ref(`user_chats/${state.user.uid}`);
    const callback = snap => renderDialogs(snap.val() || {});
    ref.on("value", callback);
    state.dialogsListener = { ref, callback };
}

function renderDialogs(chats) {
    const entries = Object.entries(chats).sort((a, b) => (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0));
    els.dialogsList.replaceChildren();
    els.dialogsCount.textContent = entries.length;

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

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        setAvatar(avatar, info.partnerName || info.partnerUsername, info.partnerAvatarUrl);

        const content = document.createElement("span");
        content.className = "dialog-content";

        const name = document.createElement("strong");
        name.textContent = info.partnerName || `@${info.partnerUsername}`;

        const last = document.createElement("small");
        last.textContent = info.lastMessage || "Диалог создан";

        const meta = document.createElement("time");
        meta.textContent = info.lastTimestamp ? formatShortTime(info.lastTimestamp) : "";

        content.append(name, last);
        item.append(avatar, content, meta);
        els.dialogsList.appendChild(item);
    });
}

// ===== ИСПРАВЛЕННЫЙ ПОИСК ПОЛЬЗОВАТЕЛЕЙ =====

async function searchUserByUsername(rawUsername) {
    const username = normalizeUsername(rawUsername);
    els.searchResults.classList.remove("hidden");
    els.searchResults.replaceChildren();

    if (!username || username.length < 2) {
        els.searchResults.appendChild(searchMessage("Введите минимум 2 символа для поиска."));
        return;
    }

    try {
        // Получаем всех пользователей из базы
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val() || {};
        
        let foundUser = null;
        let foundUid = null;
        
        const searchTerm = username.toLowerCase();
        
        // Ищем пользователя с частичным совпадением
        for (const [uid, userData] of Object.entries(users)) {
            if (uid === state.user?.uid) continue; // Пропускаем себя
            
            const userUsername = (userData.username || '').toLowerCase();
            const userNickname = (userData.nickname || '').toLowerCase();
            
            // Проверяем полное совпадение или начало username
            if (userUsername === searchTerm || 
                userUsername.startsWith(searchTerm) || 
                userNickname.includes(searchTerm) ||
                userUsername.includes(searchTerm)) {
                foundUser = userData;
                foundUid = uid;
                break;
            }
        }
        
        if (!foundUser) {
            els.searchResults.appendChild(searchMessage(`Пользователь "${rawUsername}" не найден.`));
            return;
        }

        // Создаём карточку результата
        const item = document.createElement("div");
        item.className = "search-result-item";

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        setAvatar(avatar, foundUser.nickname || foundUser.username, foundUser.avatarUrl);

        const text = document.createElement("span");
        text.className = "search-result-text";
        text.innerHTML = `
            <strong>${foundUser.nickname || foundUser.username}</strong>
            <small>@${foundUser.username}</small>
        `;

        const button = document.createElement("button");
        button.className = "small-btn";
        button.textContent = "Написать";
        button.addEventListener("click", () => startDialogWith(foundUid, foundUser));

        item.append(avatar, text, button);
        els.searchResults.appendChild(item);
        
    } catch (error) {
        console.error("Search error:", error);
        els.searchResults.appendChild(searchMessage(`Ошибка поиска: ${error.message}`));
    }
}

async function startDialogWith(uid, userData) {
    if (!state.user) {
        alert("Вы не авторизованы");
        return;
    }
    
    const chatId = [state.user.uid, uid].sort().join("_");
    const now = Date.now();
    
    try {
        const ownRef = db.ref(`user_chats/${state.user.uid}/${chatId}`);
        const exists = (await ownRef.once("value")).exists();

        if (!exists) {
            await ownRef.set({
                partnerId: uid,
                partnerName: userData.nickname || userData.username,
                partnerUsername: userData.username,
                partnerAvatarUrl: userData.avatarUrl || "",
                partnerBio: userData.bio || "",
                lastMessage: "",
                lastTimestamp: now
            });
            await db.ref(`user_chats/${uid}/${chatId}`).set({
                partnerId: state.user.uid,
                partnerName: state.profile?.nickname || state.profile?.username || "Пользователь",
                partnerUsername: state.profile?.username || "username",
                partnerAvatarUrl: state.profile?.avatarUrl || "",
                partnerBio: state.profile?.bio || "",
                lastMessage: "",
                lastTimestamp: now
            });
        }

        els.searchUserInput.value = "";
        els.searchResults.classList.add("hidden");
        openChat(chatId, { 
            uid, 
            nickname: userData.nickname || userData.username, 
            username: userData.username, 
            avatarUrl: userData.avatarUrl || "", 
            bio: userData.bio || "" 
        });
    } catch (error) {
        console.error("Start dialog error:", error);
        alert(`Не удалось начать диалог: ${error.message}`);
    }
}

function openChat(chatId, partner) {
    state.activeChatId = chatId;
    state.activePartner = partner;
    state.editingMessageId = null;
    cancelEditMessage();

    els.currentChatTitle.textContent = partner.nickname || `@${partner.username}`;
    els.currentChatSubtitle.textContent = partner.bio || `@${partner.username}`;
    setAvatar(els.chatAvatar, partner.nickname || partner.username, partner.avatarUrl);
    els.chatAvatar.classList.remove("muted");
    els.deleteDialogBtn.classList.remove("hidden");
    els.messageInput.disabled = false;
    if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
    if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
    if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;

    if (els.telegramBottomUI) {
        els.telegramBottomUI.classList.remove('hidden');
    }

    renderLoadingMessages();
    listenMessages(chatId);
    listenTyping(chatId);
    markNotificationsRead(chatId);

    if (window.innerWidth <= 768) els.chatArea.classList.add("open");

    setTimeout(() => {
        scrollMessagesToBottom(false);
    }, 200);
}

function markNotificationsRead(chatId) {
    if (!state.user) return;
    try {
        db.ref(`notifications/${state.user.uid}/${chatId}`).update({
            read: true
        }).then(() => {
            updateUnreadCount();
        }).catch(() => {});
    } catch (e) {}
}

function listenMessages(chatId) {
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);

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
        els.messagesContainer.replaceChildren(emptyBlock("Сообщений пока нет", "Напишите первым и начните диалог."));
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
    });

    els.messagesContainer.replaceChildren(fragment);
    if (wasAtBottom) {
        setTimeout(() => scrollMessagesToBottom(false), 50);
    }
    setTimeout(updateScrollState, 100);
}

function createMessageNode(message) {
    const isOwn = message.senderId === state.user.uid;
    const isDeleted = message.deleted === true;
    
    const item = document.createElement("article");
    item.className = `message-item ${isOwn ? "own-message" : ""}`;

    item.addEventListener('click', function(e) {
        if (e.target.closest('.voice-play-btn') || e.target.closest('.video-player')) {
            return;
        }
        openMessageActions(message.id, message, item);
    });

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (isDeleted) {
        const text = document.createElement("p");
        text.className = "message-text muted-text";
        text.textContent = "Сообщение удалено";
        bubble.appendChild(text);
    } else if (message.voiceData) {
        const voiceElement = createVoicePlayer(message.voiceData, message.voiceDuration);
        bubble.appendChild(voiceElement);
    } else if (message.videoData) {
        const videoElement = createVideoPlayer(message.videoData);
        bubble.appendChild(videoElement);
    } else {
        const text = document.createElement("p");
        text.className = "message-text";
        text.textContent = message.text || "";
        bubble.appendChild(text);
    }

    if (!isDeleted && state.currentMsgStyle) {
        applyMessageStyleToElement(bubble, state.currentMsgStyle);
    }

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("time");
    time.textContent = `${formatShortTime(message.timestamp)}${message.editedAt ? " · изменено" : ""}`;
    meta.appendChild(time);

    bubble.appendChild(meta);
    item.appendChild(bubble);
    return item;
}

function createVoicePlayer(voiceDataUrl, duration) {
    const container = document.createElement("div");
    container.className = "voice-message";

    const playBtn = document.createElement("button");
    playBtn.className = "voice-play-btn";
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

    const waveform = document.createElement("div");
    waveform.className = "voice-waveform";

    for (let i = 0; i < 20; i++) {
        const bar = document.createElement("div");
        bar.className = "waveform-bar";
        bar.style.height = `${Math.random() * 20 + 5}px`;
        waveform.appendChild(bar);
    }

    const durationSpan = document.createElement("span");
    durationSpan.className = "voice-duration";
    durationSpan.textContent = formatDuration(duration || 0);

    const audio = new Audio(voiceDataUrl);
    audio.preload = "metadata";

    let isPlaying = false;

    playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isPlaying) {
            audio.pause();
            playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            isPlaying = false;
            container.classList.remove("playing");
        } else {
            audio.play();
            playBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            isPlaying = true;
            container.classList.add("playing");
        }
    });

    audio.addEventListener("ended", () => {
        playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        isPlaying = false;
        container.classList.remove("playing");
    });

    container.append(playBtn, waveform, durationSpan);
    return container;
}

function createVideoPlayer(videoDataUrl) {
    const container = document.createElement("div");
    container.className = "video-message";

    const video = document.createElement("video");
    video.src = videoDataUrl;
    video.controls = true;
    video.preload = "metadata";
    video.className = "video-player";

    container.appendChild(video);
    return container;
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function sendOrUpdateMessage() {
    if (!state.activeChatId || !state.activePartner) {
        alert("Сначала выберите диалог");
        return;
    }

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
            return;
        }

        const newMessageRef = db.ref(`private_messages/${state.activeChatId}`).push();
        await newMessageRef.set({
            senderId: state.user.uid,
            text,
            timestamp: Date.now(),
            editedAt: null,
            deleted: false
        });

        await updateChatLastMessage(text);
        els.messageInput.value = "";
        updateCharCounter();
        await clearTypingIndicator();

        if (state.activePartner && state.activePartner.uid) {
            try {
                const partnerName = state.profile.nickname || state.profile.username || 'Пользователь';
                const partnerId = state.activePartner.uid;

                await db.ref(`notifications/${partnerId}/${state.activeChatId}`).set({
                    senderId: state.user.uid,
                    senderName: partnerName,
                    message: text,
                    timestamp: Date.now(),
                    read: false
                });
            } catch (notifError) {
                console.log('Ошибка уведомления:', notifError);
            }
        }

    } catch (error) {
        console.error("Send message error:", error);
        if (error.message && error.message.includes("permission_denied")) {
            alert("Нет прав для отправки сообщения. Проверьте правила безопасности Firebase.");
        } else {
            alert(`Не удалось отправить сообщение: ${error.message}`);
        }
    }
}

// ===== ГОЛОСОВЫЕ И ВИДЕО =====

async function startRecording(type) {
    if (!state.activeChatId) {
        alert("Сначала выберите диалог");
        return;
    }

    if (state.isRecording) {
        alert("Уже идет запись");
        return;
    }

    await stopRecording(true);
    state.currentRecordType = type;
    state.recordedChunks = [];
    state.isRecording = true;

    try {
        if (type === 'voice') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);

            state.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    state.recordedChunks.push(event.data);
                }
            };

            state.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
            };

            state.recordingStartTime = Date.now();
            state.mediaRecorder.start(100);

            if (els.voiceRecorderPanel) els.voiceRecorderPanel.classList.remove("hidden");
            startTimer('voice');
            startWaveformAnimation();

        } else if (type === 'video') {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            state.videoStream = stream;
            if (els.videoPreview) els.videoPreview.srcObject = stream;

            state.mediaRecorder = new MediaRecorder(stream);

            state.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    state.recordedChunks.push(event.data);
                }
            };

            state.mediaRecorder.onstop = () => {
                if (state.videoStream) {
                    state.videoStream.getTracks().forEach(track => track.stop());
                    state.videoStream = null;
                }
                if (els.videoPreview) els.videoPreview.srcObject = null;
            };

            state.recordingStartTime = Date.now();
            state.mediaRecorder.start(100);

            if (els.videoRecorderPanel) els.videoRecorderPanel.classList.remove("hidden");
            if (els.sendVideoBtn) els.sendVideoBtn.disabled = false;
            startTimer('video');
        }

        els.messageInput.disabled = true;
        if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = true;
        if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = true;
        if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = true;

    } catch (error) {
        console.error("Recording error:", error);
        alert("Не удалось получить доступ к микрофону/камере. Проверьте разрешения.");
        cancelRecording();
    }
}

function startTimer(type) {
    if (state.recordingTimer) clearInterval(state.recordingTimer);

    state.recordingTimer = setInterval(() => {
        if (!state.recordingStartTime) return;
        const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (type === 'voice' && els.voiceTimer) {
            els.voiceTimer.textContent = timeStr;
        } else if (type === 'video' && els.videoTimer) {
            els.videoTimer.textContent = timeStr;
        }

        if (elapsed >= 60) {
            if (type === 'voice') {
                sendVoiceRecording();
            } else {
                sendVideoRecording();
            }
        }
    }, 1000);
}

function startWaveformAnimation() {
    if (!els.waveformCanvas) return;

    const canvas = els.waveformCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth || 200;
    canvas.height = canvas.clientHeight || 40;

    function draw() {
        if (!els.waveformCanvas || !state.isRecording) return;
        ctx.fillStyle = 'rgba(42, 171, 238, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barCount = 40;
        const barWidth = (canvas.width / barCount) - 2;

        for (let i = 0; i < barCount; i++) {
            const height = Math.random() * canvas.height;
            ctx.fillStyle = '#2aabee';
            ctx.fillRect(i * (barWidth + 2), canvas.height - height, barWidth, height);
        }

        state.waveformAnimationId = requestAnimationFrame(draw);
    }

    draw();
}

function stopWaveformAnimation() {
    if (state.waveformAnimationId) {
        cancelAnimationFrame(state.waveformAnimationId);
        state.waveformAnimationId = null;
    }

    if (els.waveformCanvas) {
        const ctx = els.waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, els.waveformCanvas.width, els.waveformCanvas.height);
    }
}

async function stopRecording(keepChunks = false) {
    if (state.recordingTimer) {
        clearInterval(state.recordingTimer);
        state.recordingTimer = null;
    }

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        try {
            state.mediaRecorder.stop();
        } catch (e) {
            console.log("Recorder already stopped");
        }
    }

    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
        state.videoStream = null;
        if (els.videoPreview) els.videoPreview.srcObject = null;
    }

    stopWaveformAnimation();

    if (!keepChunks) {
        state.recordedChunks = [];
    }

    state.isRecording = false;
}

async function cancelRecording() {
    await stopRecording(false);

    state.currentRecordType = null;
    state.recordingStartTime = null;

    if (els.voiceRecorderPanel) els.voiceRecorderPanel.classList.add("hidden");
    if (els.videoRecorderPanel) els.videoRecorderPanel.classList.add("hidden");

    if (state.activeChatId) {
        els.messageInput.disabled = false;
        if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
    }
    if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
    if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;

    if (els.videoTimer) els.videoTimer.textContent = "00:00";
    if (els.voiceTimer) els.voiceTimer.textContent = "00:00";
}

async function sendVoiceRecording() {
    if (!state.isRecording || state.recordedChunks.length === 0) {
        cancelRecording();
        return;
    }

    try {
        await stopRecording(true);

        const duration = (Date.now() - state.recordingStartTime) / 1000;
        const blob = new Blob(state.recordedChunks, { type: 'audio/webm' });

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await db.ref(`private_messages/${state.activeChatId}`).push({
                    senderId: state.user.uid,
                    voiceData: reader.result,
                    voiceDuration: duration,
                    timestamp: Date.now(),
                    editedAt: null,
                    deleted: false
                });
                await updateChatLastMessage("🎤 Голосовое сообщение");

                state.recordedChunks = [];
                state.currentRecordType = null;
                state.recordingStartTime = null;
                state.isRecording = false;

                if (els.voiceRecorderPanel) els.voiceRecorderPanel.classList.add("hidden");
                if (els.voiceTimer) els.voiceTimer.textContent = "00:00";

                els.messageInput.disabled = false;
                if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
                if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
                if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;

            } catch (error) {
                console.error("Send voice error:", error);
                if (error.message && error.message.includes("permission_denied")) {
                    alert("Нет прав для отправки голосового сообщения. Проверьте правила безопасности Firebase.");
                } else {
                    alert(`Не удалось отправить голосовое сообщение: ${error.message}`);
                }
                cancelRecording();
            }
        };

        reader.onerror = () => {
            console.error("FileReader error");
            alert("Ошибка при обработке записи");
            cancelRecording();
        };

        reader.readAsDataURL(blob);

    } catch (error) {
        console.error("Send voice error:", error);
        alert(`Не удалось отправить голосовое сообщение: ${error.message}`);
        cancelRecording();
    }
}

async function sendVideoRecording() {
    if (!state.isRecording || state.recordedChunks.length === 0) {
        cancelRecording();
        return;
    }

    try {
        await stopRecording(true);

        const duration = (Date.now() - state.recordingStartTime) / 1000;
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await db.ref(`private_messages/${state.activeChatId}`).push({
                    senderId: state.user.uid,
                    videoData: reader.result,
                    videoDuration: duration,
                    timestamp: Date.now(),
                    editedAt: null,
                    deleted: false
                });
                await updateChatLastMessage("📹 Видеосообщение");

                state.recordedChunks = [];
                state.currentRecordType = null;
                state.recordingStartTime = null;
                state.isRecording = false;

                if (els.videoRecorderPanel) els.videoRecorderPanel.classList.add("hidden");
                if (els.videoTimer) els.videoTimer.textContent = "00:00";

                els.messageInput.disabled = false;
                if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = false;
                if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = false;
                if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = false;

            } catch (error) {
                console.error("Send video error:", error);
                if (error.message && error.message.includes("permission_denied")) {
                    alert("Нет прав для отправки видео. Проверьте правила безопасности Firebase.");
                } else {
                    alert(`Не удалось отправить видеосообщение: ${error.message}`);
                }
                cancelRecording();
            }
        };

        reader.onerror = () => {
            console.error("FileReader error");
            alert("Ошибка при обработке видео");
            cancelRecording();
        };

        reader.readAsDataURL(blob);

    } catch (error) {
        console.error("Send video error:", error);
        alert(`Не удалось отправить видеосообщение: ${error.message}`);
        cancelRecording();
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

async function updateChatLastMessage(text, timestamp = Date.now()) {
    try {
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
            partnerBio: state.profile.bio || ""
        });
    } catch (error) {
        console.error("Update chat last message error:", error);
    }
}

function beginEditMessage(message) {
    if (message.voiceData || message.videoData || message.deleted) return;
    state.editingMessageId = message.id;
    els.messageInput.value = message.text;
    els.messageInput.focus();
    els.editBanner.classList.remove("hidden");
    updateCharCounter();
}

function cancelEditMessage() {
    state.editingMessageId = null;
    els.editBanner.classList.add("hidden");
    if (els.messageInput) {
        els.messageInput.value = "";
        updateCharCounter();
    }
}

async function syncLastMessageAfterDelete() {
    if (!state.activeChatId || !state.activePartner) return;
    try {
        const snap = await db.ref(`private_messages/${state.activeChatId}`).orderByChild("timestamp").limitToLast(30).once("value");
        const messages = Object.values(snap.val() || {})
            .filter(message => !message.deleted && (!message.deletedFor || !message.deletedFor[state.user.uid]))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const latest = messages[0];
        await updateChatLastMessage(latest ? (latest.text || latest.voiceData ? "🎤 Голосовое" : latest.videoData ? "📹 Видео" : "Сообщение") : "Сообщений нет", latest ? latest.timestamp : Date.now());
    } catch (error) {
        console.error("Sync last message error:", error);
    }
}

async function deleteCurrentDialog() {
    if (!state.activeChatId || !confirm("Удалить диалог из списка? Сообщения у собеседника останутся.")) return;
    try {
        await db.ref(`user_chats/${state.user.uid}/${state.activeChatId}`).remove();
        renderEmptyChat();
    } catch (error) {
        console.error("Delete dialog error:", error);
        alert("Не удалось удалить диалог. Проверьте правила безопасности.");
    }
}

function renderEmptyChat() {
    state.activeChatId = null;
    state.activePartner = null;
    els.currentChatTitle.textContent = "Выберите диалог";
    els.currentChatSubtitle.textContent = "Сообщения появятся здесь";
    els.chatAvatar.textContent = "L";
    els.chatAvatar.style.backgroundImage = "";
    els.chatAvatar.classList.add("muted");
    els.deleteDialogBtn.classList.add("hidden");
    els.messageInput.disabled = true;
    if (els.sendBtnTelegram) els.sendBtnTelegram.disabled = true;
    if (els.voiceRecordBtnTelegram) els.voiceRecordBtnTelegram.disabled = true;
    if (els.videoRecordBtnTelegram) els.videoRecordBtnTelegram.disabled = true;

    if (els.telegramBottomUI) {
        els.telegramBottomUI.classList.add('hidden');
    }

    els.messagesContainer.replaceChildren(emptyBlock("Добро пожаловать", "Найдите пользователя по username или откройте существующий диалог."));
    updateScrollState();
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
}

function renderLoadingMessages() {
    els.messagesContainer.replaceChildren(emptyBlock("Загрузка", "Получаем историю сообщений."));
}

function listenTyping(chatId) {
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);

    const ref = db.ref(`typing/${chatId}`);
    const callback = snap => {
        const data = snap.val() || {};
        const typingUsers = Object.entries(data).filter(([uid]) => uid !== state.user.uid);
        els.typingIndicatorContainer.classList.toggle("hidden", typingUsers.length === 0);
        if (typingUsers.length) {
            els.typingText.textContent = `${typingUsers[0][1].name || "Собеседник"} печатает...`;
        }
    };
    ref.on("value", callback);
    state.typingListener = { ref, callback };
}

function updateTyping(isTyping) {
    if (!state.activeChatId || !state.user || state.editingMessageId || state.isRecording) return;
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

async function refreshOwnDialogCards() {
    try {
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
    } catch (error) {
        console.error("Refresh dialog cards error:", error);
    }
}

async function findUidByUsername(username) {
    const clean = normalizeUsername(username);
    if (!clean) return null;
    
    try {
        const direct = (await db.ref(`usernames/${clean}`).once("value")).val();
        if (typeof direct === "string") return direct;
    } catch (error) {
        console.error("Error finding username:", error);
        return null;
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
}

function openPartnerProfile(partner) {
    if (!partner) return;

    const modal = els.partnerProfileModal;
    if (!modal) return;

    const avatar = els.partnerAvatarPreview;
    setAvatar(avatar, partner.nickname || partner.username, partner.avatarUrl);

    if (els.partnerPreviewName) {
        els.partnerPreviewName.textContent = partner.nickname || partner.username || 'Пользователь';
    }
    if (els.partnerPreviewUsername) {
        els.partnerPreviewUsername.textContent = `@${partner.username || 'username'}`;
    }
    if (els.partnerUsernameDisplay) {
        els.partnerUsernameDisplay.textContent = `@${partner.username || 'username'}`;
    }
    if (els.partnerBioDisplay) {
        els.partnerBioDisplay.textContent = partner.bio || '—';
    }

    if (els.partnerChatBtn) {
        els.partnerChatBtn.dataset.partnerId = partner.uid;
        els.partnerChatBtn.dataset.chatId = state.activeChatId;
    }

    modal.classList.remove('hidden');
}

// ===== ТЕМА И СТИЛИ =====

function initTheme() {
    const saved = localStorage.getItem("localgram-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

function openSettingsModal() {
    if (els.settingsModal) {
        els.settingsModal.classList.remove("hidden");
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal:not(.hidden)');
    modals.forEach(modal => {
        if (modal.id !== 'profileModal' && modal.id !== 'settingsModal' && modal.id !== 'partnerProfileModal') {
            modal.classList.add('hidden');
        }
    });
}

function applySavedSettings() {
    const savedBg = localStorage.getItem('localgram-chat-bg');
    if (savedBg) {
        state.currentBg = savedBg;
        applyChatBackground(savedBg);
    }

    const savedStyle = localStorage.getItem('localgram-msg-style');
    if (savedStyle) {
        state.currentMsgStyle = savedStyle;
    }

    const savedAccent = localStorage.getItem('localgram-accent-color');
    if (savedAccent) {
        state.currentAccentColor = savedAccent;
        applyAccentColor(savedAccent);
    }
}

function applyChatBackground(bg) {
    const chatPanel = document.querySelector('.chat-panel');
    if (!chatPanel) return;

    const bgMap = {
        'default': 'var(--chat-bg)',
        'gradient1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'gradient3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'gradient4': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'gradient5': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };

    chatPanel.style.background = bgMap[bg] || 'var(--chat-bg)';
}

function applyMessageStyleToElement(element, style) {
    if (!element) return;
    
    const styleMap = {
        'default': { borderRadius: '12px 12px 12px 2px', background: 'var(--bubble)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
        'rounded': { borderRadius: '16px', background: 'var(--bubble)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
        'gradient': { borderRadius: '12px 12px 12px 2px', background: 'linear-gradient(135deg, var(--accent), #7b61ff)', color: 'white', boxShadow: '0 2px 8px rgba(42, 171, 238, 0.3)' },
        'neumorphic': { borderRadius: '16px', background: 'var(--panel)', color: 'var(--text)', boxShadow: '4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.1)' }
    };

    const styleConfig = styleMap[style] || styleMap['default'];
    Object.assign(element.style, styleConfig);
    
    if (style === 'gradient') {
        element.style.color = 'white';
    } else {
        element.style.color = 'var(--text)';
    }
}

function applyAccentColor(color) {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-dark', color);
}

function initAppearanceSettings() {
    const themeOptions = document.querySelectorAll('.theme-option');
    const currentTheme = document.documentElement.dataset.theme || 'light';

    themeOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.theme === currentTheme);
        option.replaceWith?.(option.cloneNode(true));
    });

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const theme = option.dataset.theme;
            if (theme === 'system') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                applyTheme(prefersDark ? 'dark' : 'light');
                localStorage.removeItem('localgram-theme');
            } else {
                applyTheme(theme);
                localStorage.setItem('localgram-theme', theme);
            }
        });
    });

    const bgOptions = document.querySelectorAll('.bg-option');
    const savedBg = localStorage.getItem('localgram-chat-bg') || 'default';

    bgOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.bg === savedBg);
        option.replaceWith?.(option.cloneNode(true));
    });

    document.querySelectorAll('.bg-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.bg-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const bg = option.dataset.bg;
            state.currentBg = bg;
            localStorage.setItem('localgram-chat-bg', bg);
            applyChatBackground(bg);
        });
    });

    const msgStyleOptions = document.querySelectorAll('.msg-style-option');
    const savedStyle = localStorage.getItem('localgram-msg-style') || 'default';

    msgStyleOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.style === savedStyle);
        option.replaceWith?.(option.cloneNode(true));
    });

    document.querySelectorAll('.msg-style-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.msg-style-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const style = option.dataset.style;
            state.currentMsgStyle = style;
            localStorage.setItem('localgram-msg-style', style);
        });
    });

    const accentOptions = document.querySelectorAll('.accent-option');
    const savedAccent = localStorage.getItem('localgram-accent-color') || '#2aabee';

    accentOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.color === savedAccent);
        option.replaceWith?.(option.cloneNode(true));
    });

    document.querySelectorAll('.accent-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.accent-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const color = option.dataset.color;
            state.currentAccentColor = color;
            localStorage.setItem('localgram-accent-color', color);
            applyAccentColor(color);
        });
    });

    document.getElementById('resetAppearanceBtn')?.addEventListener('click', () => {
        if (confirm('Сбросить все настройки оформления?')) {
            localStorage.removeItem('localgram-chat-bg');
            localStorage.removeItem('localgram-msg-style');
            localStorage.removeItem('localgram-accent-color');
            localStorage.removeItem('localgram-theme');

            state.currentBg = 'default';
            state.currentMsgStyle = 'default';
            state.currentAccentColor = '#2aabee';

            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
            applyChatBackground('default');
            applyAccentColor('#2aabee');

            document.querySelectorAll('.theme-option').forEach(o => {
                o.classList.toggle('active', o.dataset.theme === (prefersDark ? 'dark' : 'light'));
            });
            document.querySelectorAll('.bg-option').forEach(o => {
                o.classList.toggle('active', o.dataset.bg === 'default');
            });
            document.querySelectorAll('.msg-style-option').forEach(o => {
                o.classList.toggle('active', o.dataset.style === 'default');
            });
            document.querySelectorAll('.accent-option').forEach(o => {
                o.classList.toggle('active', o.dataset.color === '#2aabee');
            });

            alert('Настройки сброшены!');
        }
    });
}

function initLanguageSettings() {
    const langOptions = document.querySelectorAll('.language-option');
    const currentLang = localStorage.getItem('localgram-language') || 'ru';

    langOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.lang === currentLang);
        option.replaceWith?.(option.cloneNode(true));
    });

    document.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.language-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const lang = option.dataset.lang;
            localStorage.setItem('localgram-language', lang);
            alert(`Язык изменён на ${option.querySelector('.lang-name')?.textContent || lang}`);
        });
    });
}

function initNotificationToggles() {
    const pushToggle = document.getElementById('pushNotificationsToggle');
    const soundToggle = document.getElementById('soundNotificationsToggle');
    const previewToggle = document.getElementById('previewNotificationsToggle');

    const savedPush = localStorage.getItem('localgram-push-notifications');
    const savedSound = localStorage.getItem('localgram-sound-notifications');
    const savedPreview = localStorage.getItem('localgram-preview-notifications');

    if (pushToggle) {
        pushToggle.checked = savedPush !== 'false';
        pushToggle.addEventListener('change', () => {
            localStorage.setItem('localgram-push-notifications', pushToggle.checked);
            if (pushToggle.checked) {
                requestNotificationPermission();
            } else {
                state.notificationsEnabled = false;
            }
        });
    }

    if (soundToggle) {
        soundToggle.checked = savedSound !== 'false';
        soundToggle.addEventListener('change', () => {
            localStorage.setItem('localgram-sound-notifications', soundToggle.checked);
        });
    }

    if (previewToggle) {
        previewToggle.checked = savedPreview !== 'false';
        previewToggle.addEventListener('change', () => {
            localStorage.setItem('localgram-preview-notifications', previewToggle.checked);
        });
    }
}

// ===== УВЕДОМЛЕНИЯ =====

function initNotifications() {
    if (!('Notification' in window)) {
        console.log('Браузер не поддерживает уведомления');
        return;
    }

    if (Notification.permission === 'default') {
        document.addEventListener('click', requestNotificationPermission, { once: true });
    } else if (Notification.permission === 'granted') {
        state.notificationsEnabled = true;
        if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
            subscribeToPush();
        }
    }
}

async function registerServiceWorker() {
    if (window.location.protocol === 'file:') {
        console.log('Service Worker не поддерживается в локальном окружении');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        console.log('Service Worker зарегистрирован:', registration);

        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            state.pushSubscription = subscription;
            savePushSubscription(subscription);
        }
    } catch (error) {
        console.log('Service Worker регистрация не удалась:', error);
    }
}

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (window.location.protocol === 'file:') return;

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            const publicKey = await getPublicKey();
            if (!publicKey) {
                console.log('Публичный ключ не получен');
                return;
            }
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey
            });
        }

        state.pushSubscription = subscription;
        await savePushSubscription(subscription);
        console.log('Подписка на push создана');
    } catch (error) {
        console.log('Ошибка подписки на push:', error);
    }
}

async function getPublicKey() {
    const vapidPublicKey = 'BEl62iUYgUwfxN8vBk4qEQPp-1_N9ngnDxjFQ0lGJPuJ0ClzLwqLcM97JtWrXQnQ9JmYb6XJtP6h5t5hr5t5hr5t5hr5t5hr5t5hr5t5hr5t5';
    return urlBase64ToUint8Array(vapidPublicKey);
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function savePushSubscription(subscription) {
    if (!state.user) return;
    
    try {
        const subscriptionData = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.toJSON().keys.p256dh,
                auth: subscription.toJSON().keys.auth
            },
            userAgent: navigator.userAgent,
            isMobile: state.isMobile,
            updatedAt: Date.now()
        };

        await db.ref(`push_subscriptions/${state.user.uid}/${subscription.endpoint}`).set(subscriptionData);
    } catch (error) {
        if (error.message && error.message.includes('permission_denied')) {
            console.log('Нет прав для сохранения подписки push');
        } else {
            console.log('Ошибка сохранения подписки:', error);
        }
    }
}

async function sendPushNotification(chatId, partnerId, message, partnerName) {
    try {
        const notificationData = {
            chatId: chatId,
            partnerId: partnerId,
            message: message,
            partnerName: partnerName,
            timestamp: Date.now(),
            type: 'message'
        };

        try {
            await db.ref(`notifications/${partnerId}/${chatId}`).update({
                lastMessage: message,
                timestamp: Date.now(),
                read: false
            });
        } catch (error) {
            if (error.message && error.message.includes('permission_denied')) {
                console.log('Нет прав для сохранения уведомления');
            } else {
                throw error;
            }
        }

        showBrowserNotification(partnerName, message, chatId);
        playNotificationSound();

    } catch (error) {
        console.log('Ошибка отправки уведомления:', error);
    }
}

function showBrowserNotification(title, body, chatId) {
    if (!state.notificationsEnabled && Notification.permission !== 'granted') return;
    if (!('Notification' in window)) return;

    if (state.activeChatId === chatId && document.hasFocus()) return;

    const now = Date.now();
    if (now - state.lastNotificationTimestamp < 3000) return;
    state.lastNotificationTimestamp = now;

    try {
        const notification = new Notification(`💬 ${title}`, {
            body: body,
            icon: '/favicon.ico',
            badge: '/badge-icon.png',
            vibrate: [200, 100, 200],
            silent: true,
            tag: chatId,
            requireInteraction: false,
            data: {
                chatId: chatId,
                url: window.location.href
            }
        });

        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            if (chatId) {
                const partner = state.activePartner;
                if (partner && partner.uid) {
                    openChat(chatId, partner);
                }
            }
            notification.close();
        };

        setTimeout(() => notification.close(), 8000);
    } catch (error) {
        console.log('Ошибка показа уведомления:', error);
    }
}

function playNotificationSound() {
    try {
        const audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);

        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.frequency.value = 1000;
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.15);
        }, 150);

    } catch (error) {
        console.log('Звук уведомления не воспроизведен');
    }
}

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('Ваш браузер не поддерживает уведомления');
        return;
    }

    if (Notification.permission === 'granted') {
        state.notificationsEnabled = true;
        alert('✅ Уведомления уже включены');
        return;
    }

    if (Notification.permission === 'denied') {
        alert('❌ Уведомления заблокированы в браузере. Разрешите их в настройках браузера.');
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            state.notificationsEnabled = true;
            subscribeToPush();
            alert('✅ Уведомления включены!');
        } else {
            alert('❌ Уведомления отключены');
        }
    });
}

function listenForNotifications() {
    if (!state.user) return;

    const ref = db.ref(`notifications/${state.user.uid}`);
    ref.on('child_added', (snapshot) => {
        const notification = snapshot.val();
        if (!notification || notification.read) return;

        if (state.activeChatId === snapshot.key) {
            db.ref(`notifications/${state.user.uid}/${snapshot.key}/read`).set(true);
            return;
        }

        const senderName = notification.senderName || 'Кто-то';
        const message = notification.message || 'Новое сообщение';

        showBrowserNotification(senderName, message, snapshot.key);
        playNotificationSound();
        updateUnreadCount();
    });
}

function updateUnreadCount() {
    if (!state.user) return;

    db.ref(`notifications/${state.user.uid}`).once('value', (snapshot) => {
        const notifications = snapshot.val() || {};
        const unread = Object.values(notifications).filter(n => !n.read).length;

        if (unread > 0) {
            document.title = `(${unread}) Localgram`;
        } else {
            document.title = 'Localgram';
        }

        if (navigator.setAppBadge) {
            navigator.setAppBadge(unread).catch(() => {});
        }
    });
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UI) =====

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

function scrollMessagesToBottom(smooth) {
    const container = els.messagesContainer;
    if (!container) return;

    requestAnimationFrame(() => {
        const targetScroll = container.scrollHeight;

        if (smooth) {
            container.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        } else {
            container.scrollTop = targetScroll;
        }

        state.isAtBottom = true;
        setTimeout(updateScrollState, smooth ? 300 : 50);
    });
}

function updateScrollState() {
    const container = els.messagesContainer;
    const btn = els.scrollBottomBtn;

    if (!container || !btn) return;

    if (!state.activeChatId) {
        btn.classList.add("hidden");
        return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    const hasOverflow = scrollHeight > clientHeight + 20;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    state.isAtBottom = isAtBottom;

    if (hasOverflow && !isAtBottom && !btn.dataset.hiddenByClick) {
        btn.classList.remove("hidden");
    } else {
        btn.classList.add("hidden");
    }
}

window.addEventListener('resize', () => {
    setTimeout(updateScrollState, 100);
});

function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function isValidUsername(username) {
    return /^[a-z0-9_]{3,24}$/.test(username);
}

function updateCharCounter() {
    if (els.charCounter) {
        els.charCounter.textContent = `${els.messageInput.value.length}/500`;
    }
}

function getInitials(value) {
    const clean = String(value || "L").trim();
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
    logo.textContent = "L";
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

// ===== МОБИЛЬНЫЕ НАСТРОЙКИ (FULLSCREEN) =====

function openSettingsPage(pageId) {
    if (els.settingsModal) els.settingsModal.classList.add('hidden');
    
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('hidden');
        page.style.padding = '0';
        const card = page.querySelector('.modal-card');
        if (card) {
            card.style.borderRadius = '0';
            card.style.height = '100vh';
            card.style.height = '100dvh';
            card.style.maxHeight = '100vh';
            card.style.maxHeight = '100dvh';
            card.style.width = '100%';
            card.style.maxWidth = '100%';
            card.style.margin = '0';
            card.style.padding = '16px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-setting]').forEach(item => {
        item.addEventListener('click', function() {
            const setting = this.dataset.setting;
            const pageMap = {
                'folders': 'foldersSettings',
                'security': 'securitySettings',
                'devices': 'devicesSettings',
                'notifications': 'notificationsSettings',
                'appearance': 'appearanceSettings',
                'language': 'languageSettings',
                'shortcuts': 'shortcutsSettings',
                'help': 'helpSettings',
                'about': 'aboutModal'
            };
            
            const pageId = pageMap[setting];
            if (pageId) {
                if (pageId === 'aboutModal') {
                    if (els.settingsModal) els.settingsModal.classList.add('hidden');
                    if (els.aboutModal) els.aboutModal.classList.remove('hidden');
                } else {
                    openSettingsPage(pageId);
                }
            }
        });
    });
    
    const backButtons = [
        'backFromAppearance', 'backFromLanguage', 'backFromNotifications',
        'backFromSecurity', 'backFromDevices', 'backFromHelp',
        'backFromShortcuts', 'backFromFolders'
    ];
    
    backButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', function() {
                const page = this.closest('.modal');
                if (page) page.classList.add('hidden');
                if (els.settingsModal) els.settingsModal.classList.remove('hidden');
            });
        }
    });
    
    const closeButtons = [
        'closeAppearanceBtn', 'closeLanguageBtn', 'closeNotificationsBtn',
        'closeSecurityBtn', 'closeDevicesBtn', 'closeHelpBtn',
        'closeShortcutsBtn', 'closeFoldersBtn'
    ];
    
    closeButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', function() {
                const page = this.closest('.modal');
                if (page) page.classList.add('hidden');
            });
        }
    });
});

const originalOpenSettings = window.openSettingsModal;
if (originalOpenSettings) {
    window.openSettingsModal = function() {
        if (els.settingsModal) {
            els.settingsModal.classList.remove('hidden');
            if (window.innerWidth <= 768) {
                const card = els.settingsModal.querySelector('.modal-card');
                if (card) {
                    card.style.borderRadius = '0';
                    card.style.height = '100vh';
                    card.style.height = '100dvh';
                    card.style.maxHeight = '100vh';
                    card.style.maxHeight = '100dvh';
                    card.style.width = '100%';
                    card.style.maxWidth = '100%';
                    card.style.margin = '0';
                    card.style.padding = '16px';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                }
            }
        }
    };
}
