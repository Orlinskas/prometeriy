// ДИЗРАПТ — мини-игра для журнала «Прометерий»
// ИИ‑компания разбивает мир кирпич за кирпичом. Чем меньше мира, тем выше капитализация.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIG ---

const COLORS = {
    bg: '#000000',
    corp: '#3ca069',      // ИИ‑КОРП: стерильный фирменный зелёный
    text: '#ffffff',
    muted: '#8a8a8a',
    brickText: '#111111'
};
const FONT = '"IBM Plex Serif", Georgia, serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const HUD_HEIGHT = 56;
const SIDE = 10;
const GAP = 6;
const COLS = 5;
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60° от вертикали
const ROUNDS = ['A', 'B', 'C'];       // жизни = раунды инвестиций
const START_CAP = 1;                  // млрд $
const CHART_MAX = 10000;              // млрд $ — верх графика
const BEST_KEY = 'disrupt_best_score';

// Мир сверху вниз. Мяч сначала бьёт нижние ряды, поэтому внизу мелочи, наверху главное.
const ROWS = [
    {
        boss: true, color: '#ffffff', hp: 6, value: 1300,
        bricks: [{ label: 'ВАШИ КЛИЕНТЫ' }]
    },
    {
        color: '#8fb3e0', hp: 2, value: 150,
        bricks: [
            { label: 'Правда', epitaph: 'не отличить' },
            { label: 'Вкус', epitaph: 'усреднено' },
            { label: 'Опенсорс', epitaph: 'PR закрыты' },
            { label: 'Математика', epitaph: 'решено*' },
            { label: 'Интернет', epitaph: 'теперь слоп' }
        ]
    },
    {
        color: '#e07a5f', hp: 1, value: 100,
        bricks: [
            { label: 'Художники', epitaph: 'демократизировано' },
            { label: 'Переводчики', epitaph: 'оптимизировано' },
            { label: 'Копирайтеры', epitaph: 'отличный вопрос!' },
            { label: 'Джуниоры', epitaph: 'не нанимаем' },
            { label: 'Дизайнеры', epitaph: 'заменено промптом' }
        ]
    },
    {
        color: '#f4a261', hp: 1, value: 30,
        bricks: [
            { label: 'Stack Overflow', epitaph: 'закрыто как дубликат' },
            { label: 'Фотостоки', epitaph: 'сгенерировано' },
            { label: 'Форумы', epitaph: 'тишина' },
            { label: 'Рефераты', epitaph: 'сдано за 3 секунды' },
            { label: 'Поиск', epitaph: 'краткий ИИ‑ответ' }
        ]
    },
    {
        color: '#f2cc8f', hp: 1, value: 10,
        bricks: [
            { label: 'Капча', epitaph: 'пройдено ботом' },
            { label: 'Домашка', epitaph: 'сделано' },
            { label: 'Открытки', epitaph: 'шесть пальцев' },
            { label: 'Меню кафе', epitaph: 'ПИЦЦЦА' },
            { label: 'Вывески', epitaph: 'ВКУСНАЯ ЕДДА' }
        ]
    }
];

const BOSS_LINES = [
    'отток клиентов',
    'спрос оптимизирован',
    'клиенты сокращены',
    'клиентов заменили агенты',
    'бюджеты урезаны',
    'продавать некому'
];

const BALL_LOST = [
    'Нейросеть сгаллюцинировала',
    'Кончились данные для обучения',
    'Дата‑центру не хватило электричества',
    'Модель ответила: «Я не могу с этим помочь»',
    'Нейросеть уверенно промахнулась'
];

const GAME_OVER_REASONS = [
    'Инвесторы ушли в следующий хайп',
    'Деньги кончились раньше, чем мир',
    'Мир оказался прочнее презентации',
    'Человечество пока справляется само'
];

// --- STATE ---

