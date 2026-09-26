export function getUpscaleFileError(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) return 'Choose a JPG, PNG, or WEBP image.';
  if (!file.size) return 'The selected image is empty.';
  if (file.size > 50 * 1024 * 1024) return 'The image exceeds the 50MB limit.';
  return null;
}

export function getUpscaleDimensions(width, height, scale) {
  if (![2, 4].includes(scale)) throw new Error('Choose 2× or 4× upscaling.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('Invalid image dimensions.');
  if (width * height > 6000000) throw new Error('Choose an image of 6 megapixels or less.');
  const output = { width: width * scale, height: height * scale };
  if (output.width * output.height > 32000000 || Math.max(output.width, output.height) > 8192) {
    throw new Error('This output is too large for browser processing. Try 2× or a smaller image.');
  }
  return output;
}

export function getUpscaleFilename(name, scale) {
  return `${name.replace(/\.(jpe?g|png|webp)$/i, '')}-upscaled-${scale}x.png`;
}

export function restoreUpscaleAlpha(enhanced, mask) {
  for (let i = 3; i < enhanced.length; i += 4) enhanced[i] = mask[i];
}

export async function upscaleImage(image, scale, { signal, onProgress, preserveAlpha = true } = {}) {
  const dimensions = getUpscaleDimensions(image.naturalWidth, image.naturalHeight, scale);
  const [{ default: Upscaler }, modelModule, tf] = await Promise.all([
    import('upscaler'),
    scale === 2 ? import('@upscalerjs/esrgan-slim/2x') : import('@upscalerjs/esrgan-slim/4x'),
    import('@tensorflow/tfjs')
  ]);
  signal?.throwIfAborted();
  const upscaler = new Upscaler({ model: modelModule.default });
  // The preview's displayed size can differ from its source pixel dimensions.
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  let tensor;
  try {
    source.getContext('2d').drawImage(image, 0, 0);
    tensor = await upscaler.upscale(source, {
      output: 'tensor', patchSize: 64, padding: 4,
      awaitNextFrame: true, signal,
      progress: (value) => onProgress?.(Math.round(value * 100))
    });
    signal?.throwIfAborted();
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const pixels = tf.tidy(() => tensor.clipByValue(0, 255).round().cast('int32'));
    try {
      await tf.browser.toPixels(pixels, canvas);
    } finally {
      pixels.dispose();
    }
    if (preserveAlpha) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = dimensions.width;
      maskCanvas.height = dimensions.height;
      const maskContext = maskCanvas.getContext('2d');
      maskContext.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      const mask = maskContext.getImageData(0, 0, dimensions.width, dimensions.height);
      const context = canvas.getContext('2d');
      const enhanced = context.getImageData(0, 0, dimensions.width, dimensions.height);
      restoreUpscaleAlpha(enhanced.data, mask.data);
      context.putImageData(enhanced, 0, 0);
      maskCanvas.width = maskCanvas.height = 0;
    }
    signal?.throwIfAborted();
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export the upscaled PNG.')), 'image/png'));
  } finally {
    tensor?.dispose();
    source.width = source.height = 0;
    await upscaler.dispose();
  }
}
