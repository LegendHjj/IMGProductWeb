import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import {
  applyLogo,
  calculateLogoPlacement,
  combineImagesVertically,
  createZip,
  exportImageFile,
  formatBytes,
  getExtension,
  getImageOutputExtension,
  imageFormatNeedsBackgroundFill,
  imageFormatUsesQuality,
  removeGeminiWatermark,
  extractImageUrls
} from './utils.js';

// ==========================================
// APPLICATION STATE
// ==========================================
let activeTab = 'home';

// Compress / Convert State
let pngQueue = [];
let isPngConverting = false;

// Add Logo State
let logoQueue = [];
let isLogoConverting = false;
let logoImageElement = null; // Stored HTMLImageElement once loaded
let logoObjectURL = null;
let logoBase64 = null;        // Base64 data URL of current logo (for caching)

// localStorage keys
const LS_LOGO_B64   = 'imgconv_logo_b64';
const LS_LOGO_NAME = 'imgconv_logo_name';
const LS_LOGO_SCALE = 'imgconv_logo_scale';
const LS_LOGO_POSITION = 'imgconv_logo_position';
const LS_LOGO_EDGE_DISTANCE = 'imgconv_logo_edge_distance';
const LS_LOGO_FORMAT = 'imgconv_logo_format';
const LS_LOGO_QUALITY = 'imgconv_logo_quality';

// Remove Gemini Logo State
let geminiQueue = [];
let isGeminiConverting = false;

// Crop Image State
let cropper = null;
let cropImageFile = null;
let cropImageUrl = null;
let isCropDataSyncing = false;

// Bulk Downloader State
let bulkQueue = [];
let isBulkDownloading = false;
const BULK_FETCH_TIMEOUT_MS = 30000;

// Combine Images State
let combineQueue = [];
let isCombining = false;
let combineCropper = null;
let currentCombineCropId = null;

// Image Prompt Notes State
let imagePromptNotes = [];
let editingPromptId = null;
const LS_IMAGE_PROMPTS = 'imgconv_image_prompts_v1';

// ==========================================
// DOM SELECTORS
// ==========================================
// Sidebar navigation
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.tab-panel');
const tabLaunchers = document.querySelectorAll('[data-tab-target]');

// Compress / Convert Elements
const pngDropzone = document.getElementById('dropzone');
const pngFileInput = document.getElementById('fileInput');
const pngOptionsPanel = document.getElementById('optionsPanel');
const pngOutputFormat = document.getElementById('outputFormat');
const pngQualityGroup = document.getElementById('qualityGroup');
const pngQualitySlider = document.getElementById('qualitySlider');
const pngQualityValue = document.getElementById('qualityValue');
const pngTransparencyGroup = document.getElementById('transparencyGroup');
const pngTransparencyBg = document.getElementById('transparencyBg');
const pngCustomColorContainer = document.getElementById('customColorContainer');
const pngCustomColorPicker = document.getElementById('customColorPicker');
const pngCustomHex = document.getElementById('customHex');
const pngQueueSection = document.getElementById('queueSection');
const pngQueueStats = document.getElementById('queueStats');
const pngClearQueueBtn = document.getElementById('clearQueueBtn');
const pngAddMoreBtn = document.getElementById('addMoreBtn');
const pngQueueGrid = document.getElementById('queueGrid');
const pngMasterProgressBar = document.getElementById('masterProgressBar');
const pngMasterStatus = document.getElementById('masterStatus');
const pngConvertBtn = document.getElementById('convertBtn');
const pngDownloadAllBtn = document.getElementById('downloadAllBtn');

// Add Logo Watermarker Elements
const logoDropzone = document.getElementById('logo-dropzone');
const logoFileInput = document.getElementById('logo-fileInput');
const logoOptionsPanel = document.getElementById('logo-optionsPanel');
const logoSizeSlider = document.getElementById('logoSizeSlider');
const logoSizeValue = document.getElementById('logoSizeValue');
const logoPosition = document.getElementById('logoPosition');
const logoEdgeDistanceSlider = document.getElementById('logoEdgeDistanceSlider');
const logoEdgeDistanceValue = document.getElementById('logoEdgeDistanceValue');
const logoOutFormat = document.getElementById('logoOutFormat');
const logoQualitySlider = document.getElementById('logoQualitySlider');
const logoQualityValue = document.getElementById('logoQualityValue');
const logoQualityGroup = document.getElementById('logoQualityGroup');

const watermarkLogoFile = document.getElementById('watermark-logo-file');
const logoUploaderBox = document.getElementById('logo-uploader-box');
const logoUploadPrompt = document.getElementById('logo-upload-prompt');
const logoUploadPreview = document.getElementById('logo-upload-preview');
const logoPreviewImg = document.getElementById('logo-preview-img');
const logoPreviewName = document.getElementById('logo-preview-name');
const logoRemoveBtn = document.getElementById('logo-remove-btn');

const logoQueueSection = document.getElementById('logo-queueSection');
const logoQueueStats = document.getElementById('logo-queueStats');
const logoClearQueueBtn = document.getElementById('logo-clearQueueBtn');
const logoAddMoreBtn = document.getElementById('logo-addMoreBtn');
const logoQueueGrid = document.getElementById('logo-queueGrid');
const logoMasterProgressBar = document.getElementById('logo-masterProgressBar');
const logoMasterStatus = document.getElementById('logo-masterStatus');
const logoConvertBtn = document.getElementById('logo-convertBtn');
const logoDownloadAllBtn = document.getElementById('logo-downloadAllBtn');

// Remove Gemini Logo Elements
const geminiDropzone = document.getElementById('gemini-dropzone');
const geminiFileInput = document.getElementById('gemini-fileInput');
const geminiOptionsPanel = document.getElementById('gemini-optionsPanel');
const geminiPasses = document.getElementById('geminiPasses');
const geminiQueueSection = document.getElementById('gemini-queueSection');
const geminiQueueStats = document.getElementById('gemini-queueStats');
const geminiClearQueueBtn = document.getElementById('gemini-clearQueueBtn');
const geminiAddMoreBtn = document.getElementById('gemini-addMoreBtn');
const geminiQueueGrid = document.getElementById('gemini-queueGrid');
const geminiMasterProgressBar = document.getElementById('gemini-masterProgressBar');
const geminiMasterStatus = document.getElementById('gemini-masterStatus');
const geminiConvertBtn = document.getElementById('gemini-convertBtn');
const geminiDownloadAllBtn = document.getElementById('gemini-downloadAllBtn');

// Crop Image Elements
const cropDropzone = document.getElementById('crop-dropzone');
const cropFileInput = document.getElementById('crop-fileInput');
const cropEditorSection = document.getElementById('crop-editorSection');
const cropImage = document.getElementById('crop-image');
const cropFileName = document.getElementById('crop-fileName');
const cropImageMeta = document.getElementById('crop-imageMeta');
const cropWidthInput = document.getElementById('cropWidth');
const cropHeightInput = document.getElementById('cropHeight');
const cropXInput = document.getElementById('cropX');
const cropYInput = document.getElementById('cropY');
const cropAspectRatio = document.getElementById('cropAspectRatio');
const cropResetBtn = document.getElementById('crop-resetBtn');
const cropChangeBtn = document.getElementById('crop-changeBtn');
const cropDownloadBtn = document.getElementById('crop-downloadBtn');
const cropStatus = document.getElementById('crop-status');

// Bulk Downloader Elements
const bulkPasteArea = document.getElementById('bulk-pasteArea');
const bulkClearTextBtn = document.getElementById('bulk-clearTextBtn');
const bulkExtractBtn = document.getElementById('bulk-extractBtn');
const bulkOptionsPanel = document.getElementById('bulk-optionsPanel');
const bulkNamePrefix = document.getElementById('bulk-namePrefix');
const bulkExtensionFallback = document.getElementById('bulk-extensionFallback');
const bulkQueueSection = document.getElementById('bulk-queueSection');
const bulkQueueStats = document.getElementById('bulk-queueStats');
const bulkClearQueueBtn = document.getElementById('bulk-clearQueueBtn');
const bulkQueueGrid = document.getElementById('bulk-queueGrid');
const bulkMasterProgressBar = document.getElementById('bulk-masterProgressBar');
const bulkMasterStatus = document.getElementById('bulk-masterStatus');
const bulkConvertBtn = document.getElementById('bulk-convertBtn');
const bulkDownloadAllBtn = document.getElementById('bulk-downloadAllBtn');

// Combine Images Elements
const combineDropzone = document.getElementById('combine-dropzone');
const combineFileInput = document.getElementById('combine-fileInput');
const combineQueueSection = document.getElementById('combine-queueSection');
const combineQueueStats = document.getElementById('combine-queueStats');
const combineClearQueueBtn = document.getElementById('combine-clearQueueBtn');
const combineAddMoreBtn = document.getElementById('combine-addMoreBtn');
const combineQueueGrid = document.getElementById('combine-queueGrid');
const combineMasterProgressBar = document.getElementById('combine-masterProgressBar');
const combineMasterStatus = document.getElementById('combine-masterStatus');
const combineConvertBtn = document.getElementById('combine-convertBtn');

// Combine Crop Modal Elements
const combineCropModalOverlay = document.getElementById('combineCropModalOverlay');
const combineCropModalCloseBtn = document.getElementById('combineCropModalCloseBtn');
const combineCropModalImg = document.getElementById('combineCropModalImg');
const combineCropCancelBtn = document.getElementById('combineCropCancelBtn');
const combineCropSaveBtn = document.getElementById('combineCropSaveBtn');

// Image Prompt Notes Elements
const promptTitleInput = document.getElementById('prompt-titleInput');
const promptDescriptionInput = document.getElementById('prompt-descriptionInput');
const promptFormStatus = document.getElementById('prompt-formStatus');
const promptClearBtn = document.getElementById('prompt-clearBtn');
const promptSaveBtn = document.getElementById('prompt-saveBtn');
const promptExportBtn = document.getElementById('prompt-exportBtn');
const promptCount = document.getElementById('prompt-count');
const promptSearchInput = document.getElementById('prompt-searchInput');
const promptEmptyState = document.getElementById('prompt-emptyState');
const promptGrid = document.getElementById('prompt-grid');

// Reusable card template
const fileCardTemplate = document.getElementById('fileCardTemplate');

