/* =====================================================
   CALLS (debug version)
   ===================================================== */

const ICE_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    ],
    iceCandidatePoolSize: 10,
};

let activeCall = null;
let incomingCallData = null;
let callRingCtx = null;
let callRingInterval = null;
let callTimeoutTimer = null;
let callSystemInitialized = false;
let userCallRef = null;
let userCallHandlers = [];

function initCallSystem() {
    console.log("[CALLS] initCallSystem() вызван");
    if (callSystemInitialized) return console.log("[CALLS] уже инициализировано");
    if (!auth || !state.user) return console.log("[CALLS] нет auth или user, выходим");
    callSystemInitialized = true;

    userCallRef = db.ref(`user_calls/${state.user.uid}`);
    console.log("[CALLS] слушаем user_calls/" + state.user.uid);

    const onAdded = userCallRef.on("child_added", (snap) => {
        const call = snap.val();
        console.log("[CALLS] child_added в user_calls:", call);
        if (!call) return;
        if (Date.now() - (call.createdAt || 0) > 60000) { snap.ref.remove(); return; }
        if (call.status !== "ringing") return;
        if (activeCall) {
            db.ref(`calls/${call.chatId}/status`).set("busy").catch(() => {});
            snap.ref.remove();
            return;
        }
        if (incomingCallData && incomingCallData.chatId === call.chatId) return;
        showIncomingCall({ id: snap.key, ...call });
    });

    const onChanged = userCallRef.on("child_changed", (snap) => {
        const call = snap.val();
        if (!call) return;
        if (incomingCallData && incomingCallData.id === snap.key) {
            if (["ended", "rejected", "missed", "busy"].includes(call.status)) hideIncomingCall();
        }
    });

    const onRemoved = userCallRef.on("child_removed", (snap) => {
        if (incomingCallData && incomingCallData.id === snap.key) hideIncomingCall();
    });

    userCallHandlers = [
        () => userCallRef.off("child_added", onAdded),
        () => userCallRef.off("child_changed", onChanged),
        () => userCallRef.off("child_removed", onRemoved),
    ];
}

function cleanupCallSystem() {
    if (!callSystemInitialized) return;
    userCallHandlers.forEach((fn) => { try { fn(); } catch {} });
    userCallHandlers = [];
    userCallRef = null;
    callSystemInitialized = false;
    hideIncomingCall();
    if (activeCall) endCall(true);
}

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
    ui.remoteVideo.classList.add("hidden");
    ui.localVideo.classList.add("hidden");
    ui.infoBlock.classList.remove("hidden");
    ui.muteBtn.classList.remove("active");
    ui.videoBtn.classList.remove("active");
    document.body.classList.remove("in-call");
}

