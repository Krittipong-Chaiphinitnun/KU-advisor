// generate-assets.js – creates the required PNG branding assets from logo.svg using sharp
// -----------------------------------------------------------------------------
// Run with: `node ./frontend/scripts/generate-assets.js`
// -----------------------------------------------------------------------------
const path = require('path');
const sharp = require('sharp');

// Paths (relative to this script)
const LOGO_SVG = path.resolve(__dirname, '..', '..', 'assets', 'logo.svg');
// Output directly to the assets root (frontend/assets)
const OUT_DIR = path.resolve(__dirname, '..', '..', 'assets');

async function generate() {
  // 1️⃣ App Icon – 1024×1024 (Expo expects a high‑resolution square icon)
  await sharp(LOGO_SVG)
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'icon.png'));

  // 2️⃣ Splash screen – 2048×2048 background #004D25 with centered gold logo (1024×1024)
  const background = sharp({
    create: {
      width: 2048,
      height: 2048,
      channels: 4,
      background: '#004D25',
    },
  });
  const logoBuffer = await sharp(LOGO_SVG)
    .resize(1024, 1024)
    .png()
    .toBuffer();
  await background
    .composite([{ input: logoBuffer, left: (2048 - 1024) / 2, top: (2048 - 1024) / 2 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'splash.png'));

  // 3️⃣ Adaptive icon – 1024×1024 foreground (transparent logo) – used by Android
  await sharp(LOGO_SVG)
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'adaptive-icon.png'));

  // 4️⃣ Adaptive icon background – solid emerald (optional but useful)
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: '#004D25',
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'adaptive-icon-background.png'));

  console.log('✅ Branding assets generated in', OUT_DIR);
}

generate().catch(err => {
  console.error('❌ Asset generation failed:', err);
  process.exit(1);
});