// Active PNG background configurations
let pngBgColor = '#ffffff';

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
  // Navigation Routing
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (item.classList.contains('disabled')) return;
      
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  tabLaunchers.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab-target');
      if (tab) switchTab(tab);
    });
  });

  // ----------------------------------------
  // TAB 1: COMPRESS / CONVERT LISTENERS
  // ----------------------------------------
  pngDropzone.addEventListener('dragover', handlePngDragOver);
  pngDropzone.addEventListener('dragenter', handlePngDragOver);
  pngDropzone.addEventListener('dragleave', handlePngDragLeave);
  pngDropzone.addEventListener('dragend', handlePngDragLeave);
  pngDropzone.addEventListener('drop', handlePngDrop);
  pngDropzone.addEventListener('click', () => pngFileInput.click());
  pngFileInput.addEventListener('change', handlePngFileSelect);

  pngOutputFormat.addEventListener('change', () => {
    applyPngOutputFormatState();
    resetPngQueueForReconvert();
  });

  pngQualitySlider.addEventListener('input', (e) => {
    pngQualityValue.textContent = `${e.target.value}%`;
  });
  pngQualitySlider.addEventListener('change', resetPngQueueForReconvert);

  pngTransparencyBg.addEventListener('change', (e) => {
    handlePngTransparencyBgChange(e);
    resetPngQueueForReconvert();
  });
  pngCustomColorPicker.addEventListener('input', (e) => {
    pngBgColor = e.target.value;
    pngCustomHex.textContent = e.target.value.toUpperCase();
  });
  pngCustomColorPicker.addEventListener('change', resetPngQueueForReconvert);

  pngClearQueueBtn.addEventListener('click', clearPngQueue);
  pngAddMoreBtn.addEventListener('click', () => pngFileInput.click());
  pngConvertBtn.addEventListener('click', convertPngAll);
  pngDownloadAllBtn.addEventListener('click', downloadPngAll);
  applyPngOutputFormatState();

  // ----------------------------------------
  // TAB 2: ADD LOGO WATERMARKER LISTENERS
  // ----------------------------------------
  logoDropzone.addEventListener('dragover', handleLogoDragOver);
  logoDropzone.addEventListener('dragenter', handleLogoDragOver);
  logoDropzone.addEventListener('dragleave', handleLogoDragLeave);
  logoDropzone.addEventListener('dragend', handleLogoDragLeave);
  logoDropzone.addEventListener('drop', handleLogoDrop);
  logoDropzone.addEventListener('click', (e) => {
    // Avoid double trigger when clicking browse link vs dropzone background
    if (e.target !== logoFileInput) {
      logoFileInput.click();
    }
  });
  logoFileInput.addEventListener('change', handleLogoFileSelect);

  // Watermark logo file selection
  logoUploaderBox.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid triggering base image click dialog
    if (!logoImageElement) {
      watermarkLogoFile.click();
    }
  });
  watermarkLogoFile.addEventListener('change', handleWatermarkUpload);
  logoRemoveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeWatermarkLogo();
  });

  // Settings
  logoPosition.addEventListener('change', () => {
    localStorage.setItem(LS_LOGO_POSITION, logoPosition.value);
    updateLogoOverlayOnCards();
    resetLogoQueueForReconvert();
  });
  logoEdgeDistanceSlider.addEventListener('input', (e) => {
    logoEdgeDistanceValue.textContent = `${e.target.value}px`;
    localStorage.setItem(LS_LOGO_EDGE_DISTANCE, e.target.value);
    updateLogoOverlayOnCards();
  });
  logoEdgeDistanceSlider.addEventListener('change', () => {
    localStorage.setItem(LS_LOGO_EDGE_DISTANCE, logoEdgeDistanceSlider.value);
    resetLogoQueueForReconvert();
  });
  logoSizeSlider.addEventListener('input', (e) => {
    logoSizeValue.textContent = `${e.target.value}%`;
    localStorage.setItem(LS_LOGO_SCALE, e.target.value);
    updateLogoOverlayOnCards();
  });
  logoSizeSlider.addEventListener('change', () => {
    localStorage.setItem(LS_LOGO_SCALE, logoSizeSlider.value);
    resetLogoQueueForReconvert();
  });
  logoOutFormat.addEventListener('change', (e) => {
    localStorage.setItem(LS_LOGO_FORMAT, e.target.value);
    applyLogoOutputFormatState();
    resetLogoQueueForReconvert();
  });
  logoQualitySlider.addEventListener('input', (e) => {
    logoQualityValue.textContent = `${e.target.value}%`;
    localStorage.setItem(LS_LOGO_QUALITY, e.target.value);
  });
  logoQualitySlider.addEventListener('change', () => {
    localStorage.setItem(LS_LOGO_QUALITY, logoQualitySlider.value);
    resetLogoQueueForReconvert();
  });

  // Restore persisted logo + Add Logo settings from localStorage
  loadLogoCache();

  // Controls
  logoClearQueueBtn.addEventListener('click', clearLogoQueue);
  logoAddMoreBtn.addEventListener('click', () => logoFileInput.click());
  logoConvertBtn.addEventListener('click', convertLogoAll);
  logoDownloadAllBtn.addEventListener('click', downloadLogoAll);

  // ----------------------------------------
  // TAB 3: REMOVE GEMINI LOGO LISTENERS
  // ----------------------------------------
  geminiDropzone.addEventListener('dragover', handleGeminiDragOver);
  geminiDropzone.addEventListener('dragenter', handleGeminiDragOver);
  geminiDropzone.addEventListener('dragleave', handleGeminiDragLeave);
  geminiDropzone.addEventListener('dragend', handleGeminiDragLeave);
  geminiDropzone.addEventListener('drop', handleGeminiDrop);
  geminiDropzone.addEventListener('click', () => geminiFileInput.click());
  geminiFileInput.addEventListener('change', handleGeminiFileSelect);

  geminiPasses.addEventListener('change', resetGeminiQueueForReconvert);
  geminiClearQueueBtn.addEventListener('click', clearGeminiQueue);
  geminiAddMoreBtn.addEventListener('click', () => geminiFileInput.click());
  geminiConvertBtn.addEventListener('click', convertGeminiAll);
  geminiDownloadAllBtn.addEventListener('click', downloadGeminiAll);

  // ----------------------------------------
  // TAB 4: CROP IMAGE LISTENERS
  // ----------------------------------------
  cropDropzone.addEventListener('dragover', handleCropDragOver);
  cropDropzone.addEventListener('dragenter', handleCropDragOver);
  cropDropzone.addEventListener('dragleave', handleCropDragLeave);
  cropDropzone.addEventListener('dragend', handleCropDragLeave);
  cropDropzone.addEventListener('drop', handleCropDrop);
  cropDropzone.addEventListener('click', () => cropFileInput.click());
  cropFileInput.addEventListener('change', handleCropFileSelect);

  [cropWidthInput, cropHeightInput, cropXInput, cropYInput].forEach((input) => {
    input.addEventListener('change', applyCropDataFromInputs);
  });

  cropAspectRatio.addEventListener('change', handleCropAspectRatioChange);
  cropResetBtn.addEventListener('click', resetCropBox);
  cropChangeBtn.addEventListener('click', () => cropFileInput.click());
  cropDownloadBtn.addEventListener('click', downloadCroppedImage);

  // ----------------------------------------
  // TAB 5.5: COMBINE IMAGES LISTENERS
  // ----------------------------------------
  combineDropzone.addEventListener('dragover', handleCombineDragOver);
  combineDropzone.addEventListener('dragenter', handleCombineDragOver);
  combineDropzone.addEventListener('dragleave', handleCombineDragLeave);
  combineDropzone.addEventListener('dragend', handleCombineDragLeave);
  combineDropzone.addEventListener('drop', handleCombineDrop);
  combineDropzone.addEventListener('click', () => combineFileInput.click());
  combineFileInput.addEventListener('change', handleCombineFileSelect);

  combineClearQueueBtn.addEventListener('click', clearCombineQueue);
  combineAddMoreBtn.addEventListener('click', () => combineFileInput.click());
  combineConvertBtn.addEventListener('click', convertCombineAll);

  combineCropModalCloseBtn.addEventListener('click', closeCombineCropModal);
  combineCropCancelBtn.addEventListener('click', closeCombineCropModal);
  combineCropSaveBtn.addEventListener('click', saveCombineCrop);

  // ----------------------------------------
  // TAB 5: BULK DOWNLOADER LISTENERS
  // ----------------------------------------
  bulkExtractBtn.addEventListener('click', handleBulkExtract);
  bulkClearTextBtn.addEventListener('click', () => {
    bulkPasteArea.value = '';
    handleBulkExtract();
  });
  
  let bulkPasteTimeout = null;
  bulkPasteArea.addEventListener('input', () => {
    clearTimeout(bulkPasteTimeout);
    bulkPasteTimeout = setTimeout(handleBulkExtract, 500);
  });

  bulkNamePrefix.addEventListener('input', () => {
    updateBulkItemNames();
  });
  bulkNamePrefix.addEventListener('change', () => {
    updateBulkItemNames();
    resetBulkQueueForRedownload();
  });
  bulkExtensionFallback.addEventListener('change', () => {
    updateBulkItemNames();
    resetBulkQueueForRedownload();
  });

  bulkClearQueueBtn.addEventListener('click', clearBulkQueue);
  bulkConvertBtn.addEventListener('click', downloadBulkAll);
  bulkDownloadAllBtn.addEventListener('click', packageBulkZip);

  // ----------------------------------------
  // TAB 6: IMAGE PROMPT NOTES LISTENERS
  // ----------------------------------------
  loadImagePromptNotes();
  renderImagePromptNotes();
  promptSaveBtn.addEventListener('click', saveImagePromptNote);
  promptClearBtn.addEventListener('click', clearPromptForm);
  promptExportBtn.addEventListener('click', exportImagePromptNotes);
  promptSearchInput.addEventListener('input', renderImagePromptNotes);
}

// ==========================================
// TAB ROUTING CONTROLLER
// ==========================================
function switchTab(tabId) {
  activeTab = tabId;
  
  // Toggle sidebar items
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active panels
  panels.forEach(panel => {
    if (panel.id === `panel-${tabId}`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  document.querySelector('.app-workspace')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// TAB 1: PNG TO JPG PROCESSORS
// ==========================================
function handlePngDragOver(e) {
  e.preventDefault();
  pngDropzone.classList.add('dragover');
}

function handlePngDragLeave(e) {
  e.preventDefault();
  pngDropzone.classList.remove('dragover');
}

function handlePngDrop(e) {
  e.preventDefault();
  pngDropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) processPngFiles(files);
}

function handlePngFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) processPngFiles(files);
  pngFileInput.value = '';
}

function handlePngTransparencyBgChange(e) {
  const val = e.target.value;
  if (val === 'custom') {
    pngCustomColorContainer.classList.remove('panel-hidden');
    pngBgColor = pngCustomColorPicker.value;
    pngCustomHex.textContent = pngBgColor.toUpperCase();
  } else {
    pngCustomColorContainer.classList.add('panel-hidden');
    pngBgColor = val;
  }
}

function applyPngOutputFormatState() {
  const outputFormat = pngOutputFormat.value;
  const usesQuality = imageFormatUsesQuality(outputFormat);
  const needsBackgroundFill = imageFormatNeedsBackgroundFill(outputFormat);

  pngQualitySlider.disabled = !usesQuality || isPngConverting;
  pngQualityGroup.style.opacity = usesQuality ? '1' : '0.35';
  pngTransparencyGroup.classList.toggle('panel-hidden', !needsBackgroundFill);
  pngCustomColorContainer.classList.toggle(
    'panel-hidden',
    !needsBackgroundFill || pngTransparencyBg.value !== 'custom'
  );

  const extension = getImageOutputExtension(outputFormat).toUpperCase();
  pngMasterStatus.textContent = pngQueue.length
    ? `Ready to export as ${extension}`
    : 'Ready to compress';
}

function processPngFiles(filesList) {
  const maxLimit = 50 * 1024 * 1024; // 50MB
  let addedAny = false;

  Array.from(filesList).forEach((file) => {
    const ext = getExtension(file.name);
    const validFormats = ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'bmp'];
    
    if (!validFormats.includes(ext)) {
      alert(`Format error: "${file.name}" is not supported. Please upload PNG, JPG, JPEG, JFIF, WEBP, or BMP images.`);
      return;
    }

    if (file.size > maxLimit) {
      alert(`Size limit error: "${file.name}" exceeds the 50MB maximum size limit.`);
      return;
    }

    const isDuplicate = pngQueue.some(item => item.file.name === file.name && item.file.size === file.size);
    if (isDuplicate) return;

    const extIndex = file.name.lastIndexOf('.');
    const baseName = extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
    const localThumbUrl = URL.createObjectURL(file);

    const item = {
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      name: baseName,
      ext: ext,
      size: file.size,
      status: 'pending',
      progress: 0,
      localThumbUrl: localThumbUrl,
      outputBlob: null,
      outputUrl: null,
      outputFormat: getImageOutputExtension(pngOutputFormat.value),
      errorMessage: null
    };

    pngQueue.push(item);
    renderFileCard(item, pngQueueGrid, pngQueue, removePngFile, downloadPngIndividual);
    addedAny = true;
  });

  if (addedAny) {
    updatePngLayoutVisibility();
    updatePngQueueStats();
  }
}

