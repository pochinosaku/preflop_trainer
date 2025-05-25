const POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
let deck = [];
for (const rank of RANKS) {
    for (const suit of SUITS) {
        deck.push(rank + suit);
    }
}

let heroHand = "";
let heroPosition = "";
let isAnswered = false;
let questionNum = 0;
let correctAnswerNum = 0;
let successiveCorrectNum = 0;

const nextButton = document.getElementById("nextButton");

// Function to pick two random cards from cards directory
function pickRandomTwoCards() {
    let index1 = Math.floor(Math.random() * deck.length);
    let index2;
    do {
        index2 = Math.floor(Math.random() * deck.length);
    } while (index1 === index2);

    // 大きいランクのカードが必ず左側に表示されるように
    const minIndex = Math.min(index1, index2);
    const maxIndex = Math.max(index1, index2);
    const randomCard1 = deck[minIndex];
    const randomCard2 = deck[maxIndex];

    const handId = `${randomCard1}${randomCard2}`; // ハンドIDはカードの組み合わせをそのまま連結したもの
    // console.log("handId: ", handId);
    return [randomCard1, randomCard2, handId];
}

function pickHeroHand() {
    const [heroCard1, heroCard2, hand] = pickRandomTwoCards();

    document.getElementById("image1").src = `images/cards/${heroCard1}.png`;
    document.getElementById("image1").alt = heroCard1;
    document.getElementById("image2").src = `images/cards/${heroCard2}.png`;
    document.getElementById("image2").alt = heroCard2;

    return hand;
}


// 引数に禁止するポジションを指定
function pickRandomPosition(...position) {
    const forbiddenPosition = Array.from(position);
    forbiddenPosition.push("");
    let tmpPosition = "";

    while (forbiddenPosition.includes(tmpPosition) || tmpPosition === "") {
        // ランダムなインデックスを生成
        const randomIndex = Math.floor(Math.random() * POSITIONS.length);
        tmpPosition = POSITIONS[randomIndex];
    }
    const heroPosition = tmpPosition;

    const restPlayersNum = POSITIONS.length - POSITIONS.indexOf(heroPosition) - 1;
    document.getElementById("position").textContent = `${heroPosition}`
    document.getElementById("restPlayersNum").textContent = `${restPlayersNum}`;
    return heroPosition;
}

// 当該 spot でのハンドレンジのパスの集合を取得。openについてのみ。3betレンジについては修正の必要あり。
function getFilePaths(position) {
    const foldingPlayerNum = POSITIONS.indexOf(position);
    const filePathPrefix = "f-".repeat(foldingPlayerNum);
    const foldRangePath = `json/${filePathPrefix}f.json`;
    if (position === "SB") {
        const callRangePath = `json/${filePathPrefix}c.json`;
        const raiseRangePath = `json/${filePathPrefix}r3.json`;
        return { fold: foldRangePath, raise: raiseRangePath, call: callRangePath };
    }
    const raiseRangePath = `json/${filePathPrefix}r2.5.json`;
    return { fold: foldRangePath, raise: raiseRangePath };
}

