// Kaiji 17-Ho Online Version
// Firebase Realtime Database Implementation

const SUITS = ['m', 'p', 's', 'z'];
const HONOR_NAMES = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCKQvPfqqu_WDfWrpXwsYMwUN-BvgsXDjM",
  authDomain: "fanmade-17ho.firebaseapp.com",
  projectId: "fanmade-17ho",
  storageBucket: "fanmade-17ho.firebasestorage.app",
  messagingSenderId: "146553166120",
  appId: "1:146553166120:web:130d8464d5d7568268581d",
  measurementId: "G-SFHCYM4L0R"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Utilities ---
function tileToString(tile) {
    if (!tile || !tile.suit) return '';
    if (tile.suit === 'z') return HONOR_NAMES[tile.val];
    const kanjiNums = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
    const suitNames = { m: '萬', p: '筒', s: '索' };
    return kanjiNums[tile.val] + suitNames[tile.suit];
}

function generateShuffledDeck() {
    let deck = [];
    ['m', 'p', 's'].forEach(suit => {
        for (let v = 1; v <= 9; v++) {
            for (let i = 0; i < 4; i++) {
                deck.push({ val: v, suit: suit, id: Math.random().toString(36).substr(2, 9) });
            }
        }
    });
    for (let v = 1; v <= 7; v++) {
        for (let i = 0; i < 4; i++) {
            deck.push({ val: v, suit: 'z', id: Math.random().toString(36).substr(2, 9) });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

class MahjongEvaluator {
    evaluate(tiles14, winningTile) {
        const counts = this.getCounts(tiles14);
        if (this.checkChiitoitsu(counts)) return { isWinning: true, yakuList: ["七対子"], score: 2000 };
        const kokushiResult = this.checkKokushi(counts);
        if (kokushiResult.isWinning) return { isWinning: true, yakuList: ["国士無双"], score: 32000 };
        const decompositions = this.findAllDecompositions(counts);
        if (decompositions.length === 0) return { isWinning: false, yakuList: [], score: 0 };
        let bestResult = { isWinning: false, yakuList: [], score: -1 };
        for (const deco of decompositions) {
            const yakuList = this.checkYaku(deco, winningTile, tiles14);
            const score = this.calculateSimpleScore(yakuList);
            if (score > bestResult.score) bestResult = { isWinning: true, yakuList, score };
        }
        if (!bestResult.isWinning || bestResult.yakuList.length === 0) return { isWinning: false, yakuList: [], score: 0 };
        return bestResult;
    }
    getCounts(tiles) {
        const counts = {};
        tiles.forEach(t => { const key = t.suit + t.val; counts[key] = (counts[key] || 0) + 1; });
        return counts;
    }
    checkChiitoitsu(counts) {
        let pairs = 0;
        for (const key in counts) { if (counts[key] >= 2) pairs++; }
        return pairs === 7;
    }
    checkKokushi(counts) {
        const orphans = ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];
        let pairFound = false;
        for (const o of orphans) {
            if (!counts[o]) return { isWinning: false };
            if (counts[o] > 1) { if (pairFound) return { isWinning: false }; pairFound = true; }
        }
        return { isWinning: true };
    }
    findAllDecompositions(counts) {
        const results = [];
        const keys = Object.keys(counts).sort();
        for (const key of keys) {
            if (counts[key] >= 2) {
                const nextCounts = { ...counts };
                nextCounts[key] -= 2;
                const melds = [];
                this.decomposeRecursive(nextCounts, melds, results, key);
            }
        }
        return results;
    }
    decomposeRecursive(counts, currentMelds, allResults, pairKey) {
        const keys = Object.keys(counts).filter(k => counts[k] > 0).sort();
        if (keys.length === 0) { allResults.push({ pair: pairKey, melds: [...currentMelds] }); return; }
        const key = keys[0];
        const suit = key[0];
        const val = parseInt(key.slice(1));
        if (counts[key] >= 3) {
            counts[key] -= 3; currentMelds.push({ type: 'triplet', tile: key });
            this.decomposeRecursive(counts, currentMelds, allResults, pairKey);
            currentMelds.pop(); counts[key] += 3;
        }
        if (suit !== 'z') {
            const next1 = suit + (val + 1), next2 = suit + (val + 2);
            if (counts[next1] > 0 && counts[next2] > 0) {
                counts[key]--; counts[next1]--; counts[next2]--;
                currentMelds.push({ type: 'sequence', tiles: [key, next1, next2] });
                this.decomposeRecursive(counts, currentMelds, allResults, pairKey);
                currentMelds.pop(); counts[key]++; counts[next1]++; counts[next2]++;
            }
        }
    }
    checkYaku(deco, winningTile, allTiles) {
        const yaku = [];
        const { pair, melds } = deco;
        const allTileKeys = allTiles.map(t => t.suit + t.val);
        const counts = this.getCounts(allTiles);
        if (this.checkSuuankou(melds)) yaku.push("四暗刻");
        if (this.checkDaisangen(counts)) yaku.push("大三元");
        if (this.checkChinitsu(allTileKeys)) yaku.push("清一色");
        if (this.checkHonitsu(allTileKeys)) { if (!yaku.includes("清一色")) yaku.push("混一色"); }
        if (this.checkIttsu(melds)) yaku.push("一気通貫");
        if (this.checkTanyao(allTileKeys)) yaku.push("断幺九");
        if (this.checkYakuhai(melds)) yaku.push("役牌");
        if (this.checkPinfu(deco, winningTile, allTiles)) yaku.push("平和");
        if (this.checkToitoi(melds)) yaku.push("対々和");
        if (this.checkXiaosangen(counts)) yaku.push("小三元");
        return yaku;
    }
    checkTanyao(keys) { return keys.every(k => { if (k[0] === 'z') return false; const v = parseInt(k.slice(1)); return v >= 2 && v <= 8; }); }
    checkYakuhai(melds) { return melds.some(m => m.type === 'triplet' && m.tile[0] === 'z'); }
    checkPinfu(deco, winningTile, allTiles) {
        const { pair, melds } = deco;
        if (melds.some(m => m.type === 'triplet')) return false;
        if (pair[0] === 'z') return false;
        return this.analyzeWait(allTiles, winningTile) === 'Ryumen';
    }
    checkChinitsu(keys) { const firstSuit = keys[0][0]; return firstSuit !== 'z' && keys.every(k => k[0] === firstSuit); }
    checkHonitsu(keys) { const firstSuit = keys[0][0]; if (firstSuit === 'z') return false; return keys.every(k => k[0] === firstSuit || k[0] === 'z'); }
    checkToitoi(melds) { return melds.every(m => m.type === 'triplet'); }
    checkIttsu(melds) {
        const suits = ['m', 'p', 's'];
        for (const s of suits) {
            const sMelds = melds.filter(m => m.type === 'sequence' && m.tiles[0][0] === s);
            if (sMelds.length >= 3) {
                const vals = sMelds.flatMap(m => m.tiles.map(t => parseInt(t.slice(1))));
                const uniqueVals = new Set(vals);
                if (uniqueVals.size === 9) return true;
            }
        }
        return false;
    }
    checkDaisangen(counts) { return counts['z5'] >= 3 && counts['z6'] >= 3 && counts['z7'] >= 3; }
    checkXiaosangen(counts) { const honors = ['z5', 'z6', 'z7']; return honors.filter(h => counts[h] >= 3).length >= 2; }
    checkSuuankou(melds) { return melds.every(m => m.type === 'triplet'); }
    analyzeWait(tiles14, winningTile) {
        const winKey = winningTile.suit + winningTile.val;
        const tiles13 = [...tiles14];
        const idx = tiles13.findIndex(t => (t.suit + t.val) === winKey);
        if (idx !== -1) tiles13.splice(idx, 1);
        const counts = this.getCounts(tiles13);
        const winSuit = winKey[0];
        const winVal = parseInt(winKey.slice(1));
        if (winSuit === 'z') return 'Tanki';
        const hasLow = (counts[winSuit + (winVal - 1)] > 0 && counts[winSuit + (winVal - 2)] > 0);
        const hasHigh = (counts[winSuit + (winVal + 1)] > 0 && counts[winSuit + (winVal + 2)] > 0);
        if (hasLow || hasHigh) return 'Ryumen';
        if (counts[winSuit + (winVal - 1)] > 0 && counts[winSuit + (winVal + 1)] > 0) return 'Kan-chan';
        const isPen = (winVal === 1 && counts[winSuit + '2'] > 0 && counts[winSuit + '3'] > 0) ||
                      (winVal === 9 && counts[winSuit + '8'] > 0 && counts[winSuit + '7'] > 0) ||
                      (winVal === 2 && counts[winSuit + '1'] > 0 && counts[winSuit + '3'] > 0) ||
                      (winVal === 8 && counts[winSuit + '9'] > 0 && counts[winSuit + '7'] > 0);
        if (isPen) return 'Pen-chan';
        return 'Tanki';
    }
    getWaitingTiles(tiles13) {
        const waitingTiles = new Set();
        const allPossibleTiles = [];
        ['m', 'p', 's'].forEach(suit => { for (let v = 1; v <= 9; v++) allPossibleTiles.push({ suit, val: v }); });
        for (let v = 1; v <= 7; v++) allPossibleTiles.push({ suit: 'z', val: v });
        for (const tile of allPossibleTiles) {
            const testHand = [...tiles13, tile];
            const result = this.evaluate(testHand, tile);
            if (result.isWinning) waitingTiles.add(tile.suit + tile.val);
        }
        return Array.from(waitingTiles);
    }
    calculateSimpleScore(yakuList) {
        let total = 0;
        const weights = { "国士無双": 32000, "四暗刻": 32000, "大三元": 32000, "清一色": 16000, "小三元": 12000, "一気通貫": 4000, "対々和": 3000, "混一色": 2000, "断幺九": 1000, "平和": 1000, "役牌": 1000, "七対子": 2000 };
        yakuList.forEach(y => { total += (weights[y] || 1000); });
        return total;
    }
}

// --- Game State & Variables ---
let gameState = {
    gameMode: '1p',
    myPlayerNum: 1,
    oppPlayerNum: 2,
    round: 1,
    turn: 1,
    maxTurns: 17,
    p1Points: 25000,
    p2Points: 25000,
    myPool: [],
    myHand: [],
    myWall: [],
    myRiver: [],
    oppRiver: [],
    oppWallCount: 17,
    drawnTile: null,
    gameOver: false,
    builderMode: 'hand',
    activePlayer: 1,
    currentYaku: null,
    roomId: null,
    userId: null
};

let screens = {};
const evaluator = new MahjongEvaluator();

document.addEventListener('DOMContentLoaded', () => {
    screens = {
        title: document.getElementById('title-screen'),
        setup: document.getElementById('setup-screen'),
        battle: document.getElementById('battle-screen'),
        rules: document.getElementById('rules-modal'),
        privacy: document.getElementById('privacy-screen'),
        result: document.getElementById('result-modal')
    };

    // Generate a random room ID for the host
    const randomRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('my-room-id').textContent = randomRoomId;

    // UI Events
    document.getElementById('join-room-btn').addEventListener('click', joinRoom);
    document.getElementById('start-1p-btn').addEventListener('click', () => {
        gameState.gameMode = '1p';
        gameState.myPlayerNum = 1;
        initBuilder();
        switchScreen('setup');
    });
    document.getElementById('rules-btn').addEventListener('click', () => screens.rules.classList.add('active'));
    document.getElementById('close-rules-btn').addEventListener('click', () => screens.rules.classList.remove('active'));
    document.getElementById('clear-deck-btn').addEventListener('click', resetCurrentPoolAllocation);
    document.getElementById('sort-pool-btn').addEventListener('click', sortCurrentPool);
    document.getElementById('auto-distribute-btn').addEventListener('click', autoDistributeCurrentPlayer);
    document.getElementById('mode-hand-btn').addEventListener('click', () => setBuilderMode('hand'));
    document.getElementById('mode-wall-btn').addEventListener('click', () => setBuilderMode('wall'));
    document.getElementById('confirm-deck-btn').addEventListener('click', handleDeckConfirm);
    document.getElementById('privacy-ready-btn').addEventListener('click', handlePrivacyReady);
    document.getElementById('draw-btn').addEventListener('click', playerDraw);
    document.getElementById('ron-btn').addEventListener('click', playerRon);
    document.getElementById('tsumo-btn').addEventListener('click', playerTsumo);
    document.getElementById('next-match-btn').addEventListener('click', resetMatch);
    document.getElementById('restart-game-btn').addEventListener('click', () => {
        screens.result.classList.remove('active');
        switchScreen('title');
    });
});

// --- Firebase Integration ---

async function joinRoom() {
    const roomIDInput = document.getElementById('remote-room-id').value.toUpperCase();
    if (!roomIDInput) return;

    const statusEl = document.getElementById('connection-status');
    statusEl.textContent = "接続中...";

    gameState.gameMode = 'online';
    gameState.roomId = roomIDInput;
    gameState.userId = 'user_' + Math.random().toString(36).substr(2, 9);

    // Determine if we are the first person in the room (Host) or second (Guest)
    const roomRef = db.ref('rooms/' + gameState.roomId);
    const snapshot = await roomRef.once('value');
    const data = snapshot.val();

    if (!data) {
        // We are the host
        gameState.myPlayerNum = 1;
        gameState.oppPlayerNum = 2;
        await roomRef.set({
            public: {
                status: 'waiting',
                activePlayer: 1,
                turn: 1,
                round: 1,
                p1River: [],
                p2River: [],
                p1Points: 25000,
                p2Points: 25000,
                gameOver: false
            },
            players: {
                [gameState.userId]: { role: 1, ready: false }
            }
        });
        statusEl.textContent = "ルーム作成完了！相手を待っています...";
    } else {
        // We are the guest
        gameState.myPlayerNum = 2;
        gameState.oppPlayerNum = 1;
        await roomRef.child('players').update({
            [gameState.userId]: { role: 2, ready: false }
        });
        statusEl.textContent = "ルームに参加しました！";
    }

    // Start listening for game state changes
    setupFirebaseListener();
    initBuilder();
    switchScreen('setup');
}

function setupFirebaseListener() {
    const roomRef = db.ref('rooms/' + gameState.roomId);

    // Watch public game state
    roomRef.child('public').on('value', snapshot => {
        const data = snapshot.val();
        if (!data) return;

        gameState.activePlayer = data.activePlayer;
        gameState.turn = data.turn;
        gameState.round = data.round;
        gameState.p1Points = data.p1Points;
        gameState.p2Points = data.p2Points;
        gameState.oppRiver = (gameState.myPlayerNum === 1) ? data.p2River : data.p1River;
        gameState.gameOver = data.gameOver;

        updateBattleUI();

        if (data.gameOver) {
            // Handle game over via DB signal if necessary
        }
    });

    // Watch player readiness for battle start
    roomRef.child('players').on('value', snapshot => {
        const players = snapshot.val();
        if (!players) return;

        const p1Ready = Object.values(players).find(p => p.role === 1)?.ready;
        const p2Ready = Object.values(players).find(p => p.role === 2)?.ready;

        if (p1Ready && p2Ready && screens.setup.classList.contains('active')) {
            startBattle();
        }
    });
}

// --- Game Logic (Firebase Modified) ---

function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s && s !== screens.rules && s !== screens.privacy && s !== screens.result) {
            s.classList.remove('active');
        }
    });
    if (screens[screenName]) screens[screenName].classList.add('active');
}