function updatePngLayoutVisibility() {
  if (pngQueue.length > 0) {
    pngDropzone.classList.add('panel-hidden');
    pngOptionsPanel.classList.remove('panel-hidden');
    pngQueueSection.classList.remove('panel-hidden');
  } else {
    pngDropzone.classList.remove('panel-hidden');
    pngOptionsPanel.classList.add('panel-hidden');
    pngQueueSection.classList.add('panel-hidden');
  }
}

function updatePngQueueStats() {
  const count = pngQueue.length;
  const totalSize = pngQueue.reduce((acc, item) => acc + item.size, 0);
  pngQueueStats.textContent = `${count} file${count > 1 ? 's' : ''} • ${formatBytes(totalSize)}`;
  pngConvertBtn.disabled = isPngConverting || !pngQueue.some(item => item.status === 'pending');
}

function removePngFile(id) {
  const index = pngQueue.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = pngQueue[index];
  if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);

  pngQueue.splice(index, 1);
  const card = pngQueueGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();

  updatePngLayoutVisibility();
  updatePngQueueStats();
  updatePngMasterProgress();
}

function clearPngQueue() {
  if (isPngConverting) return;

  pngQueue.forEach((item) => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });

  pngQueue = [];
  pngQueueGrid.innerHTML = '';
  
  updatePngLayoutVisibility();
  updatePngQueueStats();
  updatePngMasterProgress();

  pngMasterStatus.textContent = 'Ready to compress';
  pngMasterStatus.className = 'master-status';
}

function updatePngMasterProgress() {
  const total = pngQueue.length;
  if (total === 0) {
    pngMasterProgressBar.style.width = '0%';
    pngDownloadAllBtn.disabled = true;
    return;
  }

  const completed = pngQueue.filter(item => item.status === 'done' || item.status === 'error').length;
  const percentage = (completed / total) * 100;
  pngMasterProgressBar.style.width = `${percentage}%`;

  const successCount = pngQueue.filter(item => item.status === 'done').length;
  pngDownloadAllBtn.disabled = successCount === 0 || isPngConverting;
}

function resetPngQueueForReconvert() {
  if (isPngConverting) return;

  let changed = false;
  pngQueue.forEach((item) => {
    if (item.status === 'done' || item.status === 'error') {
      item.status = 'pending';
      item.progress = 0;
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      item.outputBlob = null;
      item.outputUrl = null;
      item.errorMessage = null;
      updateFileCardUI(item, pngQueueGrid);
      changed = true;
    }
  });

  if (changed) {
    pngMasterStatus.textContent = 'Settings adjusted. Ready to compress again.';
    pngMasterStatus.className = 'master-status';
    updatePngQueueStats();
    updatePngMasterProgress();
  }
}

async function convertPngAll() {
  const pendingItems = pngQueue.filter(item => item.status === 'pending');
  if (pendingItems.length === 0 || isPngConverting) return;

  isPngConverting = true;
  pngConvertBtn.disabled = true;
  pngClearQueueBtn.disabled = true;
  pngDownloadAllBtn.disabled = true;
  
  pngOutputFormat.disabled = true;
  pngQualitySlider.disabled = true;
  pngTransparencyBg.disabled = true;
  pngCustomColorPicker.disabled = true;

  const outputFormat = pngOutputFormat.value;
  const outputExtension = getImageOutputExtension(outputFormat);
  const quality = parseFloat(pngQualitySlider.value) / 100;
  const bgColor = pngBgColor;

  pngMasterStatus.textContent = 'Compressing images...';
  pngMasterStatus.classList.add('pulse');

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    item.status = 'converting';
    item.progress = 35;
    updateFileCardUI(item, pngQueueGrid);

    try {
      const outputBlob = await exportImageFile(item.file, {
        format: outputFormat,
        quality,
        bgColor
      });
      item.progress = 100;
      item.status = 'done';
      item.outputBlob = outputBlob;
      item.outputUrl = URL.createObjectURL(outputBlob);
      item.outputFormat = outputExtension;
    } catch (err) {
      console.error(err);
      item.status = 'error';
      item.errorMessage = err.message || 'Error occurred';
    }

    updateFileCardUI(item, pngQueueGrid);
    updatePngMasterProgress();
  }

  isPngConverting = false;
  pngClearQueueBtn.disabled = false;
  pngConvertBtn.disabled = !pngQueue.some(item => item.status === 'pending');
  
  pngOutputFormat.disabled = false;
  pngTransparencyBg.disabled = false;
  pngCustomColorPicker.disabled = false;
  applyPngOutputFormatState();

  pngMasterStatus.classList.remove('pulse');
  
  const successCount = pngQueue.filter(item => item.status === 'done').length;
  const failCount = pngQueue.filter(item => item.status === 'error').length;
  
  if (failCount === 0) {
    pngMasterStatus.textContent = `Compressed ${successCount} image${successCount > 1 ? 's' : ''} as ${outputExtension.toUpperCase()}!`;
  } else {
    pngMasterStatus.textContent = `Completed: ${successCount} succeeded, ${failCount} failed.`;
  }
  
  updatePngMasterProgress();
}

function downloadPngIndividual(item) {
  if (item.status !== 'done' || !item.outputUrl) return;

  const a = document.createElement('a');
  a.href = item.outputUrl;
  a.download = `${item.name}.${item.outputFormat || getImageOutputExtension(pngOutputFormat.value)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadPngAll() {
  const successItems = pngQueue.filter(item => item.status === 'done' && item.outputBlob);
  if (successItems.length === 0) return;

  if (successItems.length === 1) {
    downloadPngIndividual(successItems[0]);
    return;
  }

  const originalText = pngMasterStatus.textContent;
  pngMasterStatus.textContent = 'Generating ZIP archive...';
  pngMasterStatus.classList.add('pulse');
  pngDownloadAllBtn.disabled = true;

  try {
    const zipBlob = await createZip(successItems);
    const zipUrl = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    const ext = successItems[0]?.outputFormat || getImageOutputExtension(pngOutputFormat.value);
    a.download = `ImgConvert-${ext.toUpperCase()}-Pack.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    pngMasterStatus.textContent = 'ZIP download completed!';
  } catch (err) {
    console.error(err);
    alert('Failed to generate ZIP archive: ' + err.message);
    pngMasterStatus.textContent = 'ZIP creation failed.';
  } finally {
    pngMasterStatus.classList.remove('pulse');
    setTimeout(() => {
      pngMasterStatus.textContent = originalText;
      pngDownloadAllBtn.disabled = false;
    }, 3000);
  }
}

// ==========================================
// TAB 2: ADD LOGO PROCESSORS
// ==========================================
function handleLogoDragOver(e) {
  e.preventDefault();
  logoDropzone.classList.add('dragover');
}

function handleLogoDragLeave(e) {
  e.preventDefault();
  logoDropzone.classList.remove('dragover');
}

function handleLogoDrop(e) {
  e.preventDefault();
  logoDropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) processLogoFiles(files);
}

function handleLogoFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) processLogoFiles(files);
  logoFileInput.value = '';
}

function processLogoFiles(filesList) {
  const maxLimit = 50 * 1024 * 1024;
  let addedAny = false;

  Array.from(filesList).forEach((file) => {
    const ext = getExtension(file.name);
    const validFormats = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];
    
    if (!validFormats.includes(ext)) {
      alert(`Format error: "${file.name}" is not supported. Please upload PNG, JPG, BMP, or WEBP images.`);
      return;
    }

    if (file.size > maxLimit) {
      alert(`Size limit error: "${file.name}" exceeds the 50MB maximum size.`);
      return;
    }

    const isDuplicate = logoQueue.some(item => item.file.name === file.name && item.file.size === file.size);
    if (isDuplicate) return;

    const extIndex = file.name.lastIndexOf('.');
    const baseName = extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
    const localThumbUrl = URL.createObjectURL(file);

    const item = {
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      name: baseName,
      ext: ext,
      size: file.size,
      status: 'pending',
      progress: 0,
      localThumbUrl: localThumbUrl,
      outputBlob: null,
      outputUrl: null,
      outputFormat: 'jpg', // Evaluated dynamically when saved (jpg/png)
      errorMessage: null
    };

    logoQueue.push(item);
    renderFileCard(item, logoQueueGrid, logoQueue, removeLogoFile, downloadLogoIndividual);
    addedAny = true;
  });

  if (addedAny) {
    updateLogoLayoutVisibility();
    updateLogoQueueStats();
  }
}

function updateLogoLayoutVisibility() {
  if (logoQueue.length > 0) {
    logoDropzone.classList.add('panel-hidden');
    logoQueueSection.classList.remove('panel-hidden');
  } else {
    logoDropzone.classList.remove('panel-hidden');
    logoQueueSection.classList.add('panel-hidden');
  }
}

function updateLogoQueueStats() {
  const count = logoQueue.length;
  const totalSize = logoQueue.reduce((acc, item) => acc + item.size, 0);
  logoQueueStats.textContent = `${count} file${count > 1 ? 's' : ''} • ${formatBytes(totalSize)}`;
  
  // Convert button requires BOTH files in queue AND a logo image uploaded!
  const hasPending = logoQueue.some(item => item.status === 'pending');
  logoConvertBtn.disabled = isLogoConverting || !hasPending || !logoImageElement;

  // Master status feedback
  if (!logoImageElement) {
    logoMasterStatus.textContent = 'Upload a logo watermark file in settings to start';
  } else if (logoQueue.length === 0) {
    logoMasterStatus.textContent = 'Upload product photos to watermark';
  } else if (hasPending) {
    logoMasterStatus.textContent = 'Ready to add logo';
  }
}

