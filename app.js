/**
 * InpaintLab - Client-side Watermark & Object Remover
 * Logic & Computer Vision Integration using OpenCV.js
 */

// Application State
let originalWidth = 0;
let originalHeight = 0;
let displayWidth = 0;      // 編輯器用顯示寬度，限制在 maxDisplayDim 以內以保證效能
let displayHeight = 0;     // 編輯器用顯示高度，限制在 maxDisplayDim 以內以保證效能
let displayScale = 1.0;    // 原圖尺寸與顯示尺寸之間的縮放比例
let zoomScale = 1.0;
let isDrawing = false;
let currentTool = 'brush'; // 'brush' or 'eraser'
let lastX = 0;
let lastY = 0;

// Canvas Elements (Main and Offscreen)
let imageCanvas = null;       // Offscreen canvas containing the current cleaned image
let maskCanvas = null;        // Offscreen canvas containing the transparent+white mask strokes
let originalImageElement = null; // HTML Image element containing the pristine uploaded image (for comparison)
let displayImageCanvas = null;  // Offscreen canvas containing the display-resolution cleaned image
let displayCanvas = null;     // On-screen visible canvas
let displayCtx = null;
let overlayCanvas = null;     // Persistent offscreen canvas for rendering the mask overlay
let overlayCtx = null;

// History for Undo/Redo
let undoHistory = [];
let redoHistory = [];

// DOM Elements
let loaderOverlay = null;
let uploadScreen = null;
let editorScreen = null;
let canvasContainer = null;
let brushCursor = null;

// Controls
let fileInput = null;
let browseBtn = null;
let dropZone = null;
let brushSizeSlider = null;
let brushSizeVal = null;
let inpaintRadiusSlider = null;
let inpaintRadiusVal = null;
let inpaintMethodSelect = null;

// Buttons
let btnBrush = null;
let btnEraser = null;
let btnUndo = null;
let btnRedo = null;
let btnClearMask = null;
let btnBackToUpload = null;
let btnZoomIn = null;
let btnZoomOut = null;
let btnZoomFit = null;
let zoomLevelText = null;
let btnInpaint = null;
let btnCompare = null;
let btnDownload = null;

let appInitialized = false;

// Initialize Application once DOM is ready
window.initApp = function() {
    if (appInitialized) {
        console.log("AlbertImageLab: App already initialized, skipping.");
        return;
    }
    appInitialized = true;
    console.log("AlbertImageLab: Initializing app...");
    
    // Cache DOM Elements
    loaderOverlay = document.getElementById('loader-overlay');
    uploadScreen = document.getElementById('upload-screen');
    editorScreen = document.getElementById('editor-screen');
    canvasContainer = document.getElementById('canvas-container');
    brushCursor = document.getElementById('brush-cursor');
    
    fileInput = document.getElementById('file-input');
    browseBtn = document.getElementById('browse-btn');
    dropZone = document.getElementById('drop-zone');
    
    brushSizeSlider = document.getElementById('brush-size');
    brushSizeVal = document.getElementById('brush-size-val');
    inpaintRadiusSlider = document.getElementById('inpaint-radius');
    inpaintRadiusVal = document.getElementById('inpaint-radius-val');
    inpaintMethodSelect = document.getElementById('inpaint-method');
    
    btnBrush = document.getElementById('tool-brush');
    btnEraser = document.getElementById('tool-eraser');
    btnUndo = document.getElementById('btn-undo');
    btnRedo = document.getElementById('btn-redo');
    btnClearMask = document.getElementById('btn-clear-mask');
    btnBackToUpload = document.getElementById('btn-back-to-upload');
    
    btnZoomIn = document.getElementById('btn-zoom-in');
    btnZoomOut = document.getElementById('btn-zoom-out');
    btnZoomFit = document.getElementById('btn-zoom-fit');
    zoomLevelText = document.getElementById('zoom-level-text');
    
    btnInpaint = document.getElementById('btn-inpaint');
    btnCompare = document.getElementById('btn-compare');
    btnDownload = document.getElementById('btn-download');
    
    displayCanvas = document.getElementById('display-canvas');
    displayCtx = displayCanvas.getContext('2d');
    
        // Create Offscreen Canvases
    imageCanvas = document.createElement('canvas');
    maskCanvas = document.createElement('canvas');
    displayImageCanvas = document.createElement('canvas');
    overlayCanvas = document.createElement('canvas');
    overlayCtx = overlayCanvas.getContext('2d');
    
    // Hide Loader
    loaderOverlay.classList.add('hidden');
    
    // Setup Event Listeners
    setupEventListeners();
};

