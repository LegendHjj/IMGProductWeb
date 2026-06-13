import JSZip from 'jszip';
import { createWatermarkEngine, removeWatermarkFromImage } from '@pilio/gemini-watermark-remover/browser';

let geminiWatermarkEnginePromise = null;

/**
 * Format bytes to readable string (e.g. KB, MB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get file extension from name
 */
export function getExtension(filename) {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
}

/**
 * High-performance image conversion to JPEG using createImageBitmap
 */
export async function convertToJpg(file, quality = 0.85, bgColor = '#ffffff') {
  try {
    // Attempt modern, fast decoding via createImageBitmap
    const bitmap = await createImageBitmap(file);
    
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Canvas 2D context unavailable');
    }
    
    // Fill background (removes PNG transparency)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the decoded bitmap
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close(); // Free GPU/decoded memory
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to JPEG blob conversion failed'));
      }, 'image/jpeg', quality);
    });
  } catch (error) {
    console.warn('createImageBitmap failed, falling back to FileReader image loader:', error);
    return convertToJpgFallback(file, quality, bgColor);
  }
}

/**
 * Fallback image converter using FileReader + HTMLImageElement
 */
function convertToJpgFallback(file, quality = 0.85, bgColor = '#ffffff') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to JPEG blob conversion failed'));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Failed to decode image file'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('FileReader read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Packs successful conversion blobs into a single zip blob
 */
export async function createZip(filesList) {
  const zip = new JSZip();
  let count = 0;
  
  filesList.forEach((item) => {
    if (item.status === 'done' && item.outputBlob) {
      const ext = item.outputFormat || 'jpg';
      const filename = `${item.name}.${ext}`;
      zip.file(filename, item.outputBlob);
      count++;
    }
  });
  
  if (count === 0) {
    throw new Error('No files converted successfully to compress');
  }
  
  return zip.generateAsync({ type: 'blob' });
}

function getGeminiWatermarkEngine() {
  if (!geminiWatermarkEnginePromise) {
    geminiWatermarkEnginePromise = createWatermarkEngine();
  }

  return geminiWatermarkEnginePromise;
}

function canvasToBlob(canvas, type = 'image/png') {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type });
  }

  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export cleaned image'));
      }, type);
    });
  }

  throw new Error('Canvas export is unavailable in this browser');
}

async function fileToCanvas(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      throw new Error('Canvas 2D context unavailable');
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch (error) {
    console.warn('createImageBitmap failed for Gemini remover, falling back to Image loader:', error);
    return fileToCanvasFallback(file);
  }
}

function fileToCanvasFallback(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to decode image file'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('FileReader read error'));
    reader.readAsDataURL(file);
  });
}

export async function removeGeminiWatermark(file, options = {}) {
  const sourceCanvas = await fileToCanvas(file);
  const engine = await getGeminiWatermarkEngine();
  const { canvas, meta } = await removeWatermarkFromImage(sourceCanvas, {
    engine,
    adaptiveMode: 'auto',
    maxPasses: options.maxPasses || 4
  });

  // Always export the canvas even when no watermark was detected.
  // Callers can inspect meta.applied to decide what status to show.
  const blob = await canvasToBlob(canvas, 'image/png');
  return { blob, meta };
}

/**
 * Composite a logo watermark onto a base image
 */
export async function applyLogo(baseFile, logoImageElement, options = {}) {
  const { size = 17, position = 'bottom_right', format = 'image/jpeg', quality = 0.9 } = options;

  try {
    const baseBitmap = await createImageBitmap(baseFile);
    const canvas = document.createElement('canvas');
    canvas.width = baseBitmap.width;
    canvas.height = baseBitmap.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      baseBitmap.close();
      throw new Error('Canvas 2D context unavailable');
    }

    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(baseBitmap, 0, 0);
    baseBitmap.close();

    const imgW = canvas.width;
    const imgH = canvas.height;
    
    const logoW = imgW * (size / 100);
    const scaleRatio = logoW / logoImageElement.naturalWidth;
    const logoH = logoImageElement.naturalHeight * scaleRatio;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top_left':
        x = 0;
        y = 0;
        break;
      case 'top_right':
        x = imgW - logoW;
        y = 0;
        break;
      case 'bottom_left':
        x = 0;
        y = imgH - logoH;
        break;
      case 'bottom_right':
        x = imgW - logoW;
        y = imgH - logoH;
        break;
      case 'center':
        x = (imgW - logoW) / 2;
        y = (imgH - logoH) / 2;
        break;
    }

    ctx.drawImage(logoImageElement, x, y, logoW, logoH);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate watermarked image blob'));
      }, format, quality);
    });
  } catch (error) {
    console.warn('createImageBitmap failed for applyLogo, falling back to FileReader:', error);
    return applyLogoFallback(baseFile, logoImageElement, options);
  }
}

/**
 * Fallback image logo watermarker using FileReader + Image element
 */
function applyLogoFallback(baseFile, logoImageElement, options = {}) {
  const { size = 17, position = 'bottom_right', format = 'image/jpeg', quality = 0.9 } = options;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0);
        
        const imgW = canvas.width;
        const imgH = canvas.height;
        const logoW = imgW * (size / 100);
        const scaleRatio = logoW / logoImageElement.naturalWidth;
        const logoH = logoImageElement.naturalHeight * scaleRatio;

        let x = 0;
        let y = 0;
        switch (position) {
          case 'top_left': x = 0; y = 0; break;
          case 'top_right': x = imgW - logoW; y = 0; break;
          case 'bottom_left': x = 0; y = imgH - logoH; break;
          case 'bottom_right': x = imgW - logoW; y = imgH - logoH; break;
          case 'center': x = (imgW - logoW) / 2; y = (imgH - logoH) / 2; break;
        }

        ctx.drawImage(logoImageElement, x, y, logoW, logoH);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to blob conversion failed'));
        }, format, quality);
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = event.target.result;
    };
    reader.readAsDataURL(baseFile);
  });
}