function initBuilder() {
    const deck = generateShuffledDeck();
    gameState.myPool = deck.slice(0, 30);
    gameState.myHand = [];
    gameState.myWall = [];
    gameState.builderMode = 'hand';

    const headerTitle = document.getElementById('setup-header-title');
    if (headerTitle) {
        headerTitle.textContent = gameState.gameMode === 'online'
            ? `牌構築フェーズ - プレイヤー ${gameState.myPlayerNum}`
            : `牌構築フェーズ (30枚から配分)`;
    }
    updateBuilderUI();
    triggerZawa();
}

function setBuilderMode(mode) {
    gameState.builderMode = mode;
    document.getElementById('mode-hand-btn').classList.toggle('active', mode === 'hand');
    document.getElementById('mode-wall-btn').classList.toggle('active', mode === 'wall');
}

function resetCurrentPoolAllocation() {
    gameState.myPool = [...gameState.myPool, ...gameState.myHand, ...gameState.myWall];
    gameState.myHand = [];
    gameState.myWall = [];
    sortCurrentPool();
    updateBuilderUI();
}

function sortCurrentPool() {
    const suitOrder = { 'm': 1, 'p': 2, 's': 3, 'z': 4 };
    gameState.myPool.sort((a, b) => {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
        return a.val - b.val;
    });
    updateBuilderUI();
}