// Setup Event Handlers
function setupEventListeners() {
    // Upload Handlers
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            loadFile(e.dataTransfer.files[0]);
        }
    });
    
    // Sample Images
    document.querySelectorAll('.sample-card').forEach(card => {
        card.addEventListener('click', () => {
            const sampleType = card.dataset.sample;
            loadSampleImage(sampleType);
        });
    });
    
    // Brush Controls
    brushSizeSlider.addEventListener('input', () => {
        brushSizeVal.innerText = brushSizeSlider.value + 'px';
        updateBrushCursorSize();
    });
    
    inpaintRadiusSlider.addEventListener('input', () => {
        inpaintRadiusVal.innerText = inpaintRadiusSlider.value + 'px';
    });
    
    btnBrush.addEventListener('click', () => setTool('brush'));
    btnEraser.addEventListener('click', () => setTool('eraser'));
    
    // Undo / Redo / Clear Actions
    btnUndo.addEventListener('click', handleUndo);
    btnRedo.addEventListener('click', handleRedo);
    btnClearMask.addEventListener('click', clearMask);
    
    btnBackToUpload.addEventListener('click', () => {
        editorScreen.classList.add('hidden');
        uploadScreen.classList.remove('hidden');
        // Clear references
        undoHistory = [];
        redoHistory = [];
    });
    
    // Zoom controls
    btnZoomIn.addEventListener('click', () => setZoom(zoomScale + 0.15));
    btnZoomOut.addEventListener('click', () => setZoom(zoomScale - 0.15));
    btnZoomFit.addEventListener('click', fitImageToScreen);
    
    // Inpaint / Process Actions
    btnInpaint.addEventListener('click', runInpaint);
    
    // Compare Button (Hold to view original)
    btnCompare.addEventListener('mousedown', showOriginalImage);
    btnCompare.addEventListener('mouseup', restoreCurrentDrawing);
    btnCompare.addEventListener('mouseleave', restoreCurrentDrawing);
    
    btnCompare.addEventListener('touchstart', (e) => {
        e.preventDefault();
        showOriginalImage();
    });
    btnCompare.addEventListener('touchend', (e) => {
        e.preventDefault();
        restoreCurrentDrawing();
    });
    
    // Download
    btnDownload.addEventListener('click', downloadCleanedImage);
    
    // Drawing canvas mouse events
    displayCanvas.addEventListener('mousedown', startDrawing);
    displayCanvas.addEventListener('mousemove', drawStroke);
    window.addEventListener('mouseup', stopDrawing);
    
    // Drawing canvas touch events (mobile support)
    displayCanvas.addEventListener('touchstart', startDrawingTouch, { passive: false });
    displayCanvas.addEventListener('touchmove', drawStrokeTouch, { passive: false });
    displayCanvas.addEventListener('touchend', stopDrawing);
    
    // Hover Brush Cursor tracking
    canvasContainer.addEventListener('mouseenter', () => {
        brushCursor.style.display = 'block';
        updateBrushCursorSize();
    });
    canvasContainer.addEventListener('mouseleave', () => {
        brushCursor.style.display = 'none';
    });
    canvasContainer.addEventListener('mousemove', (e) => {
        if (brushCursor.style.display !== 'block') {
            brushCursor.style.display = 'block';
            updateBrushCursorSize();
        }
        moveBrushCursor(e);
    });
}

// Handle File Selection
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        loadFile(e.target.files[0]);
    }
}

// Load File into Application
function loadFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('請上傳圖片檔案。');
        return;
    }
    

    
    // 使用 URL.createObjectURL 進行即時且省記憶體的影像載入，避免讀取成巨大的 Base64 字串
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function() {
        setupEditorWithImage(img);
        // 釋放 objectUrl 記憶體
        URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
}

