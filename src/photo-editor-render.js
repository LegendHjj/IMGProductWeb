import { photoViewport } from './photo-editor-model.js';
import { drawExtraFrame } from './photo-editor-frames.js';

export function photoTextBounds(ctx, layer) {
  ctx.font = `${layer.italic ? 'italic ' : ''}${layer.weight} ${layer.size}px "${layer.font}"`;
  const lines = layer.text.split('\n');
  const padding = layer.size * (layer.background || ['offset', 'glow'].includes(layer.effect) ? 0.28 : 0.16);
  return { width: Math.max(1, ...lines.map(line => ctx.measureText(line).width)) + padding * 2, height: lines.length * layer.size * 1.2 + padding * 2, lines, padding };
}

function drawText(ctx, layer, scale) {
  if (!layer.text) return;
  ctx.save();
  const bounds = photoTextBounds(ctx, layer);
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation * Math.PI / 180);
  ctx.globalAlpha = layer.opacity / 100;
  if (layer.background) {
    ctx.fillStyle = layer.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height, layer.size * 0.15);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = layer.color;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = layer.outlineColor;
  ctx.lineWidth = Math.max(.5, layer.size * (layer.outlineWidth ?? .065));
  if (layer.shadow) {
    ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = layer.size * 0.1 * scale;
    ctx.shadowOffsetX = layer.size * 0.035 * scale;
    ctx.shadowOffsetY = layer.size * 0.055 * scale;
  }
  bounds.lines.forEach((line, index) => {
    const y = (index - (bounds.lines.length - 1) / 2) * layer.size * 1.2;
    ctx.save();
    if (layer.effect === 'offset') {
      ctx.fillStyle = layer.effectColor;
      for (let depth = 8; depth >= 1; depth--) ctx.fillText(line, layer.size * .012 * depth, y + layer.size * .012 * depth);
      ctx.fillStyle = layer.color;
    } else if (layer.effect === 'glow') {
      ctx.shadowColor = layer.effectColor; ctx.shadowBlur = layer.size * .24 * scale;
      ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.fillText(line, 0, y); ctx.fillText(line, 0, y);
    } else if (layer.effect === 'gradient') {
      const gradient = ctx.createLinearGradient(0, y - layer.size * .5, 0, y + layer.size * .5);
      gradient.addColorStop(0, layer.color); gradient.addColorStop(1, layer.effectColor);
      ctx.fillStyle = gradient;
    }
    if (layer.outline || layer.effect === 'hollow') ctx.strokeText(line, 0, y);
    if (layer.effect !== 'hollow') ctx.fillText(line, 0, y);
    ctx.restore();
  });
  ctx.restore();
}

function leaf(ctx, x, y, size, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * 0.3, -size * 0.65, size, -size * 0.2, size, 0);
  ctx.bezierCurveTo(size * 0.6, size * 0.45, size * 0.1, size * 0.35, 0, 0);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.025;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * 0.8, 0); ctx.stroke();
  ctx.restore();
}

function flower(ctx, x, y, radius, color, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 4);
    ctx.fillStyle = color;
    ctx.globalAlpha = i % 2 ? 0.88 : 0.96;
    ctx.beginPath();
    ctx.ellipse(radius * 0.59, 0, radius * 0.64, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = radius * 0.035;
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#e6be65';
  ctx.beginPath(); ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff2cf';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.arc(Math.cos(i) * radius * 0.12, Math.sin(i) * radius * 0.12, radius * 0.028, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function cornerSprig(ctx, band, color, accent, flowers) {
  ctx.strokeStyle = color;
  ctx.lineWidth = band * 0.028;
  ctx.beginPath();
  ctx.moveTo(band * 0.6, band * 3.9);
  ctx.bezierCurveTo(band * 0.4, band * 1.4, band * 1.4, band * 0.4, band * 3.9, band * 0.6);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const t = 1.2 + i * 0.48;
    leaf(ctx, band * t, band * 0.6, band * 0.65, i % 2 ? -1.1 : 0.6, color);
    leaf(ctx, band * 0.6, band * t, band * 0.65, i % 2 ? 2.7 : -0.5, color);
  }
  if (flowers) {
    flower(ctx, band * 1.25, band * 1.15, band * 0.66, accent, 0.3);
    flower(ctx, band * 2.48, band * 0.76, band * 0.39, accent, 0.7);
    flower(ctx, band * 0.8, band * 2.5, band * 0.42, '#f4ded1', 0.1);
  }
}