function autoDistributeCurrentPlayer() {
    resetCurrentPoolAllocation();
    gameState.myHand.push(...gameState.myPool.splice(0, 13));
    gameState.myWall.push(...gameState.myPool.splice(0, 17));
    updateBuilderUI();
}

function updateBuilderUI() {
    const pool = gameState.myPool;
    const hand = gameState.myHand;
    const wall = gameState.myWall;

    document.getElementById('hand-count').textContent = hand.length;
    document.getElementById('wall-count').textContent = wall.length;
    document.getElementById('pool-count').textContent = pool.length;

    const handContainer = document.getElementById('setup-hand-tiles');
    handContainer.innerHTML = '';
    hand.forEach((t, idx) => {
        const el = createTileElement(t);
        el.addEventListener('click', () => { hand.splice(idx, 1); pool.push(t); updateBuilderUI(); });
        handContainer.appendChild(el);
    });

    const wallContainer = document.getElementById('setup-wall-tiles');
    wallContainer.innerHTML = '';
    wall.forEach((t, idx) => {
        const el = createTileElement(t);
        el.addEventListener('click', () => { wall.splice(idx, 1); pool.push(t); updateBuilderUI(); });
        wallContainer.appendChild(el);
    });

    const poolContainer = document.getElementById('tile-pool');
    poolContainer.innerHTML = '';
    pool.forEach((t, idx) => {
        const el = createTileElement(t);
        el.addEventListener('click', () => {
            if (gameState.builderMode === 'hand' && hand.length < 13) {
                pool.splice(idx, 1); hand.push(t);
                if (hand.length === 13) setBuilderMode('wall');
                updateBuilderUI();
            } else if (gameState.builderMode === 'wall' && wall.length < 17) {
                pool.splice(idx, 1); wall.push(t);
                updateBuilderUI();
            }
        });
        poolContainer.appendChild(el);
    });

    document.getElementById('confirm-deck-btn').disabled = !(hand.length === 13 && wall.length === 17);
}

