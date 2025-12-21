const quizData = [
    {
        type: 'image',
        question: "Где настоящий Cэм Альтман?",
        options: [
            "assets/img_1.jpg",
            "assets/img_2.jpg",
            "assets/img_3.jpg",
            "assets/img_4.jpg"
        ],
        correct: 2
    },
    {
        type: 'text',
        question: "Что означает CSS?",
        options: ["Computer Style Sheets", "Cascading Style Sheets", "Creative Style Sheets", "Colorful Style Sheets"],
        correct: 1
    },
    {
        type: 'image',
        question: "Где изображен логотип HTML5?",
        options: [
            "https://placehold.co/400x400/orange/white?text=HTML5",
            "https://placehold.co/400x400/blue/white?text=CSS3",
            "https://placehold.co/400x400/yellow/black?text=JS",
            "https://placehold.co/400x400/green/white?text=Node"
        ],
        correct: 0
    },
    {
        type: 'image',
        question: "Выберите кота",
        options: [
            "https://placehold.co/400x400/red/white?text=Собака",
            "https://placehold.co/400x400/purple/white?text=Кот",
            "https://placehold.co/400x400/brown/white?text=Хомяк",
            "https://placehold.co/400x400/gray/white?text=Попугай"
        ],
        correct: 1
    }
];

let currentStep = 0;

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

    data.options.forEach((option, index) => {
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
    });
}

function checkAnswer(idx) {
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
}
