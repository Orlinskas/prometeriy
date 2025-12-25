// --- AUDIO SYSTEM (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let nextNoteTime = 0;
let isPlaying = false;
const tempo = 120;
const secondsPerBeat = 60.0 / tempo;

// Melody: C4, E4, G4, B4 (Cmaj7) -> D4, F4, A4, C5 (Dm7)
const melody = [
    261.63, 329.63, 392.00, 493.88, // Cmaj7
    261.63, 329.63, 392.00, 493.88,
    293.66, 349.23, 440.00, 523.25, // Dm7
    293.66, 349.23, 440.00, 523.25
];

let noteIndex = 0;

// Helper: Synthesizer
function playTone(freq, time, duration, type = 'square', vol = 0.05, detune = 0) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    
    // Envelope: Sharp attack, decay
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + duration);
}

// Helper: Noise (Drums/Glitch)
function playNoise(time, duration, vol = 0.05) {
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    noise.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(time);
}

function scheduler() {
    if (!isPlaying) return;

    // Schedule ahead
    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        const currentLoop = Math.floor(noteIndex / melody.length);
        const beatIndex = noteIndex % melody.length;

        // --- LAYER 1: The Base Melody (Square) ---
        // Always plays
        playTone(melody[beatIndex], nextNoteTime, secondsPerBeat * 0.5, 'square', 0.04);

        // --- LAYER 2: The Bass (Triangle) ---
        // Starts after 3 loops
        if (currentLoop >= 3) {
            // Root notes: C2 (65.41) for first half, D2 (73.42) for second half
            const bassFreq = (beatIndex < 8) ? 65.41 : 73.42; 
            // Play on every beat
            if (noteIndex % 2 === 0) {
                playTone(bassFreq, nextNoteTime, secondsPerBeat, 'triangle', 0.08);
            }
        }

        // --- LAYER 3: The Anxiety (Sawtooth Arp) ---
        // Starts after 6 loops
        if (currentLoop >= 6) {
            // Play a 5th above the melody, fast and staccato
            playTone(melody[beatIndex] * 1.5, nextNoteTime, 0.1, 'sawtooth', 0.02);
        }

        // --- LAYER 4: The Burnout (Noise & Detuned Chaos) ---
        // Starts after 9 loops
        if (currentLoop >= 9) {
            // Hi-hat noise on off-beats
            if (noteIndex % 2 !== 0) {
                playNoise(nextNoteTime, 0.05, 0.03);
            }
            // Occasional random detuned screech
            if (Math.random() > 0.8) {
                 playTone(melody[beatIndex] * 2, nextNoteTime, 0.2, 'sawtooth', 0.02, Math.random() * 200 - 100);
            }
        }

        // --- LAYER 5: The Legacy Core (Deep Distortion) ---
        // Starts after 12 loops - DOOM MODE
        if (currentLoop >= 12) {
             // Super low sub-bass drone on the first beat of each bar
             if (noteIndex % 16 === 0) {
                 // 32.7 Hz (C1) - Extremely low
                 playTone(32.70, nextNoteTime, 2.0, 'sawtooth', 0.15, Math.random() * 10);
             }
             
             // Random pitch bends on the main melody
             if (Math.random() > 0.5) {
                // Actually we can't easily bend the existing note here without refactoring, 
                // but we can add a dissonant harmony.
                playTone(melody[beatIndex] * 0.95, nextNoteTime, 0.1, 'square', 0.03);
             }
        }

        // --- LAYER 6: The Code Review (Frantic Sine Arp) ---
        // Starts after 15 loops
        if (currentLoop >= 15) {
             // Fast 16th notes sine wave, jumping octaves
             const octave = (noteIndex % 2 === 0) ? 2 : 4;
             playTone(melody[beatIndex] * octave, nextNoteTime, 0.05, 'sine', 0.05);
             // Add a second one slightly offset in time? No, simpler to just layer.
        }

        // --- LAYER 7: Release Day (High Pitch Lead) ---
        // Starts after 18 loops - THE ENDGAME
        if (currentLoop >= 18) {
             // Play a counter melody high up
             // Just play the melody 2 octaves up but with a different rhythm (every 3rd 16th note?)
             // Let's keep it simple: syncopated hits
             if (noteIndex % 3 === 0) {
                 playTone(melody[(beatIndex + 2) % melody.length] * 4, nextNoteTime, 0.1, 'square', 0.03);
             }
        }

        // --- LAYER 8: Deploy to Prod (Data Static) ---
        // Starts after 21 loops
        if (currentLoop >= 21) {
            // Fast rhythmic noise burst every 2 beats
            if (noteIndex % 4 === 0) {
                 playNoise(nextNoteTime, 0.1, 0.08);
            }
        }

        // --- LAYER 9: Hotfix (Dissonant Tension) ---
        // Starts after 24 loops
        if (currentLoop >= 24) {
            // Tritone harmony (augmented 4th) relative to melody
            // This creates a very "wrong" or tense feeling
            playTone(melody[beatIndex] * 1.414, nextNoteTime, 0.2, 'sawtooth', 0.04);
        }

        // --- LAYER 10: KERNEL PANIC (Total Madness) ---
        // Starts after 27 loops
        if (currentLoop >= 27) {
             // Play extremely fast, random notes all over the spectrum
             // "Melting" sound
             const panicFreq = Math.random() * 1000 + 100;
             playTone(panicFreq, nextNoteTime, 0.05, 'square', 0.05, Math.random() * 1000);
             
             // Also maybe just scream
             if (Math.random() > 0.5) {
                playTone(Math.random() * 5000, nextNoteTime, 0.02, 'sawtooth', 0.05);
             }
        }

        // --- LAYER 11: The Singularity (Ascension) ---
        // Starts after 30 loops
        if (currentLoop >= 30) {
             // A constant, shimmering chord of pure sine waves
             // C5, E5, G5, C6
             if (noteIndex % 4 === 0) {
                 playTone(523.25, nextNoteTime, 2.0, 'sine', 0.1);
                 playTone(659.25, nextNoteTime, 2.0, 'sine', 0.1);
                 playTone(783.99, nextNoteTime, 2.0, 'sine', 0.1);
                 playTone(1046.50, nextNoteTime, 2.0, 'sine', 0.1);
             }
        }

        nextNoteTime += secondsPerBeat * 0.5; // Eighth notes
        noteIndex++;
    }
    requestAnimationFrame(scheduler);
}

function startAudio() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (!isPlaying) {
        isPlaying = true;
        nextNoteTime = audioCtx.currentTime;
        noteIndex = 0;
        scheduler();
    }
}

function stopAudio() {
    isPlaying = false;
}