async function handleDeckConfirm() {
    if (gameState.gameMode === 'online') {
        await db.ref(`rooms/${gameState.roomId}/players/${gameState.userId}`).update({
            ready: true
        });
        setDialogue("構築完了！相手の準備を待っています…");
        document.getElementById('confirm-deck-btn').disabled = true;
    } else {
        startBattle();
    }
}

function showPrivacyModal(title, msg, onReady) {
    document.getElementById('privacy-title').textContent = title;
    document.getElementById('privacy-msg').textContent = msg;
    screens.privacy.classList.add('active');
    gameState.pendingAction = onReady;
}

function handlePrivacyReady() {
    screens.privacy.classList.remove('active');
    if (gameState.pendingAction) {
        const action = gameState.pendingAction;
        gameState.pendingAction = null;
        action();
    }
}

function createTileElement(tile, isBack = false, isSmall = false) {
    const el = document.createElement('div');
    el.className = `tile ${tile.suit || ''} ${isBack ? 'tile-back' : ''} ${isSmall ? 'small' : ''}`;
    if (!isBack && tile.val) {
        const valText = tile.suit === 'z' ? '' : tile.val;
        el.innerHTML = `<span>${valText}</span><span class="kanji">${tileToString(tile)[0]}</span>`;
    }
    return el;
}

