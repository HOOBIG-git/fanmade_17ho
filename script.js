// Kaiji 17-Ho Game Logic with 1P / 2P Pass-and-Play Mode & Robust DOM Loading

const SUITS = ['m', 'p', 's', 'z'];
const HONOR_NAMES = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };

function tileToString(tile) {
    if (tile.suit === 'z') {
        return HONOR_NAMES[tile.val];
    }
    const kanjiNums = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
    const suitNames = { m: '萬', p: '筒', s: '索' };
    return kanjiNums[tile.val] + suitNames[tile.suit];
}

function parseTileStr(str) {
    const val = parseInt(str);
    const suit = str.slice(-1);
    return { val, suit, id: Math.random().toString(36).substr(2, 9) };
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

const PRESETS = {
    tanyao: {
        name: "タンヤオ型",
        hand: ["2m", "3m", "4m", "3p", "4p", "5p", "6s", "7s", "8s", "5m", "5m", "6m", "6m"],
        wall: ["4m", "2p", "8p", "3s", "9s", "1p", "7p", "4s", "2s", "5s", "1m", "9m", "1z"]
    },
    chinitsu: {
        name: "清一色型",
        hand: ["1p", "1p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "9p", "9p"],
        wall: ["2p", "5p", "8p", "1p", "9p", "3p", "7p", "4p", "6p", "2p", "8p", "3p", "7p", "5p", "1p", "9p", "2p"]
    },
    yakuman: {
        name: "国士無双型",
        hand: ["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z"],
        wall: ["1m", "9m", "1p", "9p", "1s", "9s", "1z", "2z", "3z", "4z", "5z", "6z", "7z", "1m", "9m", "1p", "1s"]
    }
};

class MahjongEvaluator {
    evaluate(tiles14, winningTile) {
        const counts = this.getCounts(tiles14);

        // 1. Special Case: Chiitoitsu (7 Pairs)
        if (this.checkChiitoitsu(counts)) {
            return { isWinning: true, yakuList: ["七対子"], score: 2000 };
        }

        // 2. Special Case: Kokushi Musou (13 Orphans)
        const kokushiResult = this.checkKokushi(counts);
        if (kokushiResult.isWinning) {
            return { isWinning: true, yakuList: ["国士無双"], score: 32000 };
        }

        // 3. Find ALL valid decompositions (4 melds + 1 pair)
        const decompositions = this.findAllDecompositions(counts);
        if (decompositions.length === 0) {
            return { isWinning: false, yakuList: [], score: 0 };
        }

        let bestResult = { isWinning: false, yakuList: [], score: -1 };

        for (const deco of decompositions) {
            const yakuList = this.checkYaku(deco, winningTile, tiles14);
            const score = this.calculateSimpleScore(yakuList);

            if (score > bestResult.score) {
                bestResult = {
                    isWinning: true,
                    yakuList: yakuList,
                    score: score
                };
            }
        }

        if (!bestResult.isWinning || bestResult.yakuList.length === 0) {
            return { isWinning: false, yakuList: [], score: 0 };
        }

        return bestResult;
    }

    getCounts(tiles) {
        const counts = {};
        tiles.forEach(t => {
            const key = t.suit + t.val;
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }

    checkChiitoitsu(counts) {
        let pairs = 0;
        for (const key in counts) {
            if (counts[key] >= 2) pairs++;
        }
        return pairs === 7;
    }

    checkKokushi(counts) {
        const orphans = ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];
        let pairFound = false;
        for (const o of orphans) {
            if (!counts[o]) return { isWinning: false };
            if (counts[o] > 1) {
                if (pairFound) return { isWinning: false };
                pairFound = true;
            }
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
        if (keys.length === 0) {
            allResults.push({ pair: pairKey, melds: [...currentMelds] });
            return;
        }

        const key = keys[0];
        const suit = key[0];
        const val = parseInt(key.slice(1));

        if (counts[key] >= 3) {
            counts[key] -= 3;
            currentMelds.push({ type: 'triplet', tile: key });
            this.decomposeRecursive(counts, currentMelds, allResults, pairKey);
            currentMelds.pop();
            counts[key] += 3;
        }

        if (suit !== 'z') {
            const next1 = suit + (val + 1);
            const next2 = suit + (val + 2);
            if (counts[next1] > 0 && counts[next2] > 0) {
                counts[key]--;
                counts[next1]--;
                counts[next2]--;
                currentMelds.push({ type: 'sequence', tiles: [key, next1, next2] });
                this.decomposeRecursive(counts, currentMelds, allResults, pairKey);
                currentMelds.pop();
                counts[key]++;
                counts[next1]++;
                counts[next2]++;
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
        if (this.checkHonitsu(allTileKeys)) {
            if (!yaku.includes("清一色")) yaku.push("混一色");
        }
        if (this.checkIttsu(melds)) yaku.push("一気通貫");

        if (this.checkTanyao(allTileKeys)) yaku.push("断幺九");
        if (this.checkYakuhai(melds)) yaku.push("役牌");
        if (this.checkPinfu(deco, winningTile, allTiles)) yaku.push("平和");
        if (this.checkToitoi(melds)) yaku.push("対々和");
        if (this.checkXiaosangen(counts)) yaku.push("小三元");

        return yaku;
    }

    checkTanyao(keys) {
        return keys.every(k => {
            if (k[0] === 'z') return false;
            const v = parseInt(k.slice(1));
            return v >= 2 && v <= 8;
        });
    }

    checkYakuhai(melds) {
        return melds.some(m => m.type === 'triplet' && m.tile[0] === 'z');
    }

    checkPinfu(deco, winningTile, allTiles) {
        const { pair, melds } = deco;
        if (melds.some(m => m.type === 'triplet')) return false;
        if (pair[0] === 'z') return false;
        return this.analyzeWait(allTiles, winningTile) === 'Ryumen';
    }

    checkChinitsu(keys) {
        const firstSuit = keys[0][0];
        return firstSuit !== 'z' && keys.every(k => k[0] === firstSuit);
    }

    checkHonitsu(keys) {
        const firstSuit = keys[0][0];
        if (firstSuit === 'z') return false;
        return keys.every(k => k[0] === firstSuit || k[0] === 'z');
    }

    checkToitoi(melds) {
        return melds.every(m => m.type === 'triplet');
    }

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

    checkDaisangen(counts) {
        return counts['z5'] >= 3 && counts['z6'] >= 3 && counts['z7'] >= 3;
    }

    checkXiaosangen(counts) {
        const honors = ['z5', 'z6', 'z7'];
        return honors.filter(h => counts[h] >= 3).length >= 2;
    }

    checkSuuankou(melds) {
        return melds.every(m => m.type === 'triplet');
    }

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

        ['m', 'p', 's'].forEach(suit => {
            for (let v = 1; v <= 9; v++) allPossibleTiles.push({ suit, val: v });
        });
        for (let v = 1; v <= 7; v++) allPossibleTiles.push({ suit: 'z', val: v });

        for (const tile of allPossibleTiles) {
            const testHand = [...tiles13, tile];
            const result = this.evaluate(testHand, tile);
            if (result.isWinning) {
                waitingTiles.add(tile.suit + tile.val);
            }
        }
        return Array.from(waitingTiles);
    }

    calculateSimpleScore(yakuList) {
        let score = 1000;
        const weights = {
            "国士無双": 32000,
            "四暗刻": 32000,
            "大三元": 32000,
            "清一色": 16000,
            "小三元": 12000,
            "一気通貫": 4000,
            "対々和": 3000,
            "混一色": 2000,
            "断幺九": 1000,
            "平和": 1000,
            "役牌": 1000,
            "七対子": 2000
        };

        let total = 0;
        yakuList.forEach(y => {
            total += (weights[y] || 1000);
        });
        return total;
    }
}

let gameState = {
    gameMode: '1p',
    setupPlayer: 1,
    activePlayer: 1,
    round: 1,
    turn: 1,
    maxTurns: 17,
    p1Points: 25000,
    p2Points: 25000,
    p1Debt: 0,
    p2Debt: 0,

    p1Pool: [],
    p1Hand: [],
    p1Wall: [],
    p1River: [],

    p2Pool: [],
    p2Hand: [],
    p2Wall: [],
    p2River: [],

    drawnTile: null,
    gameOver: false,
    builderMode: 'hand',
    pendingAction: null
};

let screens = {};

document.addEventListener('DOMContentLoaded', () => {
    screens = {
        title: document.getElementById('title-screen'),
        setup: document.getElementById('setup-screen'),
        battle: document.getElementById('battle-screen'),
        rules: document.getElementById('rules-modal'),
        privacy: document.getElementById('privacy-screen'),
        result: document.getElementById('result-modal')
    };

    document.getElementById('start-1p-btn').addEventListener('click', () => {
        gameState.gameMode = '1p';
        gameState.setupPlayer = 1;
        initBuilder(1);
        switchScreen('setup');
    });

    document.getElementById('start-2p-btn').addEventListener('click', () => {
        gameState.gameMode = '2p';
        gameState.setupPlayer = 1;
        initBuilder(1);
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

function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        if (s && s !== screens.rules && s !== screens.privacy && s !== screens.result) {
            s.classList.remove('active');
        }
    });
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

function initBuilder(playerNum) {
    gameState.setupPlayer = playerNum;
    const deck = generateShuffledDeck();

    if (playerNum === 1) {
        gameState.p1Pool = deck.slice(0, 30);
        gameState.p1Hand = [];
        gameState.p1Wall = [];
    } else {
        gameState.p2Pool = deck.slice(0, 30);
        gameState.p2Hand = [];
        gameState.p2Wall = [];
    }
    gameState.builderMode = 'hand';

    const headerTitle = document.getElementById('setup-header-title');
    if (headerTitle) {
        if (gameState.gameMode === '2p') {
            headerTitle.textContent = `牌構築フェーズ - プレイヤー ${playerNum} の番`;
        } else {
            headerTitle.textContent = `牌構築フェーズ (30枚から配分)`;
        }
    }

    updateBuilderUI();
    triggerZawa();
}

function setBuilderMode(mode) {
    gameState.builderMode = mode;
    const handBtn = document.getElementById('mode-hand-btn');
    const wallBtn = document.getElementById('mode-wall-btn');
    if (handBtn) handBtn.classList.toggle('active', mode === 'hand');
    if (wallBtn) wallBtn.classList.toggle('active', mode === 'wall');
}

function resetCurrentPoolAllocation() {
    if (gameState.setupPlayer === 1) {
        gameState.p1Pool = [...gameState.p1Pool, ...gameState.p1Hand, ...gameState.p1Wall];
        gameState.p1Hand = [];
        gameState.p1Wall = [];
    } else {
        gameState.p2Pool = [...gameState.p2Pool, ...gameState.p2Hand, ...gameState.p2Wall];
        gameState.p2Hand = [];
        gameState.p2Wall = [];
    }
    sortCurrentPool();
    updateBuilderUI();
}

function sortCurrentPool() {
    const pool = gameState.setupPlayer === 1 ? gameState.p1Pool : gameState.p2Pool;
    const suitOrder = { 'm': 1, 'p': 2, 's': 3, 'z': 4 };

    pool.sort((a, b) => {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
            return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return a.val - b.val;
    });
    updateBuilderUI();
}

function autoDistributeCurrentPlayer() {
    resetCurrentPoolAllocation();
    const pool = gameState.setupPlayer === 1 ? gameState.p1Pool : gameState.p2Pool;
    const hand = gameState.setupPlayer === 1 ? gameState.p1Hand : gameState.p2Hand;
    const wall = gameState.setupPlayer === 1 ? gameState.p1Wall : gameState.p2Wall;

    hand.push(...pool.splice(0, 13));
    wall.push(...pool.splice(0, 17));
    updateBuilderUI();
}

function updateBuilderUI() {
    const pool = gameState.setupPlayer === 1 ? gameState.p1Pool : gameState.p2Pool;
    const hand = gameState.setupPlayer === 1 ? gameState.p1Hand : gameState.p2Hand;
    const wall = gameState.setupPlayer === 1 ? gameState.p1Wall : gameState.p2Wall;

    const handCountEl = document.getElementById('hand-count');
    const wallCountEl = document.getElementById('wall-count');
    const poolCountEl = document.getElementById('pool-count');

    if (handCountEl) handCountEl.textContent = hand.length;
    if (wallCountEl) wallCountEl.textContent = wall.length;
    if (poolCountEl) poolCountEl.textContent = pool.length;

    const handContainer = document.getElementById('setup-hand-tiles');
    if (handContainer) {
        handContainer.innerHTML = '';
        hand.forEach((t, idx) => {
            const el = createTileElement(t);
            el.title = "クリックしてプールに戻す";
            el.addEventListener('click', () => {
                hand.splice(idx, 1);
                pool.push(t);
                updateBuilderUI();
            });
            handContainer.appendChild(el);
        });
    }

    const wallContainer = document.getElementById('setup-wall-tiles');
    if (wallContainer) {
        wallContainer.innerHTML = '';
        wall.forEach((t, idx) => {
            const el = createTileElement(t);
            el.title = "クリックしてプールに戻す";
            el.addEventListener('click', () => {
                wall.splice(idx, 1);
                pool.push(t);
                updateBuilderUI();
            });
            wallContainer.appendChild(el);
        });
    }

    const poolContainer = document.getElementById('tile-pool');
    if (poolContainer) {
        poolContainer.innerHTML = '';
        pool.forEach((t, idx) => {
            const el = createTileElement(t);
            el.title = "クリックして手牌または山に追加";
            el.addEventListener('click', () => {
                if (gameState.builderMode === 'hand') {
                    if (hand.length < 13) {
                        pool.splice(idx, 1);
                        hand.push(t);
                        if (hand.length === 13) setBuilderMode('wall');
                        updateBuilderUI();
                    }
                } else {
                    if (wall.length < 17) {
                        pool.splice(idx, 1);
                        wall.push(t);
                        updateBuilderUI();
                    }
                }
            });
            poolContainer.appendChild(el);
        });
    }

    const confirmBtn = document.getElementById('confirm-deck-btn');
    if (confirmBtn) {
        const isValid = hand.length === 13 && wall.length === 17;
        confirmBtn.disabled = !isValid;
    }
}

function handleDeckConfirm() {
    if (gameState.gameMode === '2p' && gameState.setupPlayer === 1) {
        showPrivacyModal(
            "プレイヤー 1 の構築完了",
            "デバイスを プレイヤー 2 に渡してください。準備ができたらボタンを押してください。",
            () => {
                initBuilder(2);
            }
        );
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
        gameState.p2Hand = cpuDeck.slice(0, 13);
        gameState.p2Wall = cpuDeck.slice(13, 30);
    }

    gameState.turn = 1;
    gameState.round = 1;
    gameState.p1River = [];
    gameState.p2River = [];
    gameState.drawnTile = null;
    gameState.activePlayer = 1;
    gameState.gameOver = false;

    if (gameState.gameMode === '2p') {
        showPrivacyModal(
            "対局開始準備",
            "プレイヤー 1 のターンから始まります。デバイスを プレイヤー 1 に渡してください。",
            () => {
                beginBattleScreen();
            }
        );
    } else {
        beginBattleScreen();
    }
}

function beginBattleScreen() {
    switchScreen('battle');
    updateBattleUI();
    setDialogue("対局開始……！ 運命の17歩が始まる…！");
    triggerZawa();
    const drawBtn = document.getElementById('draw-btn');
    if (drawBtn) drawBtn.disabled = (gameState.activePlayer !== 1);
}

function triggerZawa() {
    const overlay = document.getElementById('zawa-overlay');
    if (overlay) {
        overlay.classList.add('show');
        setTimeout(() => {
            overlay.classList.remove('show');
        }, 1200);
    }
}

function setDialogue(text) {
    const dialogueText = document.getElementById('dialogue-text');
    if (dialogueText) dialogueText.textContent = text;
}

function updateBattleUI() {
    const isP1 = gameState.activePlayer === 1;

    const roundDisplay = document.getElementById('round-display');
    const turnDisplay = document.getElementById('turn-display');
    if (roundDisplay) roundDisplay.textContent = `第${gameState.round}局`;
    if (turnDisplay) turnDisplay.textContent = `${gameState.turn} / ${gameState.maxTurns} 巡目`;

    // Final Turn Effect
    const finalTurnOverlay = document.getElementById('final-turn-overlay');
    if (finalTurnOverlay) {
        if (gameState.turn === gameState.maxTurns) {
            finalTurnOverlay.classList.add('active');
        } else {
            finalTurnOverlay.classList.remove('active');
        }
    }

    // Update Waiting Tiles for P1
    const waitContainer = document.getElementById('p1-wait-container');
    const waitText = document.getElementById('p1-wait-tiles');
    if (waitContainer && waitText) {
        waitContainer.innerHTML = '';
        if (gameState.drawnTile) {
            waitText.textContent = "ツモ中...";
        } else {
            const evaluator = new MahjongEvaluator();
            const waitingTiles = evaluator.getWaitingTiles(gameState.p1Hand);
            if (waitingTiles.length > 0) {
                waitText.textContent = "テンパイ！";
                waitingTiles.forEach(tileStr => {
                    const tileObj = {
                        suit: tileStr[0],
                        val: parseInt(tileStr.slice(1))
                    };
                    waitContainer.appendChild(createTileElement(tileObj, false, true));
                });
            } else {
                // No waiting tiles
                waitText.textContent = "なし";
            }
        }
    }

    if (gameState.gameMode === '2p') {

        const p1Name = document.getElementById('p1-name');
        const p2Name = document.getElementById('p2-name');
        const p1Points = document.getElementById('p1-points');
        const p2Points = document.getElementById('p2-points');
        const p1Debt = document.getElementById('p1-debt');
        const p2Debt = document.getElementById('p2-debt');
        const p1WallCount = document.getElementById('p1-wall-count');
        const p2WallCount = document.getElementById('p2-wall-count');

        if (p1Name) p1Name.textContent = isP1 ? "プレイヤー 1 (あなた)" : "プレイヤー 2";
        if (p2Name) p2Name.textContent = isP1 ? "プレイヤー 2" : "プレイヤー 1 (あなた)";
        if (p1Points) p1Points.textContent = `持点: ${(isP1 ? gameState.p1Points : gameState.p2Points).toLocaleString()}点`;
        if (p2Points) p2Points.textContent = `持点: ${(isP1 ? gameState.p2Points : gameState.p1Points).toLocaleString()}点`;
        if (p1Debt) p1Debt.textContent = `借金: ¥${(isP1 ? gameState.p1Debt : gameState.p2Debt).toLocaleString()}`;
        if (p2Debt) p2Debt.textContent = `借金: ¥${(isP1 ? gameState.p2Debt : gameState.p1Debt).toLocaleString()}`;

        if (p1WallCount) p1WallCount.textContent = isP1 ? gameState.p1Wall.length : gameState.p2Wall.length;
        if (p2WallCount) p2WallCount.textContent = isP1 ? gameState.p2Wall.length : gameState.p1Wall.length;

        const handContainer = document.getElementById('p1-hand-container');
        if (handContainer) {
            handContainer.innerHTML = '';
            const currentHand = isP1 ? gameState.p1Hand : gameState.p2Hand;
            currentHand.forEach(t => handContainer.appendChild(createTileElement(t)));
            if (gameState.drawnTile) {
                const drawnEl = createTileElement(gameState.drawnTile);
                drawnEl.style.border = '2px solid #ffd700';
                handContainer.appendChild(drawnEl);
            }
        }

        const oppHandContainer = document.getElementById('p2-hand-container');
        if (oppHandContainer) {
            oppHandContainer.innerHTML = '';
            for (let i = 0; i < 13; i++) oppHandContainer.appendChild(createTileElement({}, true));
        }

        const p1River = document.getElementById('p1-river-container');
        if (p1River) {
            p1River.innerHTML = '';
            (isP1 ? gameState.p1River : gameState.p2River).forEach(t => p1River.appendChild(createTileElement(t, false, true)));
        }

        const p2River = document.getElementById('p2-river-container');
        if (p2River) {
            p2River.innerHTML = '';
            (isP1 ? gameState.p2River : gameState.p1River).forEach(t => p2River.appendChild(createTileElement(t, false, true)));
        }

        const wallPreview = document.getElementById('p1-wall-preview');
        if (wallPreview) {
            wallPreview.innerHTML = '';
            (isP1 ? gameState.p1Wall : gameState.p2Wall).forEach(t => wallPreview.appendChild(createTileElement(t, false, true)));
        }

    } else {
        const p1Name = document.getElementById('p1-name');
        const p2Name = document.getElementById('p2-name');
        const p1Points = document.getElementById('p1-points');
        const p2Points = document.getElementById('p2-points');
        const p1Debt = document.getElementById('p1-debt');
        const p2Debt = document.getElementById('p2-debt');
        const p1WallCount = document.getElementById('p1-wall-count');
        const p2WallCount = document.getElementById('p2-wall-count');

        if (p1Name) p1Name.textContent = "伊藤 開示 (あなた)";
        if (p2Name) p2Name.textContent = "村上（帝愛グループ）";
        if (p1Points) p1Points.textContent = `持点: ${gameState.p1Points.toLocaleString()}点`;
        if (p2Points) p2Points.textContent = `持点: ${gameState.p2Points.toLocaleString()}点`;
        if (p1Debt) p1Debt.textContent = `借金: ¥${gameState.p1Debt.toLocaleString()}`;
        if (p2Debt) p2Debt.textContent = `借金: ¥${gameState.p2Debt.toLocaleString()}`;

        if (p1WallCount) p1WallCount.textContent = gameState.p1Wall.length;
        if (p2WallCount) p2WallCount.textContent = gameState.p2Wall.length;

        const handContainer = document.getElementById('p1-hand-container');
        if (handContainer) {
            handContainer.innerHTML = '';
            gameState.p1Hand.forEach(t => handContainer.appendChild(createTileElement(t)));
            if (gameState.drawnTile) {
                const drawnEl = createTileElement(gameState.drawnTile);
                drawnEl.style.border = '2px solid #ffd700';
                handContainer.appendChild(drawnEl);
            }
        }

        const oppHandContainer = document.getElementById('p2-hand-container');
        if (oppHandContainer) {
            oppHandContainer.innerHTML = '';
            for (let i = 0; i < 13; i++) oppHandContainer.appendChild(createTileElement({}, true));
        }

        const p1River = document.getElementById('p1-river-container');
        if (p1River) {
            p1River.innerHTML = '';
            gameState.p1River.forEach(t => p1River.appendChild(createTileElement(t, false, true)));
        }

        const p2River = document.getElementById('p2-river-container');
        if (p2River) {
            p2River.innerHTML = '';
            gameState.p2River.forEach(t => p2River.appendChild(createTileElement(t, false, true)));
        }

        const wallPreview = document.getElementById('p1-wall-preview');
        if (wallPreview) {
            wallPreview.innerHTML = '';
            gameState.p1Wall.forEach(t => wallPreview.appendChild(createTileElement(t, false, true)));
        }
    }
}

function playerDraw() {
    if (gameState.gameOver) return;

    const currentWall = gameState.activePlayer === 1 ? gameState.p1Wall : gameState.p2Wall;
    if (currentWall.length === 0) {
        checkDrawGame();
        return;
    }

    gameState.drawnTile = currentWall.shift();
    updateBattleUI();

    setDialogue(`プレイヤー ${gameState.activePlayer} が「${tileToString(gameState.drawnTile)}」をツモった！`);

    const currentHand = gameState.activePlayer === 1 ? gameState.p1Hand : gameState.p2Hand;
    const canTsumo = checkWinningHand([...currentHand, gameState.drawnTile], gameState.drawnTile);

    const tsumoBtn = document.getElementById('tsumo-btn');
    const ronBtn = document.getElementById('ron-btn');
    const drawBtn = document.getElementById('draw-btn');

    if (tsumoBtn) tsumoBtn.disabled = !canTsumo;
    if (ronBtn) ronBtn.disabled = true;
    if (drawBtn) drawBtn.disabled = true;

    setTimeout(() => {
        if (!gameState.gameOver) {
            playerDiscard(gameState.drawnTile);
        }
    }, 1500);
}

function playerDiscard(tile) {
    const isP1 = gameState.activePlayer === 1;
    if (isP1) {
        gameState.p1River.push(tile);
    } else {
        gameState.p2River.push(tile);
    }
    gameState.drawnTile = null;
    updateBattleUI();

    const oppHand = isP1 ? gameState.p2Hand : gameState.p1Hand;
    const oppCanRon = checkWinningHand([...oppHand, tile], tile);

    if (oppCanRon) {
        triggerZawa();
        const winner = isP1 ? "プレイヤー 2" : "プレイヤー 1";
        setDialogue(`${winner}：「ロンッ…！！！捉えたぞ！！」`);
        endGame(isP1 ? 2 : 1, `${winner} のロンあがり勝利！！`);
        return;
    }

    if (gameState.gameMode === '1p') {
        gameState.activePlayer = 2;
        setDialogue("村上のターン…！");
        setTimeout(opponentTurn, 1500);
    } else {
        const nextPlayer = isP1 ? 2 : 1;
        if (nextPlayer === 1) {
            gameState.turn++;
            if (gameState.turn > gameState.maxTurns) {
                checkDrawGame();
                return;
            }
        }
        gameState.activePlayer = nextPlayer;

        showPrivacyModal(
            `ターン交代 (プレイヤー ${nextPlayer} の番)`,
            `デバイスを プレイヤー ${nextPlayer} に渡してください。準備ができたらボタンを押してください。`,
            () => {
                updateBattleUI();
                setDialogue(`第 ${gameState.turn} 巡目 - プレイヤー ${nextPlayer} の番です。「ツモる」を押してください。`);
                const drawBtn = document.getElementById('draw-btn');
                if (drawBtn) drawBtn.disabled = false;
            }
        );
    }
}

function opponentTurn() {
    if (gameState.gameOver) return;

    if (gameState.p2Wall.length === 0) {
        checkDrawGame();
        return;
    }

    const oppDrawn = gameState.p2Wall.shift();
    setDialogue(`村上が牌をツモった…`);

    const oppCanTsumo = checkWinningHand([...gameState.p2Hand, oppDrawn], oppDrawn);
    if (oppCanTsumo) {
        triggerZawa();
        setDialogue("村上：「ツモ…！ハハハ、終わりだカイジ！！」");
        endGame(2, "村上にツモあがりされました！ (敗北)");
        return;
    }

    setTimeout(() => {
        const oppDiscarded = oppDrawn;
        gameState.p2River.push(oppDiscarded);
        updateBattleUI();

        setDialogue(`村上が「${tileToString(oppDiscarded)}」を河に捨てた。`);

        const playerCanRon = checkWinningHand([...gameState.p1Hand, oppDiscarded], oppDiscarded);
        const ronBtn = document.getElementById('ron-btn');
        if (playerCanRon && ronBtn) {
            ronBtn.disabled = false;
            setDialogue("チャンス…！ロンボタンを押して和了せよ！！");
        }

        setTimeout(() => {
            if (!gameState.gameOver) {
                if (ronBtn) ronBtn.disabled = true;
                gameState.turn++;
                gameState.activePlayer = 1;

                if (gameState.turn > gameState.maxTurns) {
                    checkDrawGame();
                } else {
                    setDialogue(`第 ${gameState.turn} 巡目。ツモボタンを押してください。`);
                    const drawBtn = document.getElementById('draw-btn');
                    if (drawBtn) drawBtn.disabled = false;
                }
                updateBattleUI();
            }
        }, 2000);
    }, 1500);
}

function playerRon() {
    if (gameState.gameOver) return;
    triggerZawa();
    setDialogue(`プレイヤー ${gameState.activePlayer}：「ロンッ…！！！ 見切った…！！」`);
    endGame(gameState.activePlayer, `プレイヤー ${gameState.activePlayer} のロンあがり勝利！！`);
}

function playerTsumo() {
    if (gameState.gameOver) return;
    triggerZawa();
    setDialogue(`プレイヤー ${gameState.activePlayer}：「ツモ…！！！ 完璧な自摸あがり…！！」`);
    endGame(gameState.activePlayer, `プレイヤー ${gameState.activePlayer} のツモあがり完全勝利！！`);
}

function checkWinningHand(tiles14, winningTile) {
    const evaluator = new MahjongEvaluator();
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
    setDialogue("17巡完了——流局（引き分け）！");
    endGame(0, "17巡打鍵終了。勝負は引き分けとなりました。");
}

function endGame(winnerNum, message) {
    gameState.gameOver = true;
    const drawBtn = document.getElementById('draw-btn');
    const ronBtn = document.getElementById('ron-btn');
    const tsumoBtn = document.getElementById('tsumo-btn');

    if (drawBtn) drawBtn.disabled = true;
    if (ronBtn) ronBtn.disabled = true;
    if (tsumoBtn) tsumoBtn.disabled = true;

    // Yaku Cut-in Effect
    if (winnerNum !== 0 && gameState.currentYaku && gameState.currentYaku.length > 0) {
        const cutinEl = document.getElementById('yaku-cutin');
        if (cutinEl) {
            const yakuName = gameState.currentYaku.join(' ・ ');
            cutinEl.innerHTML = `<div class="yaku-cutin-text">${yakuName}！！</div>`;
            cutinEl.classList.add('active');

            setTimeout(() => {
                showFinalResult(winnerNum, message);
            }, 1500);
            return;
        }
    }

    showFinalResult(winnerNum, message);
}

function showFinalResult(winnerNum, message) {
    const resultModal = screens.result;
    const titleEl = document.getElementById('result-title');
    const msgEl = document.getElementById('result-message');
    const scoreEl = document.getElementById('score-change');

    if (winnerNum === 1) {
        if (titleEl) titleEl.textContent = gameState.gameMode === '1p' ? "勝利 (VICTORY)" : "プレイヤー 1 の勝利";
        if (titleEl) titleEl.style.color = "#ffd700";
        gameState.p1Points += 8000;
        gameState.p2Points -= 8000;
        if (scoreEl) scoreEl.textContent = "点数移動: +8,000点獲得";
    } else if (winnerNum === 2) {
        if (titleEl) titleEl.textContent = gameState.gameMode === '1p' ? "敗北 (DEFEAT)" : "プレイヤー 2 の勝利";
        if (titleEl) titleEl.style.color = "#b31414";
        gameState.p1Points -= 8000;
        gameState.p2Points += 8000;
        gameState.p1Debt += 1000000;
        if (scoreEl) scoreEl.textContent = "点数移動: -8,000点失点";
    } else {
        if (titleEl) titleEl.textContent = "流局 (DRAW)";
        if (titleEl) titleEl.style.color = "#9e9cb0";
        if (scoreEl) scoreEl.textContent = "引き分け (持点変動なし)";
    }

    if (msgEl) msgEl.textContent = message;
    if (resultModal) resultModal.classList.add('active');
}

function resetMatch() {
    if (screens.result) screens.result.classList.remove('active');
    gameState.round++;
    startBattle();
}
