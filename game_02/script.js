const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('vibe_best_score') || 0;
let obstacles = [];
let particles = [];
let speed = 3;
let isInvincible = false; // God mode cheat
let tempInvincibleTimer = 0; // Timer for cake powerup
let cakes = [];

// Assets / Config
const GRAVITY = 0.25;
const JUMP = -6;
const SPAWN_RATE = 160; // Increased spacing (was 120)
const COLORS = {
    bg: '#1e1e1e',
    player: '#4ec9b0',
    obstacleNormal: '#6A9955', // Comment Green (Safeish?)
    obstacleBug: '#f44747', // Error Red
    text: '#d4d4d4'
};

const DEATH_MESSAGES = [
    "Error: undefined is not a function",
    "Сеньор реджектнул твой PR",
    "Мерж-конфликт в продакшене",
    "Stack Overflow упал",
    "npm audit нашел 99 уязвимостей",
    "Забыл await в асинхронной функции",
    "CSS не центрируется",
    "ChatGPT перегружен запросами",
    "Сокращение штата в отделе вайб-разработки",
    "Твой триальный период закончился"
];

const PLAYER_EMOJIS = ['🧑‍💻', '🧑‍💻', '🧑‍💻', '🧑‍💻', '🧑‍💻'];
let currentEmoji = PLAYER_EMOJIS[0];

// Resize handling
function resize() {
    // We want the internal resolution to match the CSS display size
    // to avoid stretching.
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
window.addEventListener('resize', resize);
resize();

// --- CLASSES ---

class VibeCoder {
    constructor() {
        this.x = 80; // Move x out a bit so the larger player isn't half off-screen
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.radius = 40; // Doubled size
    }

    draw() {
        ctx.font = '60px Arial'; // Doubled font size
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Rotate slightly based on velocity for "dynamics"
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // God Mode Aura
        if (isInvincible || tempInvincibleTimer > 0) {
            // Replaced expensive shadowBlur with a drawn circle
            ctx.save();
            ctx.fillStyle = (tempInvincibleTimer > 0) ? `hsl(${frames * 5}, 100%, 50%)` : "gold";
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        let angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        ctx.rotate(angle);
        
        let displayEmoji = currentEmoji;
        if (isInvincible) displayEmoji = '😎';
        else if (tempInvincibleTimer > 0) displayEmoji = '🦄'; 
        
        ctx.fillText(displayEmoji, 0, 0);
        ctx.restore();
    }

    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Floor collision
        if (this.y + this.radius >= canvas.height) {
            this.y = canvas.height - this.radius;
            if (!isInvincible) gameOver("Упал на дно (Выгорание)");
        }
        
        // Ceiling collision
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    }

    jump() {
        this.velocity = JUMP;
        createParticles(this.x, this.y);
        // Randomly change emoji sometimes for "shifting vibes"
        if (Math.random() > 0.9) {
            currentEmoji = PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)];
        }
    }
}

class Obstacle {
    constructor() {
        this.x = canvas.width;
        this.width = 80; // Wider for better visibility
        this.gap = 240; 
        this.topHeight = Math.random() * (canvas.height - this.gap - 100) + 50;
        this.passed = false;
        
        // Flavor text
        this.labelTop = this.getRandomLabel('top');
        this.labelBottom = this.getRandomLabel('bottom');
    }

    getRandomLabel(position) {
        const topLabels = ["ЛЕГАСИ", "ТЕХДОЛГ", "СПАГЕТТИ", "ANY TYPE"];
        const bottomLabels = ["ДЕДЛАЙН", "МИТИНГ", "БАГИ", "РЕФАКТОР"];
        const list = position === 'top' ? topLabels : bottomLabels;
        return list[Math.floor(Math.random() * list.length)];
    }

    draw() {
        const fontSize = 16;
        ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // --- TOP OBSTACLE (Safe/Green-ish theme) ---
        // Main Body
        ctx.fillStyle = '#252526'; 
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        
        // Stylish Border (Left, Right, Bottom)
        ctx.strokeStyle = '#6A9955';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x, 0);
        ctx.lineTo(this.x, this.topHeight);
        ctx.lineTo(this.x + this.width, this.topHeight);
        ctx.lineTo(this.x + this.width, 0);
        ctx.stroke();

        // "Cap" at the gap
        ctx.fillStyle = '#6A9955';
        ctx.fillRect(this.x, this.topHeight - 30, this.width, 30);