function startBattle() {
    if (gameState.gameMode === '1p') {
        const cpuDeck = generateShuffledDeck();
        gameState.oppHand = cpuDeck.slice(0, 13);
        gameState.oppWall = cpuDeck.slice(13, 30);
    }

    gameState.turn = 1;
    gameState.round = 1;
    gameState.myRiver = [];
    gameState.oppRiver = [];
    gameState.drawnTile = null;
    gameState.activePlayer = 1;
    gameState.gameOver = false;

    beginBattleScreen();
}

function beginBattleScreen() {
    switchScreen('battle');
    updateBattleUI();
    setDialogue("対局開始……！ 運命の17歩が始まる…！");
    triggerZawa();
}

function triggerZawa() {
    const overlay = document.getElementById('zawa-overlay');
    if (overlay) {
        overlay.classList.add('show');
        setTimeout(() => overlay.classList.remove('show'), 1200);
    }
}

function setDialogue(text) {
    const dialogueText = document.getElementById('dialogue-text');
    if (dialogueText) dialogueText.textContent = text;
}

function updateBattleUI() {
    const isMyTurn = (gameState.activePlayer === gameState.myPlayerNum);

    document.getElementById('round-display').textContent = `第${gameState.round}局`;
    document.getElementById('turn-display').textContent = `${gameState.turn} / ${gameState.maxTurns} 巡目`;

    const waitContainer = document.getElementById('p1-wait-container');
    const waitText = document.getElementById('p1-wait-tiles');
    if (waitContainer && waitText) {
        waitContainer.innerHTML = '';
        if (gameState.drawnTile) {
            waitText.textContent = "ツモ中...";
        } else {
            const waitingTiles = evaluator.getWaitingTiles(gameState.myHand);
            if (waitingTiles.length > 0) {
                waitText.textContent = "テンパイ！";
                waitingTiles.forEach(tileStr => {
                    const tileObj = { suit: tileStr[0], val: parseInt(tileStr.slice(1)) };
                    waitContainer.appendChild(createTileElement(tileObj, false, true));
                });
            } else {
                waitText.textContent = "なし";
            }
        }
    }

    const handContainer = document.getElementById('p1-hand-container');
    handContainer.innerHTML = '';
    gameState.myHand.forEach(t => handContainer.appendChild(createTileElement(t)));
    if (gameState.drawnTile) {
        const drawnEl = createTileElement(gameState.drawnTile);
        drawnEl.style.border = '2px solid #ffd700';
        handContainer.appendChild(drawnEl);
    }

    const myRiverEl = document.getElementById('p1-river-container');
    myRiverEl.innerHTML = '';
    gameState.myRiver.forEach(t => myRiverEl.appendChild(createTileElement(t, false, true)));

    const oppRiverEl = document.getElementById('p2-river-container');
    oppRiverEl.innerHTML = '';
    gameState.oppRiver.forEach(t => oppRiverEl.appendChild(createTileElement(t, false, true)));

    document.getElementById('p1-wall-count').textContent = gameState.myWall.length;
    document.getElementById('p2-wall-count').textContent = gameState.oppWallCount;

    document.getElementById('draw-btn').disabled = !isMyTurn || gameState.drawnTile !== null;
}