// Setup Editor Canvases & Sizing
function setupEditorWithImage(img) {
    originalWidth = img.naturalWidth;
    originalHeight = img.naturalHeight;
    
    // 限制編輯畫布最大維度為 1200px，保證高解析度大圖在塗鴉與重繪時有極高的流暢度（0延遲）
    const maxDisplayDim = 1200;
    displayScale = Math.min(1.0, maxDisplayDim / Math.max(originalWidth, originalHeight));
    displayWidth = Math.round(originalWidth * displayScale);
    displayHeight = Math.round(originalHeight * displayScale);
    
    // 儲存原始 Image 物件以供對照與後續高解析度處理
    originalImageElement = img;
    
    // 建立低解析度顯示用影像畫布（瞬顯優化）
    displayImageCanvas.width = displayWidth;
    displayImageCanvas.height = displayHeight;
    const displayImgCtx = displayImageCanvas.getContext('2d');
    displayImgCtx.clearRect(0, 0, displayWidth, displayHeight);
    displayImgCtx.drawImage(originalImageElement, 0, 0, originalWidth, originalHeight, 0, 0, displayWidth, displayHeight);
    
    // 延遲設定完整解析度畫布的寬高以提昇上傳速度，直到 runInpaint() 呼叫時才配置記憶體
    imageCanvas.width = 0;
    imageCanvas.height = 0;
    
    // 建立顯示解析度的編輯遮罩畫布
    maskCanvas.width = displayWidth;
    maskCanvas.height = displayHeight;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.clearRect(0, 0, displayWidth, displayHeight);
    
    // 建立顯示解析度的可視畫布
    displayCanvas.width = displayWidth;
    displayCanvas.height = displayHeight;
    
    // 建立顯示解析度的覆蓋畫布
    overlayCanvas.width = displayWidth;
    overlayCanvas.height = displayHeight;
    
    // 初始化歷史紀錄狀態
    undoHistory = [];
    redoHistory = [];
    saveHistoryState(false); // 初始狀態不複製大圖以提昇上傳速度，還原時直接使用 originalImageElement
    
    // 預設縮放為 75%
    setZoom(0.75);
    setTool('brush');
    
    // 更新介面可見度
    uploadScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');
    
    btnCompare.disabled = false;
    btnDownload.disabled = false;
    
    draw();
    
    // Start loading OpenCV.js only AFTER the editor UI and image are fully rendered and visible
    setTimeout(window.loadOpenCV, 500);
}

// Render the visual state onto display canvas
function draw() {
    if (!displayCanvas) return;
    
    // 清除顯示畫面
    displayCtx.clearRect(0, 0, displayWidth, displayHeight);
    
    // 直接將低解析度預顯示畫布繪製到顯示畫布上（效能優化，避免在大圖下即時縮放）
    displayCtx.drawImage(displayImageCanvas, 0, 0);
    
    // 清除覆蓋畫布
    overlayCtx.clearRect(0, 0, displayWidth, displayHeight);
    
    // 在覆蓋畫布上繪製半透明紅色標記
    overlayCtx.save();
    overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    overlayCtx.fillRect(0, 0, displayWidth, displayHeight);
    
    // 與顯示解析度遮罩做 destination-in 混合，僅保留筆刷劃過區域
    overlayCtx.globalCompositeOperation = 'destination-in';
    overlayCtx.drawImage(maskCanvas, 0, 0);
    overlayCtx.restore();
    
    // 將半透明紅色標記繪製到顯示畫布上
    displayCtx.drawImage(overlayCanvas, 0, 0);
}

// Save History State
// isInpaint 代表這是否是 runInpaint 後的狀態。如果是，則儲存完整大圖快照；否則只存 mask。
function saveHistoryState(isInpaint = false) {
    // 儲存顯示尺寸的遮罩快照（快速且節省記憶體）
    const maskSnap = document.createElement('canvas');
    maskSnap.width = displayWidth;
    maskSnap.height = displayHeight;
    maskSnap.getContext('2d').drawImage(maskCanvas, 0, 0);
    
    let imgSnap = null;
    if (isInpaint) {
        // 僅在執行去除浮水印時，才儲存完整解析度的影像快照，以節省記憶體並加速初始上傳
        imgSnap = document.createElement('canvas');
        imgSnap.width = originalWidth;
        imgSnap.height = originalHeight;
        imgSnap.getContext('2d').drawImage(imageCanvas, 0, 0);
    }
    
    undoHistory.push({
        image: imgSnap,
        mask: maskSnap
    });
    
    // 限制歷史紀錄大小以防記憶體消耗過高
    if (undoHistory.length > 20) {
        undoHistory.shift();
    }
    
    redoHistory = [];
    updateUndoRedoButtons();
}

