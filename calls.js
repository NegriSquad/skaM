/* =====================================================
   CALLS (WebRTC + Firebase signaling)
   ===================================================== */

const ICE_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ],
    iceCandidatePoolSize: 10,
};

const RINGTONE_FILE = "ringtone.mp3";
const RINGBACK_FILE = "ringback.mp3";
const RINGTONE_VOLUME = 0.7;
const RINGBACK_VOLUME = 0.5;

let activeCall = null;
let incomingCallData = null;
let callRingCtx = null;
let callRingInterval = null;
let callTimeoutTimer = null;
let callSystemInitialized = false;
let userCallRef = null;
let userCallHandlers = [];
let ringtoneAudio = null;
let ringbackAudio = null;

/* =====================================================
   RINGTONE
   ===================================================== */

function startRingtone(fileName) {
    try {
        stopRingtone();
        ringtoneAudio = new Audio(fileName || RINGTONE_FILE);
        ringtoneAudio.loop = true;
        ringtoneAudio.volume = RINGTONE_VOLUME;

        // Попытка 1: сразу
        ringtoneAudio.play().catch(function (err) {
            console.warn("[CALLS] ringtone autoplay blocked:", err.message);
            // Пробуем после первого клика пользователя
            const resume = function () {
                document.removeEventListener("click", resume);
                document.removeEventListener("touchstart", resume);
                if (ringtoneAudio && ringtoneAudio.paused) {
                    ringtoneAudio.play().catch(function () {});
                }
            };
            document.addEventListener("click", resume, { once: true });
            document.addEventListener("touchstart", resume, { once: true });
            // НЕ вызываем fallbackBeep — пользователь услышит свой рингтон
            // после первого клика по странице.
        });
    } catch (e) {
        console.warn("[CALLS] ringtone create failed:", e);
        // Только если Audio вообще не создался — используем beep
        fallbackBeep();
    }
}

function startRingback(fileName) {
    try {
        stopRingtone();
        ringbackAudio = new Audio(fileName || RINGBACK_FILE);
        ringbackAudio.loop = true;
        ringbackAudio.volume = RINGBACK_VOLUME;
        ringbackAudio.play().catch(function (err) {
            console.warn("[CALLS] ringback autoplay blocked:", err.message);
        });
    } catch (e) {
        console.warn("[CALLS] ringback create failed:", e);
    }
}

function stopRingtone() {
    if (ringtoneAudio) {
        try { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; } catch (e) {}
        ringtoneAudio = null;
    }
    if (ringbackAudio) {
        try { ringbackAudio.pause(); ringbackAudio.currentTime = 0; } catch (e) {}
        ringbackAudio = null;
    }
    if (callRingInterval) { clearInterval(callRingInterval); callRingInterval = null; }
    if (callRingCtx) { try { callRingCtx.close(); } catch (e) {} callRingCtx = null; }
}

function fallbackBeep() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        callRingCtx = new Ctx();
        const beep = function () {
            if (!callRingCtx) return;
            try {
                const osc = callRingCtx.createOscillator();
                const gain = callRingCtx.createGain();
                osc.type = "sine";
                osc.frequency.value = 480;
                osc.connect(gain);
                gain.connect(callRingCtx.destination);
                const now = callRingCtx.currentTime;
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.55);
            } catch (e) {}
        };
        beep();
        callRingInterval = setInterval(beep, 1600);
    } catch (e) {
        console.warn("[CALLS] fallbackBeep error:", e);
    }
}

/* =====================================================
   INIT / CLEANUP
   ===================================================== */

function initCallSystem() {
    if (callSystemInitialized) return;
    if (!auth || !state.user) return;
    callSystemInitialized = true;

    userCallRef = db.ref("user_calls/" + state.user.uid);

    const onAdded = userCallRef.on("child_added", function (snap) {
        const call = snap.val();
        if (!call) return;
        if (Date.now() - (call.createdAt || 0) > 60000) { snap.ref.remove(); return; }
        if (call.status !== "ringing") return;

        if (activeCall) {
            db.ref("calls/" + call.chatId + "/status").set("busy").catch(function () {});
            snap.ref.remove();
            return;
        }
        if (incomingCallData && incomingCallData.chatId === call.chatId) return;

        showIncomingCall(Object.assign({ id: snap.key }, call));
    });

    const onChanged = userCallRef.on("child_changed", function (snap) {
        const call = snap.val();
        if (!call) return;
        if (incomingCallData && incomingCallData.id === snap.key) {
            if (["ended", "rejected", "missed", "busy"].indexOf(call.status) >= 0) hideIncomingCall();
        }
    });

    const onRemoved = userCallRef.on("child_removed", function (snap) {
        if (incomingCallData && incomingCallData.id === snap.key) hideIncomingCall();
    });

    userCallHandlers = [
        function () { userCallRef.off("child_added", onAdded); },
        function () { userCallRef.off("child_changed", onChanged); },
        function () { userCallRef.off("child_removed", onRemoved); },
    ];
}