// Upload Watermark Logo logic
function handleWatermarkUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const validLogoExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  const ext = getExtension(file.name);
  if (!validLogoExtensions.includes(ext)) {
    alert('Please upload a valid logo format (.png, .jpg, .jpeg, .webp, or .svg). PNG transparency is recommended.');
    return;
  }

  // Convert file to base64 for caching, then load as Image
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    logoBase64 = dataUrl;
    localStorage.setItem(LS_LOGO_B64, dataUrl);
    localStorage.setItem(LS_LOGO_NAME, file.name);

    const img = new Image();
    img.onload = () => {
      logoImageElement = img;
      logoPreviewImg.src = img.src;
      logoPreviewName.textContent = file.name;

      // UI toggle
      logoUploadPrompt.classList.add('hidden');
      logoUploadPreview.classList.remove('hidden');

      updateLogoOverlayOnCards();
      resetLogoQueueForReconvert();
      updateLogoQueueStats();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);

  // Clean input file value
  watermarkLogoFile.value = '';
}

// Remove watermark logo
function removeWatermarkLogo() {
  logoImageElement = null;
  logoBase64 = null;
  if (logoObjectURL) {
    URL.revokeObjectURL(logoObjectURL);
    logoObjectURL = null;
  }
  localStorage.removeItem(LS_LOGO_B64);
  localStorage.removeItem(LS_LOGO_NAME);

  logoUploadPrompt.classList.remove('hidden');
  logoUploadPreview.classList.add('hidden');
  logoPreviewImg.src = '';

  // Clear overlays from all cards
  updateLogoOverlayOnCards();
  resetLogoQueueForReconvert();
  updateLogoQueueStats();
}

function removeLogoFile(id) {
  const index = logoQueue.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = logoQueue[index];
  if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);

  logoQueue.splice(index, 1);
  const card = logoQueueGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();

  updateLogoLayoutVisibility();
  updateLogoQueueStats();
  updateLogoMasterProgress();
}

function clearLogoQueue() {
  if (isLogoConverting) return;

  logoQueue.forEach((item) => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });

  logoQueue = [];
  logoQueueGrid.innerHTML = '';
  
  updateLogoLayoutVisibility();
  updateLogoQueueStats();
  updateLogoMasterProgress();

  if (logoImageElement) {
    logoMasterStatus.textContent = 'Ready to add logo';
  } else {
    logoMasterStatus.textContent = 'Upload product photos & logo to start';
  }
  logoMasterStatus.className = 'master-status';
}

function updateLogoMasterProgress() {
  const total = logoQueue.length;
  if (total === 0) {
    logoMasterProgressBar.style.width = '0%';
    logoDownloadAllBtn.disabled = true;
    return;
  }

  const completed = logoQueue.filter(item => item.status === 'done' || item.status === 'error').length;
  const percentage = (completed / total) * 100;
  logoMasterProgressBar.style.width = `${percentage}%`;

  const successCount = logoQueue.filter(item => item.status === 'done').length;
  logoDownloadAllBtn.disabled = successCount === 0 || isLogoConverting;
}

function resetLogoQueueForReconvert() {
  if (isLogoConverting) return;

  let changed = false;
  logoQueue.forEach((item) => {
    if (item.status === 'done' || item.status === 'error') {
      item.status = 'pending';
      item.progress = 0;
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      item.outputBlob = null;
      item.outputUrl = null;
      item.errorMessage = null;
      updateFileCardUI(item, logoQueueGrid);
      changed = true;
    }
  });

  if (changed) {
    logoMasterStatus.textContent = 'Settings adjusted. Ready to apply watermark again.';
    logoMasterStatus.className = 'master-status';
    updateLogoQueueStats();
    updateLogoMasterProgress();
  }
}

async function convertLogoAll() {
  const pendingItems = logoQueue.filter(item => item.status === 'pending');
  if (pendingItems.length === 0 || !logoImageElement || isLogoConverting) return;

  isLogoConverting = true;
  logoConvertBtn.disabled = true;
  logoClearQueueBtn.disabled = true;
  logoDownloadAllBtn.disabled = true;
  
  // Disable option controls
  logoSizeSlider.disabled = true;
  logoPosition.disabled = true;
  logoEdgeDistanceSlider.disabled = true;
  logoOutFormat.disabled = true;
  logoQualitySlider.disabled = true;

  const size = parseInt(logoSizeSlider.value);
  const position = logoPosition.value;
  const edgeDistance = parseInt(logoEdgeDistanceSlider.value, 10) || 0;
  const mimeType = logoOutFormat.value;
  const quality = parseFloat(logoQualitySlider.value) / 100;

  logoMasterStatus.textContent = 'Overlaying logo watermarks...';
  logoMasterStatus.classList.add('pulse');

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    item.status = 'converting';
    item.progress = 40;
    updateFileCardUI(item, logoQueueGrid);

    try {
      const outputBlob = await applyLogo(item.file, logoImageElement, {
        size,
        position,
        edgeDistance,
        format: mimeType,
        quality
      });
      
      item.progress = 100;
      item.status = 'done';
      item.outputBlob = outputBlob;
      item.outputUrl = URL.createObjectURL(outputBlob);
      item.outputFormat = mimeType === 'image/png' ? 'png' : 'jpg';
    } catch (err) {
      console.error(err);
      item.status = 'error';
      item.errorMessage = err.message || 'Error occurred';
    }

    updateFileCardUI(item, logoQueueGrid);
    updateLogoMasterProgress();
  }

  isLogoConverting = false;
  logoClearQueueBtn.disabled = false;
  logoConvertBtn.disabled = !logoQueue.some(item => item.status === 'pending') || !logoImageElement;
  
  logoSizeSlider.disabled = false;
  logoPosition.disabled = false;
  logoEdgeDistanceSlider.disabled = false;
  logoOutFormat.disabled = false;
  if (mimeType !== 'image/png') {
    logoQualitySlider.disabled = false;
  }

  logoMasterStatus.classList.remove('pulse');
  
  const successCount = logoQueue.filter(item => item.status === 'done').length;
  const failCount = logoQueue.filter(item => item.status === 'error').length;
  
  if (failCount === 0) {
    logoMasterStatus.textContent = `Successfully watermarked ${successCount} image${successCount > 1 ? 's' : ''}!`;
  } else {
    logoMasterStatus.textContent = `Completed: ${successCount} watermarked, ${failCount} failed.`;
  }
  
  updateLogoMasterProgress();
}