function wobblyBorder(ctx, width, height, inset, amplitude, phase) {
  const corners = [[inset, inset], [width - inset, inset], [width - inset, height - inset], [inset, height - inset], [inset, inset]];
  ctx.beginPath();
  corners.slice(0, -1).forEach((start, edge) => {
    const end = corners[edge + 1];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const steps = Math.max(6, Math.round(length / Math.max(2, amplitude * 10)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = (Math.sin(i * 1.5 + phase + edge) * 0.65 + Math.sin(i * 0.7 + phase) * 0.35) * amplitude;
      const x = start[0] + (end[0] - start[0]) * t + (edge % 2 ? jitter : 0);
      const y = start[1] + (end[1] - start[1]) * t + (edge % 2 ? 0 : jitter);
      if (edge === 0 && i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

export function drawPhotoFrame(ctx, width, height, frame) {
  if (frame.style === 'none') return;
  if (drawExtraFrame(ctx, width, height, frame)) return;
  const short = Math.min(width, height);
  const band = short * frame.width / 100;
  ctx.save();
  ctx.strokeStyle = frame.color;
  ctx.fillStyle = frame.color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (frame.style === 'clean') {
    ctx.lineWidth = band;
    ctx.strokeRect(band / 2, band / 2, width - band, height - band);
  } else if (frame.style === 'double') {
    ctx.lineWidth = Math.max(1, short * 0.003);
    ctx.strokeRect(band * 0.35, band * 0.35, width - band * 0.7, height - band * 0.7);
    ctx.lineWidth *= 0.55;
    ctx.strokeRect(band * 0.65, band * 0.65, width - band * 1.3, height - band * 1.3);
  } else if (frame.style === 'sketch' || frame.style === 'doodle') {
    ctx.lineWidth = Math.max(1, short * 0.003);
    wobblyBorder(ctx, width, height, band * 0.4, short * 0.003, 1);
    ctx.globalAlpha = 0.55;
    wobblyBorder(ctx, width, height, band * 0.52, short * 0.004, 3);
    if (frame.style === 'doodle') {
      ctx.globalAlpha = 1;
      [[band, band], [width - band, band], [width - band, height - band], [band, height - band]].forEach(([x, y]) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2);
        ctx.fillStyle = frame.accent;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const radius = band * (i % 2 ? 0.19 : 0.43);
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          if (!i) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      });
    }
  } else if (frame.style === 'floral' || frame.style === 'botanical') {
    ctx.lineWidth = Math.max(0.6, short * 0.0012);
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(band * 0.45, band * 0.45, width - band * 0.9, height - band * 0.9);
    ctx.globalAlpha = 1;
    [[0, 0, 1, 1], [width, 0, -1, 1], [0, height, 1, -1], [width, height, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      cornerSprig(ctx, band, frame.color, frame.accent, frame.style === 'floral');
      ctx.restore();
    });
    if (frame.style === 'botanical') {
      for (let x = band * 5; x < width - band * 5; x += band * 1.4) {
        leaf(ctx, x, band * 0.5, band * 0.55, -0.4, frame.color);
        leaf(ctx, x, height - band * 0.5, band * 0.55, 0.4, frame.color);
      }
    }
  }
  ctx.restore();
}

export function renderPhotoEdits(ctx, image, edits, width, height) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const viewport = photoViewport(sourceWidth, sourceHeight, edits);
  const scale = width / viewport.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(scale, height / viewport.height);
  ctx.translate(-viewport.x, -viewport.y);
  ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  for (const blur of edits.blurs) {
    ctx.save();
    ctx.beginPath(); ctx.rect(blur.x, blur.y, blur.width, blur.height); ctx.clip();
    ctx.filter = `blur(${blur.radius * scale}px)`;
    ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
    ctx.restore();
  }
  ctx.save(); ctx.translate(viewport.x, viewport.y);
  drawPhotoFrame(ctx, viewport.width, viewport.height, edits.frame);
  ctx.restore();
  edits.texts.forEach(layer => drawText(ctx, layer, scale));
  ctx.restore();
}