function cleanupCallSystem() {
    if (!callSystemInitialized) return;
    userCallHandlers.forEach(function (fn) { try { fn(); } catch (e) {} });
    userCallHandlers = [];
    userCallRef = null;
    callSystemInitialized = false;
    hideIncomingCall();
    if (activeCall) endCall(true);
}

/* =====================================================
   UI HELPERS
   ===================================================== */

function callUI() {
    return {
        screen: $("callScreen"),
        remoteVideo: $("callRemoteVideo"),
        remoteAudio: $("callRemoteAudio"),
        localVideo: $("callLocalVideo"),
        infoBlock: $("callInfoBlock"),
        avatar: $("callAvatar"),
        name: $("callName"),
        status: $("callStatus"),
        muteBtn: $("callMuteBtn"),
        videoBtn: $("callVideoBtn"),
        flipBtn: $("callFlipBtn"),
        endBtn: $("callEndBtn"),
        incoming: $("callIncoming"),
        incomingAvatar: $("callIncomingAvatar"),
        incomingName: $("callIncomingName"),
        incomingStatus: $("callIncomingStatus"),
        acceptBtn: $("callAcceptBtn"),
        rejectBtn: $("callRejectBtn"),
    };
}

function resetCallScreenUI() {
    const ui = callUI();
    if (!ui.screen) return;
    ui.screen.classList.add("hidden");
    ui.screen.classList.remove("video-mode", "audio-mode");
    if (ui.remoteVideo) ui.remoteVideo.srcObject = null;
    if (ui.localVideo) ui.localVideo.srcObject = null;
    if (ui.remoteAudio) ui.remoteAudio.srcObject = null;
    if (ui.remoteVideo) ui.remoteVideo.classList.add("hidden");
    if (ui.localVideo) ui.localVideo.classList.add("hidden");
    if (ui.infoBlock) ui.infoBlock.classList.remove("hidden");
    if (ui.muteBtn) ui.muteBtn.classList.remove("active");
    if (ui.videoBtn) ui.videoBtn.classList.remove("active");
    if (ui.flipBtn) ui.flipBtn.classList.remove("loading");
    document.body.classList.remove("in-call");
}

/* =====================================================
   SWITCH CAMERA
   ===================================================== */

async function switchCamera() {
    if (!activeCall) return;
    if (activeCall.type !== "video") return;

    const videoTracks = activeCall.stream.getVideoTracks();
    if (!videoTracks.length) {
        return toast("Нет видеотрека для переключения");
    }

    const currentMode = activeCall.facingMode || "user";
    const newMode = currentMode === "user" ? "environment" : "user";
    const newLabel = newMode === "user" ? "фронтальная" : "задняя";

    const flipBtn = $("callFlipBtn");
    if (flipBtn) flipBtn.classList.add("loading");

    try {
        await videoTracks[0].applyConstraints({ facingMode: newMode });
        activeCall.facingMode = newMode;
        toast("Камера: " + newLabel);
    } catch (e1) {
        console.warn("[calls] applyConstraints failed:", e1.message);

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: newMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });

            const newTrack = newStream.getVideoTracks()[0];
            if (!newTrack) throw new Error("no video track");

            const sender = activeCall.pc.getSenders().find(function (s) {
                return s.track && s.track.kind === "video";
            });
            if (sender) await sender.replaceTrack(newTrack);

            const oldTrack = videoTracks[0];
            try { activeCall.stream.removeTrack(oldTrack); } catch (e) {}
            activeCall.stream.addTrack(newTrack);
            try { oldTrack.stop(); } catch (e) {}

            const localVideo = $("callLocalVideo");
            if (localVideo) localVideo.srcObject = activeCall.stream;

            activeCall.facingMode = newMode;
            toast("Камера: " + newLabel);
        } catch (e2) {
            console.error("[calls] switch camera failed:", e2);
            toast("Не удалось переключить камеру");
        }
    } finally {
        if (flipBtn) flipBtn.classList.remove("loading");
    }
}

/* =====================================================
   START OUTGOING CALL
   ===================================================== */

