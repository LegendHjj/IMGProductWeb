import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { convertToJpg, applyLogo, createZip, formatBytes, getExtension, removeGeminiWatermark, extractImageUrls } from './utils.js';

// ==========================================
// APPLICATION STATE
// ==========================================
let activeTab = 'png-to-jpg';

// PNG to JPG State
let pngQueue = [];
let isPngConverting = false;

// Add Logo State
let logoQueue = [];
let isLogoConverting = false;
let logoImageElement = null; // Stored HTMLImageElement once loaded
let logoObjectURL = null;

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

// ==========================================
// DOM SELECTORS
// ==========================================
// Sidebar navigation
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.tab-panel');

// PNG to JPG Converter Elements
const pngDropzone = document.getElementById('dropzone');
const pngFileInput = document.getElementById('fileInput');
const pngOptionsPanel = document.getElementById('optionsPanel');
const pngQualitySlider = document.getElementById('qualitySlider');
const pngQualityValue = document.getElementById('qualityValue');
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

  // ----------------------------------------
  // TAB 1: PNG TO JPG LISTENERS
  // ----------------------------------------
  pngDropzone.addEventListener('dragover', handlePngDragOver);
  pngDropzone.addEventListener('dragenter', handlePngDragOver);
  pngDropzone.addEventListener('dragleave', handlePngDragLeave);
  pngDropzone.addEventListener('dragend', handlePngDragLeave);
  pngDropzone.addEventListener('drop', handlePngDrop);
  pngDropzone.addEventListener('click', () => pngFileInput.click());
  pngFileInput.addEventListener('change', handlePngFileSelect);

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
  logoPosition.addEventListener('change', resetLogoQueueForReconvert);
  logoSizeSlider.addEventListener('input', (e) => {
    logoSizeValue.textContent = `${e.target.value}%`;
  });
  logoSizeSlider.addEventListener('change', resetLogoQueueForReconvert);
  logoOutFormat.addEventListener('change', (e) => {
    const isPng = e.target.value === 'image/png';
    logoQualityGroup.style.opacity = isPng ? '0.3' : '1';
    logoQualitySlider.disabled = isPng;
    resetLogoQueueForReconvert();
  });
  logoQualitySlider.addEventListener('input', (e) => {
    logoQualityValue.textContent = `${e.target.value}%`;
  });
  logoQualitySlider.addEventListener('change', resetLogoQueueForReconvert);

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

