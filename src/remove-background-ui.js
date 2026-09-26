import {
  getBackgroundRemovalError,
  getBackgroundRemovalFilename,
  removeImageBackground
} from './background-removal.js';
import { formatBytes } from './utils.js';

export function initBackgroundRemoval() {
  const dropzone = document.getElementById('remove-bg-dropzone');
  const input = document.getElementById('remove-bg-fileInput');
  const editor = document.getElementById('remove-bg-editor');
  const changeButton = document.getElementById('remove-bg-changeBtn');
  const downloadButton = document.getElementById('remove-bg-downloadBtn');
  const fileName = document.getElementById('remove-bg-fileName');
  const imageMeta = document.getElementById('remove-bg-imageMeta');
  const status = document.getElementById('remove-bg-status');
  const stage = document.getElementById('remove-bg-stage');
  const original = document.getElementById('remove-bg-originalImage');
  const result = document.getElementById('remove-bg-resultImage');
  const compare = document.getElementById('remove-bg-compare');
  const pending = document.getElementById('remove-bg-pending');

  let sourceUrl = null;
  let resultUrl = null;
  let outputBlob = null;
  let sourceName = '';
  let generation = 0;

  function setSplit(value) {
    stage.style.setProperty('--split', `${value}%`);
  }

  function cleanUrls() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    sourceUrl = null;
    resultUrl = null;
  }

  async function loadFile(file) {
    const error = getBackgroundRemovalError(file);
    if (error) {
      if (editor.classList.contains('panel-hidden')) {
        dropzone.querySelector('.dropzone-formats').textContent = error;
      } else {
        status.textContent = error;
      }
      return;
    }

    const currentGeneration = ++generation;
    cleanUrls();
    outputBlob = null;
    sourceName = file.name;
    sourceUrl = URL.createObjectURL(file);
    fileName.textContent = file.name;
    imageMeta.textContent = `${formatBytes(file.size)} · JPG or PNG`;
    original.src = sourceUrl;
    result.removeAttribute('src');
    compare.value = '50';
    compare.disabled = true;
    setSplit(100);
    downloadButton.disabled = true;
    changeButton.disabled = true;
    pending.classList.remove('panel-hidden');
    pending.textContent = 'Removing background…';
    status.textContent = 'Removing background… First use may take longer while the model downloads.';
    dropzone.classList.add('panel-hidden');
    editor.classList.remove('panel-hidden');

    try {
      await original.decode();
      if (generation !== currentGeneration) return;
      const ratio = original.naturalWidth / original.naturalHeight;
      stage.style.aspectRatio = `${original.naturalWidth} / ${original.naturalHeight}`;
      stage.style.width = `min(100%, 820px, ${Math.round(60 * ratio)}vh)`;
      imageMeta.textContent = `${original.naturalWidth} × ${original.naturalHeight} px · ${formatBytes(file.size)}`;

      const blob = await removeImageBackground(file);
      if (generation !== currentGeneration) return;
      resultUrl = URL.createObjectURL(blob);
      result.src = resultUrl;
      await result.decode();
      outputBlob = blob;
      setSplit(50);
      pending.classList.add('panel-hidden');
      compare.disabled = false;
      downloadButton.disabled = false;
      status.textContent = 'Background removed. Drag to inspect, then download your PNG.';
    } catch (err) {
      console.error('Background removal failed:', err);
      pending.textContent = 'Could not remove this background.';
      status.textContent = 'Could not process this image. Try another JPG or PNG, or check your connection for the first model download.';
    } finally {
      if (generation === currentGeneration) changeButton.disabled = false;
    }
  }

  dropzone.addEventListener('click', (event) => {
    if (event.target !== input) input.click();
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    if (event.dataTransfer.files[0]) loadFile(event.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]);
    input.value = '';
  });
  changeButton.addEventListener('click', () => input.click());
  compare.addEventListener('input', () => setSplit(compare.value));
  downloadButton.addEventListener('click', () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getBackgroundRemovalFilename(sourceName);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