async function startCall(type) {
    console.log("[CALLS] startCall вызван, type =", type);
    const chatId = state.activeChatId;
    const entry = state.activeChat;
    if (!chatId || !entry) return console.log("[CALLS] нет chatId/entry");
    if (entry.type !== "private" || !entry.partnerId) return toast("Звонки доступны только в личных чатах");
    if (activeCall) return toast("Вы уже в звонке");

    console.log("[CALLS] запрашиваю getUserMedia…");
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        console.log("[CALLS] getUserMedia ок, tracks =", stream.getTracks().length);
    } catch (e) {
        console.error("[CALLS] getUserMedia failed:", e);
        return toast(type === "video" ? "Нет доступа к камере или микрофону" : "Нет доступа к микрофону");
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    activeCall = {
        chatId, partnerId: entry.partnerId,
        partnerName: chatTitle(entry),
        partnerAvatar: entry.partnerAvatarUrl || "",
        type, role: "caller", stream, pc,
        startedAt: null, connected: false, muted: false, videoOff: false,
        timerInterval: null, cleanup: [],
    };

    console.log("[CALLS] показываю callScreen");
    showActiveCallUI();

    const callerCandsRef = db.ref(`calls/${chatId}/callerCandidates`);
    pc.onicecandidate = (e) => {
        if (e.candidate) callerCandsRef.push(e.candidate.toJSON()).catch(() => {});
    };

    pc.ontrack = (e) => {
        console.log("[CALLS] ontrack получен");
        const remoteStream = e.streams[0];
        const ui = callUI();
        if (type === "video") { ui.remoteVideo.srcObject = remoteStream; ui.remoteVideo.play().catch(() => {}); }
        ui.remoteAudio.srcObject = remoteStream;
        ui.remoteAudio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
        console.log("[CALLS] connectionState =", pc.connectionState);
        if (!activeCall) return;
        if (pc.connectionState === "connected") {
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

    console.log("[CALLS] создаю offer");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log("[CALLS] пишу calls/" + chatId);
    await db.ref(`calls/${chatId}`).set({
        caller: state.user.uid,
        callerName: state.profile.nickname,
        callerAvatar: state.profile.avatarUrl || "",
        callee: entry.partnerId,
        type, status: "ringing",
        offer: { sdp: offer.sdp, type: offer.type },
        createdAt: Date.now(),
    });

    console.log("[CALLS] пишу user_calls/" + entry.partnerId);
    await db.ref(`user_calls/${entry.partnerId}/${chatId}`).set({
        chatId,
        callerId: state.user.uid,
        callerName: state.profile.nickname,
        callerAvatar: state.profile.avatarUrl || "",
        type, status: "ringing",
        createdAt: Date.now(),
    });

    console.log("[CALLS] слушаю answer");
    const answerRef = db.ref(`calls/${chatId}/answer`);
    const onAnswer = answerRef.on("value", async (snap) => {
        const answer = snap.val();
        if (!answer || !activeCall || activeCall.role !== "caller") return;
        console.log("[CALLS] получил answer");
        if (pc.signalingState === "have-local-offer") {
            try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch (e) { console.error(e); }
        }
    });
    activeCall.cleanup.push(() => answerRef.off("value", onAnswer));

    const calleeCandsRef = db.ref(`calls/${chatId}/calleeCandidates`);
    const onCalleeCand = calleeCandsRef.on("child_added", async (snap) => {
        if (!activeCall || activeCall.role !== "caller") return;
        try { await pc.addIceCandidate(new RTCIceCandidate(snap.val())); } catch (e) { console.warn(e); }
    });
    activeCall.cleanup.push(() => calleeCandsRef.off("child_added", onCalleeCand));

    const statusRef = db.ref(`calls/${chatId}/status`);
    const onStatus = statusRef.on("value", (snap) => {
        const s = snap.val();
        console.log("[CALLS] статус звонка изменился:", s);
        if (!activeCall) return;
        if (s === "rejected") { toast("Звонок отклонён"); endCall(true); }
        else if (s === "busy") { toast("Абонент занят"); endCall(true); }
        else if (s === "missed") { toast("Нет ответа"); endCall(true); }
        else if (s === "ended" || s === null) endCall(true);
    });
    activeCall.cleanup.push(() => statusRef.off("value", onStatus));

    callTimeoutTimer = setTimeout(() => {
        if (activeCall && activeCall.role === "caller" && !activeCall.startedAt) {
            db.ref(`calls/${chatId}/status`).set("missed").catch(() => {});
            toast("Нет ответа");
            endCall(true);
        }
    }, 45000);
}

function showActiveCallUI() {
    console.log("[CALLS] showActiveCallUI()");
    const ui = callUI();
    const call = activeCall;
    if (!ui.screen) return console.error("[CALLS] callScreen не найден в DOM");
    if (!call) return;
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

function showIncomingCall(call) {
    console.log("[CALLS] showIncomingCall()", call);
    incomingCallData = call;
    const ui = callUI();
    if (!ui.incoming) return console.error("[CALLS] callIncoming не найден в DOM");
    setAvatar(ui.incomingAvatar, call.callerName, call.callerAvatar, { key: call.callerId });
    ui.incomingName.textContent = call.callerName;
    ui.incomingStatus.textContent = call.type === "video" ? "Входящий видеозвонок" : "Входящий звонок";
    ui.incoming.classList.remove("hidden");
    document.body.classList.add("incoming-call");
    console.log("[CALLS] показываю экран входящего и играю рингтон");
    startRingtone();
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = setTimeout(() => {
        if (incomingCallData && incomingCallData.id === call.id) rejectIncomingCall(true);
    }, 45000);
}

function hideIncomingCall() {
    console.log("[CALLS] hideIncomingCall()");
    const ui = callUI();
    if (!ui.incoming) return;
    ui.incoming.classList.add("hidden");
    document.body.classList.remove("incoming-call");
    stopRingtone();
    incomingCallData = null;
    clearTimeout(callTimeoutTimer);
}

async function acceptIncomingCall() {
    console.log("[CALLS] acceptIncomingCall()");
    if (!incomingCallData) return;
    const call = incomingCallData;
    hideIncomingCall();
    stopRingtone();

    const snap = await db.ref(`calls/${call.chatId}`).once("value");
    const callData = snap.val();
    if (!callData || callData.status !== "ringing") return toast("Звонок уже завершён");

    const type = callData.type;
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
    } catch (e) {
        console.error("[CALLS] getUserMedia failed:", e);
        db.ref(`calls/${call.chatId}/status`).set("rejected").catch(() => {});
        return toast("Не удалось получить доступ к камере/микрофону");
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    activeCall = {
        chatId: call.chatId, partnerId: callData.caller,
        partnerName: callData.callerName,
        partnerAvatar: callData.callerAvatar || "",
        type, role: "callee", stream, pc,
        startedAt: null, connected: false, muted: false, videoOff: false,
        timerInterval: null, cleanup: [],
    };

    showActiveCallUI();

    pc.onicecandidate = (e) => {
        if (e.candidate) db.ref(`calls/${call.chatId}/calleeCandidates`).push(e.candidate.toJSON()).catch(() => {});
    };

    pc.ontrack = (e) => {
        console.log("[CALLS] ontrack (callee)");
        const remoteStream = e.streams[0];
        const ui = callUI();
        if (type === "video") { ui.remoteVideo.srcObject = remoteStream; ui.remoteVideo.play().catch(() => {}); }
        ui.remoteAudio.srcObject = remoteStream;
        ui.remoteAudio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
        console.log("[CALLS] connectionState (callee) =", pc.connectionState);
        if (!activeCall) return;
        if (pc.connectionState === "connected") {
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
        console.error("[CALLS] setRemoteDescription failed:", e);
        endCall(true);
        return;
    }

    const callerCandsRef = db.ref(`calls/${call.chatId}/callerCandidates`);
    const onCallerCand = callerCandsRef.on("child_added", async (s) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(s.val())); } catch (e) { console.warn(e); }
    });
    activeCall.cleanup.push(() => callerCandsRef.off("child_added", onCallerCand));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await db.ref(`calls/${call.chatId}/answer`).set({ sdp: answer.sdp, type: answer.type });
    await db.ref(`calls/${call.chatId}/status`).set("accepted");

    const statusRef = db.ref(`calls/${call.chatId}/status`);
    const onStatus = statusRef.on("value", (snap) => {
        const s = snap.val();
        if (!activeCall) return;
        if (s === "ended" || s === "rejected" || s === "missed" || s === null) endCall(true);
    });
    activeCall.cleanup.push(() => statusRef.off("value", onStatus));
}

async function rejectIncomingCall(silent = false) {
    console.log("[CALLS] rejectIncomingCall()");
    if (!incomingCallData) return;
    const call = incomingCallData;
    hideIncomingCall();
    stopRingtone();
    try {
        await db.ref(`calls/${call.chatId}/status`).set("rejected");
        await db.ref(`user_calls/${state.user.uid}/${call.chatId}`).remove();
    } catch {}
    if (!silent) toast("Звонок отклонён");
}

function endCall(silent = false) {
    console.log("[CALLS] endCall()");
    if (!activeCall) return;
    const call = activeCall;
    activeCall = null;
    clearTimeout(callTimeoutTimer);
    clearInterval(call.timerInterval);
    stopRingtone();
    call.cleanup.forEach((fn) => { try { fn(); } catch {} });
    try { call.pc.close(); } catch {}
    call.stream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    db.ref(`calls/${call.chatId}`).remove().catch(() => {});
    db.ref(`user_calls/${call.partnerId}/${call.chatId}`).remove().catch(() => {});
    db.ref(`user_calls/${state.user.uid}/${call.chatId}`).remove().catch(() => {});
    resetCallScreenUI();
}

function startCallTimer() {
    if (!activeCall) return;
    clearInterval(activeCall.timerInterval);
    const ui = callUI();
    const update = () => {
        if (!activeCall) return;
        const sec = Math.floor((Date.now() - activeCall.startedAt) / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        ui.status.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    update();
    activeCall.timerInterval = setInterval(update, 1000);
}

function startRingtone() {
    try {
        stopRingtone();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        callRingCtx = new Ctx();
        const beep = () => {
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
                gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.55);
            } catch (e) {}
        };
        beep();
        callRingInterval = setInterval(beep, 1600);
    } catch (e) {}
}

function stopRingtone() {
    if (callRingInterval) { clearInterval(callRingInterval); callRingInterval = null; }
    if (callRingCtx) { try { callRingCtx.close(); } catch {} callRingCtx = null; }
}

function bindCallUI() {
    console.log("[CALLS] bindCallUI()");
    const ui = callUI();
    if (!ui.screen) return console.error("[CALLS] callScreen не найден — проверь index.html");

    ui.endBtn.addEventListener("click", () => {
        if (activeCall) db.ref(`calls/${activeCall.chatId}/status`).set("ended").catch(() => {});
        endCall(false);
    });

    ui.muteBtn.addEventListener("click", () => {
        if (!activeCall) return;
        activeCall.muted = !activeCall.muted;
        activeCall.stream.getAudioTracks().forEach((t) => { t.enabled = !activeCall.muted; });
        ui.muteBtn.classList.toggle("active", activeCall.muted);
    });

    ui.videoBtn.addEventListener("click", () => {
        if (!activeCall) return;
        const videoTracks = activeCall.stream.getVideoTracks();
        if (!videoTracks.length) return;
        const enabled = videoTracks[0].enabled;
        videoTracks.forEach((t) => { t.enabled = !enabled; });
        activeCall.videoOff = enabled;
        ui.videoBtn.classList.toggle("active", enabled);
        ui.localVideo.classList.toggle("video-off", enabled);
    });

    ui.acceptBtn.addEventListener("click", () => acceptIncomingCall());
    ui.rejectBtn.addEventListener("click", () => rejectIncomingCall());

    const callBtn = $("chatCallBtn");
    const videoBtn = $("chatVideoBtn");
    if (callBtn) callBtn.addEventListener("click", () => {
        if (state.activeChat?.type !== "private") return toast("Звонки доступны только в личных чатах");
        startCall("audio");
    });
    if (videoBtn) videoBtn.addEventListener("click", () => {
        if (state.activeChat?.type !== "private") return toast("Звонки доступны только в личных чатах");
        startCall("video");
    });

    console.log("[CALLS] bindCallUI: все обработчики навешены");
}

window.addEventListener("beforeunload", () => {
    if (activeCall) db.ref(`calls/${activeCall.chatId}/status`).set("ended").catch(() => {});
    if (incomingCallData) db.ref(`calls/${incomingCallData.chatId}/status`).set("rejected").catch(() => {});
});