// Update UI buttons based on history bounds
function updateUndoRedoButtons() {
    btnUndo.disabled = undoHistory.length <= 1;
    btnRedo.disabled = redoHistory.length === 0;
}

// Undo Action
function handleUndo() {
    if (undoHistory.length > 1) {
        const currentState = undoHistory.pop();
        redoHistory.push(currentState);
        
        restoreState(undoHistory.length - 1);
    }
}

// Redo Action
function handleRedo() {
    if (redoHistory.length > 0) {
        const nextState = redoHistory.pop();
        undoHistory.push(nextState);
        restoreState(undoHistory.length - 1);
    }
}

// Restore Canvas Contexts from Saved State Index
function restoreState(stateIndex) {
    const state = undoHistory[stateIndex];
    
    // 1. 還原顯示解析度遮罩
    maskCanvas.getContext('2d').clearRect(0, 0, displayWidth, displayHeight);
    maskCanvas.getContext('2d').drawImage(state.mask, 0, 0);
    
    // 2. 尋找最近的有儲存完整影像的歷史狀態
    let imageState = null;
    for (let i = stateIndex; i >= 0; i--) {
        if (undoHistory[i].image) {
            imageState = undoHistory[i].image;
            break;
        }
    }
    
    if (imageState) {
        if (imageCanvas.width === 0) {
            imageCanvas.width = originalWidth;
            imageCanvas.height = originalHeight;
        }
        imageCanvas.getContext('2d').clearRect(0, 0, originalWidth, originalHeight);
        imageCanvas.getContext('2d').drawImage(imageState, 0, 0);
        
        // 更新顯示用低解析度畫布
        displayImageCanvas.getContext('2d').clearRect(0, 0, displayWidth, displayHeight);
        displayImageCanvas.getContext('2d').drawImage(imageCanvas, 0, 0, originalWidth, originalHeight, 0, 0, displayWidth, displayHeight);
    } else {
        // 若找不到（表示回到了初始上傳狀態），若高解析度畫布已初始化，則自原圖還原
        if (imageCanvas.width > 0) {
            imageCanvas.getContext('2d').clearRect(0, 0, originalWidth, originalHeight);
            imageCanvas.getContext('2d').drawImage(originalImageElement, 0, 0);
        }
        
        // 更新顯示用低解析度畫布為原始圖像
        displayImageCanvas.getContext('2d').clearRect(0, 0, displayWidth, displayHeight);
        displayImageCanvas.getContext('2d').drawImage(originalImageElement, 0, 0, originalWidth, originalHeight, 0, 0, displayWidth, displayHeight);
    }
    
    updateUndoRedoButtons();
    draw();
}

// Clear Mask
function clearMask() {
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.clearRect(0, 0, displayWidth, displayHeight);
    saveHistoryState(false);
    draw();
}

// Set drawing tool
function setTool(tool) {
    currentTool = tool;
    if (tool === 'brush') {
        btnBrush.classList.add('active');
        btnEraser.classList.remove('active');
    } else {
        btnBrush.classList.remove('active');
        btnEraser.classList.add('active');
    }
}

// Sizing Zoom
function setZoom(val) {
    // Limit zoom level
    zoomScale = Math.max(0.15, Math.min(val, 6.0));
    
    // Resize Container Element based on display dimension
    canvasContainer.style.width = (displayWidth * zoomScale) + 'px';
    canvasContainer.style.height = (displayHeight * zoomScale) + 'px';
    
    // Update zoom counter
    zoomLevelText.innerText = Math.round(zoomScale * 100) + '%';
    
    updateBrushCursorSize();
}

// Scale image to fit comfortably in browser window
function fitImageToScreen() {
    const workspaceOuter = document.querySelector('.canvas-workspace');
    const borderSpacing = 80;
    
    const availableWidth = workspaceOuter.clientWidth - borderSpacing;
    const availableHeight = workspaceOuter.clientHeight - borderSpacing - 80; // 80px bottom bar
    
    const scaleX = availableWidth / originalWidth;
    const scaleY = availableHeight / originalHeight;
    
    const bestScale = Math.min(scaleX, scaleY, 1.0); // Don't upscale past 100% on start
    setZoom(bestScale);
}

