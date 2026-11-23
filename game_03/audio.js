// --- ЗВУК (Web Audio API) ---
// Бодрая «корпоративная» музыка и звуки. Всё синтезируется, mp3 не нужны.

let audioCtx = null;
let masterGain = null;
let musicGain = null;
let noiseBuffer = null;

let isMusicPlaying = false;
let nextNoteTime = 0;
let musicStep = 0;
let musicIntensity = 0; // 0..1 — сколько мира уже разрушено

const MUSIC_TEMPO = 112;
const STEP_TIME = 60 / MUSIC_TEMPO / 2; // восьмые

// Самая мотивирующая прогрессия на свете: C – G – Am – F
const CHORDS = [
    { notes: [261.63, 329.63, 392.00], bass: 65.41 },  // C
    { notes: [196.00, 246.94, 293.66], bass: 98.00 },  // G
    { notes: [220.00, 261.63, 329.63], bass: 110.00 }, // Am
    { notes: [174.61, 220.00, 261.63], bass: 87.31 }   // F
];
const ARP = [0, 1, 2, 1, 0, 1, 2, 3]; // 3 = тоника октавой выше

function ensureAudio() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audioCtx = new AC();

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.9;
        masterGain.connect(audioCtx.destination);

        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.6;
        musicGain.connect(masterGain);

        // Один буфер шума на всю игру
        noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }
    // 'interrupted' — iOS после звонка или блокировки экрана
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
        const resumed = audioCtx.resume();
        if (resumed && resumed.catch) resumed.catch(() => {});
    }
    return true;
}

// --- ЗВУК НА ТЕЛЕФОНАХ ---
// iPhone глушит звук браузерных игр переключателем «Без звука», а музыку из плеера — нет.
// Чтобы игру было слышно, просим iOS считать её звук «воспроизведением медиа»:
// через Audio Session API (iOS 17+) и, для старых версий, через тихий зацикленный <audio>.

const IS_IOS = typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let silentAudio = null;

// 0,1 с тишины в формате WAV, собранные прямо в коде, чтобы не держать отдельный файл
function makeSilentWavUrl() {
    const sampleRate = 8000;
    const samples = 800;
    const bytes = new Uint8Array(44 + samples * 2);
    const view = new DataView(bytes.buffer);
    const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);              // PCM
    view.setUint16(22, 1, true);              // моно
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);             // 16 бит
    writeStr(36, 'data');
    view.setUint32(40, samples * 2, true);    // сами отсчёты — нули
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(binary);
}

// Вызывается на каждое касание/клик: браузеры разрешают звук только в ответ на действие игрока
function unlockAudio() {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
        try {
            navigator.audioSession.type = 'playback';
        } catch (e) {
            // Старый Safari — поможет тихий <audio> ниже
        }
    }
    if (IS_IOS) {
        if (!silentAudio) {
            silentAudio = new Audio(makeSilentWavUrl());
            silentAudio.loop = true;
            silentAudio.setAttribute('playsinline', '');
            silentAudio.setAttribute('x-webkit-airplay', 'deny');
        }
        if (silentAudio.paused) silentAudio.play().catch(() => {});
    }

    const wasRunning = audioCtx && audioCtx.state === 'running';
    if (!ensureAudio() || wasRunning) return;
    // Классическая разблокировка: пустой звук внутри жеста игрока
    const src = audioCtx.createBufferSource();
    src.buffer = audioCtx.createBuffer(1, 1, 22050);
    src.connect(audioCtx.destination);
    src.start(0);
}

// Вкладку свернули — тихий <audio> тоже на паузу, чтобы не висеть в «Сейчас играет»
if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
        if (silentAudio && document.hidden) silentAudio.pause();
    });
}

// --- СИНТЕЗ ---

function tone(freq, time, duration, type = 'square', vol = 0.05, detune = 0, dest = masterGain) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.value = detune;

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.02);
}

function noise(time, duration, vol = 0.05, filterType = null, freq = 1000, dest = masterGain) {
    if (!audioCtx) return;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    let node = src;
    if (filterType) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = freq;
        src.connect(filter);
        node = filter;
    }
    node.connect(gain);
    gain.connect(dest);

    src.start(time, Math.random() * 0.5);
    src.stop(time + duration + 0.02);
}

function kick(time, vol = 0.3, dest = masterGain) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.15);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.25);
}

// Бубенцы: короткий высокий шум и несколько звенящих обертонов вразнобой
function jingle(time, vol = 0.03, dest = masterGain) {
    if (!audioCtx) return;
    noise(time, 0.07, vol, 'highpass', 7000, dest);
    for (let i = 0; i < 3; i++) {
        const t = time + Math.random() * 0.02;
        tone(3000 + Math.random() * 3500, t, 0.05 + Math.random() * 0.04, 'sine', vol * 0.45, 0, dest);
    }
}

// Колокольчик: основной тон и неровные обертоны, как у металлической пластинки
function bell(freq, time, vol = 0.04, dest = masterGain) {
    if (!audioCtx) return;
    tone(freq, time, 1.2, 'sine', vol, 0, dest);
    tone(freq * 2.76, time, 0.5, 'sine', vol * 0.4, 0, dest);
    tone(freq * 5.4, time, 0.2, 'sine', vol * 0.2, 0, dest);
}

// --- МУЗЫКА ---
// Чем больше мира разрушено, тем бодрее и торжественнее музыка.
// Под конец она начинает фальшивить, но улыбаться не перестаёт.