function downloadLogoIndividual(item) {
  if (item.status !== 'done' || !item.outputUrl) return;

  const ext = item.outputFormat || 'jpg';
  const a = document.createElement('a');
  a.href = item.outputUrl;
  a.download = `${item.name}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadLogoAll() {
  const successItems = logoQueue.filter(item => item.status === 'done' && item.outputBlob);
  if (successItems.length === 0) return;

  if (successItems.length === 1) {
    downloadLogoIndividual(successItems[0]);
    return;
  }

  const originalText = logoMasterStatus.textContent;
  logoMasterStatus.textContent = 'Generating ZIP archive...';
  logoMasterStatus.classList.add('pulse');
  logoDownloadAllBtn.disabled = true;

  try {
    const zipBlob = await createZip(successItems);
    const zipUrl = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'ImgConvert-Watermarked-Pack.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    logoMasterStatus.textContent = 'ZIP download completed!';
  } catch (err) {
    console.error(err);
    alert('Failed to generate ZIP archive: ' + err.message);
    logoMasterStatus.textContent = 'ZIP creation failed.';
  } finally {
    logoMasterStatus.classList.remove('pulse');
    setTimeout(() => {
      logoMasterStatus.textContent = originalText;
      logoDownloadAllBtn.disabled = false;
    }, 3000);
  }
}

// ==========================================
// TAB 3: REMOVE GEMINI LOGO PROCESSORS
// ==========================================
function handleGeminiDragOver(e) {
  e.preventDefault();
  geminiDropzone.classList.add('dragover');
}

function handleGeminiDragLeave(e) {
  e.preventDefault();
  geminiDropzone.classList.remove('dragover');
}

function handleGeminiDrop(e) {
  e.preventDefault();
  geminiDropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) processGeminiFiles(files);
}

function handleGeminiFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) processGeminiFiles(files);
  geminiFileInput.value = '';
}

function processGeminiFiles(filesList) {
  const maxLimit = 50 * 1024 * 1024;
  const validFormats = ['png', 'jpg', 'jpeg', 'webp'];
  let addedAny = false;

  Array.from(filesList).forEach((file) => {
    const ext = getExtension(file.name);

    if (!validFormats.includes(ext)) {
      alert(`Format error: "${file.name}" is not supported. Please upload PNG, JPG, JPEG, or WEBP images.`);
      return;
    }

    if (file.size > maxLimit) {
      alert(`Size limit error: "${file.name}" exceeds the 50MB maximum size.`);
      return;
    }

    const isDuplicate = geminiQueue.some(item => item.file.name === file.name && item.file.size === file.size);
    if (isDuplicate) return;

    const extIndex = file.name.lastIndexOf('.');
    const baseName = extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
    const localThumbUrl = URL.createObjectURL(file);

    const item = {
      id: Math.random().toString(36).substring(2, 11),
      file,
      name: `${baseName}-gemini-clean`,
      ext,
      size: file.size,
      status: 'pending',
      progress: 0,
      localThumbUrl,
      outputBlob: null,
      outputUrl: null,
      outputFormat: 'png',
      errorMessage: null
    };

    geminiQueue.push(item);
    renderFileCard(item, geminiQueueGrid, geminiQueue, removeGeminiFile, downloadGeminiIndividual);
    addedAny = true;
  });

  if (addedAny) {
    updateGeminiLayoutVisibility();
    updateGeminiQueueStats();
  }
}

function updateGeminiLayoutVisibility() {
  if (geminiQueue.length > 0) {
    geminiDropzone.classList.add('panel-hidden');
    geminiOptionsPanel.classList.remove('panel-hidden');
    geminiQueueSection.classList.remove('panel-hidden');
  } else {
    geminiDropzone.classList.remove('panel-hidden');
    geminiOptionsPanel.classList.add('panel-hidden');
    geminiQueueSection.classList.add('panel-hidden');
  }
}

function updateGeminiQueueStats() {
  const count = geminiQueue.length;
  const totalSize = geminiQueue.reduce((acc, item) => acc + item.size, 0);
  geminiQueueStats.textContent = `${count} file${count > 1 ? 's' : ''} - ${formatBytes(totalSize)}`;
  geminiConvertBtn.disabled = isGeminiConverting || !geminiQueue.some(item => item.status === 'pending');
}

function removeGeminiFile(id) {
  const index = geminiQueue.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = geminiQueue[index];
  if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);

  geminiQueue.splice(index, 1);
  const card = geminiQueueGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();

  updateGeminiLayoutVisibility();
  updateGeminiQueueStats();
  updateGeminiMasterProgress();
}

function clearGeminiQueue() {
  if (isGeminiConverting) return;

  geminiQueue.forEach((item) => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });

  geminiQueue = [];
  geminiQueueGrid.innerHTML = '';

  updateGeminiLayoutVisibility();
  updateGeminiQueueStats();
  updateGeminiMasterProgress();

  geminiMasterStatus.textContent = 'Ready to remove Gemini logo';
  geminiMasterStatus.className = 'master-status';
}

function updateGeminiMasterProgress() {
  const total = geminiQueue.length;
  if (total === 0) {
    geminiMasterProgressBar.style.width = '0%';
    geminiDownloadAllBtn.disabled = true;
    return;
  }

  const completed = geminiQueue.filter(item => item.status === 'done' || item.status === 'error').length;
  const percentage = (completed / total) * 100;
  geminiMasterProgressBar.style.width = `${percentage}%`;

  const successCount = geminiQueue.filter(item => item.status === 'done').length;
  geminiDownloadAllBtn.disabled = successCount === 0 || isGeminiConverting;
}

function resetGeminiQueueForReconvert() {
  if (isGeminiConverting) return;

  let changed = false;
  geminiQueue.forEach((item) => {
    if (item.status === 'done' || item.status === 'error') {
      item.status = 'pending';
      item.progress = 0;
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      item.outputBlob = null;
      item.outputUrl = null;
      item.errorMessage = null;
      updateFileCardUI(item, geminiQueueGrid);
      changed = true;
    }
  });

  if (changed) {
    geminiMasterStatus.textContent = 'Settings adjusted. Ready to remove again.';
    geminiMasterStatus.className = 'master-status';
    updateGeminiQueueStats();
    updateGeminiMasterProgress();
  }
}

async function convertGeminiAll() {
  const pendingItems = geminiQueue.filter(item => item.status === 'pending');
  if (pendingItems.length === 0 || isGeminiConverting) return;

  isGeminiConverting = true;
  geminiConvertBtn.disabled = true;
  geminiClearQueueBtn.disabled = true;
  geminiDownloadAllBtn.disabled = true;
  geminiPasses.disabled = true;

  const maxPasses = parseInt(geminiPasses.value, 10);

  geminiMasterStatus.textContent = 'Removing Gemini logo watermarks...';
  geminiMasterStatus.classList.add('pulse');

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    item.status = 'converting';
    item.progress = 45;
    updateFileCardUI(item, geminiQueueGrid);

    try {
      const { blob, meta } = await removeGeminiWatermark(item.file, { maxPasses });
      item.progress = 100;
      item.outputBlob = blob;
      item.outputUrl = URL.createObjectURL(blob);
      item.outputFormat = 'png';
      item.geminiMeta = meta;

      // If the library found and applied a watermark removal, mark as done.
      // If meta.applied is false, the image had no detectable Gemini logo —
      // still mark as 'done' so the user can download, but store a note.
      if (meta && meta.applied === false) {
        item.status = 'done';
        item.noWatermark = true;
        item.errorMessage = meta.skipReason === 'no-watermark-detected'
          ? 'No Gemini logo detected — original returned'
          : 'Watermark removal skipped — original returned';
      } else {
        item.status = 'done';
        item.noWatermark = false;
      }
    } catch (err) {
      console.error(err);
      item.status = 'error';
      item.errorMessage = err.message || 'Watermark removal failed';
    }

    updateFileCardUI(item, geminiQueueGrid);
    updateGeminiMasterProgress();
  }

  isGeminiConverting = false;
  geminiClearQueueBtn.disabled = false;
  geminiConvertBtn.disabled = !geminiQueue.some(item => item.status === 'pending');
  geminiPasses.disabled = false;

  geminiMasterStatus.classList.remove('pulse');

  const successCount = geminiQueue.filter(item => item.status === 'done' && !item.noWatermark).length;
  const noWatermarkCount = geminiQueue.filter(item => item.status === 'done' && item.noWatermark).length;
  const failCount = geminiQueue.filter(item => item.status === 'error').length;

  if (failCount === 0 && noWatermarkCount === 0) {
    geminiMasterStatus.textContent = `Successfully cleaned ${successCount} image${successCount > 1 ? 's' : ''}!`;
  } else if (failCount === 0) {
    const parts = [];
    if (successCount > 0) parts.push(`${successCount} cleaned`);
    if (noWatermarkCount > 0) parts.push(`${noWatermarkCount} had no Gemini logo`);
    geminiMasterStatus.textContent = `Completed: ${parts.join(', ')}.`;
  } else {
    geminiMasterStatus.textContent = `Completed: ${successCount} cleaned, ${noWatermarkCount} no logo found, ${failCount} failed.`;
  }

  updateGeminiMasterProgress();
}

function downloadGeminiIndividual(item) {
  if (item.status !== 'done' || !item.outputUrl) return;

  const a = document.createElement('a');
  a.href = item.outputUrl;
  a.download = `${item.name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadGeminiAll() {
  const successItems = geminiQueue.filter(item => item.status === 'done' && item.outputBlob);
  if (successItems.length === 0) return;

  if (successItems.length === 1) {
    downloadGeminiIndividual(successItems[0]);
    return;
  }

  const originalText = geminiMasterStatus.textContent;
  geminiMasterStatus.textContent = 'Generating ZIP archive...';
  geminiMasterStatus.classList.add('pulse');
  geminiDownloadAllBtn.disabled = true;

  try {
    const zipBlob = await createZip(successItems);
    const zipUrl = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'ImgConvert-Gemini-Clean-Pack.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    geminiMasterStatus.textContent = 'ZIP download completed!';
  } catch (err) {
    console.error(err);
    alert('Failed to generate ZIP archive: ' + err.message);
    geminiMasterStatus.textContent = 'ZIP creation failed.';
  } finally {
    geminiMasterStatus.classList.remove('pulse');
    setTimeout(() => {
      geminiMasterStatus.textContent = originalText;
      geminiDownloadAllBtn.disabled = false;
    }, 3000);
  }
}

// ==========================================
// TAB 4: CROP IMAGE PROCESSORS
// ==========================================
function handleCropDragOver(e) {
  e.preventDefault();
  cropDropzone.classList.add('dragover');
}

function handleCropDragLeave(e) {
  e.preventDefault();
  cropDropzone.classList.remove('dragover');
}

function handleCropDrop(e) {
  e.preventDefault();
  cropDropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) loadCropFile(file);
}

function handleCropFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadCropFile(file);
  cropFileInput.value = '';
}

function loadCropFile(file) {
  const maxLimit = 50 * 1024 * 1024;
  const ext = getExtension(file.name);
  const validFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

  if (!validFormats.includes(ext)) {
    alert(`Format error: "${file.name}" is not supported. Please upload PNG, JPG, GIF, WEBP, or BMP images.`);
    return;
  }

  if (file.size > maxLimit) {
    alert(`Size limit error: "${file.name}" exceeds the 50MB maximum size.`);
    return;
  }

  destroyCropper();

  cropImageFile = file;
  cropImageUrl = URL.createObjectURL(file);
  cropFileName.textContent = file.name;
  cropImageMeta.textContent = `${ext.toUpperCase()} - ${formatBytes(file.size)}`;
  cropStatus.textContent = 'Loading image...';
  cropDownloadBtn.disabled = true;

  cropDropzone.classList.add('panel-hidden');
  cropEditorSection.classList.remove('panel-hidden');

  cropImage.onload = () => initCropper();
  cropImage.onerror = () => {
    cropStatus.textContent = 'Could not load this image.';
    cropDownloadBtn.disabled = true;
  };
  cropImage.src = cropImageUrl;
}

function initCropper() {
  cropper = new Cropper(cropImage, {
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.85,
    responsive: true,
    restore: false,
    background: false,
    guides: true,
    center: true,
    highlight: true,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: true,
    ready() {
      const imageData = cropper.getImageData();
      cropImageMeta.textContent = `${Math.round(imageData.naturalWidth)} x ${Math.round(imageData.naturalHeight)} px - ${formatBytes(cropImageFile.size)}`;
      cropDownloadBtn.disabled = false;
      cropStatus.textContent = 'Adjust the crop box, then crop to download.';
      syncCropInputs();
    },
    crop() {
      syncCropInputs();
    }
  });
}

function syncCropInputs() {
  if (!cropper || isCropDataSyncing) return;

  const data = cropper.getData(true);
  isCropDataSyncing = true;
  cropWidthInput.value = Math.max(1, data.width);
  cropHeightInput.value = Math.max(1, data.height);
  cropXInput.value = Math.max(0, data.x);
  cropYInput.value = Math.max(0, data.y);
  isCropDataSyncing = false;
}

function applyCropDataFromInputs() {
  if (!cropper || isCropDataSyncing) return;

  const imageData = cropper.getImageData();
  const naturalWidth = Math.round(imageData.naturalWidth);
  const naturalHeight = Math.round(imageData.naturalHeight);

  const nextWidth = clampInteger(cropWidthInput.value, 1, naturalWidth);
  const nextHeight = clampInteger(cropHeightInput.value, 1, naturalHeight);
  const nextX = clampInteger(cropXInput.value, 0, naturalWidth - nextWidth);
  const nextY = clampInteger(cropYInput.value, 0, naturalHeight - nextHeight);

  cropper.setData({
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight
  });

  syncCropInputs();
}

function clampInteger(value, min, max) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), Math.max(min, max));
}

function handleCropAspectRatioChange() {
  if (!cropper) return;

  const ratio = cropAspectRatio.value === 'free'
    ? NaN
    : parseFloat(cropAspectRatio.value);

  cropper.setAspectRatio(ratio);
  syncCropInputs();
}

function resetCropBox() {
  if (!cropper) return;

  cropper.reset();
  cropper.setAspectRatio(cropAspectRatio.value === 'free' ? NaN : parseFloat(cropAspectRatio.value));
  cropStatus.textContent = 'Crop box reset.';
  syncCropInputs();
}

function downloadCroppedImage() {
  if (!cropper || !cropImageFile) return;

  const data = cropper.getData(true);
  if (data.width <= 0 || data.height <= 0) {
    cropStatus.textContent = 'Choose a valid crop area first.';
    return;
  }

  cropDownloadBtn.disabled = true;
  cropStatus.textContent = 'Cropping image...';

  const outputType = getCropOutputType(cropImageFile);
  const canvas = cropper.getCroppedCanvas({
    width: data.width,
    height: data.height,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillColor: outputType === 'image/jpeg' ? '#ffffff' : 'transparent'
  });

  if (!canvas) {
    cropStatus.textContent = 'Could not create cropped image.';
    cropDownloadBtn.disabled = false;
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      cropStatus.textContent = 'Could not export cropped image.';
      cropDownloadBtn.disabled = false;
      return;
    }

    const ext = outputType === 'image/jpeg' ? 'jpg' : 'png';
    const baseName = getBaseName(cropImageFile.name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}-cropped.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    cropStatus.textContent = `Downloaded ${Math.round(data.width)} x ${Math.round(data.height)} px crop.`;
    cropDownloadBtn.disabled = false;
  }, outputType, outputType === 'image/jpeg' ? 0.92 : undefined);
}

function getCropOutputType(file) {
  const ext = getExtension(file.name);
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
}

function getBaseName(filename) {
  const extIndex = filename.lastIndexOf('.');
  return extIndex !== -1 ? filename.substring(0, extIndex) : filename;
}

function destroyCropper() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  if (cropImageUrl) {
    URL.revokeObjectURL(cropImageUrl);
    cropImageUrl = null;
  }

    cropImage.removeAttribute('src');
}

// ==========================================
// TAB 5: BULK DOWNLOADER PROCESSORS
// ==========================================

