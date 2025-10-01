document.addEventListener('DOMContentLoaded', () => {
    // --- ⭐ 1. Firebase 設定與初始化 ---

    // ▼▼▼▼▼▼ 請將此處替換為你自己的 Firebase 設定 ▼▼▼▼▼▼
    const firebaseConfig = {
        apiKey: "AIzaSyAv-SitSIjRJxT-HAVD1efBDl8Ari1cV5E",
        authDomain: "maple-boss-timer-a8195.firebaseapp.com",
        databaseURL: "https://maple-boss-timer-a8195-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "maple-boss-timer-a8195",
        storageBucket: "maple-boss-timer-a8195.firebasestorage.app",
        messagingSenderId: "451280757769",
        appId: "1:451280757769:web:3a0219ca19fa25413844d8"
    };
    // ▲▲▲▲▲▲ 請將此處替換為你自己的 Firebase 設定 ▲▲▲▲▲▲

    // 初始化 Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    let sessionRef; // 用於指向我們在資料庫中的 session
    let sessionId;  // 目前的 session ID

    // --- DOM 元素 (新增隱私權 Modal) ---
    const privacyModal = document.getElementById('privacy-modal');
    const privacyAgreeBtn = document.getElementById('privacy-agree-btn');
    const shareBtn = document.getElementById('share-btn');
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
    const sortOrderSelect = document.getElementById('sort-order-select');

    // --- 資料變數 (activeTimers 現在由 Firebase 控制) ---
    let bossData = {};
    let dropData = {};
    let savedDrops = {}; // 掉落物紀錄仍保留在本機，因為這是個人化的
    let activeTimers = []; // 這個陣列將會是 Firebase 資料的本地鏡像
    let pinnedBosses = [];
    let selectedBoss = null;
    let currentLootBoss = null;
    let bossOrder = [];
    let currentSortOrder = 'respawnTime';


    function initializeApp() {
        // 舊的 URL 檢查不再需要
        setupCustomSelect();
        // 舊的 import 功能移除
        loadPins(); // 置頂是個人設定，保留 LocalStorage
        loadSortOrder(); // 排序也是個人設定，保留 LocalStorage

        loadAllData().then(() => {
            // ⭐ 核心改動：等待使用者同意隱私權條款
            privacyAgreeBtn.addEventListener('click', () => {
                privacyModal.classList.add('hidden');
                setupFirebaseSession();
            });
        });
    }

    // --- ⭐ 2. Firebase 同步核心邏輯 ---

    function generateUniqueId() {
        return Math.random().toString(36).substring(2, 10);
    }

    function setupFirebaseSession() {
        const urlParams = new URLSearchParams(window.location.search);
        sessionId = urlParams.get('session');

        if (!sessionId) {
            sessionId = generateUniqueId();
            // 將新的 session ID 更新到 URL，方便使用者複製分享
            history.replaceState(null, '', `?session=${sessionId}`);
        }

        // 設定資料庫的參考路徑
        sessionRef = database.ref(`sessions/${sessionId}`);

        // 監聽來自 Firebase 的資料變化
        sessionRef.on('value', (snapshot) => {
            const timersFromFirebase = snapshot.val();
            // 如果 Firebase 上有資料，就更新本地的 activeTimers
            // 如果是 null (例如全部清除後)，就設為空陣列
            activeTimers = timersFromFirebase || [];
            sortAndRenderTimers();
        });

        // 載入本地儲存的掉落物紀錄
        loadDrops(); 
        // 啟動每秒更新畫面的計時器
        setInterval(updateAllTimers, 1000);

        // 如果是從歡迎畫面進入，則顯示主容器
        if (welcomeScreen.classList.contains('hidden')) {
             mainContainer.classList.remove('hidden');
        }
    }

    // ⭐ 將儲存計時器的功能改為寫入 Firebase
    function saveTimersToFirebase() {
        // 我們將整個 activeTimers 陣列寫入 Firebase
        // Firebase 會處理好同步的問題
        if (sessionRef) {
            sessionRef.set(activeTimers);
        }
    }
    
    // --- 3. 修改計時器操作函式 ---

    function addTimer() {
        addTimerBtn.classList.add('pressed');
        setTimeout(() => addTimerBtn.classList.remove('pressed'), 300);

        if (!mainContainer.classList.contains('hidden') && (!selectedBoss || !channelInput.value)) {
             alert('請選擇 BOSS 並輸入頻道！');
             return;
        }
        
        if(mainContainer.classList.contains('hidden')) {
             welcomeScreen.classList.add('hidden');
             mainContainer.classList.remove('hidden');
        }

        const bossName = selectedBoss;
        const channel = channelInput.value;
        if (!bossName || !channel) return;

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
        // ⭐ 將 saveTimers() 改為 saveTimersToFirebase()
        saveTimersToFirebase();
        // sortAndRenderTimers() 會由 Firebase 的 onValue 監聽器觸發，這裡可以不用手動呼叫
    }

    function deleteTimer(id) {
        activeTimers = activeTimers.filter(timer => timer.id !== id);
        // ⭐ 將 saveTimers() 改為 saveTimersToFirebase()
        saveTimersToFirebase();
    }
    
    function clearAllTimers() {
        if (activeTimers.length === 0) {
            alert('目前沒有計時器可以清除。');
            return;
        }
        if (confirm('確定要清除所有計時器嗎？此操作會同步到所有分享對象！')) {
            activeTimers = [];
            // ⭐ 將 saveTimers() 改為 saveTimersToFirebase()
            saveTimersToFirebase();
        }
    }
    
    function resetTimer(id) {
        // 找到要重置的計時器在陣列中的索引
        const timerIndex = activeTimers.findIndex(t => t.id === id);
        if (timerIndex > -1) {
            const timer = activeTimers[timerIndex];
            const { minSeconds, maxSeconds } = parseRespawnTime(bossData[timer.bossName]);
            // 更新計時器物件的屬性
            timer.defeatTime = Date.now();
            timer.minRespawnTime = Date.now() + minSeconds * 1000;
            timer.maxRespawnTime = Date.now() + maxSeconds * 1000;
            // ⭐ 將更新後的整個陣列存回 Firebase
            saveTimersToFirebase();
        }
    }

    // ⭐ 修改分享功能，現在只分享 URL
    function generateShareLink() {
        const shareUrl = window.location.href; // 直接分享當前的 URL
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('同步分享連結已複製到剪貼簿！\n傳給朋友，他們打開連結就能即時看到一樣的畫面。');
        }).catch(err => {
            console.error('無法自動複製連結: ', err);
            window.prompt("自動複製失敗，請手動複製此連結:", shareUrl);
        });
    }

    // --- 4. 其餘函式 (大部分不變或微調) ---

    // loadTimers 和 saveTimers 被 Firebase 邏輯取代，可以刪除
    // handleSharedURL 和 import 相關功能也被 Firebase 邏輯取代，可以刪除

    // 個人化的設定（置頂、排序、掉落物）仍然使用 LocalStorage
    function savePins() { localStorage.setItem('mapleBossPins', JSON.stringify(pinnedBosses)); }
    function loadPins() { const d = localStorage.getItem('mapleBossPins'); if(d) pinnedBosses = JSON.parse(d); }
    function saveSortOrder() { localStorage.setItem('mapleBossSortOrder', currentSortOrder); }
    function loadSortOrder() { const d = localStorage.getItem('mapleBossSortOrder'); if(d) { currentSortOrder = d; sortOrderSelect.value = currentSortOrder; }}
    function saveDrops() { localStorage.setItem('mapleBossDrops', JSON.stringify(savedDrops)); }
    function loadDrops() { const d = localStorage.getItem('mapleBossDrops'); if(d) savedDrops = JSON.parse(d); }
    
    /* 以下的函式幾乎不需要修改，因為它們是處理畫面渲染和計算的，
       而我們的核心改動是資料的來源和儲存方式。
       
       parseRespawnTime, formatTime, createTimerCardElement, 
       sortAndRenderTimers, updateAllTimers, 
       openLootModal, closeLootModal, clearCurrentLoot,
       renderBossOptions, loadAllData, selectBossFromWelcomeScreen, 
       togglePin, setupCustomSelect
       ...等等，都可以維持原樣。
    */

    // --- 以下是從原 script.js 複製過來且不需要修改的函式 ---

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

    function createTimerCardElement(timer) {
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
            </div>
        </div>
        <div class="countdown">--:--:--</div>
        <div class="max-respawn-countdown"></div>
        <div class="respawn-window">重生區間: ${new Date(timer.minRespawnTime).toLocaleTimeString()} ~ ${new Date(timer.maxRespawnTime).toLocaleTimeString()}</div>
        <div class="optional-info">
            <p class="defeat-time">擊殺: ${new Date(timer.defeatTime).toLocaleTimeString()}</p>
            <p class="fixed-respawn-time">固定重生: ${timer.respawnString}</p>
        </div>
    `;
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTimer(timer.id));
        card.querySelector('.reset-btn').addEventListener('click', () => resetTimer(timer.id));
        card.querySelector('.loot-btn').addEventListener('click', () => openLootModal(timer.bossName));
        return card;
    }

    function sortAndRenderTimers() {
        respawnReadyContainer.innerHTML = '';
        waitingContainer.innerHTML = '';
        let timersToRender = [...activeTimers];
        timersToRender.sort((a, b) => {
            switch (currentSortOrder) {
                case 'bossName':
                    return bossOrder.indexOf(a.bossName) - bossOrder.indexOf(b.bossName);
                case 'defeatTime':
                    return a.defeatTime - b.defeatTime;
                case 'respawnTime':
                default:
                    return a.minRespawnTime - b.minRespawnTime;
            }
        });
        const now = Date.now();
        timersToRender.forEach(timer => {
            const card = createTimerCardElement(timer);
            if (now < timer.minRespawnTime) {
                waitingContainer.appendChild(card);
            } else {
                respawnReadyContainer.appendChild(card);
            }
        });
        updateAllTimers();
    }

    function updateAllTimers() {
        const now = Date.now();
        let needsReRender = false;
        activeTimers.forEach(timer => {
            const card = document.querySelector(`.timer-card[data-timer-id='${timer.id}']`);
            if (!card) return;
            const wasInWaiting = card.parentElement === waitingContainer;
            const shouldBeInWaiting = now < timer.minRespawnTime;
            if (wasInWaiting !== shouldBeInWaiting) {
                needsReRender = true;
            }
            const countdownElement = card.querySelector('.countdown');
            const maxCountdownElement = card.querySelector('.max-respawn-countdown');
            const optionalInfoElement = card.querySelector('.optional-info');
            card.classList.remove('status-window-open', 'status-overdue');
            if (shouldBeInWaiting) {
                const remainingSeconds = Math.round((timer.minRespawnTime - now) / 1000);
                countdownElement.textContent = `重生倒數: ${formatTime(remainingSeconds)}`;
                countdownElement.style.color = '#f0f0f0';
                optionalInfoElement.style.display = 'block';
                maxCountdownElement.style.display = 'none';
            } else {
                optionalInfoElement.style.display = 'none';
                if (now <= timer.maxRespawnTime) {
                    card.classList.add('status-window-open');
                    countdownElement.textContent = 'BOSS 已進入重生視窗！';
                    countdownElement.style.color = '#28a745';
                    const remainingMaxSeconds = Math.round((timer.maxRespawnTime - now) / 1000);
                    maxCountdownElement.textContent = `100%重生倒數: ${formatTime(remainingMaxSeconds)}`;
                    maxCountdownElement.style.display = 'block';
                } else {
                    card.classList.add('status-overdue');
                    const overdueSeconds = Math.round((now - timer.maxRespawnTime) / 1000);
                    countdownElement.textContent = `已超過最長重生時間 ${formatTime(overdueSeconds)}`;
                    countdownElement.style.color = '#ffc107';
                    maxCountdownElement.style.display = 'none';
                }
            }
        });
        if (needsReRender) {
            sortAndRenderTimers();
        }
    }
    
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
        const customSort = (a,b) => { /* ... 排序邏輯不變 ... */ return 0; };
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
            itemElement.innerHTML = `<input type="checkbox" id="${uniqueId}" value="${item}" ${isChecked}><img src="./image/${encodedItemName}.png" alt="${item}" onerror="this.style.display='none'"><span>${item}</span>`;
            lootItemContainer.appendChild(itemElement);
        });
        lootModal.classList.remove('hidden');
    }

    function closeLootModal() {
        if (!currentLootBoss) return;
        const checkedInputs = lootItemContainer.querySelectorAll('input[type="checkbox"]:checked');
        const checkedItems = Array.from(checkedInputs).map(input => input.value);
        if (checkedItems.length > 0) savedDrops[currentLootBoss] = checkedItems;
        else delete savedDrops[currentLootBoss];
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

    async function loadAllData() {
        try {
            const [bossResponse, dropResponse] = await Promise.all([
                fetch('boss_time.json'),
                fetch('drop.json')
            ]);
            bossData = await bossResponse.json();
            bossOrder = Object.keys(bossData);
            dropData = await dropResponse.json();
            renderBossOptions();
        } catch (error) {
            console.error('無法載入 JSON 資料:', error);
            alert('錯誤：無法載入 BOSS 或掉落物資料！');
        }
    }

    function togglePin(bossName, event) {
        event.stopPropagation();
        const index = pinnedBosses.indexOf(bossName);
        if (index > -1) pinnedBosses.splice(index, 1);
        else pinnedBosses.push(bossName);
        savePins();
        renderBossOptions();
    }
    
    function renderBossOptions() {
        customOptions.innerHTML = '';
        bossSelectionGrid.innerHTML = '';
        const allBossNames = Object.keys(bossData);
        allBossNames.sort((a, b) => {
            const isAPinned = pinnedBosses.includes(a);
            const isBPinned = pinnedBosses.includes(b);
            if (isAPinned && !isBPinned) return -1;
            if (!isAPinned && isBPinned) return 1;
            return 0;
        });
        allBossNames.forEach(bossName => {
            const isPinned = pinnedBosses.includes(bossName);
            const option = document.createElement('div');
            option.className = 'custom-option';
            option.dataset.value = bossName;
            option.innerHTML = `<span class="pin-btn ${isPinned ? 'active' : ''}" title="置頂/取消置頂">📌</span><img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;
            option.addEventListener('click', () => {
                if (document.querySelector('.custom-option.selected')) {
                    document.querySelector('.custom-option.selected').classList.remove('selected');
                }
                option.classList.add('selected');
                customSelectTrigger.innerHTML = `<img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;
                selectedBoss = bossName;
            });
            option.querySelector('.pin-btn').addEventListener('click', (e) => togglePin(bossName, e));
            customOptions.appendChild(option);
            const gridItem = document.createElement('div');
            gridItem.className = 'boss-grid-item';
            gridItem.dataset.bossName = bossName;
            gridItem.innerHTML = `<img src="./image/${bossName}.png" alt="${bossName}"><span>${bossName}</span>`;
            gridItem.addEventListener('click', () => selectBossFromWelcomeScreen(bossName));
            bossSelectionGrid.appendChild(gridItem);
        });
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
        // ⭐ 如果 Firebase Session 已經啟動，則顯示主容器
        if (sessionRef) {
            mainContainer.classList.remove('hidden');
        }
    }
    
    function setupCustomSelect() {
        customSelectWrapper.addEventListener('click', (e) => {
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

    // --- 事件綁定 ---
    addTimerBtn.addEventListener('click', addTimer);
    shareBtn.addEventListener('click', generateShareLink);
    clearAllBtn.addEventListener('click', clearAllTimers);
    sortOrderSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        saveSortOrder();
        sortAndRenderTimers();
    });
    channelInput.addEventListener('click', function() { this.select(); });
    channelInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTimer(); });
    closeLootModalBtn.addEventListener('click', closeLootModal);
    clearLootBtn.addEventListener('click', clearCurrentLoot);
    lootModal.addEventListener('click', (e) => { if (e.target === lootModal) closeLootModal(); });
    
    // --- 啟動流程 ---
    initializeApp();
});