async function startCall(type) {
    const chatId = state.activeChatId;
    const entry = state.activeChat;

    if (!chatId || !entry) return;
    if (entry.type !== "private" || !entry.partnerId) {
        return toast("Звонки доступны только в личных чатах");
    }
    if (activeCall) return toast("Вы уже в звонке");

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: type === "video"
                ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: "user" } }
                : false,
        });
    } catch (e) {
        console.error("[CALLS] getUserMedia failed:", e);
        return toast(type === "video"
            ? "Нет доступа к камере или микрофону"
            : "Нет доступа к микрофону");
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });

    activeCall = {
        chatId: chatId,
        partnerId: entry.partnerId,
        partnerName: chatTitle(entry),
        partnerAvatar: entry.partnerAvatarUrl || "",
        type: type,
        role: "caller",
        stream: stream,
        pc: pc,
        startedAt: null,
        connected: false,
        muted: false,
        videoOff: false,
        facingMode: "user",
        timerInterval: null,
        cleanup: [],
    };

    showActiveCallUI();
    startRingback();

    const callerCandsRef = db.ref("calls/" + chatId + "/callerCandidates");
    pc.onicecandidate = function (e) {
        if (e.candidate) callerCandsRef.push(e.candidate.toJSON()).catch(function () {});
    };

    pc.ontrack = function (e) {
        const remoteStream = e.streams[0];
        const ui = callUI();
        if (type === "video" && ui.remoteVideo) {
            ui.remoteVideo.srcObject = remoteStream;
            ui.remoteVideo.play().catch(function () {});
        }
        if (ui.remoteAudio) {
            ui.remoteAudio.srcObject = remoteStream;
            ui.remoteAudio.play().catch(function () {});
        }
    };

    pc.onconnectionstatechange = function () {
        if (!activeCall) return;
        if (pc.connectionState === "connected") {
            stopRingtone();
            if (!activeCall.connected) {
                activeCall.connected = true;
                activeCall.startedAt = Date.now();
                startCallTimer();
            }
        } else if (pc.connectionState === "failed") {
            toast("Соединение потеряно");
            endCall(true);
        }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await db.ref("calls/" + chatId).set({
        caller: state.user.uid,
        callerName: state.profile.nickname,
        callerAvatar: state.profile.avatarUrl || "",
        callee: entry.partnerId,
        type: type,
        status: "ringing",
        offer: { sdp: offer.sdp, type: offer.type },
        createdAt: Date.now(),
    });

    await db.ref("user_calls/" + entry.partnerId + "/" + chatId).set({
        chatId: chatId,
        callerId: state.user.uid,
        callerName: state.profile.nickname,
        callerAvatar: state.profile.avatarUrl || "",
        type: type,
        status: "ringing",
        createdAt: Date.now(),
    });

    const answerRef = db.ref("calls/" + chatId + "/answer");
    const onAnswer = answerRef.on("value", async function (snap) {
        const answer = snap.val();
        if (!answer || !activeCall || activeCall.role !== "caller") return;
        if (pc.signalingState === "have-local-offer") {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (e) {
                console.warn("[CALLS] setRemoteDescription(answer):", e);
            }
        }
    });
    activeCall.cleanup.push(function () { answerRef.off("value", onAnswer); });

    const calleeCandsRef = db.ref("calls/" + chatId + "/calleeCandidates");
    const onCalleeCand = calleeCandsRef.on("child_added", async function (snap) {
        if (!activeCall || activeCall.role !== "caller") return;
        try {
            await pc.addIceCandidate(new RTCIceCandidate(snap.val()));
        } catch (e) {
            console.warn("[CALLS] addIceCandidate(callee):", e);
        }
    });
    activeCall.cleanup.push(function () { calleeCandsRef.off("child_added", onCalleeCand); });

    const statusRef = db.ref("calls/" + chatId + "/status");
    const onStatus = statusRef.on("value", function (snap) {
        const s = snap.val();
        if (!activeCall) return;
        if (s === "rejected") { toast("Звонок отклонён"); endCall(true); }
        else if (s === "busy") { toast("Абонент занят"); endCall(true); }
        else if (s === "missed") { toast("Нет ответа"); endCall(true); }
        else if (s === "ended" || s === null) { endCall(true); }
    });
    activeCall.cleanup.push(function () { statusRef.off("value", onStatus); });

    callTimeoutTimer = setTimeout(function () {
        if (activeCall && activeCall.role === "caller" && !activeCall.startedAt) {
            db.ref("calls/" + chatId + "/status").set("missed").catch(function () {});
            toast("Нет ответа");
            endCall(true);
        }
    }, 45000);
}

/* =====================================================
   ACTIVE CALL UI
   ===================================================== */

