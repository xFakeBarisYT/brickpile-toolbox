
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeSplit(line) {
  return (line || "").trim().split(/\s+/);
}

function parseBrkSafe(data) {
  const lines = data.split("\n");

  const bricks = [];
  const spawns = [];
  const tools = [];
  const teams = [];

  let currentBrick = -1;
  let lineIndex = 0;

  for (let raw of lines) {
    lineIndex++;
    const line = raw.trim();
    if (!line) continue;

    const DATA = safeSplit(line);
    if (!DATA[0]) continue;

    // =========================
    // ENV (skip safely)
    // =========================
    if (lineIndex >= 3 && lineIndex <= 7) {
      continue;
    }

    // =========================
    // NEW BRICK
    // =========================
    if (DATA.length === 10 && !DATA[0].startsWith(">")) {
      const [x, z, y, sx, sz, sy, r, g, b, vis] = DATA;

      const brick = {
        position: {
          x: safeNum(x)+safeNum(sx, 1),
          y: safeNum(y)+safeNum(sy, 1),
          z: safeNum(z)+safeNum(sz, 1),
        },
        scale: {
          x: safeNum(sx, 1),
          y: safeNum(sy, 1),
          z: safeNum(sz, 1),
        },
        color: `rgb(${safeNum(r)},${safeNum(g)},${safeNum(b)})`,
        visibility: safeNum(vis, 1),

        // IMPORTANT: normalize rotation
        rotation: 0
      };

      bricks.push(brick);
      currentBrick++;
      continue;
    }

    const ATTR = DATA[0].replace("+", "");
    const VALUE = DATA.slice(1).join(" ");

    const b = bricks[currentBrick];

    if (!b) continue;

    switch (ATTR) {
      case "ROT": {
        b.rotation = safeNum(VALUE) % 360;
        break;
      }

      case "SHAPE": {
        b.shape = VALUE;
        if (VALUE === "spawnpoint") spawns.push(b);
        break;
      }

      case "NOCOLLISION": {
        b.collision = false;
        break;
      }
    }

    if (DATA[0] === ">TEAM") {
      teams.push({ name: VALUE });
    }

    if (DATA[0] === ">SLOT") {
      tools.push({ name: VALUE });
    }
  }

  return { bricks, spawns, tools, teams };
}

module.exports = { parseBrkSafe };