async function playerDraw() {
    if (gameState.gameOver) return;

    if (gameState.myWall.length === 0) {
        checkDrawGame();
        return;
    }

    gameState.drawnTile = gameState.myWall.shift();
    updateBattleUI();
    setDialogue(`ツモった！ 「${tileToString(gameState.drawnTile)}」`);

    const canTsumo = checkWinningHand([...gameState.myHand, gameState.drawnTile], gameState.drawnTile);
    document.getElementById('tsumo-btn').disabled = !canTsumo;
    document.getElementById('ron-btn').disabled = true;

    if (gameState.gameMode === 'online') {
        // 通知だけ送る（相手にツモったことを知らせる）
        // 実際の捨て牌は playerDiscard で送る
    }
}

async function playerDiscard(tile) {
    const discardTile = gameState.drawnTile || tile;
    gameState.myRiver.push(discardTile);
    gameState.drawnTile = null;
    updateBattleUI();

    if (gameState.gameMode === 'online') {
        const riverKey = (gameState.myPlayerNum === 1) ? 'p1River' : 'p2River';
        const currentRiver = gameState.myPlayerNum === 1 ? gameState.myRiver : gameState.oppRiver;

        // Firebaseに捨て牌を同期
        await db.ref(`rooms/${gameState.roomId}/public`).update({
            [riverKey]: currentRiver,
            activePlayer: gameState.oppPlayerNum,
            turn: (gameState.myPlayerNum === 1) ? gameState.turn : gameState.turn + 1
        });
    }

    if (gameState.gameMode === '1p') {
        gameState.activePlayer = 2;
        setTimeout(opponentTurn, 1500);
    } else {
        gameState.activePlayer = gameState.oppPlayerNum;
    }
}