function showActiveCallUI() {
    const ui = callUI();
    const call = activeCall;
    if (!call) return;
    if (!ui.screen) {
        console.error("[CALLS] callScreen не найден в DOM");
        return;
    }

    ui.screen.classList.remove("hidden");
    ui.screen.classList.add(call.type === "video" ? "video-mode" : "audio-mode");
    document.body.classList.add("in-call");

    setAvatar(ui.avatar, call.partnerName, call.partnerAvatar, { key: call.partnerId });
    ui.name.textContent = call.partnerName;
    ui.status.textContent = "Вызов…";

    if (call.type === "video") {
        ui.localVideo.classList.remove("hidden");
        ui.remoteVideo.classList.remove("hidden");
        ui.localVideo.srcObject = call.stream;
    } else {
        ui.localVideo.classList.add("hidden");
        ui.remoteVideo.classList.add("hidden");
    }
}

/* =====================================================
   INCOMING CALL
   ===================================================== */

function showIncomingCall(call) {
    incomingCallData = call;
    const ui = callUI();
    setAvatar(ui.incomingAvatar, call.callerName, call.callerAvatar, { key: call.callerId });
    ui.incomingName.textContent = call.callerName;
    ui.incomingStatus.textContent = call.type === "video" ? "Входящий видеозвонок" : "Входящий звонок";
    ui.incoming.classList.remove("hidden");
    document.body.classList.add("incoming-call");
    startRingtone();

    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = setTimeout(function () {
        if (incomingCallData && incomingCallData.id === call.id) rejectIncomingCall(true);
    }, 45000);
}

function hideIncomingCall() {
    const ui = callUI();
    ui.incoming.classList.add("hidden");
    document.body.classList.remove("incoming-call");
    stopRingtone();
    incomingCallData = null;
    clearTimeout(callTimeoutTimer);
}

async function acceptIncomingCall() {
    if (!incomingCallData) return;
    const call = incomingCallData;
    hideIncomingCall();
    stopRingtone();

    const snap = await db.ref("calls/" + call.chatId).once("value");
    const callData = snap.val();
    if (!callData || callData.status !== "ringing") {
        toast("Звонок уже завершён");
        return;
    }

    const type = callData.type;

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: type === "video"
                ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: "user" } }
                : false,
        });
    } catch (e) {
        console.error("[CALLS] getUserMedia failed:", e);
        db.ref("calls/" + call.chatId + "/status").set("rejected").catch(function () {});
        toast("Не удалось получить доступ к камере/микрофону");
        return;
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });

    activeCall = {
        chatId: call.chatId,
        partnerId: callData.caller,
        partnerName: callData.callerName,
        partnerAvatar: callData.callerAvatar || "",
        type: type,
        role: "callee",
        stream: stream,
        pc: pc,
        startedAt: null,
        connected: false,
        muted: false,
        videoOff: false,
        facingMode: "user",
        timerInterval: null,
        cleanup: [],
    };

    showActiveCallUI();

    pc.onicecandidate = function (e) {
        if (e.candidate) db.ref("calls/" + call.chatId + "/calleeCandidates").push(e.candidate.toJSON()).catch(function () {});
    };

    pc.ontrack = function (e) {
        const remoteStream = e.streams[0];
        const ui = callUI();
        if (type === "video" && ui.remoteVideo) {
            ui.remoteVideo.srcObject = remoteStream;
            ui.remoteVideo.play().catch(function () {});
        }
        if (ui.remoteAudio) {
            ui.remoteAudio.srcObject = remoteStream;
            ui.remoteAudio.play().catch(function () {});
        }
    };

    pc.onconnectionstatechange = function () {
        if (!activeCall) return;
        if (pc.connectionState === "connected") {
            stopRingtone();
            if (!activeCall.connected) {
                activeCall.connected = true;
                activeCall.startedAt = Date.now();
                startCallTimer();
            }
        } else if (pc.connectionState === "failed") {
            toast("Соединение потеряно");
            endCall(true);
        }
    };

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
    } catch (e) {
        console.error("[CALLS] setRemoteDescription(offer):", e);
        endCall(true);
        return;
    }

    const callerCandsRef = db.ref("calls/" + call.chatId + "/callerCandidates");
    const onCallerCand = callerCandsRef.on("child_added", async function (s) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(s.val()));
        } catch (e) {
            console.warn("[CALLS] addIceCandidate(caller):", e);
        }
    });
    activeCall.cleanup.push(function () { callerCandsRef.off("child_added", onCallerCand); });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await db.ref("calls/" + call.chatId + "/answer").set({ sdp: answer.sdp, type: answer.type });
    await db.ref("calls/" + call.chatId + "/status").set("accepted");

    const statusRef = db.ref("calls/" + call.chatId + "/status");
    const onStatus = statusRef.on("value", function (snap) {
        const s = snap.val();
        if (!activeCall) return;
        if (s === "ended" || s === "rejected" || s === "missed" || s === null) endCall(true);
    });
    activeCall.cleanup.push(function () { statusRef.off("value", onStatus); });
}

