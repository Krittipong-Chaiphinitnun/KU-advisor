/**
 * generate-branding.js
 * --------------------
 * Generates clean, standalone PNG branding assets for KU-advisor.
 * Pure pixel buffers (Sharp) — no SVG rasterization dependency.
 *
 * Outputs in frontend/assets/:
 *   - icon.png          (1024 × 1024) - Clean centered gold cap icon on #004D25
 *   - splash.png        (2048 × 2048) - Solid #004D25 with centered logo
 *   - adaptive-icon.png (1024 × 1024) - Clean foreground icon on #004D25
 */
const path = require('path');
const sharp = require('sharp');

const OUT = path.resolve(__dirname, '..', 'assets');

// ── Colours ──────────────────────────────────────────────────────────────────
const EMERALD = { r: 0, g: 77, b: 37, alpha: 255 };   // #004D25
const GOLD    = { r: 212, g: 175, b: 55, alpha: 255 };  // #D4AF37
const GOLD_LIGHT = { r: 232, g: 200, b: 95, alpha: 255 };

// ── Helpers ──────────────────────────────────────────────────────────────────

function solidBuffer(w, h, { r, g, b, alpha }) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = alpha;
  }
  return buf;
}

function setPixel(buf, w, x, y, { r, g, b, alpha }) {
  if (x < 0 || y < 0 || x >= w) return;
  const o = (y * w + x) * 4;
  buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = alpha;
}

function fillRect(buf, w, h, x0, y0, rw, rh, col) {
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const px = x0 + dx, py = y0 + dy;
      if (px >= 0 && px < w && py >= 0 && py < h) setPixel(buf, w, px, py, col);
    }
  }
}

function fillCircle(buf, w, h, cx, cy, radius, col) {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= r2) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) setPixel(buf, w, px, py, col);
      }
    }
  }
}

function fillTriangle(buf, w, h, x0, y0, x1, y1, x2, y2, col) {
  let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x2, y: y2 }];
  pts.sort((a, b) => a.y - b.y);
  const [p0, p1, p2] = pts;

  function scanline(ya, yb, xaStart, xaEnd, xbStart, xbEnd) {
    const dy = yb - ya || 1;
    for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(h - 1, Math.floor(yb)); y++) {
      const t = (y - ya) / dy;
      let leftX = Math.floor(xaStart + t * (xaEnd - xaStart));
      let rightX = Math.floor(xbStart + t * (xbEnd - xbStart));
      if (leftX > rightX) [leftX, rightX] = [rightX, leftX];
      for (let x = Math.max(0, leftX); x <= Math.min(w - 1, rightX); x++) {
        setPixel(buf, w, x, y, col);
      }
    }
  }

  scanline(p0.y, p1.y, p0.x, p1.x, p0.x, p2.x);
  scanline(p1.y, p2.y, p1.x, p2.x, p0.x + (p2.x - p0.x) * ((p1.y - p0.y) / ((p2.y - p0.y) || 1)), p2.x);
}

function fillStar4(buf, w, h, cx, cy, outerR, innerR, col) {
  fillTriangle(buf, w, h, cx, cy - outerR, cx - innerR, cy, cx + innerR, cy, col);
  fillTriangle(buf, w, h, cx, cy + outerR, cx - innerR, cy, cx + innerR, cy, col);
  fillTriangle(buf, w, h, cx - outerR, cy, cx, cy - innerR, cx, cy + innerR, col);
  fillTriangle(buf, w, h, cx + outerR, cy, cx, cy - innerR, cx, cy + innerR, col);
}

// ── Clean Vector Logo Drawing ────────────────────────────────────────────────
/**
 * Draw a clean, beautifully centered graduation cap + book + sparkle motif.
 */