function scheduleStep(step, time) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const s = step % 8;
    const idx = ARP[s];
    const freq = idx === 3 ? chord.notes[0] * 2 : chord.notes[idx];
    const detune = musicIntensity > 0.8 ? Math.random() * 50 - 25 : 0;

    // Слой 1: «укулеле» — есть всегда
    tone(freq * 2, time, 0.22, 'triangle', 0.05, detune, musicGain);

    // Новогодний слой — есть всегда: бубенцы на каждую восьмую (на слабых долях громче)
    // и колокольчик в начале каждого такта
    jingle(time, s % 2 === 1 ? 0.028 : 0.016, musicGain);
    if (s === 0) {
        bell(chord.notes[0] * 4, time, 0.03, musicGain);
    }

    // Слой 2: бас и бочка
    if (musicIntensity > 0.12 && (s === 0 || s === 4)) {
        tone(chord.bass, time, 0.4, 'sine', 0.14, 0, musicGain);
        kick(time, 0.25, musicGain);
    }

    // Слой 3: хлопки на слабую долю
    if (musicIntensity > 0.3 && (s === 2 || s === 6)) {
        noise(time, 0.09, 0.08, 'bandpass', 1500, musicGain);
    }

    // Слой 4: хай‑хэт
    if (musicIntensity > 0.5 && s % 2 === 1) {
        noise(time, 0.03, 0.025, 'highpass', 7000, musicGain);
    }

    // Слой 5: колокольчики успеха
    if (musicIntensity > 0.7 && (s === 3 || s === 6)) {
        bell(chord.notes[2] * 4 * Math.pow(2, detune / 1200), time, 0.03, musicGain);
    }
}

function musicScheduler() {
    if (!isMusicPlaying || !audioCtx) return;

    // Вкладка спала — не играем пропущенное залпом
    if (nextNoteTime < audioCtx.currentTime - 0.25) {
        nextNoteTime = audioCtx.currentTime + 0.05;
    }

    while (nextNoteTime < audioCtx.currentTime + 0.12) {
        scheduleStep(musicStep, nextNoteTime);
        nextNoteTime += STEP_TIME;
        musicStep++;
    }
    requestAnimationFrame(musicScheduler);
}

function startMusic() {
    if (!ensureAudio()) return;
    musicIntensity = 0;
    if (!isMusicPlaying) {
        isMusicPlaying = true;
        musicStep = 0;
        nextNoteTime = audioCtx.currentTime + 0.05;
        musicScheduler();
    }
}

function stopMusic() {
    isMusicPlaying = false;
}

function setMusicIntensity(value) {
    musicIntensity = Math.max(0, Math.min(1, value));
}

// --- ЗВУКОВЫЕ ЭФФЕКТЫ ---

function sfxPaddle() {
    if (!audioCtx) return;
    tone(520, audioCtx.currentTime, 0.07, 'square', 0.05);
}

function sfxWall() {
    if (!audioCtx) return;
    tone(330, audioCtx.currentTime, 0.04, 'square', 0.025);
}

// Кирпич треснул, но держится
function sfxCrack() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    tone(140, t, 0.1, 'triangle', 0.15);
    noise(t, 0.06, 0.06, 'highpass', 2000);
}

// Кирпич разрушен — касса!
function sfxCash(delay = 0) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + delay;
    tone(1567.98, t, 0.08, 'square', 0.03);
    tone(2093.0, t + 0.06, 0.28, 'square', 0.03);
    noise(t + 0.06, 0.12, 0.03, 'highpass', 6000);
}

// Клиентов пока трогать нельзя
function sfxBonk() {
    if (!audioCtx) return;
    tone(110, audioCtx.currentTime, 0.12, 'square', 0.05);
}

function sfxBossHit() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    kick(t, 0.5);
    noise(t, 0.25, 0.08, 'lowpass', 900);
    sfxCash(0.05);
}

// Корпоративное уведомление «динь‑дон»
function sfxAlert() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    tone(880, t, 0.2, 'sine', 0.09);
    tone(660, t + 0.18, 0.35, 'sine', 0.09);
}

// Появился риск: тревожное «пип‑пип»
function sfxRisk() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    tone(740, t, 0.08, 'square', 0.04);
    tone(740, t + 0.12, 0.08, 'square', 0.04);
}

// Попал в риск: удары судейского молотка
function sfxGavel() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    [0, 0.14].forEach((d) => {
        tone(180, t + d, 0.09, 'square', 0.08);
        noise(t + d, 0.05, 0.1, 'lowpass', 1200);
    });
}

// Пролетает Санта: звон бубенцов упряжки
function sfxSleigh() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    for (let i = 0; i < 10; i++) {
        jingle(t + i * 0.08 + Math.random() * 0.02, 0.05 - i * 0.004);
    }
}

// Мяч потерян: три мягких колокольчика вниз (ми – до – ля) и тихий бас — «ну, бывает»
function sfxLose() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + 0.02;
    [659.25, 523.25, 440.0].forEach((freq, i) => {
        bell(freq, t + i * 0.16, 0.07);
    });
    tone(110, t + 0.32, 0.6, 'sine', 0.08);
}

// Победа: касса, касса, касса и фанфары
function sfxWin() {
    if (!audioCtx) return;
    sfxCash(0);
    sfxCash(0.15);
    sfxCash(0.3);

    const t = audioCtx.currentTime + 0.5;
    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((freq, i) => {
        tone(freq, t + i * 0.12, 0.25, 'square', 0.04);
        tone(freq, t + i * 0.12, 0.25, 'triangle', 0.06);
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
        tone(freq, t + 0.55, 1.4, 'triangle', 0.05);
    });
}