        // Text (White on Green Cap? No, text above it)
        // Let's put text vertically in the dark area, reading UP away from gap
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.translate(this.x + this.width / 2, this.topHeight - 45);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "left"; 
        ctx.fillText(this.labelTop, 0, 0);
        ctx.restore();

        // --- BOTTOM OBSTACLE (Danger/Red theme) ---
        let bottomY = this.topHeight + this.gap;
        let bottomH = canvas.height - bottomY;
        
        // Main Body
        ctx.fillStyle = '#252526';
        ctx.fillRect(this.x, bottomY, this.width, bottomH);
        
        // Stylish Border
        ctx.strokeStyle = '#f44747';
        ctx.beginPath();
        ctx.moveTo(this.x, canvas.height);
        ctx.lineTo(this.x, bottomY);
        ctx.lineTo(this.x + this.width, bottomY);
        ctx.lineTo(this.x + this.width, canvas.height);
        ctx.stroke();

        // "Cap" at the gap
        ctx.fillStyle = '#f44747';
        ctx.fillRect(this.x, bottomY, this.width, 30);

        // Text
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.translate(this.x + this.width / 2, bottomY + 45);
        ctx.rotate(Math.PI / 2); // Read downwards
        ctx.textAlign = "left";
        ctx.fillText(this.labelBottom, 0, 0);
        ctx.restore();
    }

    update() {
        this.x -= speed;
    }
}