// Drawing Logic Coordinate Translation
function getCanvasCoords(e) {
    const rect = displayCanvas.getBoundingClientRect();
    
    // Handle Touch vs Mouse
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    // Calculate relative coordinates in display terms
    const x = (clientX - rect.left) * (displayWidth / rect.width);
    const y = (clientY - rect.top) * (displayHeight / rect.height);
    
    return { x, y };
}

// Mouse events to draw strokes
function startDrawing(e) {
    if (e.button !== 0) return; // Left click only
    isDrawing = true;
    
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
    
    drawStrokeAtPoint(coords.x, coords.y, true);
}

function startDrawingTouch(e) {
    e.preventDefault(); // Stop mobile scrolling
    isDrawing = true;
    
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
    
    drawStrokeAtPoint(coords.x, coords.y, true);
}

function drawStroke(e) {
    if (!isDrawing) return;
    
    const coords = getCanvasCoords(e);
    drawStrokeAtPoint(coords.x, coords.y, false);
}

function drawStrokeTouch(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getCanvasCoords(e);
    drawStrokeAtPoint(coords.x, coords.y, false);
}

function drawStrokeAtPoint(x, y, isStart) {
    const maskCtx = maskCanvas.getContext('2d');
    const size = parseInt(brushSizeSlider.value);
    
    maskCtx.save();
    maskCtx.lineWidth = size;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    
    if (currentTool === 'brush') {
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.strokeStyle = '#ffffff'; // white represents area to inpaint
        maskCtx.fillStyle = '#ffffff';
    } else {
        maskCtx.globalCompositeOperation = 'destination-out'; // erase from mask
        maskCtx.strokeStyle = 'rgba(0,0,0,1)';
        maskCtx.fillStyle = 'rgba(0,0,0,1)';
    }
    
    maskCtx.beginPath();
    if (isStart) {
        maskCtx.arc(x, y, size / 2, 0, Math.PI * 2);
        maskCtx.fill();
    } else {
        maskCtx.moveTo(lastX, lastY);
        maskCtx.lineTo(x, y);
        maskCtx.stroke();
    }
    
    maskCtx.restore();
    
    lastX = x;
    lastY = y;
    
    draw();
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        saveHistoryState();
    }
}

// Move floating circular cursor outline
function moveBrushCursor(e) {
    if (!brushCursor || !canvasContainer) return;
    const rect = canvasContainer.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    
    // Update cursor position
    brushCursor.style.left = `${cursorX}px`;
    brushCursor.style.top = `${cursorY}px`;
}

// Update brush cursor size based on zoom and slider value
function updateBrushCursorSize() {
    if (!brushCursor || !brushSizeSlider) return;
    const size = parseInt(brushSizeSlider.value) * zoomScale;
    brushCursor.style.width = size + 'px';
    brushCursor.style.height = size + 'px';
}