function handleBulkExtract() {
  const text = bulkPasteArea.value;
  const urls = extractImageUrls(text);
  
  if (urls.length === 0) {
    clearBulkQueue();
    return;
  }

  bulkOptionsPanel.classList.remove('panel-hidden');
  bulkQueueSection.classList.remove('panel-hidden');

  const currentUrls = bulkQueue.map(item => item.url);
  let addedAny = false;

  urls.forEach((url) => {
    if (currentUrls.includes(url)) return;

    const id = Math.random().toString(36).substring(2, 11);
    
    const item = {
      id: id,
      url: url,
      name: '', 
      ext: '',  
      size: 0,
      status: 'pending',
      progress: 0,
      localThumbUrl: url, 
      outputBlob: null,
      outputUrl: null,
      outputFormat: '', 
      errorMessage: null
    };

    bulkQueue.push(item);
    renderFileCard(item, bulkQueueGrid, bulkQueue, removeBulkFile, downloadBulkIndividual);
    addedAny = true;
  });

  if (addedAny || bulkQueue.length > 0) {
    updateBulkItemNames();
    updateBulkQueueStats();
  }
}

function getExtensionFromUrl(url, fallback = 'jpg') {
  try {
    if (url.includes('susercontent.com/file/') || url.includes('shopee.com/file/')) {
      return 'jpg';
    }
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extIndex = pathname.lastIndexOf('.');
    if (extIndex !== -1) {
      const ext = pathname.substring(extIndex + 1).toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  } catch (e) {}
  return fallback;
}

function getHeaderValue(headers, name) {
  try {
    return headers.get(name) || '';
  } catch (error) {
    return '';
  }
}

function isAllowedBulkContentType(contentType) {
  if (!contentType) return true;
  const lowerType = contentType.toLowerCase();
  return lowerType.startsWith('image/')
    || lowerType.includes('application/octet-stream')
    || lowerType.includes('binary/octet-stream');
}

function getBulkDownloadErrorMessage(error) {
  const message = error?.message || 'Download failed';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('networkerror')) {
    return 'Browser could not fetch this CDN URL. Open it in a new tab or try again from the source page.';
  }

  if (lowerMessage.includes('empty')) {
    return 'The CDN returned an empty file. The URL may be expired, protected, or malformed.';
  }

  return message;
}

async function fetchBulkImageBlob(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BULK_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = getHeaderValue(response.headers, 'content-type');
    if (!isAllowedBulkContentType(contentType)) {
      throw new Error(`Expected an image, but received ${contentType}`);
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      const length = getHeaderValue(response.headers, 'content-length');
      throw new Error(length === '0'
        ? 'The server returned an empty image file'
        : 'Downloaded image data is empty');
    }

    return blob;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function updateBulkItemNames() {
  const nameTemplate = bulkNamePrefix.value || 'image_{n}';
  const extFallback = bulkExtensionFallback.value;

  bulkQueue.forEach((item, index) => {
    let name = nameTemplate;
    if (name.includes('{n}')) {
      name = name.replace('{n}', index + 1);
    } else {
      name = `${name}_${index + 1}`;
    }
    
    const originalExt = getExtensionFromUrl(item.url, 'jpg');
    const ext = extFallback === 'original' ? originalExt : extFallback;

    item.name = name;
    item.ext = ext;
    item.outputFormat = ext;

    const card = bulkQueueGrid.querySelector(`[data-id="${item.id}"]`);
    if (card) {
      card.querySelector('.file-name').textContent = `${name}.${ext}`;
      card.querySelector('.file-name').setAttribute('title', `${name}.${ext}`);
      
      if (item.status === 'done') {
        const badge = card.querySelector('.file-badge');
        badge.textContent = ext.toUpperCase();
      }
    }
  });
}

function resetBulkQueueForRedownload() {
  if (isBulkDownloading) return;

  let changed = false;
  bulkQueue.forEach((item) => {
    if (item.status === 'done' || item.status === 'error') {
      item.status = 'pending';
      item.progress = 0;
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      item.outputBlob = null;
      item.outputUrl = null;
      item.errorMessage = null;
      updateFileCardUI(item, bulkQueueGrid);
      changed = true;
    }
  });

  if (changed) {
    bulkMasterStatus.textContent = 'Settings adjusted. Ready to download again.';
    bulkMasterStatus.className = 'master-status';
    updateBulkQueueStats();
    updateBulkMasterProgress();
  }
}

function removeBulkFile(id) {
  const index = bulkQueue.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = bulkQueue[index];
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);

  bulkQueue.splice(index, 1);
  const card = bulkQueueGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();

  if (bulkQueue.length === 0) {
    bulkOptionsPanel.classList.add('panel-hidden');
    bulkQueueSection.classList.add('panel-hidden');
  } else {
    updateBulkItemNames();
    updateBulkQueueStats();
    updateBulkMasterProgress();
  }
}

function clearBulkQueue() {
  if (isBulkDownloading) return;

  bulkQueue.forEach((item) => {
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });

  bulkQueue = [];
  bulkQueueGrid.innerHTML = '';
  
  bulkOptionsPanel.classList.add('panel-hidden');
  bulkQueueSection.classList.add('panel-hidden');
  
  bulkMasterStatus.textContent = 'Ready to download';
  bulkMasterStatus.className = 'master-status';
  updateBulkMasterProgress();
}

function updateBulkQueueStats() {
  const count = bulkQueue.length;
  bulkQueueStats.textContent = `${count} URL${count > 1 ? 's' : ''} found`;
  bulkConvertBtn.disabled = isBulkDownloading || !bulkQueue.some(item => item.status === 'pending');
}

function updateBulkMasterProgress() {
  const total = bulkQueue.length;
  if (total === 0) {
    bulkMasterProgressBar.style.width = '0%';
    bulkDownloadAllBtn.disabled = true;
    return;
  }

  const completed = bulkQueue.filter(item => item.status === 'done' || item.status === 'error').length;
  const percentage = (completed / total) * 100;
  bulkMasterProgressBar.style.width = `${percentage}%`;

  const successCount = bulkQueue.filter(item => item.status === 'done').length;
  bulkDownloadAllBtn.disabled = successCount === 0 || isBulkDownloading;
}

