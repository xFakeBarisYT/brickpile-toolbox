const sharp = require('sharp');

// ---------------------------------------------------------------------------
// Minimal BRK parser (replaces dotbrk)
// ---------------------------------------------------------------------------
function convertRGB(r, g, b) {
  return [
    Math.round(parseFloat(r) * 255),
    Math.round(parseFloat(g) * 255),
    Math.round(parseFloat(b) * 255),
  ];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}

function parseBrk(data) {
  const LINES = data.split('\n');
  const bricks = [];
  let currentBrick = -1;
  let totalLines = 0;

  const environment = {
    ambient: '#ffffff',
    skyColor: '#ffffff',
    baseColor: '#ffffff',
    baseSize: 100,
    sunIntensity: 300,
  };

  for (let line of LINES) {
    totalLines++;
    line = line.trim();

    switch (totalLines) {
      case 3: {
        const parts = line.split(' ');
        const RGB = convertRGB(parts[0], parts[1], parts[2]);
        environment.ambient = rgbToHex(RGB[2], RGB[1], RGB[0]);
        continue;
      }
      case 4: {
        const parts = line.split(' ');
        const RGB = convertRGB(parts[0], parts[1], parts[2]);
        environment.baseColor = rgbToHex(RGB[2], RGB[1], RGB[0]);
        continue;
      }
      case 5: {
        const parts = line.split(' ');
        const RGB = convertRGB(parts[0], parts[1], parts[2]);
        environment.skyColor = rgbToHex(RGB[0], RGB[1], RGB[2]);
        continue;
      }
      case 6: {
        environment.baseSize = Number(line);
        continue;
      }
      case 7: {
        environment.sunIntensity = Number(line);
        continue;
      }
    }

    const DATA = line.split(' ');
    if (!DATA[0]) continue;

    const ATTRIBUTE = DATA[0].replace('+', '');
    const VALUE = DATA.slice(1).join(' ');
    const cB = bricks[currentBrick];

    // Named-attribute lines
    if (cB) {
      switch (ATTRIBUTE) {
        case 'NAME':
          cB.name = VALUE;
          continue;
        case 'ROT': {
          const parts = VALUE.split(' ');
          cB.rotationX = parseFloat(parts[0]) || 0;
          cB.rotation  = parseFloat(parts[1]) || 0; // Y axis
          cB.rotationZ = parseFloat(parts[2]) || 0;
          continue;
        }
        case 'SHAPE':
          cB.shape = VALUE;
          continue;
        case 'MODEL':
          cB.model = Number(VALUE);
          continue;
        case 'NOCOLLISION':
          cB.collision = false;
          continue;
        case 'LIGHT': {
          const colors = VALUE.split(' ');
          const RGB = convertRGB(colors[0], colors[1], colors[2]);
          cB.lightEnabled = true;
          cB.lightRange = parseInt(colors[3], 10) || 5;
          cB.lightColor = rgbToHex(RGB[0], RGB[1], RGB[2]);
          continue;
        }
      }
    }

    // 10-token brick definition line
    if (DATA.length === 10) {
      const RGB = convertRGB(DATA[6], DATA[7], DATA[8]);
      const newBrick = {
        name: '',
        position: { x: Number(DATA[0]), y: Number(DATA[1]), z: Number(DATA[2]) },
        scale:    { x: Number(DATA[3]), y: Number(DATA[4]), z: Number(DATA[5]) },
        color: rgbToHex(RGB[0], RGB[1], RGB[2]),
        visibility: Number(DATA[9]),
        collision: true,
        rotation: 0,
        rotationX: 0,
        rotationZ: 0,
        model: 0,
        shape: 'brick',
        lightEnabled: false,
        lightColor: '#000000',
        lightRange: 5,
      };
      bricks.push(newBrick);
      currentBrick++;
    }
  }

  return { bricks, environment };
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
function shade(r, g, b, f) {
  return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rotate3D(x, y, z, degX, degY, degZ) {
  const toRad = d => (d * Math.PI) / 180;

  {
    const rad = toRad(degX);
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const ny = y * cos - z * sin;
    const nz = y * sin + z * cos;
    y = ny; z = nz;
  }
  {
    const rad = toRad(degY);
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const nx = x * cos + z * sin;
    const nz = -x * sin + z * cos;
    x = nx; z = nz;
  }
  {
    const rad = toRad(degZ);
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const nx = x * cos - y * sin;
    const ny = x * sin + y * cos;
    x = nx; y = ny;
  }

  return { x, y, z };
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a;
}

const BRICK_FACES = [
  { idx: [4,5,6,7], nx:  0, ny:  0, nz:  1 },
  { idx: [1,2,6,5], nx:  1, ny:  0, nz:  0 },
  { idx: [2,3,7,6], nx:  0, ny:  1, nz:  0 },
  { idx: [0,1,5,4], nx:  0, ny: -1, nz:  0 },
  { idx: [3,0,4,7], nx: -1, ny:  0, nz:  0 },
  { idx: [0,3,2,1], nx:  0, ny:  0, nz: -1 },
];

const INV_SQRT2 = 1 / Math.SQRT2;
const LX =  INV_SQRT2;
const LY = -INV_SQRT2;

function shadeFactor(nx, ny, nz) {
  if (nz > 0.5)  return 1.15;
  if (nz < -0.5) return 0.40;
  return 0.725 + 0.106 * (nx * LX + ny * LY);
}

/**
 * Convert rotation field to degrees.
 * Values 0–3 are treated as step-based (multiples of 90°).
 * Values >= 4 are treated as raw degrees (e.g. 90, 180, 270).
 * NaN / undefined → 0.
 */
function getRotationDegrees(bk) {
  const raw  = isFinite(bk.rotation)  ? bk.rotation  : 0;
  const rawX = isFinite(bk.rotationX) ? bk.rotationX : 0;
  const rawZ = isFinite(bk.rotationZ) ? bk.rotationZ : 0;

  const degY = raw;

  return { degX: rawX, degY, degZ: rawZ };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
async function renderThumbnail(bricks, width, height) {
  if (!bricks || bricks.length === 0) {
    return generateEmptyThumbnail(width, height);
  }

  try {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const b of bricks) {
      const { x, y, z } = b.position;
      const hx = b.scale.x / 2;
      const hy = b.scale.y / 2;
      const hz = b.scale.z / 2;
      const { degX, degY, degZ } = getRotationDegrees(b);

      for (const dx of [-hx, hx]) {
        for (const dy of [-hy, hy]) {
          for (const dz of [-hz, hz]) {
            const r = rotate3D(dx, dy, dz, degX, degY, degZ);
            minX = Math.min(minX, x + r.x); maxX = Math.max(maxX, x + r.x);
            minY = Math.min(minY, y + r.y); maxY = Math.max(maxY, y + r.y);
            minZ = Math.min(minZ, z + r.z); maxZ = Math.max(maxZ, z + r.z);
          }
        }
      }
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const spanX = (maxX - minX) || 1;
    const spanY = (maxY - minY) || 1;
    const spanZ = (maxZ - minZ) || 1;
    // True isometric: 30deg elevation, equal axes.
    // sx = (wx - wy) * cos30,  sy = (wx + wy) * sin30 - wz
    const ISO_H = 0.866; // cos(30deg) - horizontal spread per world unit
    const ISO_V = 0.5;   // sin(30deg) - vertical drop for horizontal movement
    const projW = (spanX + spanY) * ISO_H;
    const projH = (spanX + spanY) * ISO_V + spanZ;
    const scale = Math.min((width * 0.82) / projW, (height * 0.82) / projH);

    const offX = width / 2;
    const offY = height * 0.60;

    const proj = (wx, wy, wz) => ({
      x: offX + (wx - wy) * ISO_H * scale,
      y: offY + (wx + wy) * ISO_V * scale - wz * scale,
    });

    // Painter's sort: project each brick's center into screen-depth space.
    // In dimetric projection the "depth" axis (into the screen) is x+y for
    // the horizontal plane, with z lifting things up.  We want to draw the
    // brick whose projected far-corner is closest to the camera last (on top).
    // Using the far corner (max x+y, min z) gives a tighter ordering than the
    // centre alone when bricks are different sizes.
    const sortKey = bk => {
      const hx = bk.scale.x / 2;
      const hy = bk.scale.y / 2;
      const hz = bk.scale.z / 2;
      const { degX, degY, degZ } = getRotationDegrees(bk);
      // Find the corner with maximum (x+y) depth and minimum z (front-bottom)
      let maxDepth = -Infinity;
      let minZCorner = Infinity;
      for (const dx of [-hx, hx]) {
        for (const dy of [-hy, hy]) {
          for (const dz of [-hz, hz]) {
            const r = rotate3D(dx, dy, dz, degX, degY, degZ);
            const wx = bk.position.x + r.x;
            const wy = bk.position.y + r.y;
            const wz = bk.position.z + r.z;
            const d = wx + wy;
            if (d > maxDepth) { maxDepth = d; minZCorner = wz; }
            else if (d === maxDepth && wz < minZCorner) { minZCorner = wz; }
          }
        }
      }
      return maxDepth + minZCorner * 0.001; // higher z draws later (on top)
    };
    const sorted = [...bricks].sort((a, b) => sortKey(a) - sortKey(b));

    let polys = '';

    for (const bk of sorted) {
      if (bk.visibility <= 0) continue;

      const px = bk.position.x - cx;
      const py = bk.position.y - cy;
      const pz = bk.position.z - cz;
      const hx = bk.scale.x / 2;
      const hy = bk.scale.y / 2;
      const hz = bk.scale.z / 2;
      const { degX, degY, degZ } = getRotationDegrees(bk);

      const localCorners = [
        [-hx, -hy, -hz],
        [ hx, -hy, -hz],
        [ hx,  hy, -hz],
        [-hx,  hy, -hz],
        [-hx, -hy,  hz],
        [ hx, -hy,  hz],
        [ hx,  hy,  hz],
        [-hx,  hy,  hz],
      ];

      const c = localCorners.map(([lx, ly, lz]) => {
        const r = rotate3D(lx, ly, lz, degX, degY, degZ);
        return proj(px + r.x, py + r.y, pz + r.z);
      });

      const { r: cr, g: cg, b: cb } = hexToRgb(bk.color || '#808080');
      const op = Math.min(1, Math.max(0, bk.visibility)).toFixed(3);

      for (const face of BRICK_FACES) {
        if (signedArea(face.idx.map(i => c[i])) <= 0) continue;
        const rn   = rotate3D(face.nx, face.ny, face.nz, degX, degY, degZ);
        const fill = shade(cr, cg, cb, shadeFactor(rn.x, rn.y, rn.z));
        const pts  = face.idx.map(i => `${c[i].x.toFixed(1)},${c[i].y.toFixed(1)}`).join(' ');
        polys += `<polygon points="${pts}" fill="${fill}" opacity="${op}" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>`;
      }
    }

    const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#87ceeb"/>
  ${polys}
</svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch (err) {
    console.error('Thumbnail error:', err);
    return generateEmptyThumbnail(width, height);
  }
}

async function generateBrkThumbnail(brkContent, width = 256, height = 256) {
  const { bricks } = parseBrk(brkContent);
  return renderThumbnail(bricks, width, height);
}

async function generateEmptyThumbnail(width = 256, height = 256) {
  try {
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f0f0f0"/>
  <text
    x="${width / 2}"
    y="${height / 2}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-size="20"
    fill="#999"
    font-family="Arial">
    No Preview
  </text>
</svg>`;
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch {
    return Buffer.from([
      0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,
      0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
      0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,0x89,0x00,0x00,0x00,
      0x0d,0x49,0x44,0x41,0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
      0x00,0x00,0x03,0x00,0x01,0x85,0x84,0x7e,0xf6,0x00,0x00,0x00,
      0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82
    ]);
  }
}

module.exports = {
  generateBrkThumbnail,
  generateEmptyThumbnail,
};