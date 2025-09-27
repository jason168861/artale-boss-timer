document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素獲取
    const channelInput = document.getElementById('channel-input');
    const addTimerBtn = document.getElementById('add-timer-btn');
    const clearAllBtn = document.getElementById('clear-all-btn'); // ⭐ 獲取新按鈕
    const respawnReadyContainer = document.getElementById('respawn-ready-container');
    const waitingContainer = document.getElementById('waiting-container');
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = customSelectWrapper.querySelector('.custom-select');
    const customSelectTrigger = customSelectWrapper.querySelector('.custom-select-trigger span');
    const customOptions = customSelectWrapper.querySelector('.custom-options');

    let bossData = {};
    let activeTimers = [];
    let selectedBoss = null;

    // --- 1. 自訂下拉選單邏輯 ---
    function setupCustomSelect() {
        customSelectWrapper.addEventListener('click', () => {
            customSelect.classList.toggle('open');
        });

        window.addEventListener('click', (e) => {
            if (!customSelectWrapper.contains(e.target)) {
                customSelect.classList.remove('open');
            }
        });
    }

    async function loadBossData() {
        try {
            const response = await fetch('boss_time.json');
            bossData = await response.json();
            for (const bossName in bossData) {
                const option = document.createElement('div');
                option.className = 'custom-option';
                option.dataset.value = bossName;
                option.innerHTML = `<img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;
                
                option.addEventListener('click', () => {
                    if (document.querySelector('.custom-option.selected')) {
                        document.querySelector('.custom-option.selected').classList.remove('selected');
                    }
                    option.classList.add('selected');
                    customSelectTrigger.innerHTML = option.innerHTML; // 顯示圖片和名稱
                    selectedBoss = bossName;
                });
                customOptions.appendChild(option);
            }
        } catch (error) {
            console.error('無法載入 boss_time.json:', error);
            alert('錯誤：無法載入 BOSS 資料！');
        }
    }

    // --- 2. 核心計時器邏輯 (大部分不變) ---
    function parseRespawnTime(timeString) {
        const parts = timeString.split('~');
        const parse = str => (str.match(/(\d+)小時/)?.[1] || 0) * 3600 + (str.match(/(\d+)分/)?.[1] || 0) * 60;
        return { minSeconds: parse(parts[0]), maxSeconds: parse(parts[1]) };
    }

    function formatTime(totalSeconds) {
        if (totalSeconds < 0) totalSeconds = 0;
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    // --- 3. 新增/修改/刪除/重置功能 ---
    function addTimer() {
        const bossName = selectedBoss;
        const channel = channelInput.value;
        if (!bossName || !channel) {
            alert('請選擇 BOSS 並輸入頻道！');
            return;
        }
        const respawnString = bossData[bossName];
        const { minSeconds, maxSeconds } = parseRespawnTime(respawnString);
        const timer = {
            id: Date.now(), bossName, channel,
            defeatTime: Date.now(),
            minRespawnTime: Date.now() + minSeconds * 1000,
            maxRespawnTime: Date.now() + maxSeconds * 1000,
            respawnString
        };
        activeTimers.push(timer);
        createTimerCard(timer);
        saveTimers();
    }

    function createTimerCard(timer) {
        const card = document.createElement('div');
        card.className = 'timer-card';
        card.dataset.timerId = timer.id;
        card.innerHTML = `
            <div class="card-buttons">
                <button class="reset-btn" title="重置計時">🔄</button>
                <button class="delete-btn" title="刪除">X</button>
            </div>
            <div class="card-header">
                <img src="./image/${timer.bossName}.png" alt="${timer.bossName}" onerror="this.style.display='none'">
                <div class="title-group">
                    <h3>${timer.bossName}</h3>
                    <div class="timer-info">
                         <p class="defeat-time">擊殺: ${new Date(timer.defeatTime).toLocaleTimeString()}</p>
                    </div>
                </div>
                <div class="channel-display">CH ${timer.channel}</div>
            </div>
            <div class="countdown">--:--:--</div>
            <div class="respawn-window">重生區間: ${new Date(timer.minRespawnTime).toLocaleTimeString()} ~ ${new Date(timer.maxRespawnTime).toLocaleTimeString()}</div>
            <p class="fixed-respawn-time">固定重生: ${timer.respawnString}</p>
        `;
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTimer(timer.id));
        card.querySelector('.reset-btn').addEventListener('click', () => resetTimer(timer.id));
        waitingContainer.appendChild(card); // 新卡片一律加到等待區
    }

    function deleteTimer(id) {
        activeTimers = activeTimers.filter(timer => timer.id !== id);
        document.querySelector(`.timer-card[data-timer-id='${id}']`)?.remove();
        saveTimers();
    }

    // ⭐ 新增全部清除功能
    function clearAllTimers() {
        if (activeTimers.length === 0) {
            alert('目前沒有計時器可以清除。');
            return;
        }
        if (confirm('確定要清除所有計時器嗎？此操作無法復原。')) {
            activeTimers = []; // 清空計時器陣列
            respawnReadyContainer.innerHTML = ''; // 清空畫面
            waitingContainer.innerHTML = ''; // 清空畫面
            saveTimers(); // 更新本地儲存
        }
    }
    
    function resetTimer(id) {
        const timer = activeTimers.find(t => t.id === id);
        if (timer) {
            const { minSeconds, maxSeconds } = parseRespawnTime(bossData[timer.bossName]);
            timer.defeatTime = Date.now();
            timer.minRespawnTime = Date.now() + minSeconds * 1000;
            timer.maxRespawnTime = Date.now() + maxSeconds * 1000;
            const card = document.querySelector(`.timer-card[data-timer-id='${id}']`);
            if (card) {
                card.querySelector('.defeat-time').textContent = `擊殺: ${new Date(timer.defeatTime).toLocaleTimeString()}`;
                card.querySelector('.respawn-window').textContent = `重生區間: ${new Date(timer.minRespawnTime).toLocaleTimeString()} ~ ${new Date(timer.maxRespawnTime).toLocaleTimeString()}`;
                waitingContainer.appendChild(card); // 重置後移回等待區
            }
            saveTimers();
        }
    }

    // --- 4. 核心更新迴圈 (*** 重大修改 ***) ---
    function updateAllTimers() {
        const now = Date.now();
        activeTimers.forEach(timer => {
            const card = document.querySelector(`.timer-card[data-timer-id='${timer.id}']`);
            if (!card) return;
            const countdownElement = card.querySelector('.countdown');
            card.classList.remove('status-window-open', 'status-overdue');

            if (now < timer.minRespawnTime) {
                // 狀態：等待中
                const remainingSeconds = Math.round((timer.minRespawnTime - now) / 1000);
                countdownElement.textContent = `重生倒數: ${formatTime(remainingSeconds)}`;
                countdownElement.style.color = '#f0f0f0';
                if (card.parentElement !== waitingContainer) {
                    waitingContainer.appendChild(card); // 確認在等待區
                }
            } else {
                // 狀態：已進入重生區間或已過期
                if (now <= timer.maxRespawnTime) {
                    card.classList.add('status-window-open');
                    countdownElement.textContent = 'BOSS 已進入重生視窗！';
                    countdownElement.style.color = '#28a745';
                } else {
                    card.classList.add('status-overdue');
                    const overdueSeconds = Math.round((now - timer.maxRespawnTime) / 1000);
                    countdownElement.textContent = `已超過最長重生時間 ${formatTime(overdueSeconds)}`;
                    countdownElement.style.color = '#ffc107';
                }
                if (card.parentElement !== respawnReadyContainer) {
                    respawnReadyContainer.appendChild(card); // 確認在重生區
                }
            }
        });
    }

    // --- 5. 本地儲存 & 初始化 ---
    function saveTimers() {
        localStorage.setItem('mapleBossTimers', JSON.stringify(activeTimers));
    }

    function loadTimers() {
        const savedTimers = localStorage.getItem('mapleBossTimers');
        if (savedTimers) {
            activeTimers = JSON.parse(savedTimers);
            // 讀取時不直接創建，讓 updateAllTimers 首次运行时自動分類
            activeTimers.forEach(timer => createTimerCardForLoad(timer));
            updateAllTimers(); 
        }
    }
    
    // 專為載入設計的創卡函式，不立即分類
    function createTimerCardForLoad(timer) {
        const card = document.createElement('div');
        card.className = 'timer-card';
        card.dataset.timerId = timer.id;
        // ... (與 createTimerCard 相同的 innerHTML)
        card.innerHTML = `
            <div class="card-buttons">
                <button class="reset-btn" title="重置計時">🔄</button>
                <button class="delete-btn" title="刪除">X</button>
            </div>
            <div class="card-header">
                <img src="./image/${timer.bossName}.png" alt="${timer.bossName}" onerror="this.style.display='none'">
                <div class="title-group">
                    <h3>${timer.bossName}</h3>
                    <div class="timer-info">
                         <p class="defeat-time">擊殺: ${new Date(timer.defeatTime).toLocaleTimeString()}</p>
                    </div>
                </div>
                <div class="channel-display">CH ${timer.channel}</div>
            </div>
            <div class="countdown">--:--:--</div>
            <div class="respawn-window">重生區間: ${new Date(timer.minRespawnTime).toLocaleTimeString()} ~ ${new Date(timer.maxRespawnTime).toLocaleTimeString()}</div>
            <p class="fixed-respawn-time">固定重生: ${timer.respawnString}</p>
        `;
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTimer(timer.id));
        card.querySelector('.reset-btn').addEventListener('click', () => resetTimer(timer.id));
        // 先暫時放在某處，讓 updateAllTimers 分類
        waitingContainer.appendChild(card);
    }
    
    // --- 事件綁定與啟動 ---
    addTimerBtn.addEventListener('click', addTimer);
    clearAllBtn.addEventListener('click', clearAllTimers); // ⭐ 綁定新按鈕的事件
    channelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTimer();
        }
    });
    
    setupCustomSelect();
    loadBossData().then(() => {
        loadTimers();
        setInterval(updateAllTimers, 1000);
    });
});