function processOpponentDiscard(tile, playerId) {
    // この関数は Firebase listener 内で自動的に処理されるため、
    // 外部から直接呼ぶのではなく、updateBattleUI等で反映されます。
}

async function playerRon() {
    if (gameState.gameOver) return;
    triggerZawa();
    if (gameState.gameMode === 'online') {
        await db.ref(`rooms/${gameState.roomId}/public`).update({
            gameOver: true,
            winner: gameState.myPlayerNum
        });
    }
    endGame(gameState.myPlayerNum, `見事にロンあがり！勝利！！`);
}

async function playerTsumo() {
    if (gameState.gameOver) return;
    triggerZawa();
    if (gameState.gameMode === 'online') {
        await db.ref(`rooms/${gameState.roomId}/public`).update({
            gameOver: true,
            winner: gameState.myPlayerNum
        });
    }
    endGame(gameState.myPlayerNum, `完璧な自摸あがり！勝利！！`);
}

function checkWinningHand(tiles14, winningTile) {
    const result = evaluator.evaluate(tiles14, winningTile);
    if (result.isWinning) {
        gameState.currentYaku = result.yakuList;
        return true;
    }
    return false;
}

function checkDrawGame() {
    if (gameState.gameOver) return;
    triggerZawa();
    setDialogue("17巡完了——流局！");
    endGame(0, "引き分けとなりました。");
}

function endGame(winnerNum, message) {
    gameState.gameOver = true;
    document.getElementById('draw-btn').disabled = true;
    document.getElementById('ron-btn').disabled = true;
    document.getElementById('tsumo-btn').disabled = true;

    if (winnerNum !== 0 && gameState.currentYaku) {
        const cutinEl = document.getElementById('yaku-cutin');
        if (cutinEl) {
            cutinEl.innerHTML = `<div class="yaku-cutin-text">${gameState.currentYaku.join(' ・ ')}！！</div>`;
            cutinEl.classList.add('active');
            setTimeout(() => showFinalResult(winnerNum, message), 1500);
            return;
        }
    }
    showFinalResult(winnerNum, message);
}

function showFinalResult(winnerNum, message) {
    const resultModal = screens.result;
    const titleEl = document.getElementById('result-title');
    const msgEl = document.getElementById('result-message');
    if (winnerNum === gameState.myPlayerNum) {
        if (titleEl) { titleEl.textContent = "勝利 (VICTORY)"; titleEl.style.color = "#ffd700"; }
    } else if (winnerNum === 0) {
        if (titleEl) { titleEl.textContent = "流局 (DRAW)"; titleEl.style.color = "#9e9cb0"; }
    } else {
        if (titleEl) { titleEl.textContent = "敗北 (DEFEAT)"; titleEl.style.color = "#b31414"; }
    }
    if (msgEl) msgEl.textContent = message;
    if (resultModal) resultModal.classList.add('active');
}

function resetMatch() {
    if (screens.result) screens.result.classList.remove('active');
    gameState.round++;
    startBattle();
}

function opponentTurn() {
    if (gameState.gameOver) return;
    const oppDrawn = generateShuffledDeck()[0];
    setDialogue(`村上がツモった…`);
    setTimeout(() => {
        gameState.oppRiver.push(oppDrawn);
        setDialogue(`村上が「${tileToString(oppDrawn)}」を捨てた。`);
        updateBattleUI();
        gameState.activePlayer = 1;
        gameState.turn++;
        if (gameState.turn > gameState.maxTurns) checkDrawGame();
    }, 1500);
}
