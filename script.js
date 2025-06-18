// Toàn bộ nội dung file script.js đã được cập nhật và tối ưu hóa

document.addEventListener('DOMContentLoaded', () => {
    // ---- Khai báo các đối tượng và biến trạng thái ----
    let osmd;
    let audioPlayer;
    let isSheetLoaded = false;
    let customCursor;
    let lastCursorX = null;
    let currentTranspose = 0;
    let originalXmlString = '';

    // ---- Lấy các phần tử DOM ----
    const fileInput = document.getElementById('file-input');
    const osmdContainer = document.getElementById('osmd-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const transposeUpBtn = document.getElementById('transpose-up-btn');
    const transposeDownBtn = document.getElementById('transpose-down-btn');
    const transposeValueDisplay = document.getElementById('transpose-value');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // ---- Hàm cập nhật trạng thái các nút ----
    function updateAllButtonsState() {
        const disabled = !isSheetLoaded;
        [playBtn, pauseBtn, stopBtn, transposeUpBtn, transposeDownBtn, exportPdfBtn].forEach(btn => btn.disabled = disabled);
    }

    // ---- Hàm cập nhật vị trí con trỏ tùy chỉnh ----
    function updateCustomCursor() {
        if (!isSheetLoaded || !customCursor || !osmd.cursor) return;
        const cursorElement = osmd.cursor.cursorElement;
        if (cursorElement) {
            const rect = cursorElement.getBoundingClientRect();
            const containerRect = osmdContainer.getBoundingClientRect();
            const x = rect.left - containerRect.left + rect.width / 2 - 6;
            const y = rect.top - containerRect.top + rect.height / 2 - 6;

            if (lastCursorX !== null && Math.abs(x - lastCursorX) > 3) {
                customCursor.classList.remove('jumping');
                void customCursor.offsetWidth;
                customCursor.classList.add('jumping');
            }
            customCursor.style.left = `${x}px`;
            customCursor.style.top = `${y}px`;
            
            lastCursorX = x;
            customCursor.style.display = 'block';
        }
    }

    // ---- Các hàm điều khiển ----
    async function play() {
        if (!isSheetLoaded || audioPlayer.state === 'PLAYING') return;
        if (audioPlayer.ac.state !== 'running') {
            try { await audioPlayer.ac.resume(); } catch (e) { console.error("Lỗi:", e); return; }
        }
        await audioPlayer.play();
    }

    function pause() {
        if (audioPlayer.state === 'PLAYING') {
            audioPlayer.pause();
        }
    }

    function stop() {
        if (!isSheetLoaded) return;
        audioPlayer.stop();
        osmd.cursor.reset();
        osmd.cursor.show();
        lastCursorX = null;
        updateCustomCursor();
    }
    
    // ---- Vòng lặp cập nhật con trỏ ----
    function onPlaybackStateChanged() {
        if (audioPlayer.state === 'PLAYING') {
            customCursor.style.display = 'block';
            osmd.cursor.show();
            requestAnimationFrame(updateCustomCursorLoop);
        } else {
            customCursor.style.display = 'block';
        }
    }

    function updateCustomCursorLoop() {
        if (audioPlayer.state === 'PLAYING') {
            updateCustomCursor();
            requestAnimationFrame(updateCustomCursorLoop);
        }
    }
    
    // ---- Hàm xử lý transpose ----
    async function transpose(step) {
        if (!isSheetLoaded) return;
        if (audioPlayer.state === 'PLAYING' || audioPlayer.state === 'PAUSED') {
            audioPlayer.stop();
        }
        currentTranspose += step;
        transposeValueDisplay.textContent = currentTranspose >= 0 ? `+${currentTranspose}` : currentTranspose;
        loadingIndicator.style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 10));
        try {
            const transposedXml = applyTransposeToXml(originalXmlString, currentTranspose);
            await osmd.load(transposedXml);
            osmd.render();
            await audioPlayer.loadScore(osmd);
            osmd.cursor.reset();
            osmd.cursor.show();
            lastCursorX = null;
            updateCustomCursor();
        } catch (e) {
            console.error("Lỗi khi transpose:", e);
            alert("Đã xảy ra lỗi khi dịch giọng: " + e.message);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // ---- Hàm trợ giúp để transpose XML ----
    function applyTransposeToXml(xmlString, transpose) {
        if (transpose === 0) return xmlString;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const notes = xmlDoc.getElementsByTagName("note");
        const transposeCalculator = new opensheetmusicdisplay.TransposeCalculator();

        for (let i = 0; i < notes.length; i++) {
            const noteNode = notes[i];
            const pitchNode = noteNode.getElementsByTagName("pitch")[0];
            const restNode = noteNode.getElementsByTagName("rest")[0];
            
            if (pitchNode && !restNode) {
                const stepNode = pitchNode.getElementsByTagName("step")[0];
                const alterNode = pitchNode.getElementsByTagName("alter")[0];
                const octaveNode = pitchNode.getElementsByTagName("octave")[0];
                
                if (stepNode && octaveNode) {
                    const step = stepNode.textContent;
                    const octave = parseInt(octaveNode.textContent, 10);
                    const alter = alterNode ? parseInt(alterNode.textContent, 10) : 0;
                    
                    const pitch = new opensheetmusicdisplay.Pitch(
                        opensheetmusicdisplay.NoteEnum[step],
                        octave,
                        opensheetmusicdisplay.Pitch.AccidentalFromHalfTones(alter)
                    );

                    const keyInstruction = new opensheetmusicdisplay.KeyInstruction();
                    const transposedPitch = transposeCalculator.transposePitch(pitch, keyInstruction, transpose);
                    
                    stepNode.textContent = opensheetmusicdisplay.Pitch.getNoteEnumString(transposedPitch.FundamentalNote);
                    octaveNode.textContent = transposedPitch.Octave.toString();
                    
                    const newAlter = transposedPitch.AccidentalHalfTones;
                    if (newAlter !== 0) {
                        if (alterNode) {
                            alterNode.textContent = newAlter.toString();
                        } else {
                            const newAlterNode = xmlDoc.createElement("alter");
                            newAlterNode.textContent = newAlter.toString();
                            pitchNode.insertBefore(newAlterNode, octaveNode);
                        }
                    } else if (alterNode) {
                        pitchNode.removeChild(alterNode);
                    }
                }
            }
        }
        return new XMLSerializer().serializeToString(xmlDoc);
    }

    // ---- Hàm xuất PDF - Đã cập nhật để render chuẩn A4 ----
    async function exportToPdf() {
        if (!isSheetLoaded) return;
        loadingIndicator.textContent = "Đang tạo file PDF...";
        loadingIndicator.style.display = 'block';

        // Lưu trạng thái autoResize hiện tại
        const originalAutoResize = osmd.autoResize;

        try {
            // 1. Tắt autoResize và đặt kích thước cố định để render chuẩn
            osmd.setOptions({ autoResize: false });
            osmd.EngravingRules.PageFormat = opensheetmusicdisplay.OpenSheetMusicDisplay.PageFormatStandards.A4_P;
            osmd.render(); 

            // Chờ một chút để SVG được render lại hoàn toàn trong DOM
            await new Promise(resolve => setTimeout(resolve, 500));

            // 2. Tiến hành xuất PDF
            const { jsPDF } = window.jspdf;
            if (typeof jsPDF === 'undefined') throw new Error("Thư viện jsPDF chưa được tải.");
            if (typeof (new jsPDF()).svg !== 'function') throw new Error("Thư viện svg2pdf.js chưa được tải hoặc không tương thích.");

            const pages = osmd.graphic.MusicPages.length;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4'
            });

            for (let i = 0; i < pages; i++) {
                if (i > 0) {
                    pdf.addPage('a4', 'p');
                }
                const svgElement = document.getElementById(`osmdSvgPage${i + 1}`);
                if (svgElement) {
                    await pdf.svg(svgElement, {
                        x: 0,
                        y: 0,
                        width: pdf.internal.pageSize.getWidth(),
                        height: pdf.internal.pageSize.getHeight(),
                    });
                }
            }
            
            const sheetTitle = osmd.Sheet.TitleString || 'sheet';
            pdf.save(`${sheetTitle}.pdf`);

        } catch (e) {
            console.error("Lỗi khi xuất PDF:", e);
            alert("Không thể xuất file PDF. Lỗi: " + e.message);
        } finally {
            // 3. Khôi phục lại cài đặt ban đầu
            loadingIndicator.textContent = "Đang Tải Và Xử Lý Sheet...";
            loadingIndicator.style.display = 'none';

            // Render lại với cài đặt cũ để giao diện trở lại bình thường
            osmd.setOptions({ autoResize: originalAutoResize });
            osmd.render();
        }
    }

    // ---- Hàm xử lý khi người dùng chọn file ----
    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (isSheetLoaded) {
            try { audioPlayer.stop(); } catch (e) {}
        }
        
        isSheetLoaded = false;
        loadingIndicator.style.display = 'block';
        customCursor.style.display = 'none';
        
        currentTranspose = 0;
        transposeValueDisplay.textContent = '0';

        updateAllButtonsState();

        try {
            originalXmlString = await file.text();
            
            await osmd.load(originalXmlString);
            osmd.render();
            await audioPlayer.loadScore(osmd);
            
            isSheetLoaded = true;
            osmd.cursor.reset();
            osmd.cursor.show();
            lastCursorX = null; 
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
        
        customCursor = document.createElement('div');
        customCursor.id = 'custom-cursor';
        osmdContainer.appendChild(customCursor);
        customCursor.style.display = 'none';

        audioPlayer.on("playbackStateChanged", onPlaybackStateChanged);
        audioPlayer.on("cursorPositionChanged", updateCustomCursor);
        audioPlayer.on("stop", () => {
            if (osmd.cursor.Iterator.EndReached) {
                stop();
            }
        });
        
        fileInput.addEventListener('change', handleFileSelect);
        playBtn.addEventListener('click', play);
        pauseBtn.addEventListener('click', pause);
        stopBtn.addEventListener('click', stop);
        transposeUpBtn.addEventListener('click', () => transpose(1));
        transposeDownBtn.addEventListener('click', () => transpose(-1));
        exportPdfBtn.addEventListener('click', exportToPdf);

        updateAllButtonsState();
    }

    initialize();
});