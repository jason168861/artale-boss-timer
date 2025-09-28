document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const welcomeScreen = document.getElementById('welcome-screen');
    const bossSelectionGrid = document.getElementById('boss-selection-grid');
    const mainContainer = document.querySelector('.container');
    const channelInput = document.getElementById('channel-input');
    const addTimerBtn = document.getElementById('add-timer-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const respawnReadyContainer = document.getElementById('respawn-ready-container');
    const waitingContainer = document.getElementById('waiting-container');
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = customSelectWrapper.querySelector('.custom-select');
    const customSelectTrigger = customSelectWrapper.querySelector('.custom-select-trigger span');
    const customOptions = customSelectWrapper.querySelector('.custom-options');
    const lootModal = document.getElementById('loot-modal');
    const lootModalTitle = document.getElementById('loot-modal-title');
    const closeLootModalBtn = document.getElementById('close-loot-modal-btn');
    const clearLootBtn = document.getElementById('clear-loot-btn');
    const lootItemContainer = document.getElementById('loot-item-container');

    // 資料變數
    let bossData = {};
    let dropData = {};
    let savedDrops = {};
    let activeTimers = [];
    let pinnedBosses = []; // ⭐ 新增：用於儲存置頂的 BOSS
    let selectedBoss = null;
    let currentLootBoss = null;

    // --- 1. 資料處理與渲染 ---

    // ⭐ 新增：儲存置頂設定到 localStorage
    function savePins() {
        localStorage.setItem('mapleBossPins', JSON.stringify(pinnedBosses));
    }

    // ⭐ 新增：從 localStorage 讀取置頂設定
    function loadPins() {
        const savedPins = localStorage.getItem('mapleBossPins');
        if (savedPins) {
            pinnedBosses = JSON.parse(savedPins);
        }
    }
    
    // ⭐ 新增：切換 BOSS 的置頂狀態
    function togglePin(bossName, event) {
        event.stopPropagation(); // 防止觸發父層的點擊事件（即選擇 BOSS）
        const index = pinnedBosses.indexOf(bossName);
        if (index > -1) {
            pinnedBosses.splice(index, 1); // 如果已置頂，則取消
        } else {
            pinnedBosses.push(bossName); // 如果未置頂，則加入
        }
        savePins();
        renderBossOptions(); // 重新渲染列表以更新順序和樣式
    }
    
    // ⭐ 修改：建立一個專門渲染 BOSS 選項的函式
    function renderBossOptions() {
        // 清空現有選項
        customOptions.innerHTML = '';
        bossSelectionGrid.innerHTML = '';

        // 取得所有 BOSS 名稱並排序（置頂優先，然後按預設順序）
        const allBossNames = Object.keys(bossData);
        allBossNames.sort((a, b) => {
            const isAPinned = pinnedBosses.includes(a);
            const isBPinned = pinnedBosses.includes(b);
            if (isAPinned && !isBPinned) return -1;
            if (!isAPinned && isBPinned) return 1;
            return 0; // 保持原有順序
        });

        // 遍歷排序後的 BOSS 列表來建立元素
        allBossNames.forEach(bossName => {
            const isPinned = pinnedBosses.includes(bossName);

            // 1. 建立下拉選單選項
            const option = document.createElement('div');
            option.className = 'custom-option';
            option.dataset.value = bossName;
            // ⭐ 在 HTML 中加入圖釘按鈕
            option.innerHTML = `
                <span class="pin-btn ${isPinned ? 'active' : ''}" title="置頂/取消置頂">📌</span>
                <img src="./image/${bossName}.png" alt="${bossName}">
                <span>${bossName}</span>
            `;
            
            option.addEventListener('click', () => {
                if (document.querySelector('.custom-option.selected')) {
                    document.querySelector('.custom-option.selected').classList.remove('selected');
                }
                option.classList.add('selected');
                customSelectTrigger.innerHTML = `<img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;
                selectedBoss = bossName;
            });
            
            // ⭐ 為圖釘按鈕綁定置頂事件
            option.querySelector('.pin-btn').addEventListener('click', (e) => togglePin(bossName, e));
            
            customOptions.appendChild(option);

            // 2. 建立歡迎畫面的 BOSS 方格
            const gridItem = document.createElement('div');
            gridItem.className = 'boss-grid-item';
            gridItem.dataset.bossName = bossName;
            gridItem.innerHTML = `<img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;
            gridItem.addEventListener('click', () => selectBossFromWelcomeScreen(bossName));
            bossSelectionGrid.appendChild(gridItem);
        });
    }

    async function loadAllData() {
        try {
            const [bossResponse, dropResponse] = await Promise.all([
                fetch('boss_time.json'),
                fetch('drop.json')
            ]);
            bossData = await bossResponse.json();
            dropData = await dropResponse.json();
            
            renderBossOptions(); // ⭐ 資料載入後，呼叫渲染函式

        } catch (error) {
            console.error('無法載入 JSON 資料:', error);
            alert('錯誤：無法載入 BOSS 或掉落物資料！');
        }
    }
    
    function selectBossFromWelcomeScreen(bossName) {
        const optionToSelect = customOptions.querySelector(`.custom-option[data-value="${bossName}"]`);
        if (optionToSelect) {
            if (document.querySelector('.custom-option.selected')) {
                document.querySelector('.custom-option.selected').classList.remove('selected');
            }
            optionToSelect.classList.add('selected');
            customSelectTrigger.innerHTML = optionToSelect.querySelector('img').outerHTML + optionToSelect.querySelector('span:last-child').outerHTML;
            selectedBoss = bossName;
        }
        welcomeScreen.classList.add('hidden');
        mainContainer.classList.remove('hidden');
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
        if (!mainContainer.classList.contains('hidden') && (!selectedBoss || !channelInput.value)) {
             alert('請選擇 BOSS 並輸入頻道！');
             return;
        }
        
        // 如果是從歡迎頁面直接新增
        if(mainContainer.classList.contains('hidden')) {
             welcomeScreen.classList.add('hidden');
             mainContainer.classList.remove('hidden');
        }

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

    function clearAllTimers() {
        if (activeTimers.length === 0) {
            alert('目前沒有計時器可以清除。');
            return;
        }
        if (confirm('確定要清除所有計時器嗎？此操作無法復原。')) {
            activeTimers = [];
            respawnReadyContainer.innerHTML = '';
            waitingContainer.innerHTML = '';
            saveTimers();
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
                waitingContainer.appendChild(card);
            }
            saveTimers();
        }
    }

    // --- 4. 核心更新迴圈 ---
    function updateAllTimers() {
        const now = Date.now();
        activeTimers.forEach(timer => {
            const card = document.querySelector(`.timer-card[data-timer-id='${timer.id}']`);
            if (!card) return;
            const countdownElement = card.querySelector('.countdown');
            card.classList.remove('status-window-open', 'status-overdue');

            if (now < timer.minRespawnTime) {
                const remainingSeconds = Math.round((timer.minRespawnTime - now) / 1000);
                countdownElement.textContent = `重生倒數: ${formatTime(remainingSeconds)}`;
                countdownElement.style.color = '#f0f0f0';
                if (card.parentElement !== waitingContainer) {
                    waitingContainer.appendChild(card);
                }
            } else {
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
                    respawnReadyContainer.appendChild(card);
                }
            }
        });
    }


    // --- 5. 掉落物 Modal 邏輯 ---
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
        
        const customSort = (a, b) => {
            const getBagPriority = (name) => {
                if (name.includes('銅幣')) return 1;
                if (name.includes('銀幣')) return 2;
                if (name.includes('金幣')) return 3;
                if (name.includes('古幣')) return 4;
                return Infinity;
            };
            const priorityA = getBagPriority(a);
            const priorityB = getBagPriority(b);
            if (priorityA !== Infinity || priorityB !== Infinity) {
                if (priorityA !== priorityB) return priorityA - priorityB;
                const getMultiplier = (name) => {
                    const match = name.match(/X(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };
                return getMultiplier(a) - getMultiplier(b);
            }
            const isAScroll = a.includes('卷軸');
            const isBScroll = b.includes('卷軸');
            if (isAScroll && !isBScroll) return -1;
            if (!isAScroll && isBScroll) return 1;
            const getPercentage = (name) => {
                const match = name.match(/(\d+)%/);
                return match ? parseInt(match[1], 10) : Infinity;
            };
            const percentA = getPercentage(a);
            const percentB = getPercentage(b);
            if (percentA !== percentB) return percentA - percentB;
            return a.localeCompare(b, 'zh-Hant');
        };

        const sortedItems = [...items].sort(customSort);
        const checkedItems = savedDrops[bossName] || [];

        sortedItems.forEach((item, index) => {
            const itemElement = document.createElement('label');
            itemElement.className = 'loot-item';
            const uniqueId = `loot-${currentLootBoss.replace(/\s/g, '-')}-${index}`;
            itemElement.htmlFor = uniqueId;
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
        const checkedInputs = lootItemContainer.querySelectorAll('input[type="checkbox"]:checked');
        const checkedItems = Array.from(checkedInputs).map(input => input.value);
        if (checkedItems.length > 0) {
            savedDrops[currentLootBoss] = checkedItems;
        } else {
            delete savedDrops[currentLootBoss];
        }
        saveDrops();
        lootModal.classList.add('hidden');
        currentLootBoss = null;
    }

    function clearCurrentLoot() {
        if (!currentLootBoss) return;
        if (confirm(`確定要清除【${currentLootBoss}】的所有掉落物紀錄嗎？`)) {
            delete savedDrops[currentLootBoss];
            saveDrops();
            const allCheckboxes = lootItemContainer.querySelectorAll('input[type="checkbox"]');
            allCheckboxes.forEach(checkbox => checkbox.checked = false);
        }
    }

    // --- 6. 本地儲存 & 初始化 ---
    function saveTimers() {
        localStorage.setItem('mapleBossTimers', JSON.stringify(activeTimers));
    }

    function loadTimers() {
        const savedTimers = localStorage.getItem('mapleBossTimers');
        if (savedTimers) {
            activeTimers = JSON.parse(savedTimers);
            // ⭐ 檢查計時器是否過期太久（例如超過一天），可選擇性清除
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            activeTimers = activeTimers.filter(timer => now - timer.defeatTime < oneDay);
            saveTimers(); // 更新儲存

            activeTimers.forEach(timer => createTimerCardForLoad(timer));
            updateAllTimers(); 
        }

        // 如果沒有活動計時器，則顯示歡迎畫面
        // if(activeTimers.length === 0){
        //     welcomeScreen.classList.remove('hidden');
        //     mainContainer.classList.add('hidden');
        // } else {
        //     welcomeScreen.classList.add('hidden');
        //     mainContainer.classList.remove('hidden');
        // }
    }
    
    function saveDrops() {
        localStorage.setItem('mapleBossDrops', JSON.stringify(savedDrops));
    }

    function loadDrops() {
        const data = localStorage.getItem('mapleBossDrops');
        if (data) {
            savedDrops = JSON.parse(data);
        }
    }

    function createTimerCardForLoad(timer) {
        createTimerCard(timer);
    }
    
    // --- 7. 事件綁定與啟動 ---
    function setupCustomSelect() {
        customSelectWrapper.addEventListener('click', (e) => {
            // ⭐ 確保點擊圖釘時不會開關選單
            if(!e.target.classList.contains('pin-btn')){
                customSelect.classList.toggle('open');
            }
        });

        window.addEventListener('click', (e) => {
            if (!customSelectWrapper.contains(e.target)) {
                customSelect.classList.remove('open');
            }
        });
    }
    addTimerBtn.addEventListener('click', addTimer);
    clearAllBtn.addEventListener('click', clearAllTimers);
    channelInput.addEventListener('click', function() {
        this.select();
    });
    channelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTimer();
    });

    closeLootModalBtn.addEventListener('click', closeLootModal);
    clearLootBtn.addEventListener('click', clearCurrentLoot);
    lootModal.addEventListener('click', (e) => {
        if (e.target === lootModal) {
            closeLootModal();
        }
    });
    
    // --- 啟動流程 ---
    setupCustomSelect();
    loadPins(); // ⭐ 先讀取置頂設定
    loadAllData().then(() => {
        loadTimers();
        loadDrops();
        setInterval(updateAllTimers, 1000);
    });
});