// fetch APIを使用して、指定されたURLからJSONデータを取得する関数
async function getJson(URL) {
    try {
        const response = await fetch(URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // console.log('Fetched JSON:', data);
        return data;
    } catch (error) {
        console.error('Error fetching JSON:', error);
    }
}

// 各ハンドのアクションを取得
async function foldComboGTO(position, hand) {
    const filePath = getFilePaths(position);
    const data = await getJson(filePath.fold);
    if (data[hand]) {
        const foldCombo = data[hand];
        return parseFloat(foldCombo);
    } else {
        return 0;
    }
}

async function raiseComboGTO(position, hand) {
    const filePath = getFilePaths(position);
    const data = await getJson(filePath.raise);
    if (data[hand]) {
        const raiseCombo = data[hand];
        return parseFloat(raiseCombo);
    } else {
        return 0;
    }
}

async function callComboGTO(position, hand) {
    const filePath = getFilePaths(position);
    if (filePath.call === undefined) {
        return 0;
    }
    const data = await getJson(filePath.call);
    if (data[hand]) {
        const callCombo = data[hand];
        return parseFloat(callCombo);
    } else {
        return 0;
    }
}

async function actionFreqGTO(position, hand) {
    const foldCombo = await foldComboGTO(position, hand);
    const raiseCombo = await raiseComboGTO(position, hand);
    const callCombo = await callComboGTO(position, hand);
    const totalCombo = foldCombo + raiseCombo + callCombo;
    // console.log("foldCombo: ", foldCombo, "raiseCombo: ", raiseCombo, "callCombo: ", callCombo, "totalCombo: ", totalCombo);
    const actionFreq = {
        fold: foldCombo / totalCombo,
        raise: raiseCombo / totalCombo,
        call: callCombo / totalCombo
    };
    return actionFreq;
}

async function printAnswer(position, hand, action) {
    if (isAnswered) {
        return;
    }

    const actionFreq = await actionFreqGTO(position, hand);
    console.log("actionFreq: ", actionFreq);
    const mostFrequentAction = Object.keys(actionFreq).reduce((a, b) => actionFreq[a] > actionFreq[b] ? a : b);

    let evaluation = "";
    if (action === mostFrequentAction) {
        evaluation = "良いですね！正解です！！";
        if (action == "fold") {
            evaluation += "弱いハンドはしっかり降りましょう！"
        }
        correctAnswerNum++;
        successiveCorrectNum++;
    } else if (actionFreq[action] >= 0.2) {
        evaluation = "それなりに正解です！もっと頻度の高いアクションがあります。";
        correctAnswerNum++;
        successiveCorrectNum++;
    } else {
        if (action == "call") {
            evaluation = "不正解です。Open raise せずに call で参加することを limp (リンプ) といいます。軽い気持ちで limp をすると初心者だと透けます。やめましょう。";
        } else {
            evaluation = "不正解です！";
        }
        successiveCorrectNum = 0;
    }
    const actionFreqText = "このハンドのアクション頻度 Fold: " + (actionFreq.fold * 100).toFixed(1) + "%, Call: " + (actionFreq.call * 100).toFixed(1) + "%, Raise: " + (actionFreq.raise * 100).toFixed(1) + "%";
    
    document.getElementById("answer-container").textContent = evaluation + `（あなたのアクション：${action}）`;
    document.getElementById("frequency-container").textContent = actionFreqText;

    isAnswered = true;
    questionNum++;
}

function clearAnswer() {
    document.getElementById("answer-container").textContent = "";
    document.getElementById("frequency-container").textContent = "";
}


async function startNewHand() {
    document.getElementById("successive-correct-answer").textContent = successiveCorrectNum;
    document.getElementById("question-num").textContent = questionNum;
    document.getElementById("correct-num").textContent = correctAnswerNum;
    heroHand = pickHeroHand();
    heroPosition = pickRandomPosition("BB");          // BB を除外
    clearAnswer();
    isAnswered = false;
    console.log("heroHand:", heroHand, "heroPosition:", heroPosition);
    console.log("アクション頻度: ", await actionFreqGTO(heroPosition, heroHand));
}

// ページが読み込まれたときに実行される処理
window.addEventListener('load', () => {
    startNewHand();
});

document.getElementById("nextButton").addEventListener("click", () => {
    if (!isAnswered) {
        return;
    }
    startNewHand();
});

// enterキーでも次のハンドに進む
document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && isAnswered) {
        startNewHand();
    }
});

// キーが押されて解答されたときの処理
document.addEventListener("keydown", (event) => {
    if (event.key === "R" || event.key === "r") {
        printAnswer(heroPosition, heroHand, "raise");
    } else if (event.key === "C" || event.key === "c") {
        printAnswer(heroPosition, heroHand, "call");
    } else if (event.key === "F" || event.key === "f") {
        printAnswer(heroPosition, heroHand, "fold");
    }
});

// アクションのボタンがクリックされたときの処理
document.getElementById("foldButton").addEventListener("click", async () => {
    await printAnswer(heroPosition, heroHand, "fold");
});
document.getElementById("raiseButton").addEventListener("click", async () => {
    await printAnswer(heroPosition, heroHand, "raise");
});
document.getElementById("callButton").addEventListener("click", async () => {
    await printAnswer(heroPosition, heroHand, "call");
});