let W = 0;
let H = 0;
let gameState = 'START'; // START, SERVE, PLAYING, ENDING, GAMEOVER, WIN
let bricks = [];
let particles = [];
let popups = [];
let chart = [];
let score = START_CAP;
let bestScore = loadBest();
let round = 0;
let totalHits = 0;
let hitsDone = 0;
let message = null;
let shake = 0;
let endTimer = 0;
let lastTime = 0;
let lastEndTime = 0;
let lastProtectedPopup = 0;
let isMonopoly = false; // чит
let pointerX = null;
const keys = { left: false, right: false };

const paddle = { x: 0, y: 0, w: 100, h: 16 };
const ball = { x: 0, y: 0, r: 10, dx: 0, dy: -1, speed: 5, baseSpeed: 5 };

// --- DOM ---

const hudEl = document.getElementById('hud');
const hudCapEl = document.getElementById('hud-cap');
const hudRoundEl = document.getElementById('hud-round');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const winScreen = document.getElementById('win-screen');
const titleEl = document.getElementById('title');
const cheatNoteEl = document.getElementById('cheat-note');

// --- HELPERS ---

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function formatCap(v) {
    if (v >= 1000) {
        const t = v / 1000;
        const str = t >= 10 ? String(Math.round(t)) : t.toFixed(1).replace('.', ',').replace(/,0$/, '');
        return '$' + str + ' трлн';
    }
    return '$' + Math.round(v) + ' млрд';
}