function downloadBulkIndividual(item) {
  if (item.status === 'done' && item.outputUrl) {
    const a = document.createElement('a');
    a.href = item.outputUrl;
    a.download = `${item.name}.${item.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.open(item.url, '_blank');
  }
}

async function downloadBulkAll() {
  const pendingItems = bulkQueue.filter(item => item.status === 'pending');
  if (pendingItems.length === 0 || isBulkDownloading) return;

  isBulkDownloading = true;
  bulkConvertBtn.disabled = true;
  bulkClearQueueBtn.disabled = true;
  bulkDownloadAllBtn.disabled = true;
  
  bulkNamePrefix.disabled = true;
  bulkExtensionFallback.disabled = true;
  bulkPasteArea.disabled = true;
  bulkClearTextBtn.disabled = true;
  bulkExtractBtn.disabled = true;

  bulkMasterStatus.textContent = 'Downloading images...';
  bulkMasterStatus.classList.add('pulse');

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    item.status = 'converting';
    item.progress = 20;
    updateFileCardUI(item, bulkQueueGrid);

    try {
      const blob = await fetchBulkImageBlob(item.url);
      item.progress = 60;
      updateFileCardUI(item, bulkQueueGrid);
      
      item.progress = 100;
      item.status = 'done';
      item.outputBlob = blob;
      item.size = blob.size; 
      item.outputUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error('Download error for URL:', item.url, err);
      item.status = 'error';
      item.errorMessage = getBulkDownloadErrorMessage(err);
    }

    updateFileCardUI(item, bulkQueueGrid);
    updateBulkMasterProgress();
  }

  isBulkDownloading = false;
  bulkClearQueueBtn.disabled = false;
  bulkConvertBtn.disabled = !bulkQueue.some(item => item.status === 'pending');
  
  bulkNamePrefix.disabled = false;
  bulkExtensionFallback.disabled = false;
  bulkPasteArea.disabled = false;
  bulkClearTextBtn.disabled = false;
  bulkExtractBtn.disabled = false;

  bulkMasterStatus.classList.remove('pulse');
  
  const successCount = bulkQueue.filter(item => item.status === 'done').length;
  const failCount = bulkQueue.filter(item => item.status === 'error').length;
  
  if (failCount === 0) {
    bulkMasterStatus.textContent = `Successfully downloaded ${successCount} image${successCount > 1 ? 's' : ''}!`;
  } else {
    bulkMasterStatus.textContent = `Completed: ${successCount} downloaded, ${failCount} failed.`;
  }
  
  updateBulkMasterProgress();
}

async function packageBulkZip() {
  const successItems = bulkQueue.filter(item => item.status === 'done' && item.outputBlob);
  if (successItems.length === 0) return;

  if (successItems.length === 1) {
    downloadBulkIndividual(successItems[0]);
    return;
  }

  const originalText = bulkMasterStatus.textContent;
  bulkMasterStatus.textContent = 'Generating ZIP archive...';
  bulkMasterStatus.classList.add('pulse');
  bulkDownloadAllBtn.disabled = true;

  try {
    const zipBlob = await createZip(successItems);
    const zipUrl = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'ImgConvert-Downloaded-Pack.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    bulkMasterStatus.textContent = 'ZIP download completed!';
  } catch (err) {
    console.error(err);
    alert('Failed to generate ZIP archive: ' + err.message);
    bulkMasterStatus.textContent = 'ZIP creation failed.';
  } finally {
    bulkMasterStatus.classList.remove('pulse');
    setTimeout(() => {
      bulkMasterStatus.textContent = originalText;
      bulkDownloadAllBtn.disabled = false;
    }, 3000);
  }
}

// ==========================================
// TAB 6: IMAGE PROMPT NOTES PROCESSORS
// ==========================================
function createPromptId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function normalizePromptNote(rawNote) {
  if (!rawNote || typeof rawNote !== 'object') return null;

  const description = typeof rawNote.description === 'string'
    ? rawNote.description
    : (typeof rawNote.prompt === 'string' ? rawNote.prompt : '');

  if (!description.trim()) return null;

  const now = new Date().toISOString();
  return {
    id: typeof rawNote.id === 'string' && rawNote.id ? rawNote.id : createPromptId(),
    title: typeof rawNote.title === 'string' && rawNote.title.trim()
      ? rawNote.title.trim()
      : 'Untitled prompt',
    description: description.trim(),
    createdAt: typeof rawNote.createdAt === 'string' ? rawNote.createdAt : now,
    updatedAt: typeof rawNote.updatedAt === 'string' ? rawNote.updatedAt : now
  };
}

function loadImagePromptNotes() {
  try {
    const stored = localStorage.getItem(LS_IMAGE_PROMPTS);
    const parsed = stored ? JSON.parse(stored) : [];
    imagePromptNotes = Array.isArray(parsed)
      ? parsed.map(normalizePromptNote).filter(Boolean)
      : [];
  } catch (error) {
    console.warn('Failed to load image prompt notes:', error);
    imagePromptNotes = [];
    promptFormStatus.textContent = 'Prompt storage could not be read. Starting with an empty list.';
  }
}

function persistImagePromptNotes() {
  localStorage.setItem(LS_IMAGE_PROMPTS, JSON.stringify(imagePromptNotes));
}

function getFilteredPromptNotes() {
  const query = promptSearchInput.value.trim().toLowerCase();
  if (!query) return imagePromptNotes;

  return imagePromptNotes.filter((note) => {
    return note.title.toLowerCase().includes(query)
      || note.description.toLowerCase().includes(query);
  });
}

function formatPromptDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved locally';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function updatePromptCount() {
  const total = imagePromptNotes.length;
  const visible = getFilteredPromptNotes().length;
  promptCount.textContent = promptSearchInput.value.trim()
    ? `${visible} of ${total} prompt${total === 1 ? '' : 's'} shown`
    : `${total} prompt${total === 1 ? '' : 's'} saved`;
  promptExportBtn.disabled = total === 0;
}

function renderImagePromptNotes() {
  promptGrid.innerHTML = '';
  const filteredNotes = getFilteredPromptNotes();

  updatePromptCount();
  promptEmptyState.classList.toggle('hidden', filteredNotes.length > 0);

  filteredNotes.forEach((note) => {
    const card = document.createElement('article');
    card.className = 'prompt-card';
    card.dataset.id = note.id;

    const header = document.createElement('div');
    header.className = 'prompt-card-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'prompt-card-title-wrap';

    const title = document.createElement('h4');
    title.textContent = note.title;
    title.title = note.title;

    const meta = document.createElement('span');
    meta.className = 'prompt-card-meta';
    meta.textContent = `Updated ${formatPromptDate(note.updatedAt)}`;

    titleWrap.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'prompt-card-actions';

    const copyBtn = createPromptIconButton('copy', 'Copy prompt', () => copyImagePromptNote(note.id));
    const editBtn = createPromptIconButton('square-pen', 'Edit prompt', () => editImagePromptNote(note.id));
    const deleteBtn = createPromptIconButton('trash-2', 'Delete prompt', () => deleteImagePromptNote(note.id), 'danger');

    actions.append(copyBtn, editBtn, deleteBtn);
    header.append(titleWrap, actions);

    const body = document.createElement('p');
    body.className = 'prompt-card-description';
    body.textContent = note.description;

    card.append(header, body);
    promptGrid.appendChild(card);
  });

  lucide.createIcons({
    attrs: { class: 'lucide' },
    nameAttr: 'data-lucide',
    node: promptGrid
  });
}

function createPromptIconButton(iconName, title, onClick, variant = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = variant ? `prompt-icon-btn ${variant}` : 'prompt-icon-btn';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = `<i data-lucide="${iconName}"></i>`;
  button.addEventListener('click', onClick);
  return button;
}

function saveImagePromptNote() {
  const title = promptTitleInput.value.trim() || 'Untitled prompt';
  const description = promptDescriptionInput.value.trim();

  if (!description) {
    promptFormStatus.textContent = 'Please paste a prompt description before saving.';
    promptDescriptionInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const existingIndex = imagePromptNotes.findIndex(note => note.id === editingPromptId);

  if (existingIndex !== -1) {
    imagePromptNotes[existingIndex] = {
      ...imagePromptNotes[existingIndex],
      title,
      description,
      updatedAt: now
    };
    promptFormStatus.textContent = 'Prompt updated and saved locally.';
  } else {
    imagePromptNotes.unshift({
      id: createPromptId(),
      title,
      description,
      createdAt: now,
      updatedAt: now
    });
    promptFormStatus.textContent = 'Prompt saved locally.';
  }

  persistImagePromptNotes();
  clearPromptForm({ keepStatus: true });
  renderImagePromptNotes();
}

function clearPromptForm(options = {}) {
  editingPromptId = null;
  promptTitleInput.value = '';
  promptDescriptionInput.value = '';
  promptSaveBtn.querySelector('span').textContent = 'Save Prompt';

  if (!options.keepStatus) {
    promptFormStatus.textContent = 'Ready to save your next prompt.';
  }
}

function editImagePromptNote(id) {
  const note = imagePromptNotes.find(item => item.id === id);
  if (!note) return;

  editingPromptId = id;
  promptTitleInput.value = note.title;
  promptDescriptionInput.value = note.description;
  promptSaveBtn.querySelector('span').textContent = 'Update Prompt';
  promptFormStatus.textContent = 'Editing saved prompt. Update when ready.';
  promptTitleInput.focus();
}

async function copyImagePromptNote(id) {
  const note = imagePromptNotes.find(item => item.id === id);
  if (!note) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(note.description);
    } else {
      copyTextWithFallback(note.description);
    }
    promptFormStatus.textContent = `Copied "${note.title}" prompt.`;
  } catch (error) {
    console.error('Copy prompt failed:', error);
    copyTextWithFallback(note.description);
    promptFormStatus.textContent = `Copied "${note.title}" prompt.`;
  }
}

function copyTextWithFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function deleteImagePromptNote(id) {
  const note = imagePromptNotes.find(item => item.id === id);
  if (!note) return;

  const confirmed = window.confirm(`Delete "${note.title}"?`);
  if (!confirmed) return;

  imagePromptNotes = imagePromptNotes.filter(item => item.id !== id);
  if (editingPromptId === id) clearPromptForm();

  persistImagePromptNotes();
  renderImagePromptNotes();
  promptFormStatus.textContent = 'Prompt deleted.';
}

function exportImagePromptNotes() {
  if (imagePromptNotes.length === 0) return;

  const exportPayload = {
    app: 'ImgConvert Pro',
    type: 'image-prompt-notes',
    version: 1,
    exportedAt: new Date().toISOString(),
    prompts: imagePromptNotes
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `imgconvert-image-prompts-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  promptFormStatus.textContent = 'Prompt library exported as JSON.';
}

// ==========================================
// SHARED FILE CARD UI RENDERING
// ==========================================
function renderFileCard(item, gridElement, queueArray, removeCallback, downloadCallback) {
  const clone = fileCardTemplate.content.cloneNode(true);
  const card = clone.querySelector('.file-card');
  card.setAttribute('data-id', item.id);

  // Filename & Info
  card.querySelector('.file-name').textContent = `${item.name}.${item.ext}`;
  card.querySelector('.file-name').setAttribute('title', `${item.name}.${item.ext}`);
  card.querySelector('.file-size').textContent = formatBytes(item.size);

  // Preview Load
  const img = card.querySelector('.preview-img');
  const placeholder = card.querySelector('.preview-placeholder');
  img.src = item.localThumbUrl;
  img.onload = () => {
    img.classList.remove('hidden');
    placeholder.classList.add('hidden');
    // Apply logo overlay once base image is measured (logo tab only)
    if (gridElement === logoQueueGrid) {
      applyOverlayToCard(card);
    }
  };

  // Card Controls
  card.querySelector('.card-remove-btn').onclick = (e) => {
    e.stopPropagation();
    if (isPngConverting || isLogoConverting || isGeminiConverting) return;
    removeCallback(item.id);
  };

  card.querySelector('.btn-card-download').onclick = (e) => {
    e.stopPropagation();
    downloadCallback(item);
  };

  gridElement.appendChild(card);
  
  // Re-load lucide icons for newly added buttons
  lucide.createIcons({
    attrs: { class: 'lucide' },
    nameAttr: 'data-lucide',
    node: card
  });
}

// ==========================================
// LOGO OVERLAY PREVIEW HELPERS
// ==========================================

/**
 * Applies (or clears) the watermark overlay img on a single card element.
 * Sizes the overlay relative to the rendered preview image dimensions.
 */
function applyOverlayToCard(card) {
  const overlayImg = card.querySelector('.watermark-overlay-img');
  if (!overlayImg) return;

  if (!logoImageElement || !logoBase64) {
    overlayImg.classList.add('hidden');
    overlayImg.src = '';
    return;
  }

  const baseImg = card.querySelector('.preview-img');
  const sizePercent = parseInt(logoSizeSlider.value, 10) / 100;
  const position = logoPosition.value;
  const edgeDistance = parseInt(logoEdgeDistanceSlider.value, 10) || 0;

  // Width of the logo in the thumbnail = rendered preview width * scale %
  const previewW = baseImg.offsetWidth || 120;
  const previewH = baseImg.offsetHeight || 120;
  const logoW = Math.round(previewW * sizePercent);
  const logoH = Math.round(logoW * (logoImageElement.naturalHeight / logoImageElement.naturalWidth));
  const previewScale = baseImg.naturalWidth ? previewW / baseImg.naturalWidth : 1;
  const previewEdgeDistance = edgeDistance * previewScale;
  const wrapper = card.querySelector('.preview-wrapper');
  if (wrapper) {
    wrapper.style.width = `${previewW}px`;
    wrapper.style.height = `${previewH}px`;
  }

  overlayImg.src = logoBase64;
  overlayImg.style.width = `${logoW}px`;
  overlayImg.style.height = 'auto';

  // Reset all corner offsets first
  overlayImg.style.top    = '';
  overlayImg.style.bottom = '';
  overlayImg.style.left   = '';
  overlayImg.style.right  = '';

  const { x, y } = calculateLogoPlacement({
    imageWidth: previewW,
    imageHeight: previewH,
    logoWidth: logoW,
    logoHeight: logoH,
    position,
    edgeDistance: previewEdgeDistance
  });

  overlayImg.style.left = `${x}px`;
  overlayImg.style.top = `${y}px`;

  overlayImg.classList.remove('hidden');
}

/**
 * Refreshes the watermark overlay on every card in the logo queue grid.
 * Call whenever logo, size, or position changes.
 */
function updateLogoOverlayOnCards() {
  const cards = logoQueueGrid.querySelectorAll('.file-card');
  cards.forEach((card) => applyOverlayToCard(card));
}

// ==========================================
// LOGO CACHE (localStorage)
// ==========================================

function applyLogoOutputFormatState() {
  const isPng = logoOutFormat.value === 'image/png';
  logoQualityGroup.style.opacity = isPng ? '0.3' : '1';
  logoQualitySlider.disabled = isPng;
}

function restoreSelectValue(selectElement, savedValue) {
  if (!savedValue) return;
  const hasOption = Array.from(selectElement.options).some(option => option.value === savedValue);
  if (hasOption) {
    selectElement.value = savedValue;
  }
}

function restoreRangeValue(rangeElement, displayElement, savedValue, suffix = '') {
  if (savedValue === null) return;

  const min = Number(rangeElement.min);
  const max = Number(rangeElement.max);
  const value = Number(savedValue);
  if (!Number.isFinite(value) || value < min || value > max) return;

  rangeElement.value = String(value);
  displayElement.textContent = `${value}${suffix}`;
}

/** Restores logo image and Add Logo settings from localStorage on page load. */
function loadLogoCache() {
  restoreRangeValue(logoSizeSlider, logoSizeValue, localStorage.getItem(LS_LOGO_SCALE), '%');
  restoreRangeValue(logoEdgeDistanceSlider, logoEdgeDistanceValue, localStorage.getItem(LS_LOGO_EDGE_DISTANCE), 'px');
  restoreRangeValue(logoQualitySlider, logoQualityValue, localStorage.getItem(LS_LOGO_QUALITY), '%');
  restoreSelectValue(logoPosition, localStorage.getItem(LS_LOGO_POSITION));
  restoreSelectValue(logoOutFormat, localStorage.getItem(LS_LOGO_FORMAT));
  applyLogoOutputFormatState();

  // Restore logo image
  const savedB64 = localStorage.getItem(LS_LOGO_B64);
  if (!savedB64) return;
  const savedName = localStorage.getItem(LS_LOGO_NAME) || 'Cached logo';

  const img = new Image();
  img.onload = () => {
    logoImageElement = img;
    logoBase64 = savedB64;
    logoPreviewImg.src = savedB64;
    logoPreviewName.textContent = savedName;

    logoUploadPrompt.classList.add('hidden');
    logoUploadPreview.classList.remove('hidden');

    updateLogoOverlayOnCards();
    updateLogoQueueStats();
  };
  img.onerror = () => {
    // Cached data is corrupt — drop it
    localStorage.removeItem(LS_LOGO_B64);
    localStorage.removeItem(LS_LOGO_NAME);
  };
  img.src = savedB64;
}


function updateFileCardUI(item, gridElement) {
  const card = gridElement.querySelector(`[data-id="${item.id}"]`);
  if (!card) return;

  const badge = card.querySelector('.file-badge');
  const fileSize = card.querySelector('.file-size');
  const progressContainer = card.querySelector('.card-progress-bar-container');
  const progressBar = card.querySelector('.card-progress-bar');
  const resultPanel = card.querySelector('.conversion-result');
  const downloadBtn = card.querySelector('.btn-card-download');

  badge.className = 'file-badge';
  if (fileSize) {
    fileSize.textContent = formatBytes(item.size || item.outputBlob?.size || 0);
  }
  
  if (item.status === 'pending') {
    badge.textContent = 'Pending';
    badge.classList.add('badge-pending');
    progressContainer.classList.add('hidden');
    resultPanel.classList.add('hidden');
    downloadBtn.disabled = true;
  } else if (item.status === 'converting') {
    badge.textContent = 'Converting';
    badge.classList.add('badge-converting');
    progressContainer.classList.remove('hidden');
    progressBar.style.width = `${item.progress}%`;
    resultPanel.classList.add('hidden');
    downloadBtn.disabled = true;
  } else if (item.status === 'done') {
    progressContainer.classList.add('hidden');
    resultPanel.classList.remove('hidden');
    resultPanel.querySelector('.result-size').textContent = formatBytes(item.outputBlob.size);
    
    const ratio = item.size ? ((item.size - item.outputBlob.size) / item.size) * 100 : 0;
    const savingsEl = resultPanel.querySelector('.result-savings');
    if (ratio > 0) {
      savingsEl.textContent = `-${ratio.toFixed(0)}%`;
      savingsEl.style.color = '#34d399';
      savingsEl.classList.remove('hidden');
    } else if (ratio < 0) {
      savingsEl.textContent = `+${Math.abs(ratio).toFixed(0)}%`;
      savingsEl.style.color = '#f87171';
      savingsEl.classList.remove('hidden');
    } else {
      savingsEl.classList.add('hidden');
    }

    if (item.noWatermark) {
      // No Gemini logo was detected — show amber warning badge but still allow download
      badge.textContent = 'No Logo';
      badge.classList.add('badge-warn');
      badge.setAttribute('title', item.errorMessage || 'No Gemini logo detected — original returned');
    } else {
      const extName = item.outputFormat ? item.outputFormat.toUpperCase() : 'JPG';
      badge.textContent = extName;
      badge.classList.add('badge-done');
    }

    downloadBtn.disabled = false;
  } else if (item.status === 'error') {
    badge.textContent = 'Failed';
    badge.classList.add('badge-error');
    badge.setAttribute('title', item.errorMessage || 'Conversion failed');
    progressContainer.classList.add('hidden');
    resultPanel.classList.add('hidden');
    downloadBtn.disabled = true;
  }
}

// Clean up windows unload events
// Clean up windows unload events
window.addEventListener('beforeunload', () => {
  pngQueue.forEach(item => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  logoQueue.forEach(item => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  geminiQueue.forEach(item => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
  });
  bulkQueue.forEach(item => {
    if (item.localThumbUrl && item.localThumbUrl.startsWith('blob:')) URL.revokeObjectURL(item.localThumbUrl);
    if (item.outputUrl && item.outputUrl.startsWith('blob:')) URL.revokeObjectURL(item.outputUrl);
  });
  if (logoObjectURL) {
    URL.revokeObjectURL(logoObjectURL);
  }
  destroyCropper();
});

// ==========================================
// TAB 5.5: COMBINE IMAGES PROCESSORS
// ==========================================
function handleCombineDragOver(e) {
  e.preventDefault();
  combineDropzone.classList.add('dragover');
}

function handleCombineDragLeave(e) {
  e.preventDefault();
  combineDropzone.classList.remove('dragover');
}

function handleCombineDrop(e) {
  e.preventDefault();
  combineDropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) processCombineFiles(files);
}

function handleCombineFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) processCombineFiles(files);
  combineFileInput.value = '';
}