function drawCleanCapLogo(buf, imgW, imgH, cx, cy, size) {
  const s = size;

  // 1. Graduation cap rhombus (top flat diamond)
  const capY = cy - Math.floor(s * 0.12);
  const capHalfW = Math.floor(s * 0.44);
  const capHalfH = Math.floor(s * 0.20);
  for (let dy = -capHalfH; dy <= capHalfH; dy++) {
    const ratio = 1 - Math.abs(dy) / capHalfH;
    const halfRow = Math.floor(capHalfW * ratio);
    for (let dx = -halfRow; dx <= halfRow; dx++) {
      const px = cx + dx, py = capY + dy;
      if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
        setPixel(buf, imgW, px, py, GOLD);
      }
    }
  }

  // 2. Cap lower headband / skullcap
  const capBaseY = capY + Math.floor(s * 0.06);
  const capBaseW = Math.floor(s * 0.24);
  const capBaseH = Math.floor(s * 0.12);
  fillRect(buf, imgW, imgH, cx - capBaseW, capBaseY, capBaseW * 2, capBaseH, GOLD);

  // 3. Tassel
  const tasselX = cx + Math.floor(s * 0.32);
  const tasselTopY = capY;
  const tasselBotY = capY + Math.floor(s * 0.30);
  fillRect(buf, imgW, imgH, tasselX - 2, tasselTopY, 5, tasselBotY - tasselTopY, GOLD_LIGHT);
  fillCircle(buf, imgW, imgH, tasselX, tasselBotY, Math.floor(s * 0.045), GOLD_LIGHT);

  // 4. Open Book Motif below cap
  const bookY = cy + Math.floor(s * 0.20);
  const bookW = Math.floor(s * 0.38);
  const bookH = Math.floor(s * 0.14);
  // Left page
  fillRect(buf, imgW, imgH, cx - bookW, bookY, bookW - 4, bookH, GOLD);
  // Right page
  fillRect(buf, imgW, imgH, cx + 4, bookY, bookW - 4, bookH, GOLD);
  // Spine line
  fillRect(buf, imgW, imgH, cx - 2, bookY - 2, 4, bookH + 4, GOLD_LIGHT);

  // 5. Sparkle Star (Top Right)
  const sparkX = cx + Math.floor(s * 0.36);
  const sparkY = capY - Math.floor(s * 0.18);
  fillStar4(buf, imgW, imgH, sparkX, sparkY, Math.floor(s * 0.10), Math.floor(s * 0.03), GOLD_LIGHT);

  // Small Sparkle (Left)
  const spark2X = cx - Math.floor(s * 0.38);
  const spark2Y = capY - Math.floor(s * 0.06);
  fillStar4(buf, imgW, imgH, spark2X, spark2Y, Math.floor(s * 0.05), Math.floor(s * 0.015), GOLD_LIGHT);
}

// ── PNG generation ───────────────────────────────────────────────────────────

async function generateCleanIcon(outPath, size) {
  const buf = solidBuffer(size, size, EMERALD);
  const logoSize = Math.floor(size * 0.58);
  drawCleanCapLogo(buf, size, size, Math.floor(size / 2), Math.floor(size / 2), logoSize);

  await sharp(buf, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`  ✅ ${path.basename(outPath)}  (${size}×${size})`);
}

async function generateCleanSplash(outPath, size) {
  const buf = solidBuffer(size, size, EMERALD);
  const logoSize = Math.floor(size * 0.38);
  drawCleanCapLogo(buf, size, size, Math.floor(size / 2), Math.floor(size / 2), logoSize);

  await sharp(buf, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`  ✅ ${path.basename(outPath)}  (${size}×${size})`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Re-generating clean KU-advisor branding assets (no outer text banners)...\n');

  await generateCleanIcon(path.join(OUT, 'icon.png'), 1024);
  await generateCleanIcon(path.join(OUT, 'adaptive-icon.png'), 1024);
  await generateCleanSplash(path.join(OUT, 'splash.png'), 2048);

  console.log('\nDone — all clean assets successfully written to', OUT);
}

main().catch(err => { console.error('❌', err); process.exit(1); });