function loadBest() {
    try {
        return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch (e) {
        return 0;
    }
}

function saveBest() {
    if (score > bestScore) {
        bestScore = score;
        try {
            localStorage.setItem(BEST_KEY, String(bestScore));
        } catch (e) {
            // Хранилище недоступно (например, в приватном режиме) — просто не сохраняем
        }
    }
}

function splitInTwo(text) {
    const mid = text.length / 2;
    let best = -1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    }
    return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

// ctx.font должен быть установлен до вызова
function wrapLines(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (line && ctx.measureText(test).width > maxW) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// --- LAYOUT ---

function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldW = W;
    const oldH = H;
    W = rect.width;
    H = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout(oldW, oldH);
}

function layout(oldW, oldH) {
    const brickH = clamp(H * 0.042, 26, 36);
    const colW = (W - SIDE * 2 - GAP * (COLS - 1)) / COLS;

    const rowBoxes = [];
    let y = HUD_HEIGHT + 28;
    for (const row of ROWS) {
        const h = row.boss ? Math.round(brickH * 1.4) : brickH;
        rowBoxes.push({ y, h });
        y += h + GAP;
    }

    for (const b of bricks) {
        const box = rowBoxes[b.row];
        b.y = box.y;
        b.h = box.h;
        if (b.boss) {
            b.x = SIDE;
            b.w = W - SIDE * 2;
        } else {
            b.x = SIDE + b.col * (colW + GAP);
            b.w = colW;
        }
        fitBrickText(b);
    }

    // Один размер шрифта на ряд — так ряды выглядят ровно
    const rowFont = {};
    for (const b of bricks) {
        if (!b.boss) rowFont[b.row] = Math.min(rowFont[b.row] ?? Infinity, b.font);
    }
    for (const b of bricks) {
        if (!b.boss && b.font > rowFont[b.row]) {
            b.font = rowFont[b.row];
            b.lines = brickLines(b, b.font).lines;
        }
    }

    // Платформа: сохраняем её центр пропорционально ширине
    const ratio = oldW ? W / oldW : 1;
    const center = (paddle.x + paddle.w / 2) * ratio;
    paddle.h = 16;
    paddle.y = H - Math.max(60, H * 0.09);
    paddle.w = isMonopoly ? W - SIDE * 2 : clamp(W * 0.22, 80, 130);
    paddle.x = clamp(center - paddle.w / 2, 0, W - paddle.w);

    ball.r = clamp(W * 0.02, 9, 12);
    ball.baseSpeed = clamp(H * 0.0075, 4.5, 7);
    updateBallSpeed();

    if (gameState === 'PLAYING' && oldW && oldH) {
        ball.x = clamp(ball.x * W / oldW, ball.r, W - ball.r);
        ball.y = ball.y * H / oldH;
    }
    if (gameState === 'START' || gameState === 'SERVE') {
        placeBallOnPaddle();
    }
}

// Подбираем размер шрифта, чтобы подпись влезла в кирпич (при необходимости в две строки).
// Мельче MIN_BRICK_FONT не уменьшаем — на узких экранах текст сожмётся по ширине при отрисовке.
const MIN_BRICK_FONT = 10;

function brickLines(b, size) {
    const maxW = b.w - 6;
    const maxH = b.h - 4;
    ctx.font = `700 ${size}px ${FONT}`;
    if (ctx.measureText(b.label).width <= maxW) {
        return { lines: [b.label], fits: true };
    }
    if (b.label.includes(' ') && size * 2.2 <= maxH) {
        const parts = splitInTwo(b.label);
        return { lines: parts, fits: parts.every((p) => ctx.measureText(p).width <= maxW) };
    }
    return { lines: [b.label], fits: false };
}

function fitBrickText(b) {
    const start = b.boss ? Math.min(20, b.h * 0.5) : Math.min(14, b.h * 0.5);
    for (let size = start; size >= MIN_BRICK_FONT; size -= 0.5) {
        const res = brickLines(b, size);
        if (res.fits) {
            b.font = size;
            b.lines = res.lines;
            return;
        }
    }
    b.font = MIN_BRICK_FONT;
    b.lines = brickLines(b, MIN_BRICK_FONT).lines;
}

// --- WORLD ---

function buildBricks() {
    bricks = [];
    ROWS.forEach((row, ri) => {
        row.bricks.forEach((data, ci) => {
            bricks.push({
                row: ri,
                col: ci,
                label: data.label,
                epitaph: data.epitaph || '',
                color: row.color,
                hp: row.hp,
                maxHp: row.hp,
                value: row.value,
                boss: !!row.boss,
                alive: true,
                cracks: [],
                flash: 0,
                x: 0, y: 0, w: 0, h: 0,
                font: 12,
                lines: [data.label]
            });
        });
    });
    totalHits = bricks.reduce((sum, b) => sum + b.hp, 0);
}

function isBossProtected() {
    return bricks.some((b) => b.alive && !b.boss);
}

function addCrack(b) {
    const pts = [];
    let x = 0.15 + Math.random() * 0.7;
    let y = Math.random() < 0.5 ? 0 : 1;
    const dirY = y === 0 ? 1 : -1;
    pts.push([x, y]);
    for (let i = 0; i < 3; i++) {
        x = clamp(x + (Math.random() - 0.5) * (b.boss ? 0.08 : 0.3), 0, 1);
        y = clamp(y + dirY * (0.2 + Math.random() * 0.2), 0, 1);
        pts.push([x, y]);
    }
    b.cracks.push(pts);
}

function spawnDebris(b, count) {
    for (let i = 0; i < count; i++) {
        if (particles.length > 250) break;
        particles.push({
            x: b.x + Math.random() * b.w,
            y: b.y + Math.random() * b.h,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3,
            size: 3 + Math.random() * 5,
            color: b.color,
            life: 1
        });
    }
}

function addPopup(x, y, text, sub) {
    popups.push({ x, y, text, sub: sub || '', life: 1 });
}

function addScore(value) {
    score += value;
    chart.push(score);
    updateHud();
}

function updateBallSpeed() {
    const progress = totalHits ? hitsDone / totalHits : 0;
    ball.speed = ball.baseSpeed * (1 + 0.5 * progress);
}

function updateHud() {
    hudCapEl.innerText = formatCap(score);
    hudRoundEl.innerText = isMonopoly ? 'Монополия' : 'Раунд ' + ROUNDS[Math.min(round, ROUNDS.length - 1)];
}

function placeBallOnPaddle() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
}

// --- GAME FLOW ---

function initGame() {
    startMusic();

    buildBricks();
    score = START_CAP;
    chart = [score];
    round = 0;
    hitsDone = 0;
    particles = [];
    popups = [];
    message = null;
    shake = 0;
    endTimer = 0;
    lastTime = 0;

    layout(W, H);
    paddle.x = (W - paddle.w) / 2;
    placeBallOnPaddle();
    gameState = 'SERVE';

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
    updateHud();
}

