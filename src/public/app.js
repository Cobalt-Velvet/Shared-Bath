// ==========================================
// 1. Setup & DOM
// ==========================================

// Socket初期化 (自動接続OFF)
const socket = io({ autoConnect: false });

// 状態変数 (Local State)
let isOnline = false;
let localState = {
    waterLevel: 0,
    temperature: 0
};
let streamTimer = null;

// DOM要素
const ui = {
    water: document.getElementById('water'),
    levelValue: document.getElementById('levelValue'),
    tempValue: document.getElementById('tempValue'),
    modeToggle: document.getElementById('modeToggle'),
    modeLabel: document.getElementById('modeLabel'),
    userCount: document.getElementById('userCount'),
    userList: document.getElementById('userList'),
    tempIndicator: document.getElementById('tempIndicator'),
    waterStream: document.getElementById('waterStream'),
    btns: {
        fill: document.getElementById('btnFill'),
        drain: document.getElementById('btnDrain'),
        heat: document.getElementById('btnHeat'),
        cool: document.getElementById('btnCool')
    }
};

// ==========================================
// 2. Visualization (View)
// ==========================================

/**
 * 水温の色計算 (Linear Interpolation)
 * 0(Blue) -> 50(Purple) -> 100(Red)
 */
function getWaterColor(temp) {
    const ratio = temp / 100;

    // RGB計算
    const r = Math.round(255 * ratio);
    const g = 0;
    const b = Math.round(255 * (1 - ratio));

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 画面更新 (Render)
 */
function updateDisplay(state) {
    // Text更新
    ui.levelValue.textContent = state.waterLevel;
    ui.tempValue.textContent = state.temperature;

    // 水位更新 (CSS Height)
    ui.water.style.height = `${state.waterLevel}%`;

    // インジケーター色更新
    ui.tempIndicator.style.backgroundColor = getWaterColor(state.temperature);
}

/**
 * 注水エフェクト (Timer Reset)
 */
function showWaterStream() {
    // 既存タイマー解除
    if (streamTimer) {
        clearTimeout(streamTimer);
    }

    // 表示 (Active)
    ui.waterStream.classList.add('active');

    // 非表示予約 (400ms)
    streamTimer = setTimeout(() => {
        ui.waterStream.classList.remove('active');
        streamTimer = null;
    }, 400);
}

// ==========================================
// 3. Action Handlers
// ==========================================

function handleAction(actionType) {
    // 注水時エフェクトON
    if (actionType === 'FILL') {
        showWaterStream();
    }

    if (isOnline) {
        // [ONLINE] サーバーへ送信
        socket.emit('action', actionType);
    } else {
        // [OFFLINE] ローカル計算
        switch (actionType) {
            case 'FILL':
                localState.waterLevel = Math.min(100, localState.waterLevel + 2);
                break;
            case 'DRAIN':
                localState.waterLevel = Math.max(0, localState.waterLevel - 2);
                break;
            case 'HEAT':
                localState.temperature = Math.min(100, localState.temperature + 2);
                break;
            case 'COOL':
                localState.temperature = Math.max(0, localState.temperature - 2);
                break;
        }
        updateDisplay(localState);
    }
}

// Event Listener登録
ui.btns.fill.onclick = () => handleAction('FILL');
ui.btns.drain.onclick = () => handleAction('DRAIN');
ui.btns.heat.onclick = () => handleAction('HEAT');
ui.btns.cool.onclick = () => handleAction('COOL');

// ==========================================
// 4. Mode Switch
// ==========================================

ui.modeToggle.onchange = (e) => {
    isOnline = e.target.checked;

    if (isOnline) {
        // ONLINE: 接続開始
        ui.modeLabel.textContent = "ONLINE";
        ui.modeLabel.style.color = "#2196F3";
        socket.connect();
    } else {
        // OFFLINE: 切断 & リスト初期化
        ui.modeLabel.textContent = "OFFLINE";
        ui.modeLabel.style.color = "#999";
        socket.disconnect();

        ui.userCount.textContent = "0";
        ui.userList.innerHTML = '';

        updateDisplay(localState);
    }
};

// ==========================================
// 5. Socket Events
// ==========================================

// 接続時 (初期化)
socket.on('init', (data) => {
    console.log('[Socket] Connected');
    localState = data.state;
    updateDisplay(localState);
});

// 状態更新受信 (Broadcast)
socket.on('update', (newState) => {
    if (isOnline) {
        // 他者の注水操作を検知 -> エフェクト実行
        if (newState.waterLevel > localState.waterLevel) {
            showWaterStream();
        }

        localState = newState;
        updateDisplay(newState);
    }
});

// 参加者リスト更新
socket.on('updateUserList', (userList) => {
    ui.userCount.textContent = userList.length;

    ui.userList.innerHTML = '';
    userList.forEach(userIp => {
        const li = document.createElement('li');
        li.textContent = `User: ${userIp}`;
        ui.userList.appendChild(li);
    });
});