function processCombineFiles(filesList) {
  const maxLimit = 50 * 1024 * 1024;
  let addedAny = false;

  Array.from(filesList).forEach((file) => {
    const ext = getExtension(file.name);
    const validFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
    
    if (!validFormats.includes(ext)) {
      alert(`Format error: "${file.name}" is not supported.`);
      return;
    }

    if (file.size > maxLimit) {
      alert(`Size limit error: "${file.name}" exceeds the 50MB maximum size.`);
      return;
    }

    const localThumbUrl = URL.createObjectURL(file);
    const item = {
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      name: file.name,
      ext: ext,
      size: file.size,
      status: 'pending',
      localThumbUrl: localThumbUrl,
      cropData: null // {x, y, width, height}
    };

    combineQueue.push(item);
    renderCombineCard(item);
    addedAny = true;
  });

  if (addedAny) {
    updateCombineLayoutVisibility();
    updateCombineQueueStats();
  }
}

function updateCombineLayoutVisibility() {
  if (combineQueue.length > 0) {
    combineDropzone.classList.add('panel-hidden');
    combineQueueSection.classList.remove('panel-hidden');
  } else {
    combineDropzone.classList.remove('panel-hidden');
    combineQueueSection.classList.add('panel-hidden');
  }
}

function updateCombineQueueStats() {
  const count = combineQueue.length;
  combineQueueStats.textContent = `${count} image${count > 1 ? 's' : ''}`;
  combineConvertBtn.disabled = count < 2 || isCombining;
}

function renderCombineCard(item) {
  const clone = fileCardTemplate.content.cloneNode(true);
  const card = clone.querySelector('.file-card');
  card.setAttribute('data-id', item.id);
  
  card.querySelector('.file-name').textContent = item.name;
  card.querySelector('.file-name').title = item.name;
  card.querySelector('.file-size').textContent = formatBytes(item.size);
  
  const img = card.querySelector('.preview-img');
  img.src = item.localThumbUrl;
  img.classList.remove('hidden');
  card.querySelector('.preview-placeholder').classList.add('hidden');
  
  const removeBtn = card.querySelector('.card-remove-btn');
  removeBtn.addEventListener('click', () => removeCombineFile(item.id));
  
  const actionsContainer = card.querySelector('.card-actions');
  actionsContainer.innerHTML = ''; 
  
  const cropBtn = document.createElement('button');
  cropBtn.className = 'btn-card-crop';
  cropBtn.innerHTML = '<i data-lucide="crop"></i><span>Crop</span>';
  cropBtn.addEventListener('click', () => openCombineCropModal(item.id));
  
  actionsContainer.appendChild(cropBtn);
  
  combineQueueGrid.appendChild(card);
  if (window.lucide) {
    lucide.createIcons({ root: card });
  }
}

function removeCombineFile(id) {
  const index = combineQueue.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = combineQueue[index];
  if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);

  combineQueue.splice(index, 1);
  const card = combineQueueGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();

  updateCombineLayoutVisibility();
  updateCombineQueueStats();
}

function clearCombineQueue() {
  if (isCombining) return;
  combineQueue.forEach(item => {
    if (item.localThumbUrl) URL.revokeObjectURL(item.localThumbUrl);
  });
  combineQueue = [];
  combineQueueGrid.innerHTML = '';
  updateCombineLayoutVisibility();
  updateCombineQueueStats();
  combineMasterStatus.textContent = 'Ready to combine';
}

function openCombineCropModal(id) {
  const item = combineQueue.find(i => i.id === id);
  if (!item) return;
  currentCombineCropId = id;
  
  combineCropModalImg.src = item.localThumbUrl;
  combineCropModalOverlay.classList.remove('hidden');
  
  setTimeout(() => {
    combineCropModalOverlay.classList.add('visible');
    if (combineCropper) {
      combineCropper.destroy();
    }
    
    combineCropper = new Cropper(combineCropModalImg, {
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      zoomable: false,
      ready() {
        if (item.cropData) {
          combineCropper.setData(item.cropData);
        }
      }
    });
  }, 50);
}

function closeCombineCropModal() {
  combineCropModalOverlay.classList.remove('visible');
  setTimeout(() => {
    combineCropModalOverlay.classList.add('hidden');
    if (combineCropper) {
      combineCropper.destroy();
      combineCropper = null;
    }
    currentCombineCropId = null;
  }, 250);
}

function saveCombineCrop() {
  if (!combineCropper || !currentCombineCropId) return;
  
  const item = combineQueue.find(i => i.id === currentCombineCropId);
  if (item) {
    const cropData = combineCropper.getData(true);
    item.cropData = {
      x: cropData.x,
      y: cropData.y,
      width: cropData.width,
      height: cropData.height
    };
    
    const card = combineQueueGrid.querySelector(`[data-id="${currentCombineCropId}"]`);
    if (card) {
      const badge = card.querySelector('.file-badge');
      badge.textContent = 'Cropped';
      badge.className = 'file-badge badge-active';
    }
  }
  closeCombineCropModal();
}

async function convertCombineAll() {
  if (combineQueue.length < 2 || isCombining) return;

  isCombining = true;
  combineConvertBtn.disabled = true;
  combineClearQueueBtn.disabled = true;
  combineAddMoreBtn.disabled = true;
  
  combineMasterStatus.textContent = 'Stitching images...';
  combineMasterStatus.classList.add('pulse');
  combineMasterProgressBar.style.width = '50%';

  try {
    const blob = await combineImagesVertically(combineQueue);
    combineMasterProgressBar.style.width = '100%';
    combineMasterStatus.textContent = 'Combination complete!';
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Construct meaningful filename from original files
    const baseNames = combineQueue.slice(0, 3).map(item => {
      const lastDot = item.name.lastIndexOf('.');
      return lastDot > 0 ? item.name.substring(0, lastDot) : item.name;
    });
    let downloadName = baseNames.join('_');
    if (combineQueue.length > 3) {
      downloadName += `_and_${combineQueue.length - 3}_more`;
    }
    downloadName += '_combined.jpg';
    
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    
  } catch (err) {
    console.error(err);
    alert('Failed to combine images: ' + err.message);
    combineMasterStatus.textContent = 'Combination failed.';
    combineMasterProgressBar.style.width = '0%';
  }

  isCombining = false;
  combineConvertBtn.disabled = false;
  combineClearQueueBtn.disabled = false;
  combineAddMoreBtn.disabled = false;
  combineMasterStatus.classList.remove('pulse');
}

// Run Init on Page Load
init();
