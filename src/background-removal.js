const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

export function getBackgroundRemovalError(file) {
  if (!file || !['image/jpeg', 'image/png'].includes(file.type) || !/\.(jpe?g|png)$/i.test(file.name)) {
    return 'Choose a JPG or PNG image.';
  }
  if (file.size === 0) return 'The selected image is empty.';
  if (file.size > MAX_IMAGE_SIZE) return 'The image exceeds the 50MB limit.';
  return null;
}

export function getBackgroundRemovalFilename(name) {
  return `${name.replace(/\.(jpe?g|png)$/i, '')}-no-background.png`;
}

export function getComparisonPercent(clientX, left, width) {
  if (width <= 0) return 50;
  return Math.min(100, Math.max(0, ((clientX - left) / width) * 100));
}

export async function removeImageBackground(file) {
  const { removeBackground } = await import('@imgly/background-removal');
  return removeBackground(file, {
    output: { format: 'image/png', type: 'foreground' }
  });
}