function runInpaint() {
    if (typeof cv === 'undefined' || !cv.Mat || !window.OPENCV_LOADED) {
        console.log("OpenCV not ready yet, queuing inpaint operation...");
        btnInpaint.disabled = true;
        btnInpaint.querySelector('.btn-text').classList.add('hidden');
        btnInpaint.querySelector('.btn-spinner').classList.remove('hidden');
        btnInpaint.querySelector('.btn-spinner').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 正在初始化 AI 引擎...';
        
        // Start polling for OpenCV readiness
        const checkInterval = setInterval(() => {
            if (window.OPENCV_LOADED) {
                clearInterval(checkInterval);
                btnInpaint.querySelector('.btn-spinner').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 影像處理中...';
                runInpaint(); // Call recursively once ready
            }
        }, 300);
        return;
    }
    
    // 檢查遮罩畫布（顯示解析度）中是否包含塗抹標記
    const maskCtx = maskCanvas.getContext('2d');
    const imgData = maskCtx.getImageData(0, 0, displayWidth, displayHeight);
    let hasMask = false;
    for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 0) {
            hasMask = true;
            break;
        }
    }
    
    if (!hasMask) {
        alert("請使用紅色筆刷塗記需要去除的浮水印或物件區域。");
        return;
    }
    
    btnInpaint.disabled = true;
    btnInpaint.querySelector('.btn-text').classList.add('hidden');
    btnInpaint.querySelector('.btn-spinner').classList.remove('hidden');
    
    setTimeout(() => {
        try {
            // 0. 延遲載入並配置高解析度影像畫布以提昇初次上傳速度
            if (imageCanvas.width === 0) {
                imageCanvas.width = originalWidth;
                imageCanvas.height = originalHeight;
                const imgCtx = imageCanvas.getContext('2d');
                imgCtx.clearRect(0, 0, originalWidth, originalHeight);
                imgCtx.drawImage(originalImageElement, 0, 0);
            }
            
            // 1. 讀取原始高解析度影像，並轉換為 3 通道 RGB
            let srcRGBA = cv.imread(imageCanvas);
            let src = new cv.Mat();
            cv.cvtColor(srcRGBA, src, cv.COLOR_RGBA2RGB);
            
            // 2. 建立高解析度的遮罩畫布，並將顯示解析度的 maskCanvas 放大繪製上去
            const bwCanvas = document.createElement('canvas');
            bwCanvas.width = originalWidth;
            bwCanvas.height = originalHeight;
            const bwCtx = bwCanvas.getContext('2d');
            bwCtx.fillStyle = '#000000';
            bwCtx.fillRect(0, 0, originalWidth, originalHeight);
            
            // 使用 drawImage 放大繪製，自動利用線性延伸遮罩
            bwCtx.drawImage(maskCanvas, 0, 0, displayWidth, displayHeight, 0, 0, originalWidth, originalHeight);
            
            let maskRGBA = cv.imread(bwCanvas);
            let mask = new cv.Mat();
            cv.cvtColor(maskRGBA, mask, cv.COLOR_RGBA2GRAY);
            
            // 二值化遮罩，降低門檻以保留邊緣軟邊界
            cv.threshold(mask, mask, 30, 255, cv.THRESH_BINARY);
            
            // 使用自適應大小的橢圓結構元素進行膨脹，保證高解析度大圖下能完整包覆邊緣
            const kSize = Math.max(3, Math.round(3 / displayScale));
            const kernelSize = kSize % 2 === 0 ? kSize + 1 : kSize; // 必須為奇數
            let dkernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kernelSize, kernelSize));
            cv.dilate(mask, mask, dkernel);
            dkernel.delete();
            
            // 3. 輸出矩陣
            let dst = new cv.Mat();
            
            // 4. 修復參數（修復半徑直接使用使用者選取的大小）
            const sliderRadius = parseFloat(inpaintRadiusSlider.value);
            const radius = Math.max(1, Math.round(sliderRadius / displayScale));
            const flag = inpaintMethodSelect.value === 'ns' ? cv.INPAINT_NS : cv.INPAINT_TELEA;
            
            // 5. 呼叫 OpenCV Core Inpaint 進行修復
            cv.inpaint(src, mask, dst, radius, flag);
            
            // 6. 將修復後影像繪製回高解析度 imageCanvas
            cv.imshow(imageCanvas, dst);
            
            // 6.5. 在 JS 中為修復區域添加微弱相片雜訊，以匹配原始紋理，消除平滑模糊色塊
            try {
                const imgCtx = imageCanvas.getContext('2d');
                const imgData = imgCtx.getImageData(0, 0, originalWidth, originalHeight);
                
                // 讀取高解析度遮罩資料
                const bwCtx = bwCanvas.getContext('2d');
                const bwData = bwCtx.getImageData(0, 0, originalWidth, originalHeight);
                
                // 對修復區域的像素進行細微單色（Luminance）噪點加成，避免彩噪顯得不自然
                for (let i = 0; i < bwData.data.length; i += 4) {
                    if (bwData.data[i] > 127) { // 遮罩二值化後，紅色/綠色/藍色通道均為 255
                        // 生成 -3 到 +3 之間的隨機單色雜訊
                        const noise = (Math.random() - 0.5) * 6;
                        
                        imgData.data[i]     = Math.max(0, Math.min(255, imgData.data[i]     + noise)); // R
                        imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + noise)); // G
                        imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + noise)); // B
                    }
                }
                imgCtx.putImageData(imgData, 0, 0);
            } catch (noiseErr) {
                console.warn("Failed to generate background grain noise:", noiseErr);
            }
            
            // 6.8. 更新顯示用低解析度畫布
            const displayImgCtx = displayImageCanvas.getContext('2d');
            displayImgCtx.clearRect(0, 0, displayWidth, displayHeight);
            displayImgCtx.drawImage(imageCanvas, 0, 0, originalWidth, originalHeight, 0, 0, displayWidth, displayHeight);
            
            // 7. 清除顯示解析度的編輯遮罩
            maskCtx.clearRect(0, 0, displayWidth, displayHeight);
            
            // 釋放 OpenCV 矩陣記憶體
            srcRGBA.delete();
            src.delete();
            maskRGBA.delete();
            mask.delete();
            dst.delete();
            
            // 儲存 inpaint 類型的歷史狀態 (isInpaint = true)
            saveHistoryState(true);
            draw();
            
        } catch (err) {
            console.error("OpenCV inpainting error: ", err);
            alert("影像處理過程中發生錯誤。請嘗試縮小修復半徑，或塗抹小一點的區域後再試一次。");
        } finally {
            btnInpaint.disabled = false;
            btnInpaint.querySelector('.btn-text').classList.remove('hidden');
            btnInpaint.querySelector('.btn-spinner').classList.add('hidden');
        }
    }, 50);
}

