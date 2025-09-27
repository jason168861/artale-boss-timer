document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素獲取
    const channelInput = document.getElementById('channel-input');
    const addTimerBtn = document.getElementById('add-timer-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const respawnReadyContainer = document.getElementById('respawn-ready-container');
    const waitingContainer = document.getElementById('waiting-container');
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = customSelectWrapper.querySelector('.custom-select');
    const customSelectTrigger = customSelectWrapper.querySelector('.custom-select-trigger span');
    const customOptions = customSelectWrapper.querySelector('.custom-options');

    // ⭐ 新增 Modal DOM 元素
    const lootModal = document.getElementById('loot-modal');
    const lootModalTitle = document.getElementById('loot-modal-title');
    const closeLootModalBtn = document.getElementById('close-loot-modal-btn');
    const clearLootBtn = document.getElementById('clear-loot-btn'); // ⭐ 獲取清除按鈕
    const lootItemContainer = document.getElementById('loot-item-container');

    let bossData = {};
    let dropData = {}; // ⭐ 新增：儲存掉落物資料
    let savedDrops = {}; // ⭐ 新增：儲存已勾選的掉落物
    let activeTimers = [];
    let selectedBoss = null;
    let currentLootBoss = null; // ⭐ 新增：紀錄當前開啟 Modal 的 BOSS

    // --- 1. 資料載入 ---
    async function loadAllData() {
        try {
            // 載入 BOSS 時間
            const bossResponse = await fetch('boss_time.json');
            bossData = await bossResponse.json();
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
                    customSelectTrigger.innerHTML = option.innerHTML;
                    selectedBoss = bossName;
                });
                customOptions.appendChild(option);
            }

            // ⭐ 載入掉落物資料
            const dropResponse = await fetch('drop.json');
            dropData = await dropResponse.json();

        } catch (error) {
            console.error('無法載入 JSON 資料:', error);
            alert('錯誤：無法載入 BOSS 或掉落物資料！');
        }
    }

    // --- 2. 核心計時器邏輯 (無變動) ---
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
        // ... (此函式無變動)
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
        // ⭐ 在 innerHTML 中新增掉落物按鈕
        card.innerHTML = `
        <div class="card-buttons">
            <button class="loot-btn" title="掉落物紀錄">💰</button>
            <button class="reset-btn" title="重置計時">↻</button>
            <button class="delete-btn" title="刪除">X</button>
        </div>
        <div class="card-header">
            <div class="boss-portrait">
                <img src="./image/${timer.bossName}.png" alt="${timer.bossName}" onerror="this.style.display='none'">
                <div class="channel-display">${timer.channel}</div>
            </div>
            <div class="title-group">
                <h3>${timer.bossName}</h3>
                <div class="timer-info">
                     <p class="defeat-time">擊殺: ${new Date(timer.defeatTime).toLocaleTimeString()}</p>
                </div>
            </div>
        </div>
        <div class="countdown">--:--:--</div>
        <div class="respawn-window">重生區間: ${new Date(timer.minRespawnTime).toLocaleTimeString()} ~ ${new Date(timer.maxRespawnTime).toLocaleTimeString()}</div>
        <p class="fixed-respawn-time">固定重生: ${timer.respawnString}</p>
    `;
        // ⭐ 綁定事件
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTimer(timer.id));
        card.querySelector('.reset-btn').addEventListener('click', () => resetTimer(timer.id));
        card.querySelector('.loot-btn').addEventListener('click', () => openLootModal(timer.bossName));
        waitingContainer.appendChild(card);
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


    // --- 4. ⭐ 新增：掉落物 Modal 邏輯 ---
    function openLootModal(bossName) {
        currentLootBoss = bossName;
        lootModalTitle.textContent = `${bossName} 掉落物紀錄`;
        lootItemContainer.innerHTML = '';

        const items = dropData[bossName];
        if (!items || items.length === 0) {
            lootItemContainer.innerHTML = '<p>這個 BOSS 沒有設定掉落物資料。</p>';
            lootModal.classList.remove('hidden');
            return;
        }

        // ⭐ 需求 2：實作更進階的自訂排序邏輯
        const customSort = (a, b) => {
            // 規則 1: 錢袋最優先，並依照指定順序排列
            const getBagPriority = (name) => {
                if (name.includes('銅幣')) return 1;
                if (name.includes('銀幣')) return 2;
                if (name.includes('金幣')) return 3;
                if (name.includes('古幣')) return 4;
                return Infinity; // 不是錢袋，優先度最低
            };
            
            const priorityA = getBagPriority(a);
            const priorityB = getBagPriority(b);

            // 如果至少有一個是錢袋
            if (priorityA !== Infinity || priorityB !== Infinity) {
                // 如果優先度不同 (例如: 一個銅幣一個銀幣，或一個錢袋一個卷軸)
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                // 如果是同種錢袋 (例如: 都是銅幣)，則依照 X 後面的數字排序
                const getMultiplier = (name) => {
                    const match = name.match(/X(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };
                return getMultiplier(a) - getMultiplier(b);
            }

            // --- 如果都不是錢袋，才執行後面的規則 ---
            const isAScroll = a.includes('卷軸');
            const isBScroll = b.includes('卷軸');

            // 規則 2: "卷軸" 類別的排前面
            if (isAScroll && !isBScroll) return -1;
            if (!isAScroll && isBScroll) return 1;

            // 規則 3: 依照百分比排序
            const getPercentage = (name) => {
                const match = name.match(/(\d+)%/);
                return match ? parseInt(match[1], 10) : Infinity;
            };
            const percentA = getPercentage(a);
            const percentB = getPercentage(b);
            if (percentA !== percentB) {
                return percentA - percentB;
            }

            // 規則 4: 預設文字排序
            return a.localeCompare(b, 'zh-Hant');
        };

        const sortedItems = [...items].sort(customSort);
        const checkedItems = savedDrops[bossName] || [];

        sortedItems.forEach((item, index) => {
            const itemElement = document.createElement('label');
            itemElement.className = 'loot-item';
            const uniqueId = `loot-${currentLootBoss.replace(/\s/g, '-')}-${index}`;
            itemElement.htmlFor = uniqueId;

            // ⭐ 需求 1：處理錢袋圖片路徑，移除結尾的 "Xn"
            const imageName = item.replace(/X\d+$/, '');
            const encodedItemName = encodeURIComponent(imageName);
            const isChecked = checkedItems.includes(item) ? 'checked' : '';

            itemElement.innerHTML = `
                <input type="checkbox" id="${uniqueId}" value="${item}" ${isChecked}>
                <img src="./image/${encodedItemName}.png" alt="${item}" onerror="this.style.display='none'">
                <span>${item}</span>
            `;
            lootItemContainer.appendChild(itemElement);
        });

        lootModal.classList.remove('hidden');
    }

    function closeLootModal() {
        if (!currentLootBoss) return;

        // 儲存勾選狀態
        const checkedInputs = lootItemContainer.querySelectorAll('input[type="checkbox"]:checked');
        const checkedItems = Array.from(checkedInputs).map(input => input.value);
        
        if (checkedItems.length > 0) {
            savedDrops[currentLootBoss] = checkedItems;
        } else {
            delete savedDrops[currentLootBoss]; // 如果沒有勾選任何物品，則刪除該 BOSS 的紀錄
        }
        
        saveDrops(); // 保存到 localStorage

        lootModal.classList.add('hidden');
        currentLootBoss = null;
    }

    function clearCurrentLoot() {
        if (!currentLootBoss) return;

        if (confirm(`確定要清除【${currentLootBoss}】的所有掉落物紀錄嗎？`)) {
            // 1. 從 savedDrops 物件中刪除這個 BOSS 的資料
            delete savedDrops[currentLootBoss];
            
            // 2. 更新 localStorage
            saveDrops();

            // 3. 將畫面上所有 checkbox 取消勾選
            const allCheckboxes = lootItemContainer.querySelectorAll('input[type="checkbox"]');
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });

            // 可以選擇在這裡顯示一個短暫的成功訊息，但目前這樣已經很清楚了
        }
    }
    // --- 5. 本地儲存 & 初始化 ---
    function saveTimers() {
        localStorage.setItem('mapleBossTimers', JSON.stringify(activeTimers));
    }

    function loadTimers() {
        const savedTimers = localStorage.getItem('mapleBossTimers');
        if (savedTimers) {
            activeTimers = JSON.parse(savedTimers);
            activeTimers.forEach(timer => createTimerCardForLoad(timer));
            updateAllTimers(); 
        }
    }
    
    // ⭐ 新增：掉落物紀錄的本地儲存
    function saveDrops() {
        localStorage.setItem('mapleBossDrops', JSON.stringify(savedDrops));
    }

    function loadDrops() {
        const data = localStorage.getItem('mapleBossDrops');
        if (data) {
            savedDrops = JSON.parse(data);
        }
    }

    // 專為載入設計的創卡函式
    function createTimerCardForLoad(timer) {
        // 這邊的邏輯與 createTimerCard 完全相同，所以直接呼叫它
        // 這樣可以確保不管是新建立還是載入的卡片，都有掉落物按鈕與事件
        createTimerCard(timer);
        // 唯一的不同是載入時不需要再加到 activeTimers 和 saveTimers，
        // 因為 loadTimers 函式已經處理好了。
    }
    
    // --- 6. 事件綁定與啟動 ---
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
    addTimerBtn.addEventListener('click', addTimer);
    clearAllBtn.addEventListener('click', clearAllTimers);
    channelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTimer();
    });

    // ⭐ 綁定 Modal 關閉事件
    closeLootModalBtn.addEventListener('click', closeLootModal);
    clearLootBtn.addEventListener('click', clearCurrentLoot); // ⭐ 綁定清除事件
    lootModal.addEventListener('click', (e) => {
        if (e.target === lootModal) { // 點擊背景遮罩時關閉
            closeLootModal();
        }
    });
    
    setupCustomSelect();
    // 修改啟動流程
    loadAllData().then(() => {
        loadTimers();
        loadDrops(); // ⭐ 載入已儲存的掉落物紀錄
        setInterval(updateAllTimers, 1000);
    });

    // (省略其他未變動的函式...)
    // 為了簡潔，我將未變動的函式內容折疊。請確保你的檔案中有這些函式的完整內容。
    // deleteTimer, clearAllTimers, resetTimer, updateAllTimers, setupCustomSelect
    // (這些函式我已在上面正確的位置標示為無變動)
});