class Cake {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 40;
        this.collected = false;
    }

    update() {
        this.x -= speed;
    }

    draw() {
        if (this.collected) return;
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Simple glow (circle behind) instead of expensive shadowBlur
        ctx.fillStyle = 'rgba(255, 105, 180, 0.3)'; // HotPink transparent
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size/1.5, 0, Math.PI*2);
        ctx.fill();

        ctx.fillText('🍰', this.x, this.y);
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 10 + 10;
        // Small random drift
        this.speedX = Math.random() * 2 - 1; 
        this.speedY = Math.random() * 2 - 1;
        this.life = 1.0; 
    }
    update() {
        // Move with the world (speed is the global game speed)
        this.x -= speed; 
        
        // Add local drift
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Fade out faster for performance (was 0.005)
        this.life -= 0.02; 
    }
    draw() {
        ctx.font = `${this.size}px Arial`;
        ctx.globalAlpha = this.life;
        ctx.fillText('💩', this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

// --- CORE FUNCTIONS ---

const player = new VibeCoder();

function createParticles(x, y) {
    for(let i=0; i<5; i++) {
        particles.push(new Particle(x, y));
    }
}

function initGame() {
    gameState = 'PLAYING';
    player.y = canvas.height / 2;
    player.velocity = 0;
    score = 0;
    frames = 0;
    obstacles = [];
    particles = [];
    cakes = []; // Reset cakes
    tempInvincibleTimer = 0; // Reset powerup
    currentEmoji = '🧑‍💻';
    
    document.getElementById('current-score').innerText = score;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden'); // Hide win screen
    document.getElementById('hud').classList.remove('hidden');
    
    startAudio(); // Start the music
    loop();
}

function gameWin() {
    gameState = 'GAMEOVER'; // Stop game loop
    stopAudio();
    lastGameOverTime = Date.now();

    // Save Score (100)
    if(score > bestScore) {
        bestScore = score;
        localStorage.setItem('vibe_best_score', bestScore);
    }

    // Show Win Screen
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('win-screen').classList.remove('hidden');
    document.getElementById('win-score').innerText = score;
    
    // Play a "Win" sound? (Optional, maybe just silence or existing stopAudio)
}

function gameOver(reason) {
    gameState = 'GAMEOVER';
    stopAudio(); // Stop music
    lastGameOverTime = Date.now();
    
    // Save Score
    if(score > bestScore) {
        bestScore = score;
        localStorage.setItem('vibe_best_score', bestScore);
    }

    // Update UI
    const randomMsg = DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];
    document.getElementById('death-reason').innerText = reason || randomMsg;
    document.getElementById('final-score').innerText = score;
    document.getElementById('best-score').innerText = bestScore;
    
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function loop() {
    if(gameState !== 'PLAYING') return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Matrix-lite Background (Optional subtle grid)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for(let i=0; i<canvas.width; i+=50) {
        ctx.beginPath();
        ctx.moveTo(i - (frames % 50), 0);
        ctx.lineTo(i - (frames % 50), canvas.height);
        ctx.stroke();
    }

    // Update Player
    player.update();
    player.draw();

    // Constant Poop Trail (Reduced frequency for performance)
    if (frames % 15 === 0) {
        particles.push(new Particle(player.x, player.y));
    }

    // Manage Obstacles
    if (frames % SPAWN_RATE === 0) {
        const obs = new Obstacle();
        obstacles.push(obs);
        
        // 20% chance to spawn a cake in the gap
        if (Math.random() < 0.2) {
            // Position cake in the middle of the gap
            const cakeY = obs.topHeight + obs.gap / 2;
            // Position cake slightly after the pipe starts so it looks centered horizontally
            const cakeX = obs.x + obs.width / 2;
            cakes.push(new Cake(cakeX, cakeY));
        }
    }

    // Manage Cakes
    for (let i = 0; i < cakes.length; i++) {
        let cake = cakes[i];
        cake.update();
        cake.draw();

        // Collision with Cake
        // Simple circle collision
        const dist = Math.hypot(player.x - cake.x, player.y - cake.y);
        if (dist < player.radius + cake.size/2 && !cake.collected) {
            cake.collected = true;
            tempInvincibleTimer = 300; // 5 seconds at 60fps
            createParticles(cake.x, cake.y); // Confetti!
        }

        // Remove off-screen
        if (cake.x < -50 || cake.collected) {
            cakes.splice(i, 1);
            i--;
        }
    }

    // Update Temp Invincibility
    if (tempInvincibleTimer > 0) {
        tempInvincibleTimer--;
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.update();
        obs.draw();

        // Collision Check
        // Invincible if Cheat OR Cake Timer is active
        if (!isInvincible && tempInvincibleTimer <= 0) {
            const hitBox = player.radius * 0.6; // Forgiving hitbox for the emoji shape
            
            // Top Pipe
            if (
                player.x + hitBox > obs.x && 
                player.x - hitBox < obs.x + obs.width &&
                player.y - hitBox < obs.topHeight
            ) {
                gameOver();
            }
            // Bottom Pipe
            if (
                player.x + hitBox > obs.x && 
                player.x - hitBox < obs.x + obs.width &&
                player.y + hitBox > obs.topHeight + obs.gap
            ) {
                gameOver();
            }
        }

        // Score update
        if (obs.x + obs.width < player.x && !obs.passed) {
            score++;
            obs.passed = true;
            document.getElementById('current-score').innerText = score;
            // Increase difficulty slightly
            if(score % 5 === 0) speed += 0.2;

            // WIN CONDITION
            if (score >= 100) {
                gameWin();
            }
        }

        // Remove off-screen
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            i--;
        }
    }

    // Particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }

    frames++;
    requestAnimationFrame(loop);
}

// --- CONTROLS ---

let lastGameOverTime = 0;

function handleInput(e) {
    // If it's a keyboard event, only accept Space
    if (e.type === 'keydown' && e.code !== 'Space') return;
    
    // If it's a touch/click event on a button or the Title (cheat), ignore
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'H1') return;

    e.preventDefault();

    if (gameState === 'START') {
        initGame();
    } else if (gameState === 'PLAYING') {
        player.jump();
    } else if (gameState === 'GAMEOVER') {
        // Simple cooldown to prevent accidental restart immediately after death
        if (Date.now() - lastGameOverTime > 500) {
            initGame();
        }
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, {passive: false});
window.addEventListener('mousedown', handleInput);

// Button listeners
document.getElementById('start-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Stop bubbling to window handler
    initGame();
});
document.getElementById('restart-btn').addEventListener('click', (e) => {
    e.stopPropagation(); 
    initGame();
});
document.getElementById('win-restart-btn').addEventListener('click', (e) => {
    e.stopPropagation(); 
    initGame();
});

// CHEAT CODE: Click Title 5 times
let titleClicks = 0;
const titleElement = document.querySelector('#start-screen h1');

function triggerCheat(e) {
    e.stopPropagation();
    e.preventDefault(); // Prevent default to stop mouse emulation if touch
    titleClicks++;
    if (titleClicks === 5) {
        isInvincible = !isInvincible;
        alert(isInvincible ? "GOD MODE: ON (You are Senior Architect now)" : "GOD MODE: OFF");
        titleClicks = 0;
    }
}

titleElement.addEventListener('click', triggerCheat);
titleElement.addEventListener('touchstart', triggerCheat);
titleElement.addEventListener('mousedown', triggerCheat);

// Initial Draw
ctx.fillStyle = COLORS.bg;
ctx.fillRect(0, 0, canvas.width, canvas.height);
player.draw();