function launchBall() {
    const angle = (Math.random() - 0.5) * 0.5;
    ball.dx = Math.sin(angle);
    ball.dy = -Math.cos(angle);
    message = null;
    gameState = 'PLAYING';
}

function loseBall() {
    round++;
    if (round >= ROUNDS.length) {
        gameOver();
        return;
    }
    // Провал — повод для нового раунда. И оценка, конечно, выросла.
    const bonus = 100 * round;
    addScore(bonus);
    message = {
        title: pick(BALL_LOST),
        text: `Инвесторы дали ещё денег. Раунд ${ROUNDS[round]}: оценка +${formatCap(bonus)}`
    };
    sfxSadTrombone();
    gameState = 'SERVE';
    placeBallOnPaddle();
}

function gameOver() {
    gameState = 'GAMEOVER';
    lastEndTime = Date.now();
    stopMusic();
    sfxSadTrombone();
    saveBest();

    const destroyed = bricks.filter((b) => !b.alive).length;
    document.getElementById('death-reason').innerText = pick(GAME_OVER_REASONS);
    document.getElementById('final-destroyed').innerText = destroyed;
    document.getElementById('final-total').innerText = bricks.length;
    document.getElementById('final-score').innerText = formatCap(score);
    document.getElementById('best-score').innerText = formatCap(bestScore);

    hudEl.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

function startEnding() {
    gameState = 'ENDING';
    endTimer = 100; // ~1.7 секунды полюбоваться пустым миром
    shake = 14;
    stopMusic();
}

function gameWin() {
    gameState = 'WIN';
    lastEndTime = Date.now();
    saveBest();
    sfxWin();

    document.getElementById('win-score').innerText = formatCap(score);
    hudEl.classList.add('hidden');
    winScreen.classList.remove('hidden');
}

// --- COLLISIONS ---

function hitBrick(b) {
    if (b.boss && isBossProtected()) {
        sfxBonk();
        const now = Date.now();
        if (now - lastProtectedPopup > 1500) {
            lastProtectedPopup = now;
            addPopup(ball.x, b.y + b.h + 16, 'клиенты пока нужны');
        }
        return;
    }

    b.hp--;
    b.flash = 8;
    hitsDone++;
    addScore(b.value);
    updateBallSpeed();
    setMusicIntensity(hitsDone / totalHits);

    if (b.boss) {
        const line = BOSS_LINES[Math.min(b.maxHp - b.hp - 1, BOSS_LINES.length - 1)];
        addPopup(ball.x, b.y + b.h + 18, line, '+' + formatCap(b.value));
        addCrack(b);
        shake = 8;
        sfxBossHit();
        if (b.hp <= 0) destroyBrick(b);
        return;
    }

    if (b.hp <= 0) {
        destroyBrick(b);
    } else {
        addCrack(b);
        sfxCrack();
    }
}

function destroyBrick(b) {
    b.alive = false;

    if (b.boss) {
        spawnDebris(b, 80);
        startEnding();
        return;
    }

    spawnDebris(b, 10);
    addPopup(b.x + b.w / 2, b.y + b.h / 2, b.epitaph, '+' + formatCap(b.value));
    sfxCash();

    // Остались только клиенты — пора и до них добраться
    if (!isBossProtected()) {
        const boss = bricks.find((x) => x.boss && x.alive);
        if (boss) {
            addPopup(W / 2, boss.y + boss.h + 40, 'новая цель: клиенты');
            sfxAlert();
        }
    }
}

// Отскок мяча от прямоугольника. true — если было касание.
function collideRect(r) {
    const cx = clamp(ball.x, r.x, r.x + r.w);
    const cy = clamp(ball.y, r.y, r.y + r.h);
    const ddx = ball.x - cx;
    const ddy = ball.y - cy;
    if (ddx * ddx + ddy * ddy >= ball.r * ball.r) return false;

    const overlapX = ball.dx > 0 ? ball.x + ball.r - r.x : r.x + r.w - (ball.x - ball.r);
    const overlapY = ball.dy > 0 ? ball.y + ball.r - r.y : r.y + r.h - (ball.y - ball.r);
    if (overlapX < overlapY) {
        ball.x += ball.dx > 0 ? -overlapX : overlapX;
        ball.dx = -ball.dx;
    } else {
        ball.y += ball.dy > 0 ? -overlapY : overlapY;
        ball.dy = -ball.dy;
    }
    return true;
}

// Не даём мячу лететь почти горизонтально
function fixAngle() {
    const minDy = 0.3;
    if (Math.abs(ball.dy) < minDy) {
        ball.dy = (ball.dy < 0 ? -1 : 1) * minDy;
        ball.dx = (ball.dx < 0 ? -1 : 1) * Math.sqrt(1 - minDy * minDy);
    }
}

function moveBall(dt) {
    // Мелкие шаги, чтобы быстрый мяч не проскакивал сквозь кирпичи
    const dist = ball.speed * dt;
    const steps = Math.max(1, Math.ceil(dist / (ball.r * 0.5)));
    const stepLen = dist / steps;

    for (let s = 0; s < steps; s++) {
        ball.x += ball.dx * stepLen;
        ball.y += ball.dy * stepLen;

        // Стены
        if (ball.x - ball.r < 0) {
            ball.x = ball.r;
            ball.dx = Math.abs(ball.dx);
            fixAngle();
            sfxWall();
        } else if (ball.x + ball.r > W) {
            ball.x = W - ball.r;
            ball.dx = -Math.abs(ball.dx);
            fixAngle();
            sfxWall();
        }
        if (ball.y - ball.r < HUD_HEIGHT) {
            ball.y = HUD_HEIGHT + ball.r;
            ball.dy = Math.abs(ball.dy);
            sfxWall();
        }

        // Платформа: угол отскока зависит от точки удара
        if (
            ball.dy > 0 &&
            ball.y + ball.r >= paddle.y &&
            ball.y - ball.r <= paddle.y + paddle.h &&
            ball.x + ball.r >= paddle.x &&
            ball.x - ball.r <= paddle.x + paddle.w
        ) {
            const rel = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
            const angle = rel * MAX_BOUNCE_ANGLE;
            ball.dx = Math.sin(angle);
            ball.dy = -Math.cos(angle);
            ball.y = paddle.y - ball.r;
            sfxPaddle();
        }

        // Кирпичи (не больше одного за шаг)
        for (const b of bricks) {
            if (!b.alive) continue;
            if (collideRect(b)) {
                fixAngle();
                hitBrick(b);
                break;
            }
        }
        if (gameState !== 'PLAYING') return;

        // Мяч упал
        if (ball.y - ball.r > H) {
            loseBall();
            return;
        }
    }
}

// --- UPDATE ---

function movePaddle(dt) {
    if (keys.left || keys.right) {
        const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        paddle.x += dir * W * 0.016 * dt;
    } else if (pointerX !== null) {
        paddle.x = pointerX - paddle.w / 2;
    }
    paddle.x = clamp(paddle.x, 0, W - paddle.w);
}

function update(dt) {
    if (gameState === 'SERVE' || gameState === 'PLAYING') {
        movePaddle(dt);
    }
    if (gameState === 'SERVE') {
        placeBallOnPaddle();
    } else if (gameState === 'PLAYING') {
        moveBall(dt);
    } else if (gameState === 'ENDING') {
        endTimer -= dt;
        if (endTimer <= 0) gameWin();
    }

    for (const b of bricks) {
        if (b.flash > 0) b.flash -= dt;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += 0.25 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.015 * dt;
        if (p.life <= 0 || p.y > H + 20) particles.splice(i, 1);
    }

    for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.y -= 0.5 * dt;
        p.life -= 0.011 * dt;
        if (p.life <= 0) popups.splice(i, 1);
    }

    if (shake > 0) shake = Math.max(0, shake - 0.6 * dt);
}

