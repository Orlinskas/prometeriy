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
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return true;
}

// Мобильные браузеры разрешают звук только после touchend/click
function unlockAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
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
    if (musicIntensity > 0.7 && (s === 0 || s === 3 || s === 6)) {
        tone(chord.notes[2] * 4, time, 0.35, 'sine', 0.035, detune, musicGain);
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

// Грустный тромбон: уа‑уа‑уа‑уаааа
function sfxSadTrombone() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + 0.02;
    const notes = [233.08, 220.0, 207.65, 196.0];
    const durs = [0.3, 0.3, 0.3, 1.0];

    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.value = 1100;

    let time = t0;
    gain.gain.setValueAtTime(0.0001, time);
    notes.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.04);
        gain.gain.setValueAtTime(0.12, time + durs[i] - 0.06);
        gain.gain.linearRampToValueAtTime(i === notes.length - 1 ? 0.0001 : 0.02, time + durs[i]);
        time += durs[i];
    });

    // Вибрато на последней ноте
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.value = 6;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t0 + 0.9);
    lfo.stop(time);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(t0);
    osc.stop(time + 0.05);
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