function downloadCleanedImage() {
    if (imageCanvas.width === 0) {
        imageCanvas.width = originalWidth;
        imageCanvas.height = originalHeight;
        imageCanvas.getContext('2d').drawImage(originalImageElement, 0, 0);
    }
    const link = document.createElement('a');
    link.download = 'AlbertImageLab_cleaned.png';
    link.href = imageCanvas.toDataURL('image/png');
    link.click();
}

// Load High-Quality Sample Images from server for testing
function loadSampleImage(type) {
    const img = new Image();
    img.onload = function() {
        setupEditorWithImage(img);
    };
    img.onerror = function() {
        console.error("Failed to load sample image:", type);
        alert("無法載入範例圖片，請確認 samples 目錄下的檔案是否存在。");
    };
    img.src = `samples/${type}.png`;
}

// Dynamic loading of OpenCV.js to prevent page blocking
window.loadOpenCV = function() {
    if (window.OPENCV_LOADING || window.OPENCV_LOADED) {
        return;
    }
    window.OPENCV_LOADING = true;
    console.log("AlbertImageLab: Starting dynamic load of OpenCV.js...");
    
    // Set up global hooks for Emscripten in Electron
    window.__node_require = window.require;
    window.__node_module = window.module;
    window.__node_process = window.process;
    window.__node_exports = window.exports;
    
    window.require = undefined;
    window.module = undefined;
    window.process = undefined;
    window.exports = undefined;
    
    const script = document.createElement('script');
    script.src = 'opencv.js';
    script.type = 'text/javascript';
    script.async = true;
    
    script.onload = function() {
        console.log("AlbertImageLab: OpenCV.js script tag loaded. Starting polling...");
        startOpenCvPolling();
    };
    
    script.onerror = function(e) {
        console.error("AlbertImageLab: Failed to load OpenCV.js script:", e);
        window.OPENCV_LOADING = false;
        
        // Restore Node globals
        window.require = window.__node_require;
        window.module = window.__node_module;
        window.process = window.__node_process;
        window.exports = window.__node_exports;
    };
    
    document.body.appendChild(script);
};

function startOpenCvPolling() {
    let checkCount = 0;
    const cvInterval = setInterval(() => {
        checkCount++;
        try {
            if (window.cv && typeof window.cv.Mat === 'function') {
                window.OPENCV_LOADED = true;
                window.OPENCV_LOADING = false;
                console.log("OpenCV.js successfully loaded and initialized after", checkCount * 200, "ms");
                
                // Restore Node globals
                window.require = window.__node_require;
                window.module = window.__node_module;
                window.process = window.__node_process;
                window.exports = window.__node_exports;
                
                clearInterval(cvInterval);
            }
        } catch (e) {
            console.error("OpenCV background initialization error:", e);
        }
        
        if (checkCount >= 150) {
            console.warn("OpenCV background loading check timed out.");
            window.OPENCV_LOADING = false;
            clearInterval(cvInterval);
            
            // Restore Node globals
            window.require = window.__node_require;
            window.module = window.__node_module;
            window.process = window.__node_process;
            window.exports = window.__node_exports;
        }
    }, 200);
}

// Compare Button (Hold to view original)
function showOriginalImage() {
    if (!displayCanvas) return;
    displayCtx.clearRect(0, 0, displayWidth, displayHeight);
    displayCtx.drawImage(originalImageElement, 0, 0, originalWidth, originalHeight, 0, 0, displayWidth, displayHeight);
}

function restoreCurrentDrawing() {
    draw();
}

// Initial entry point checking
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initApp();
    });
} else {
    window.initApp();
}
