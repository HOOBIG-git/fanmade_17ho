// Kaiji 17-Ho Online Version
// P2P Networking implementation using PeerJS

const SUITS = ['m', 'p', 's', 'z'];
const HONOR_NAMES = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };

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

class NetworkManager {
    constructor() {
        this.peer = new Peer();
        this.conn = null;
        this.onConnected = null;
        this.onMessage = null;
        this.peer.on('open', id => { document.getElementById('my-peer-id').textContent = id; });
        this.peer.on('connection', conn => { this.conn = conn; this.setupConnection(); });
    }
    setupConnection() {
        this.conn.on('open', () => {
            document.getElementById('connection-status').textContent = "接続完了！";
            document.getElementById('connection-status').style.color = "#00ff00";
            if (this.onConnected) this.onConnected();
        });
        this.conn.on('data', data => { if (this.onMessage) this.onMessage(data); });
    }
    connect(remoteId) { this.conn = this.peer.connect(remoteId); this.setupConnection(); }
    send(type, payload) { if (this.conn && this.conn.open) this.conn.send({ type, payload }); }
}

let gameState = {
    gameMode: '1p', myPlayerNum: 1, oppPlayerNum: 2, round: 1, turn: 1, maxTurns: 17,
    p1Points: 25000, p2Points: 25000, p1Debt: 0, p2Debt: 0,
    myPool: [], myHand: [], myWall: [], myRiver: [],
    oppRiver: [], oppWallCount: 17,
    drawnTile: null, gameOver: false, builderMode: 'hand', activePlayer: 1, currentYaku: null
};

let screens = {};
const network = new NetworkManager();
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
    document.getElementById('connect-btn').addEventListener('click', () => {
        const remoteId = document.getElementById('remote-peer-id').value;
        if (remoteId) {
            document.getElementById('connection-status').textContent = "接続中...";
            network.connect(remoteId);
        }
    });
    network.onConnected = () => {
        gameState.gameMode = 'online';
        network.send('HELLO', { name: 'Player' });
    };
    network.onMessage = (data) => handleNetworkMessage(data);
    document.getElementById('start-1p-btn').addEventListener('click', () => {
        gameState.gameMode = '1p'; gameState.myPlayerNum = 1; initBuilder(); switchScreen('setup');
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
        screens.result.classList.remove('active'); switchScreen('title');
    });
});

function handleNetworkMessage(data) {
    const { type, payload } = data;
    switch(type) {
        case 'HELLO':
            if (gameState.myPlayerNum === 1) {
                gameState.myPlayerNum = 2; gameState.oppPlayerNum = 1;
                network.send('ROLE_CONFIRM', { role: 2 });
            } else {
                network.send('ROLE_CONFIRM', { role: 1 });
            }
            break;
        case 'ROLE_CONFIRM':
            if (payload.role === 1) {
                gameState.myPlayerNum = 1; gameState.oppPlayerNum = 2;
                initBuilder(); switchScreen('setup');
            } else {
                gameState.myPlayerNum = 2; gameState.oppPlayerNum = 1;
            }
            break;
        case 'START_BUILDING': initBuilder(); switchScreen('setup'); break;
        case 'BUILD_COMPLETE':
            if (gameState.myPlayerNum === 1) {
                showPrivacyModal("相手の構築完了", "相手が牌を組み上げました。あなたも構築を完了させてください。", null);
            } else {
                network.send('START_BATTLE', {});
            }
            break;
        case 'START_BATTLE': startBattle(); break;
        case 'DISCARD': processOpponentDiscard(payload.tile, payload.playerId); break;
        case 'TSUMO_SIGNAL': setDialogue(`相手が牌をツモった…`); updateBattleUI(); break;
        case 'WIN_SIGNAL': endGame(payload.playerId, payload.message); break;
    }
}

function switchScreen(screenName) {
    Object.values(screens).forEach(s => { if (s && s !== screens.rules && s !== screens.privacy && s !== screens.result) s.classList.remove('active'); });
    if (screens[screenName]) screens[screenName].classList.add('active');
}

function initBuilder() {
    const deck = generateShuffledDeck();
    gameState.myPool = deck.slice(0, 30); gameState.myHand = []; gameState.myWall = [];
    gameState.builderMode = 'hand';
    const headerTitle = document.getElementById('setup-header-title');
    if (headerTitle) headerTitle.textContent = gameState.gameMode === 'online' ? `牌構築フェーズ - プレイヤー ${gameState.myPlayerNum}` : `牌構築フェーズ (30枚から配分)`;
    updateBuilderUI(); triggerZawa();
}

function setBuilderMode(mode) {
    gameState.builderMode = mode;
    document.getElementById('mode-hand-btn').classList.toggle('active', mode === 'hand');
    document.getElementById('mode-wall-btn').classList.toggle('active', mode === 'wall');
}

