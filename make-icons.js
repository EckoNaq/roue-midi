// Générateur d'icônes PNG (pur Node, sans dépendance) pour la PWA "Roue du midi".
// Dessine une roue à segments colorés sur fond ambre, avec supersampling x2 pour l'anti-aliasing.
const zlib = require("zlib");
const fs = require("fs");

const PALETTE = [
  "#ef4444","#f97316","#eab308","#84cc16","#22c55e","#14b8a6",
  "#06b6d4","#3b82f6","#6366f1","#8b5cf6","#d946ef","#ec4899"
];
const BG = [245, 158, 11];      // #f59e0b (ambre) -> plein cadre (maskable)
const RING = [255, 255, 255];
const HUB = [15, 23, 42];       // #0f172a

function hex(c){ return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; }
const SEG = PALETTE.map(hex);

function renderPixel(nx, ny) {
  // nx, ny in [-1, 1] centrés
  const dist = Math.hypot(nx, ny);
  const R = 0.80;        // rayon de la roue
  const RING_W = 0.06;   // épaisseur anneau
  const HUB_R = 0.16;    // rayon du moyeu
  if (dist <= HUB_R) return HUB;
  if (dist <= R) {
    let a = Math.atan2(ny, nx);           // -PI..PI
    if (a < 0) a += Math.PI * 2;          // 0..2PI
    const idx = Math.floor((a / (Math.PI * 2)) * SEG.length) % SEG.length;
    return SEG[idx];
  }
  if (dist <= R + RING_W) return RING;
  return BG;
}

function makePng(size) {
  const SS = 2;                 // supersampling
  const S = size * SS;
  const acc = new Float32Array(size * size * 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x + 0.5) / S * 2 - 1;
      const ny = (y + 0.5) / S * 2 - 1;
      const c = renderPixel(nx, ny);
      const ox = Math.floor(x / SS), oy = Math.floor(y / SS);
      const oi = (oy * size + ox) * 3;
      acc[oi] += c[0]; acc[oi+1] += c[1]; acc[oi+2] += c[2];
    }
  }
  const per = SS * SS;
  // scanlines RGBA avec filtre 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const oi = (y * size + x) * 3;
      raw[p++] = Math.round(acc[oi] / per);
      raw[p++] = Math.round(acc[oi+1] / per);
      raw[p++] = Math.round(acc[oi+2] / per);
      raw[p++] = 255;
    }
  }
  return encodePng(size, size, raw);
}

// --- Encodage PNG minimal ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, raw) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

fs.writeFileSync("icon-512.png", makePng(512));
fs.writeFileSync("icon-192.png", makePng(192));
console.log("Icônes générées : icon-512.png, icon-192.png");