async function rejectIncomingCall(silent) {
    if (!incomingCallData) return;
    const call = incomingCallData;
    hideIncomingCall();
    stopRingtone();
    try {
        await db.ref("calls/" + call.chatId + "/status").set("rejected");
        await db.ref("user_calls/" + state.user.uid + "/" + call.chatId).remove();
    } catch (e) {}
    if (!silent) toast("Звонок отклонён");
}

/* =====================================================
   END CALL
   ===================================================== */

function endCall(silent) {
    if (!activeCall) return;
    const call = activeCall;
    activeCall = null;

    clearTimeout(callTimeoutTimer);
    clearInterval(call.timerInterval);
    stopRingtone();

    call.cleanup.forEach(function (fn) { try { fn(); } catch (e) {} });
    try { call.pc.close(); } catch (e) {}
    call.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });

    db.ref("calls/" + call.chatId).remove().catch(function () {});
    db.ref("user_calls/" + call.partnerId + "/" + call.chatId).remove().catch(function () {});
    db.ref("user_calls/" + state.user.uid + "/" + call.chatId).remove().catch(function () {});

    resetCallScreenUI();
}

/* =====================================================
   TIMER
   ===================================================== */

function startCallTimer() {
    if (!activeCall) return;
    clearInterval(activeCall.timerInterval);
    const ui = callUI();
    const update = function () {
        if (!activeCall) return;
        const sec = Math.floor((Date.now() - activeCall.startedAt) / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        ui.status.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    };
    update();
    activeCall.timerInterval = setInterval(update, 1000);
}

/* =====================================================
   BIND UI
   ===================================================== */

function bindCallUI() {
    const ui = callUI();
    if (!ui.screen) {
        console.warn("[CALLS] callScreen не найден в DOM");
        return;
    }

    if (ui.endBtn) ui.endBtn.addEventListener("click", function () {
        if (activeCall) {
            db.ref("calls/" + activeCall.chatId + "/status").set("ended").catch(function () {});
        }
        endCall(false);
    });

    if (ui.muteBtn) ui.muteBtn.addEventListener("click", function () {
        if (!activeCall) return;
        activeCall.muted = !activeCall.muted;
        activeCall.stream.getAudioTracks().forEach(function (t) { t.enabled = !activeCall.muted; });
        ui.muteBtn.classList.toggle("active", activeCall.muted);
    });

    if (ui.videoBtn) ui.videoBtn.addEventListener("click", function () {
        if (!activeCall) return;
        const videoTracks = activeCall.stream.getVideoTracks();
        if (!videoTracks.length) return;
        const enabled = videoTracks[0].enabled;
        videoTracks.forEach(function (t) { t.enabled = !enabled; });
        activeCall.videoOff = enabled;
        ui.videoBtn.classList.toggle("active", enabled);
        if (ui.localVideo) ui.localVideo.classList.toggle("video-off", enabled);
    });

    if (ui.flipBtn) ui.flipBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        switchCamera();
    });

    if (ui.acceptBtn) ui.acceptBtn.addEventListener("click", function () { acceptIncomingCall(); });
    if (ui.rejectBtn) ui.rejectBtn.addEventListener("click", function () { rejectIncomingCall(); });

    const callBtn = $("chatCallBtn");
    const videoBtn = $("chatVideoBtn");
    if (callBtn) callBtn.addEventListener("click", function () {
        if (state.activeChat && state.activeChat.type !== "private") return toast("Только в личных чатах");
        startCall("audio");
    });
    if (videoBtn) videoBtn.addEventListener("click", function () {
        if (state.activeChat && state.activeChat.type !== "private") return toast("Только в личных чатах");
        startCall("video");
    });

    console.log("[CALLS] bindCallUI: обработчики навешены ✓");
}

/* =====================================================
   AUTO-CLEANUP
   ===================================================== */

window.addEventListener("beforeunload", function () {
    if (activeCall) {
        db.ref("calls/" + activeCall.chatId + "/status").set("ended").catch(function () {});
    }
    if (incomingCallData) {
        db.ref("calls/" + incomingCallData.chatId + "/status").set("rejected").catch(function () {});
    }
});