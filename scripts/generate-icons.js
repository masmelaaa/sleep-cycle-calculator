// Minimal PNG encoder (no deps) to generate app icons: gradient night-sky
// background + crescent moon + a few stars. Renders each requested size
// directly (recomputing vector coordinates) instead of downsampling.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Palette: Liquid Glass violet - deep indigo-violet gradient tile with a
// soft white crescent moon and glowing stars.
const TOP = hexToRgb('#7c3aed');
const BOTTOM = hexToRgb('#1e1240');
const MOON_LIGHT = hexToRgb('#ffffff');
const MOON_SHADOW = hexToRgb('#e9e1ff');

function drawIcon({ size, moonScale = 0.62, stars = true, cornerRadius = 0.22 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size * 0.52;
  const cy = size * 0.48;
  const r = size * moonScale * 0.5;
  // Crescent = main circle minus offset circle
  const offX = r * 0.62;
  const offY = -r * 0.18;
  const cx2 = cx + offX;
  const cy2 = cy + offY;
  const r2 = r * 0.92;

  const starPositions = [
    [size * 0.22, size * 0.24, size * 0.028],
    [size * 0.78, size * 0.66, size * 0.02],
    [size * 0.68, size * 0.2, size * 0.016],
    [size * 0.18, size * 0.72, size * 0.017],
  ];

  const radius = size * cornerRadius;

  for (let y = 0; y < size; y++) {
    const t = y / size;
    const bg = [mix(TOP[0], BOTTOM[0], t), mix(TOP[1], BOTTOM[1], t), mix(TOP[2], BOTTOM[2], t)];
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded-square mask (soft edge, 1px anti-alias) so the source PNG
      // itself looks clean even before iOS applies its own mask.
      const dx = Math.max(radius - x, x - (size - radius), 0);
      const dy = Math.max(radius - y, y - (size - radius), 0);
      let alpha = 1;
      if (dx > 0 && dy > 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        alpha = dist <= radius ? 1 : Math.max(0, 1 - (dist - radius));
      }

      const dMain = Math.hypot(x - cx, y - cy);
      const dCut = Math.hypot(x - cx2, y - cy2);

      let r_, g_, b_;
      if (dMain <= r && dCut >= r2) {
        // Inside moon crescent
        const shade = Math.min(1, (r - dMain) / r);
        r_ = mix(MOON_SHADOW[0], MOON_LIGHT[0], shade);
        g_ = mix(MOON_SHADOW[1], MOON_LIGHT[1], shade);
        b_ = mix(MOON_SHADOW[2], MOON_LIGHT[2], shade);
        // soft edge anti-alias against the cutout circle
        const edge = dCut - r2;
        if (edge < 1.5) {
          const blend = Math.max(0, edge / 1.5);
          r_ = mix(bg[0], r_, blend);
          g_ = mix(bg[1], g_, blend);
          b_ = mix(bg[2], b_, blend);
        }
      } else {
        r_ = bg[0];
        g_ = bg[1];
        b_ = bg[2];
      }

      // stars
      if (stars) {
        for (const [sx, sy, sr] of starPositions) {
          const d = Math.hypot(x - sx, y - sy);
          if (d < sr * 3) {
            const glow = Math.max(0, 1 - d / (sr * 3));
            const core = d < sr ? 1 : 0;
            const intensity = Math.max(core, glow * 0.5);
            r_ = mix(r_, 255, intensity);
            g_ = mix(g_, 255, intensity);
            b_ = mix(b_, 255, intensity);
          }
        }
      }

      rgba[idx] = Math.round(r_);
      rgba[idx + 1] = Math.round(g_);
      rgba[idx + 2] = Math.round(b_);
      rgba[idx + 3] = Math.round(255 * alpha);
    }
  }
  return rgba;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'apple-touch-icon-180.png', size: 180, cornerRadius: 0 }, // iOS masks it; keep square
  { name: 'icon-192.png', size: 192, cornerRadius: 0.22 },
  { name: 'icon-512.png', size: 512, cornerRadius: 0.22 },
  { name: 'icon-512-maskable.png', size: 512, cornerRadius: 0, moonScale: 0.42 },
  { name: 'favicon-32.png', size: 32, cornerRadius: 0.28, stars: false },
];

for (const t of targets) {
  const rgba = drawIcon(t);
  const png = encodePNG(t.size, t.size, rgba);
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log('wrote', t.name, `${t.size}x${t.size}`, `${png.length}B`);
}
