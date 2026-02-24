import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outDir = resolve("public/icons");
mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 128];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(width, height, pixelFn) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0
    for (let x = 0; x < width; x += 1) {
      const idx = y * (stride + 1) + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y);
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const idat = deflateSync(raw);

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const out = Buffer.concat([
    pngSig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);

  return out;
}

const palette = {
  bg: [17, 24, 39, 255], // #111827
  bar1: [255, 255, 255, 255],
  bar2: [96, 165, 250, 255] // #60A5FA
};

function buildIcon(size) {
  const barHeight = Math.max(2, Math.round(size * 0.12));
  const bar1Width = Math.round(size * 0.72);
  const bar2Width = Math.round(size * 0.6);
  const bar1Y = Math.round(size * 0.38);
  const bar2Y = Math.round(size * 0.56);

  const bar1X = Math.round((size - bar1Width) / 2);
  const bar2X = Math.round((size - bar2Width) / 2);

  return createPng(size, size, (x, y) => {
    const inBar1 =
      x >= bar1X &&
      x < bar1X + bar1Width &&
      y >= bar1Y &&
      y < bar1Y + barHeight;

    const inBar2 =
      x >= bar2X &&
      x < bar2X + bar2Width &&
      y >= bar2Y &&
      y < bar2Y + barHeight;

    if (inBar1) {
      return palette.bar1;
    }

    if (inBar2) {
      return palette.bar2;
    }

    return palette.bg;
  });
}

for (const size of sizes) {
  const buffer = buildIcon(size);
  const filePath = resolve(outDir, `icon-${size}.png`);
  writeFileSync(filePath, buffer);
}

console.log("Icons generated:", sizes.map((s) => `icon-${s}.png`).join(", "));