function processPngFiles(filesList) {
  const maxLimit = 50 * 1024 * 1024; // 50MB
  let addedAny = false;

  Array.from(filesList).forEach((file) => {
    const ext = getExtension(file.name);
    
    if (ext !== 'png' && ext !== 'jfif') {
      alert(`Format error: "${file.name}" is not supported. Please upload PNG or JFIF files.`);
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
      outputFormat: 'jpg', // PNG/JFIF to JPG always yields a JPG file
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

  pngMasterStatus.textContent = 'Ready to convert';
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
    pngMasterStatus.textContent = 'Settings adjusted. Ready to convert again.';
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
  
  pngQualitySlider.disabled = true;
  pngTransparencyBg.disabled = true;
  pngCustomColorPicker.disabled = true;

  const quality = parseFloat(pngQualitySlider.value) / 100;
  const bgColor = pngBgColor;

  pngMasterStatus.textContent = 'Converting images...';
  pngMasterStatus.classList.add('pulse');

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    item.status = 'converting';
    item.progress = 35;
    updateFileCardUI(item, pngQueueGrid);

    try {
      const outputBlob = await convertToJpg(item.file, quality, bgColor);
      item.progress = 100;
      item.status = 'done';
      item.outputBlob = outputBlob;
      item.outputUrl = URL.createObjectURL(outputBlob);
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
  
  pngQualitySlider.disabled = false;
  pngTransparencyBg.disabled = false;
  pngCustomColorPicker.disabled = false;

  pngMasterStatus.classList.remove('pulse');
  
  const successCount = pngQueue.filter(item => item.status === 'done').length;
  const failCount = pngQueue.filter(item => item.status === 'error').length;
  
  if (failCount === 0) {
    pngMasterStatus.textContent = `Successfully converted ${successCount} image${successCount > 1 ? 's' : ''}!`;
  } else {
    pngMasterStatus.textContent = `Completed: ${successCount} succeeded, ${failCount} failed.`;
  }
  
  updatePngMasterProgress();
}

function downloadPngIndividual(item) {
  if (item.status !== 'done' || !item.outputUrl) return;

  const a = document.createElement('a');
  a.href = item.outputUrl;
  a.download = `${item.name}.jpg`;
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
    a.download = 'ImgConvert-JPG-Pack.zip';
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

  // Load logo as Image element
  const img = new Image();
  img.onload = () => {
    logoImageElement = img;
    logoPreviewImg.src = img.src;
    logoPreviewName.textContent = file.name;
    
    // UI toggle
    logoUploadPrompt.classList.add('hidden');
    logoUploadPreview.classList.remove('hidden');
    
    resetLogoQueueForReconvert();
    updateLogoQueueStats();
  };
  
  if (logoObjectURL) {
    URL.revokeObjectURL(logoObjectURL);
  }
  logoObjectURL = URL.createObjectURL(file);
  img.src = logoObjectURL;
  
  // Clean input file value
  watermarkLogoFile.value = '';
}

// Remove watermark logo
function removeWatermarkLogo() {
  logoImageElement = null;
  if (logoObjectURL) {
    URL.revokeObjectURL(logoObjectURL);
    logoObjectURL = null;
  }
  
  logoUploadPrompt.classList.remove('hidden');
  logoUploadPreview.classList.add('hidden');
  logoPreviewImg.src = '';
  
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
  logoOutFormat.disabled = true;
  logoQualitySlider.disabled = true;

  const size = parseInt(logoSizeSlider.value);
  const position = logoPosition.value;
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
      item.status = 'done';
      item.outputBlob = blob;
      item.outputUrl = URL.createObjectURL(blob);
      item.outputFormat = 'png';
      item.geminiMeta = meta;
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

  const successCount = geminiQueue.filter(item => item.status === 'done').length;
  const failCount = geminiQueue.filter(item => item.status === 'error').length;

  if (failCount === 0) {
    geminiMasterStatus.textContent = `Successfully cleaned ${successCount} image${successCount > 1 ? 's' : ''}!`;
  } else {
    geminiMasterStatus.textContent = `Completed: ${successCount} cleaned, ${failCount} failed.`;
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
      const response = await fetch(item.url, {
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      item.progress = 60;
      updateFileCardUI(item, bulkQueueGrid);
      
      const blob = await response.blob();
      item.progress = 100;
      item.status = 'done';
      item.outputBlob = blob;
      item.size = blob.size; 
      item.outputUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error('Download error for URL:', item.url, err);
      item.status = 'error';
      if (err.message.includes('Failed to fetch') || err.message === 'TypeError: Failed to fetch') {
        item.errorMessage = 'CORS restriction or network offline. Click card to open in new tab.';
      } else {
        item.errorMessage = err.message || 'Download failed';
      }
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

function updateFileCardUI(item, gridElement) {
  const card = gridElement.querySelector(`[data-id="${item.id}"]`);
  if (!card) return;

  const badge = card.querySelector('.file-badge');
  const progressContainer = card.querySelector('.card-progress-bar-container');
  const progressBar = card.querySelector('.card-progress-bar');
  const resultPanel = card.querySelector('.conversion-result');
  const downloadBtn = card.querySelector('.btn-card-download');

  badge.className = 'file-badge';
  
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
    const extName = item.outputFormat ? item.outputFormat.toUpperCase() : 'JPG';
    badge.textContent = extName;
    badge.classList.add('badge-done');
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

// Run Init on Page Load
init();