function decodeHtmlEntities(value) {
  if (!value || !/[&<]/.test(value)) return value;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, 'text/html');
    return doc.documentElement.textContent || value;
  } catch (error) {
    return value;
  }
}

function normalizeExtractedImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim();
  const encodedQuoteIndex = url.search(/&(quot|apos|lt|gt|#34|#39);/i);
  if (encodedQuoteIndex !== -1) {
    url = url.slice(0, encodedQuoteIndex);
  }

  url = decodeHtmlEntities(url)
    .trim()
    .replace(/^[<("'`]+/, '')
    .replace(/[>)"'`,;]+$/g, '')
    .replace(/%(22|27|3C|3E)$/i, '');

  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  try {
    return new URL(url).href;
  } catch (error) {
    return null;
  }
}

function isLikelyImageUrl(url) {
  return /\.(jpg|jpeg|png|webp|gif|bmp)(?:[?#].*)?$/i.test(url)
    || url.includes('susercontent.com/file/')
    || url.includes('shopee.com/file/')
    || url.includes('/img/')
    || url.includes('/image');
}

function addImageUrl(urls, candidate) {
  const normalizedUrl = normalizeExtractedImageUrl(candidate);
  if (normalizedUrl && isLikelyImageUrl(normalizedUrl)) {
    urls.add(normalizedUrl);
  }
}

/**
 * Extract fully qualified image URLs from plain text or HTML
 */
export function extractImageUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const urls = new Set();
  
  // 1. Try DOM Parsing if it looks like HTML
  if (text.includes('<') && text.includes('>')) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const elements = doc.querySelectorAll('img, a, [style*="background-image"]');
      
      elements.forEach(el => {
        if (el.tagName === 'IMG') {
          // Check typical attributes used for images
          const srcAttrs = ['src', 'data-src', 'data-original', 'original', 'srcset', 'data-lazy-src'];
          srcAttrs.forEach(attr => {
            const val = el.getAttribute(attr);
            if (val) {
              if (attr === 'srcset') {
                const parts = val.split(',');
                parts.forEach(part => {
                  const match = part.trim().match(/^((?:https?:)?\/\/[^\s]+)/);
                  if (match) addImageUrl(urls, match[1]);
                });
              } else {
                addImageUrl(urls, val);
              }
            }
          });
        } else if (el.tagName === 'A') {
          const href = el.getAttribute('href');
          addImageUrl(urls, href);
        } else {
          const bg = el.style.backgroundImage;
          if (bg) {
            const match = bg.match(/url\(['"']?((?:https?:)?\/\/[^'"]+)['"']?\)/);
            if (match) addImageUrl(urls, match[1]);
          }
        }
      });
    } catch (e) {
      console.warn('DOMParser failed, falling back to regex', e);
    }
  }

  // 2. Regex fallback/supplement to capture URLs
  const standardRegex = /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp|gif|bmp)(?:\?[^\s"']*)?/gi;
  let match;
  while ((match = standardRegex.exec(text)) !== null) {
    addImageUrl(urls, match[0]);
  }

  const shopeeRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:susercontent\.com|shopee\.[a-z.]+)\/file\/[a-zA-Z0-9_-]+/gi;
  while ((match = shopeeRegex.exec(text)) !== null) {
    addImageUrl(urls, match[0]);
  }

  const generalUrlRegex = /https?:\/\/[^\s"']+/gi;
  while ((match = generalUrlRegex.exec(text)) !== null) {
    addImageUrl(urls, match[0]);
  }

  return Array.from(urls);
}

/**
 * Combine multiple images vertically (top to bottom)
 * with optional crop boundaries for each image.
 */
export async function combineImagesVertically(items) {
  // Decode all images and their cropped dimensions
  const decodedItems = [];
  let totalHeight = 0;
  let maxWidth = 0;

  for (const item of items) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(item.file);
    } catch (e) {
      // Fallback if createImageBitmap fails
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = URL.createObjectURL(item.file);
      });
    }

    const crop = item.cropData || { x: 0, y: 0, width: bitmap.width || bitmap.naturalWidth, height: bitmap.height || bitmap.naturalHeight };
    
    decodedItems.push({
      bitmap,
      crop
    });
    
    totalHeight += crop.height;
    maxWidth = Math.max(maxWidth, crop.width);
  }

  if (decodedItems.length === 0) {
    throw new Error('No images provided for combination');
  }

  // Create final canvas
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // White background (in case of transparency or different widths)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw images
  let currentY = 0;
  for (const data of decodedItems) {
    // Center horizontally if widths differ
    const xOffset = (maxWidth - data.crop.width) / 2;
    
    ctx.drawImage(
      data.bitmap,
      data.crop.x, data.crop.y, data.crop.width, data.crop.height, // Source crop
      xOffset, currentY, data.crop.width, data.crop.height        // Destination
    );
    
    currentY += data.crop.height;
    
    if (data.bitmap.close) {
      data.bitmap.close(); // Free memory if it's an ImageBitmap
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate combined image blob'));
    }, 'image/jpeg', 0.95);
  });
}