// --- RENDER ---

// Главная визуальная шутка: мир пустеет, а график ползёт вверх
function drawChart() {
    if (chart.length === 0) return;
    const slots = Math.max(chart.length - 1, totalHits + ROUNDS.length - 1, 1);
    const bottom = H - 8;
    const top = HUD_HEIGHT + 12;
    const toX = (i) => (i / slots) * W;
    // Степень < 1: рост заметен с первых кирпичей, а финальный рывок на клиентах всё равно самый крутой
    const toY = (v) => bottom - Math.pow(Math.min(v / CHART_MAX, 1), 0.6) * (bottom - top);

    ctx.beginPath();
    chart.forEach((v, i) => {
        if (i === 0) ctx.moveTo(toX(i), toY(v));
        else ctx.lineTo(toX(i), toY(v));
    });
    const lastX = toX(chart.length - 1);
    const lastY = toY(chart[chart.length - 1]);

    ctx.strokeStyle = 'rgba(60, 160, 105, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(lastX, bottom);
    ctx.lineTo(0, bottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(60, 160, 105, 0.08)';
    ctx.fill();

    ctx.fillStyle = 'rgba(60, 160, 105, 0.7)';
    ctx.font = `400 12px ${FONT}`;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = lastX > W - 140 ? 'right' : 'left';
    const labelX = lastX > W - 140 ? lastX - 6 : lastX + 6;
    let labelY = Math.max(lastY - 6, top + 14);
    // Подпись не должна залезать на платформу и лежащий на ней мяч — уводим её под платформу
    const zoneTop = paddle.y - ball.r * 2 - 2;
    const zoneBottom = paddle.y + paddle.h;
    if (labelY > zoneTop && labelY - 14 < zoneBottom) {
        labelY = zoneBottom + 18 <= H - 2 ? zoneBottom + 18 : zoneTop - 2;
    }
    ctx.fillText(`ИИКОРП ▲ ${formatCap(score)}`, labelX, labelY);
}

function drawBrick(b) {
    const protectedBoss = b.boss && isBossProtected();
    ctx.globalAlpha = protectedBoss ? 0.55 : 1;

    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    if (b.flash > 0) {
        ctx.globalAlpha = (protectedBoss ? 0.55 : 1) * Math.min(1, b.flash / 8);
        ctx.fillStyle = b.boss ? COLORS.corp : '#ffffff';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.globalAlpha = protectedBoss ? 0.55 : 1;
    }

    if (b.cracks.length) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.lineWidth = 1.5;
        for (const crack of b.cracks) {
            ctx.beginPath();
            crack.forEach(([rx, ry], i) => {
                const x = b.x + rx * b.w;
                const y = b.y + ry * b.h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
    }

    ctx.fillStyle = COLORS.brickText;
    ctx.font = `700 ${b.font}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = b.font * 1.1;
    const startY = b.y + b.h / 2 - (lineH * (b.lines.length - 1)) / 2;
    b.lines.forEach((line, i) => {
        ctx.fillText(line, b.x + b.w / 2, startY + i * lineH + 1, b.w - 6);
    });

    // Клиенты стали целью — пульсирующая рамка
    if (b.boss && !protectedBoss && gameState === 'PLAYING') {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 150);
        ctx.strokeStyle = COLORS.corp;
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    }
    ctx.globalAlpha = 1;
}

function drawPaddle() {
    ctx.fillStyle = COLORS.corp;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = '#000000';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isMonopoly ? 'ИИ‑КОРП · МОНОПОЛИЯ' : 'ИИ‑КОРП', paddle.x + paddle.w / 2, paddle.y + paddle.h / 2 + 1);
}

function drawBall() {
    ctx.font = `${ball.r * 2.3}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🤖', ball.x, ball.y + ball.r * 0.1);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of popups) {
        const x = clamp(p.x, 80, W - 80);
        ctx.globalAlpha = Math.min(1, p.life * 2);

        ctx.font = `italic 400 16px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(p.text, x, p.y);
        ctx.fillStyle = COLORS.corp;
        ctx.fillText(p.text, x, p.y);

        if (p.sub) {
            ctx.font = `700 12px ${FONT}`;
            ctx.strokeText(p.sub, x, p.y + 17);
            ctx.fillStyle = COLORS.text;
            ctx.fillText(p.sub, x, p.y + 17);
        }
    }
    ctx.globalAlpha = 1;
}

function drawServeText() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = paddle.y - 150;

    if (message) {
        ctx.font = `700 16px ${FONT}`;
        ctx.fillStyle = COLORS.text;
        for (const line of wrapLines(message.title, W - 48)) {
            ctx.fillText(line, W / 2, y);
            y += 22;
        }
        y += 4;
        ctx.font = `italic 400 14px ${FONT}`;
        ctx.fillStyle = COLORS.corp;
        for (const line of wrapLines(message.text, W - 48)) {
            ctx.fillText(line, W / 2, y);
            y += 20;
        }
    }

    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 300);
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('Тап или пробел — запустить нейросеть', W / 2, paddle.y - 40);
    ctx.globalAlpha = 1;
}

function render() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawChart();
    for (const b of bricks) {
        if (b.alive) drawBrick(b);
    }
    drawPaddle();
    if (gameState === 'START' || gameState === 'SERVE' || gameState === 'PLAYING') {
        drawBall();
    }
    drawParticles();
    drawPopups();

    ctx.restore();

    if (gameState === 'SERVE') drawServeText();
}

// --- LOOP ---
// Цикл крутится всегда: за экранами меню виден мир, который предстоит разрушить.

function loop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const dt = Math.min((currentTime - lastTime) / (1000 / 60), 3); // 1.0 при 60 fps
    lastTime = currentTime;

    update(dt);
    render();
    requestAnimationFrame(loop);
}

// --- CONTROLS ---

function handleAction() {
    if (gameState === 'START') {
        initGame();
    } else if (gameState === 'SERVE') {
        launchBall();
    } else if (gameState === 'GAMEOVER' && Date.now() - lastEndTime > 1000) {
        initGame();
    }
    // На экране победы — только кнопка, чтобы случайный тап не сбил скриншот
}

function canvasX(clientX) {
    return clientX - canvas.getBoundingClientRect().left;
}

window.addEventListener('pointermove', (e) => {
    pointerX = canvasX(e.clientX);
});

window.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button')) return;
    pointerX = canvasX(e.clientX);
    handleAction();
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keys.left = true;
        pointerX = null;
        e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keys.right = true;
        pointerX = null;
        e.preventDefault();
    } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) handleAction();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

// Мобильные браузеры включают звук только по touchend/click
window.addEventListener('touchend', unlockAudio);
window.addEventListener('click', unlockAudio);

// Не даём странице скроллиться и показывать меню при долгом тапе
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function onButton(id, action) {
    document.getElementById(id).addEventListener('click', (e) => {
        e.stopPropagation();
        e.currentTarget.blur(); // чтобы пробел не «нажимал» кнопку повторно
        action();
    });
}
onButton('start-btn', initGame);
onButton('restart-btn', initGame);
onButton('win-restart-btn', initGame);

// ЧИТ: 5 кликов по заголовку — режим монополии (платформа на всю ширину)
let titleClicks = 0;
titleEl.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    titleClicks++;
    if (titleClicks >= 5) {
        titleClicks = 0;
        isMonopoly = !isMonopoly;
        layout(W, H);
        cheatNoteEl.innerText = isMonopoly
            ? 'Режим монополии включён. Антимонопольная служба распущена.'
            : 'Режим монополии выключен. Конкуренция вернулась.';
        cheatNoteEl.classList.remove('hidden');
    }
});

window.addEventListener('resize', resize);

// --- START ---

buildBricks();
resize();
paddle.x = (W - paddle.w) / 2;
placeBallOnPaddle();
chart = [score];

// Шрифт с кириллицей грузится асинхронно — после загрузки заново подгоняем подписи
if (document.fonts && document.fonts.load) {
    Promise.all([
        document.fonts.load(`700 14px ${FONT}`, 'Дизрапт'),
        document.fonts.load(`italic 400 14px ${FONT}`, 'Дизрапт')
    ]).then(() => layout(W, H)).catch(() => {});
}

requestAnimationFrame(loop);
