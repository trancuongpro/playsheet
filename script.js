// Toàn bộ nội dung file script.js đã được cập nhật

document.addEventListener('DOMContentLoaded', () => {
    // ---- Khai báo các đối tượng và biến trạng thái ----
    let osmd;
    let audioPlayer;
    let isSheetLoaded = false;
    let customCursor;
    let lastCursorX = null; // Lưu vị trí X trước đó để phát hiện thay đổi note

    // ---- Lấy các phần tử DOM ----
    const fileInput = document.getElementById('file-input');
    const osmdContainer = document.getElementById('osmd-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');

    // ---- Hàm cập nhật trạng thái các nút ----
    function updateAllButtonsState() {
        if (!isSheetLoaded) {
            [playBtn, pauseBtn, stopBtn].forEach(btn => btn.disabled = true);
            return;
        }
        playBtn.disabled = false;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
    }

    // ---- Hàm cập nhật vị trí con trỏ tùy chỉnh ----
    function updateCustomCursor() {
        if (!isSheetLoaded || !customCursor || !osmd.cursor) return;
        const cursorElement = osmd.cursor.cursorElement;
        if (cursorElement) {
            const rect = cursorElement.getBoundingClientRect();
            const containerRect = osmdContainer.getBoundingClientRect();
            const x = rect.left - containerRect.left + rect.width / 2 - 6; // Căn giữa con trỏ
            const y = rect.top - containerRect.top + rect.height / 2 - 6;

            // Kiểm tra xem con trỏ có di chuyển sang note mới không
            if (lastCursorX !== null && Math.abs(x - lastCursorX) > 3) { // Ngưỡng 3px
                // Áp dụng hiệu ứng nhảy vòng cung
                customCursor.classList.remove('jumping');
                void customCursor.offsetWidth; // Trigger reflow để reset animation
                customCursor.classList.add('jumping');
                customCursor.style.left = `${x}px`; // Di chuyển ngang
                customCursor.style.top = `${y}px`;
            } else {
                customCursor.style.left = `${x}px`;
                customCursor.style.top = `${y}px`;
            }
            lastCursorX = x;
            customCursor.style.display = 'block';
        }
    }

    // ---- Các hàm điều khiển ----
    async function play() {
        if (!isSheetLoaded || audioPlayer.state === 'PLAYING') return;
        
        if (audioPlayer.ac.state !== 'running') {
            try {
                await audioPlayer.ac.resume();
            } catch (e) {
                console.error("Lỗi khi khởi động ngữ cảnh âm thanh:", e);
                return;
            }
        }

        try {
            await audioPlayer.play();
            customCursor.style.display = 'block';
            osmd.cursor.show();
            if (audioPlayer.state === 'PLAYING') {
                requestAnimationFrame(updateCustomCursorLoop);
            }
        } catch (e) {
            console.error("Lỗi khi phát nhạc:", e);
        }
    }

    function pause() {
        if (!isSheetLoaded || audioPlayer.state !== 'PLAYING') return;
        audioPlayer.pause();
        customCursor.style.display = 'block';
    }

    function stop() {
        if (!isSheetLoaded) return;
        audioPlayer.stop();
        osmd.cursor.reset();
        osmd.cursor.show();
        lastCursorX = null; // Reset vị trí X
        updateCustomCursor();
    }

    // ---- Vòng lặp cập nhật con trỏ ----
    function updateCustomCursorLoop() {
        if (audioPlayer.state === 'PLAYING') {
            updateCustomCursor();
            requestAnimationFrame(updateCustomCursorLoop);
        }
    }

    // ---- Hàm xử lý khi người dùng chọn file ----
    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (isSheetLoaded) {
            try { audioPlayer.stop(); } catch (e) { /* Bỏ qua lỗi */ }
        }
        
        isSheetLoaded = false;
        loadingIndicator.style.display = 'block';
        customCursor.style.display = 'none';
        updateAllButtonsState();

        try {
            const xmlString = await file.text();
            
            await osmd.load(xmlString);
            osmd.render();
            await audioPlayer.loadScore(osmd);
            
            isSheetLoaded = true;
            osmd.cursor.reset();
            osmd.cursor.show();
            lastCursorX = null; // Reset vị trí X
            updateCustomCursor();
            
        } catch (error) {
            isSheetLoaded = false;
            console.error("Lỗi khi xử lý file:", error);
            alert("Không thể xử lý file này. Lỗi: " + error.message);
        } finally {
            loadingIndicator.style.display = 'none';
            updateAllButtonsState();
        }
    }

    // ---- Hàm khởi tạo chính ----
    function initialize() {
        osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(osmdContainer, {
            autoResize: true,
            backend: "svg",
            followCursor: true,
        });
        audioPlayer = new OsmdAudioPlayer();
        
        // Tạo con trỏ tùy chỉnh
        customCursor = document.createElement('div');
        customCursor.id = 'custom-cursor';
        osmdContainer.appendChild(customCursor);
        customCursor.style.display = 'none';

        audioPlayer.on("stop", () => {
            if (osmd.cursor.Iterator.EndReached) {
                stop();
            }
        });
        
        audioPlayer.on("cursorPositionChanged", updateCustomCursor);
        
        fileInput.addEventListener('change', handleFileSelect);
        playBtn.addEventListener('click', play);
        pauseBtn.addEventListener('click', pause);
        stopBtn.addEventListener('click', stop);

        updateAllButtonsState();
    }

    initialize();
});