const quizData = [
    {
        type: 'image',
        question: "Где настоящий Cэм Альтман?",
        options: [
            "assets/img_1.jpg",
            "assets/img_2.png",
            "assets/img_3.jpg",
            "assets/img_4.jpg"
        ],
        correct: 1
    },
    {
        type: 'image',
        question: "Где настоящая Скарлетт Йоханссон?",
        options: [
            "assets/img_6.webp",
            "assets/img_7.webp",
            "assets/img_5.webp",
            "assets/img_8.webp",
        ],
        correct: 2
    },
    {
        type: 'sound',
        question: "Где настоящий голос Скарлетт Йоханссон?",
        options: [
            "assets/voice_2.mp3",
            "assets/voice_1.mp3",
        ],
        correct: 0
    },
    {
        type: 'text',
        question: "Какой текст написан человеком?",
        options: [
            "Экономика делает движение вверх, и население испытывает большую радость от событий. Власти осуществляют деятельность для улучшения жизни людей в текущем периоде времени.", 
            "Правительство утвердило новый пакет реформ, направленных на стабилизацию ситуации в регионе. Эксперты уверены, что принятые меры помогут улучшить благосостояние граждан уже в ближайшем будущем.",
            "Разразившийся в кулуарах кризис грозит не просто перекроить политическую карту, а стать точкой невозврата для всей действующей администрации. То, что вчера казалось рядовым скандалом, сегодня рискует обрушить многолетние репутации за считаные часы.", 
            "Возмутительно, когда один человек может отнять у другого его труд, деньги, корову, лошадь, может отнять даже его сына, дочь, — это возмутительно, но насколько возмутительнее то, что может один человек отнять у другого его душу, может заставить его сделать то, что губит его духовное «я», лишает его его духовного блага."
        ],
        correct: 3
    }
];

let currentStep = 0;
let currentPreviewAudio = null;

const correctSnd = document.getElementById('sound-correct');
const wrongSnd = document.getElementById('sound-wrong');
const bgMusic = document.getElementById('sound-bg');

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const questionEl = document.getElementById('question');
const optionsContainer = document.getElementById('options-container');

function startGame() {
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    bgMusic.volume = 0.5;
    bgMusic.play().then(() => {
        console.log("Music started playing");
    }).catch(e => {
        console.error("Music play failed:", e);
        if(e.name === 'NotAllowedError') {
             alert("Пожалуйста, нажмите на экран, чтобы включить музыку");
             document.body.addEventListener('click', () => {
                 bgMusic.play();
             }, { once: true });
        }
    });
    
    currentStep = 0;
    loadQuestion();
}

function loadQuestion() {
    if (currentStep >= quizData.length) {
        finishGame();
        return;
    }

    const data = quizData[currentStep];
    questionEl.textContent = data.question;
    optionsContainer.innerHTML = '';

    if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio = null;
    }

    if (data.type === 'sound') {
        bgMusic.volume = 0.1;
    } else {
        bgMusic.volume = 0.5;
    }

    data.options.forEach((option, index) => {
        if (data.type === 'sound') {
            const wrapper = document.createElement('div');
            wrapper.classList.add('option-wrapper');

            const item = document.createElement('div');
            item.classList.add('option-item');
            
            const icon = document.createElement('div');
            icon.classList.add('play-icon');
            icon.textContent = '▶';
            item.appendChild(icon);

            item.onclick = () => {
                if (currentPreviewAudio) {
                    currentPreviewAudio.pause();
                    currentPreviewAudio.currentTime = 0;
                }
                currentPreviewAudio = new Audio(option);
                currentPreviewAudio.play().catch(e => console.error("Audio play failed", e));
            };

            const btn = document.createElement('button');
            btn.textContent = 'Выбрать';
            btn.classList.add('select-btn');
            btn.onclick = () => checkAnswer(index);

            wrapper.appendChild(item);
            wrapper.appendChild(btn);
            optionsContainer.appendChild(wrapper);
        } else {
            const item = document.createElement('div');
            item.classList.add('option-item');
            item.onclick = () => checkAnswer(index);

            if (data.type === 'image') {
                const img = document.createElement('img');
                img.src = option;
                img.alt = `Option ${index + 1}`;
                item.appendChild(img);
            } else {
                const text = document.createElement('span');
                text.textContent = option;
                item.appendChild(text);
            }

            optionsContainer.appendChild(item);
        }
    });
}

function checkAnswer(idx) {
    if (currentPreviewAudio) {
        currentPreviewAudio.pause();
    }

    if (idx === quizData[currentStep].correct) {
        correctSnd.currentTime = 0;
        correctSnd.play().catch(e => console.error(e));
        
        currentStep++;
        setTimeout(loadQuestion, 500); 
    } else {
        wrongSnd.currentTime = 0;
        wrongSnd.play().catch(e => console.error(e));
    }
}

function finishGame() {
    alert("Поздравляем! Вы прошли все уровни!");
    returnToMenu();
}

function returnToMenu() {
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    currentStep = 0;
    bgMusic.pause();
    bgMusic.currentTime = 0;
    if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio = null;
    }
}
