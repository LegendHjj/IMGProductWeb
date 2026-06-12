const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf8');

let idx = code.indexOf(`window.addEventListener('beforeunload'`);
if (idx !== -1) {
  code = code.substring(0, idx);
}

let appendCode = `// Clean up windows unload events
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
      alert(\`Format error: "\${file.name}" is not supported.\`);
      return;
    }

    if (file.size > maxLimit) {
      alert(\`Size limit error: "\${file.name}" exceeds the 50MB maximum size.\`);
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
  combineQueueStats.textContent = \`\${count} image\${count > 1 ? 's' : ''}\`;
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
  const card = combineQueueGrid.querySelector(\`[data-id="\${id}"]\`);
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
    
    const card = combineQueueGrid.querySelector(\`[data-id="\${currentCombineCropId}"]\`);
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
    a.download = \`combined_image_\${new Date().getTime()}.jpg\`;
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
`;

code += appendCode;
fs.writeFileSync('src/main.js', code);