function resetCurrentPoolAllocation() {
    gameState.myPool = [...gameState.myPool, ...gameState.myHand, ...gameState.myWall];
    gameState.myHand = []; gameState.myWall = [];
    sortCurrentPool(); updateBuilderUI();
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
    const pool = gameState.myPool, hand = gameState.myHand, wall = gameState.myWall;
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
            } else if (gameState.builderMode === 'wall' && wall.length < 17) {
                pool.splice(idx, 1); wall.push(t);
            }
            updateBuilderUI();
        });
        poolContainer.appendChild(el);
    });
    document.getElementById('confirm-deck-btn').disabled = !(hand.length === 13 && wall.length === 17);
}

function handleDeckConfirm() {
    if (gameState.gameMode === 'online') {
        network.send('BUILD_COMPLETE', { playerId: gameState.myPlayerNum });
        if (gameState.myPlayerNum === 2) {
            network.send('START_BATTLE', {});
        } else {
            setDialogue("相手の構築完了を待っています…");
            document.getElementById('confirm-deck-btn').disabled = true;
        }
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
    gameState.turn = 1; gameState.round = 1; gameState.myRiver = []; gameState.oppRiver = [];
    gameState.drawnTile = null; gameState.activePlayer = 1; gameState.gameOver = false;
    beginBattleScreen();
}

function beginBattleScreen() {
    switchScreen('battle');
    updateBattleUI();
    setDialogue("対局開始……！ 運命の17歩が始まる…！");
    triggerZawa();
    if (gameState.myPlayerNum === 1) {
        document.getElementById('draw-btn').disabled = false;
    } else {
        setDialogue("相手（プレイヤー1）のターンです…");
        document.getElementById('draw-btn').disabled = true;
    }
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

function playerDraw() {
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
        network.send('TSUMO_SIGNAL', { playerId: gameState.myPlayerNum });
    }
}

function playerDiscard(tile) {
    const discardTile = gameState.drawnTile || tile;
    gameState.myRiver.push(discardTile);
    gameState.drawnTile = null;
    updateBattleUI();
    if (gameState.gameMode === 'online') {
        network.send('DISCARD', { tile: discardTile, playerId: gameState.myPlayerNum });
    }
    if (gameState.gameMode === '1p') {
        gameState.activePlayer = 2;
        setTimeout(opponentTurn, 1500);
    } else {
        gameState.activePlayer = gameState.oppPlayerNum;
        if (gameState.activePlayer === 1) gameState.turn++;
        if (gameState.turn > gameState.maxTurns) {
            checkDrawGame();
        } else {
            setDialogue(`相手（プレイヤー ${gameState.activePlayer}）のターンです…`);
            updateBattleUI();
        }
    }
}

function processOpponentDiscard(tile, playerId) {
    gameState.oppRiver.push(tile);
    setDialogue(`相手が「${tileToString(tile)}」を捨てた！`);
    updateBattleUI();
    const canRon = checkWinningHand([...gameState.myHand, tile], tile);
    const ronBtn = document.getElementById('ron-btn');
    if (canRon && ronBtn) {
        ronBtn.disabled = false;
        setDialogue("チャンス…！ロンボタンを押せ！！");
    }
}

function playerRon() {
    if (gameState.gameOver) return;
    triggerZawa();
    network.send('WIN_SIGNAL', { playerId: gameState.myPlayerNum, message: `プレイヤー ${gameState.myPlayerNum} のロンあがり！` });
    endGame(gameState.myPlayerNum, `見事にロンあがり！勝利！！`);
}

function playerTsumo() {
    if (gameState.gameOver) return;
    triggerZawa();
    network.send('WIN_SIGNAL', { playerId: gameState.myPlayerNum, message: `プレイヤー ${gameState.myPlayerNum} のツモあがり！` });
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
        titleEl.textContent = "勝利 (VICTORY)";
        titleEl.style.color = "#ffd700";
    } else if (winnerNum === 0) {
        titleEl.textContent = "流局 (DRAW)";
        titleEl.style.color = "#9e9cb0";
    } else {
        titleEl.textContent = "敗北 (DEFEAT)";
        titleEl.style.color = "#b31414";
    }
    msgEl.textContent = message;
    resultModal.classList.add('active');
}

function resetMatch() {
    screens.result.classList.remove('active');
    gameState.round++;
    startBattle();
}

function opponentTurn() {
    if (gameState.gameOver) return;
    const oppDrawn = generateShuffledDeck()[0];
    setDialogue(`村上がツモった…`);
    setTimeout(() => {
        processOpponentDiscard(oppDrawn, 2);
        gameState.activePlayer = 1;
        gameState.turn++;
        if (gameState.turn > gameState.maxTurns) checkDrawGame();
        updateBattleUI();
    }, 1500);
}
