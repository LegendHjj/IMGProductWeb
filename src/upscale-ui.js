import { getUpscaleDimensions, getUpscaleFileError, getUpscaleFilename, upscaleImage } from './upscale.js';
import { formatBytes } from './utils.js';

export function initUpscaleImage() {
  const byId = name => document.getElementById(`upscale-${name}`);
  const dropzone = byId('dropzone');
  const input = byId('fileInput');
  const editor = byId('editor');
  const original = byId('originalImage');
  const result = byId('resultImage');
  const stage = byId('stage');
  const scale = byId('scale');
  const status = byId('status');
  const process = byId('processBtn');
  const cancel = byId('cancelBtn');
  const change = byId('changeBtn');
  const download = byId('downloadBtn');
  const compare = byId('compare');
  const actualSize = byId('actualSize');
  const progress = byId('progress');
  let file;
  let sourceUrl;
  let outputUrl;
  let outputScale;
  let controller;
  let generation = 0;

  function setPreviewSize() {
    if (!original.naturalWidth) return;
    const factor = outputUrl ? outputScale : 1;
    const ratio = original.naturalWidth / original.naturalHeight;
    stage.style.width = actualSize.checked
      ? `${original.naturalWidth * factor}px`
      : `min(100%, 820px, ${60 * ratio}vh)`;
    byId('previewWrap').classList.toggle('actual-size', actualSize.checked);
  }

  function resetOutput() {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    result.removeAttribute('src');
    stage.style.setProperty('--split', '100%');
    compare.disabled = true;
    download.disabled = true;
    ['compare', 'divider', 'afterLabel'].forEach(name => byId(name).classList.add('panel-hidden'));
    if (original.naturalWidth) setPreviewSize();
  }

  function updateDimensions() {
    try {
      const dimensions = getUpscaleDimensions(original.naturalWidth, original.naturalHeight, Number(scale.value));
      byId('outputSize').textContent = `${dimensions.width} × ${dimensions.height} px`;
      process.disabled = false;
      status.textContent = 'Choose a multiplier, then click Upscale Image.';
    } catch (error) {
      byId('outputSize').textContent = 'Image too large';
      process.disabled = true;
      status.textContent = error.message;
    }
  }

  async function loadFile(nextFile) {
    if (controller) return;
    const error = getUpscaleFileError(nextFile);
    if (error) {
      if (editor.classList.contains('panel-hidden')) dropzone.querySelector('.dropzone-formats').textContent = error;
      else status.textContent = error;
      return;
    }
    const currentGeneration = ++generation;
    resetOutput();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    file = nextFile;
    sourceUrl = URL.createObjectURL(file);
    original.src = sourceUrl;
    byId('fileName').textContent = file.name;
    byId('imageMeta').textContent = 'Loading image…';
    actualSize.checked = false;
    process.disabled = true;
    download.disabled = true;
    editor.classList.remove('panel-hidden');
    dropzone.classList.add('panel-hidden');
    status.textContent = 'Loading image…';
    try {
      await original.decode();
      if (generation !== currentGeneration) return;
      byId('imageMeta').textContent = `${original.naturalWidth} × ${original.naturalHeight} px · ${formatBytes(file.size)}`;
      stage.style.aspectRatio = `${original.naturalWidth} / ${original.naturalHeight}`;
      setPreviewSize();
      updateDimensions();
    } catch {
      if (generation !== currentGeneration) return;
      status.textContent = 'Could not open this image. Please choose another image.';
    }
  }

  async function runUpscale() {
    if (!file || controller || !original.naturalWidth) return;
    const selectedScale = Number(scale.value);
    resetOutput();
    const operation = new AbortController();
    controller = operation;
    process.disabled = change.disabled = scale.disabled = true;
    cancel.disabled = false;
    cancel.classList.remove('panel-hidden');
    progress.value = 0;
    progress.classList.remove('panel-hidden');
    status.textContent = 'Loading the AI model… First use may take a moment.';
    try {
      const blob = await upscaleImage(original, selectedScale, {
        signal: operation.signal,
        preserveAlpha: file.type !== 'image/jpeg',
        onProgress: value => {
          progress.value = value;
          status.textContent = `Enhancing image… ${value}%`;
        }
      });
      operation.signal.throwIfAborted();
      outputUrl = URL.createObjectURL(blob);
      outputScale = selectedScale;
      result.src = outputUrl;
      await result.decode();
      operation.signal.throwIfAborted();
      stage.style.setProperty('--split', '50%');
      compare.value = '50';
      compare.disabled = false;
      ['compare', 'divider', 'afterLabel'].forEach(name => byId(name).classList.remove('panel-hidden'));
      byId('afterLabel').textContent = `${selectedScale}× upscaled`;
      download.disabled = false;
      setPreviewSize();
      status.textContent = 'Image upscaled. Drag the divider to compare, or view actual pixels to inspect detail.';
    } catch (error) {
      resetOutput();
      status.textContent = operation.signal.aborted
        ? 'Upscaling cancelled. You can try again or change the image.'
        : 'Could not upscale this image. Check your connection for the model download, or try a smaller image.';
      if (!operation.signal.aborted) console.error('Upscaling failed:', error);
    } finally {
      controller = null;
      process.disabled = change.disabled = scale.disabled = false;
      cancel.classList.add('panel-hidden');
      progress.classList.add('panel-hidden');
    }
  }

  dropzone.addEventListener('click', event => { if (event.target !== input) input.click(); });
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    if (event.dataTransfer.files[0]) loadFile(event.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files[0]) loadFile(input.files[0]); input.value = ''; });
  change.addEventListener('click', () => input.click());
  scale.addEventListener('change', () => { resetOutput(); updateDimensions(); });
  process.addEventListener('click', runUpscale);
  cancel.addEventListener('click', () => {
    controller?.abort();
    cancel.disabled = true;
    status.textContent = 'Cancelling upscaling…';
  });
  compare.addEventListener('input', () => stage.style.setProperty('--split', `${compare.value}%`));
  actualSize.addEventListener('change', setPreviewSize);
  download.addEventListener('click', () => {
    if (!outputUrl) return;
    const anchor = document.createElement('a');
    anchor.href = outputUrl;
    anchor.download = getUpscaleFilename(file.name, outputScale);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  });
}
