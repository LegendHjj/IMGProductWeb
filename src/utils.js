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

  if (meta && meta.applied === false) {
    throw new Error(meta.skipReason === 'no-watermark-detected'
      ? 'No supported Gemini logo watermark detected'
      : 'Gemini watermark removal was skipped');
  }

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
                  const match = part.trim().match(/^(https?:\/\/[^\s]+)/);
                  if (match) urls.add(match[1]);
                });
              } else {
                if (val.startsWith('http://') || val.startsWith('https://')) {
                  urls.add(val);
                } else if (val.startsWith('//')) {
                  urls.add('https:' + val);
                }
              }
            }
          });
        } else if (el.tagName === 'A') {
          const href = el.getAttribute('href');
          if (href && (href.startsWith('http') || href.startsWith('//'))) {
            if (/\.(jpg|jpeg|png|webp|gif|bmp)(?:\?.*)?$/i.test(href) || href.includes('susercontent.com/file/') || href.includes('shopee.com/file/')) {
              urls.add(href.startsWith('//') ? 'https:' + href : href);
            }
          }
        } else {
          const bg = el.style.backgroundImage;
          if (bg) {
            const match = bg.match(/url\(['"]?(https?:\/\/[^'"]+)['"]?\)/);
            if (match) urls.add(match[1]);
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
    urls.add(match[0]);
  }

  const shopeeRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:susercontent\.com|shopee\.[a-z.]+)\/file\/[a-zA-Z0-9_-]+/gi;
  while ((match = shopeeRegex.exec(text)) !== null) {
    urls.add(match[0]);
  }

  const generalUrlRegex = /https?:\/\/[^\s"']+/gi;
  while ((match = generalUrlRegex.exec(text)) !== null) {
    const url = match[0];
    if (/\.(jpg|jpeg|png|webp|gif|bmp)/i.test(url) || url.includes('/file/') || url.includes('image')) {
      urls.add(url);
    }
  }

  // Clean URLs (remove wrapping parenthesis or quotes from regex matches if any)
  const cleanUrls = Array.from(urls).map(url => {
    let u = url.trim();
    if (u.endsWith(')')) u = u.slice(0, -1);
    if (u.endsWith('"') || u.endsWith("'")) u = u.slice(0, -1);
    return u;
  }).filter(url => {
    return url.startsWith('http://') || url.startsWith('https://');
  });

  return Array.from(new Set(cleanUrls));
}
