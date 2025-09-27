document.addEventListener('DOMContentLoaded', () => {
    // ⭐ 新增：歡迎畫面和主容器的 DOM 元素
    const welcomeScreen = document.getElementById('welcome-screen');
    const bossSelectionGrid = document.getElementById('boss-selection-grid');
    const mainContainer = document.querySelector('.container');

    // 主計時器畫面的 DOM 元素
    const channelInput = document.getElementById('channel-input');
    const addTimerBtn = document.getElementById('add-timer-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const respawnReadyContainer = document.getElementById('respawn-ready-container');
    const waitingContainer = document.getElementById('waiting-container');
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = customSelectWrapper.querySelector('.custom-select');
    const customSelectTrigger = customSelectWrapper.querySelector('.custom-select-trigger span');
    const customOptions = customSelectWrapper.querySelector('.custom-options');

    // Modal DOM 元素
    const lootModal = document.getElementById('loot-modal');
    const lootModalTitle = document.getElementById('loot-modal-title');
    const closeLootModalBtn = document.getElementById('close-loot-modal-btn');
    const clearLootBtn = document.getElementById('clear-loot-btn');
    const lootItemContainer = document.getElementById('loot-item-container');

    let bossData = {};
    let dropData = {};
    let savedDrops = {};
    let activeTimers = [];
    let selectedBoss = null;
    let currentLootBoss = null;

    // --- ⭐ 修改：資料載入函式 ---
    async function loadAllData() {
        try {
            const bossResponse = await fetch('boss_time.json');
            bossData = await bossResponse.json();

            // ⭐ 同時產生下拉選單選項 和 歡迎畫面的方格
            for (const bossName in bossData) {
                // 1. 建立下拉選單選項 (原本的邏輯)
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

                // 2. ⭐ 建立歡迎畫面的 BOSS 方格
                const gridItem = document.createElement('div');
                gridItem.className = 'boss-grid-item';
                gridItem.dataset.bossName = bossName;
                gridItem.innerHTML = `<img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;

                // 綁定點擊事件，點擊後選定 BOSS 並切換畫面
                gridItem.addEventListener('click', () => selectBossFromWelcomeScreen(bossName));
                bossSelectionGrid.appendChild(gridItem);
            }

            const dropResponse = await fetch('drop.json');
            dropData = await dropResponse.json();

        } catch (error) {
            console.error('無法載入 JSON 資料:', error);
            alert('錯誤：無法載入 BOSS 或掉落物資料！');
        }
    }
    
    // --- ⭐ 新增：從歡迎畫面選擇 BOSS 的函式 ---
    function selectBossFromWelcomeScreen(bossName) {
        // 1. 在下拉選單中找到對應的選項
        const optionToSelect = customOptions.querySelector(`.custom-option[data-value="${bossName}"]`);
        if (optionToSelect) {
            // 2. 模擬點擊或手動設定狀態，來更新下拉選單
            if (document.querySelector('.custom-option.selected')) {
                document.querySelector('.custom-option.selected').classList.remove('selected');
            }
            optionToSelect.classList.add('selected');
            customSelectTrigger.innerHTML = optionToSelect.innerHTML;
            selectedBoss = bossName; // 設定全域變數
        }

        // 3. 切換畫面
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

    // --- 4. 核心更新迴圈 (無變動) ---
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


    // --- 掉落物 Modal 邏輯 (無變動) ---
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
    // --- 5. 本地儲存 & 初始化 (無變動) ---
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
    
    // 啟動流程 (無變動)
    setupCustomSelect();
    loadAllData().then(() => {
        loadTimers();
        loadDrops();
        setInterval(updateAllTimers, 1000);
    });
});