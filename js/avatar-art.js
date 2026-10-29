// Drawing data for the characters. Pure data and maths, no DOM: ui-character.js turns the shapes
// into SVG. Everything is drawn from simple shapes on a 200 x 200 canvas, written for this project.
//
// Every animal has the same named anchor points (ANCHORS). Hats, face items and props are
// drawn ONCE in their own plain coordinates and then placed with an animal's anchors, so each item
// fits all animals. Shapes have a "z" number; they are drawn from the lowest z to the highest.

export const VIEWBOX = 200;

const Z = {
  behind: 0, body: 10, bodyOver: 20, earBack: 25, head: 30, headOver: 36,
  face: 40, cheek: 45, eyes: 50, ears: 60, hat: 70,
};

/* ---------- Anchors ---------- */

// crown: top of the head where a hat sits. headWidth: width a hat should have there.
// eyeL/eyeR: centres of the eyes. cheekL/cheekR: centres of the cheeks.
// earL/earR: the sides of the head at ear height (headphones). body: the body under the head.
export const ANCHORS = {
  cat: {
    crown: { x: 100, y: 58 }, headWidth: 70,
    eyeL: { x: 80, y: 100 }, eyeR: { x: 120, y: 100 },
    cheekL: { x: 68, y: 114 }, cheekR: { x: 132, y: 114 },
    earL: { x: 49, y: 98 }, earR: { x: 151, y: 98 },
    body: { x: 100, top: 136, bottom: 191, width: 72 },
  },
  dog: {
    crown: { x: 100, y: 58 }, headWidth: 66,
    eyeL: { x: 81, y: 92 }, eyeR: { x: 119, y: 92 },
    cheekL: { x: 66, y: 108 }, cheekR: { x: 134, y: 108 },
    earL: { x: 50, y: 96 }, earR: { x: 150, y: 96 },
    body: { x: 100, top: 136, bottom: 191, width: 72 },
  },
  hamster: {
    crown: { x: 100, y: 58 }, headWidth: 74,
    eyeL: { x: 80, y: 94 }, eyeR: { x: 120, y: 94 },
    cheekL: { x: 62, y: 112 }, cheekR: { x: 138, y: 112 },
    earL: { x: 43, y: 100 }, earR: { x: 157, y: 100 },
    body: { x: 100, top: 138, bottom: 191, width: 80 },
  },
  capybara: {
    crown: { x: 100, y: 58 }, headWidth: 76,
    eyeL: { x: 74, y: 88 }, eyeR: { x: 126, y: 88 },
    cheekL: { x: 62, y: 106 }, cheekR: { x: 138, y: 106 },
    earL: { x: 48, y: 96 }, earR: { x: 152, y: 96 },
    body: { x: 100, top: 138, bottom: 191, width: 84 },
  },
};

/* ---------- Colours ---------- */

export const NATURAL_FUR = {
  cat: "#f0a65a", dog: "#d9a066", hamster: "#efd2a2", capybara: "#a9744a",
};

// The colour items replace the fur colour.
export const FUR_COLORS = {
  mint: "#8fe3c8", sky: "#8ec9f5", pink: "#f7a8c8", yellow: "#ffe27a", gold: "#f2c94c",
};

// Mixes a "#rrggbb" colour with white (amount 0..1) or black (amount -1..0).
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  const out = channels.map((c) => Math.round(c + (target - c) * mix));
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}

function furOf(base) {
  return { base, dark: shade(base, -0.22), light: shade(base, 0.45) };
}

const INK = "#2b2a33"; // eyes, noses, outlines

/* ---------- Shape helpers ----------
   t: "ellipse" | "circle" | "rect" | "poly" | "path". Optional: stroke, sw (stroke width),
   op (opacity), z, rot: { deg, cx, cy } (clockwise rotation around a point). */

const ell = (cx, cy, rx, ry, fill, extra = {}) => ({ t: "ellipse", cx, cy, rx, ry, fill, ...extra });
const circ = (cx, cy, r, fill, extra = {}) => ({ t: "circle", cx, cy, r, fill, ...extra });
const rect = (x, y, w, h, fill, extra = {}) => ({ t: "rect", x, y, w, h, fill, ...extra });
const poly = (pts, fill, extra = {}) => ({ t: "poly", pts, fill, ...extra });
const path = (d, fill, extra = {}) => ({ t: "path", d, fill, ...extra });
const stroke = (d, color, sw, extra = {}) => path(d, "none", { stroke: color, sw, ...extra });
const withZ = (shapes, z) => shapes.map((s) => ({ z, ...s }));

// Eyes with a small shine.
function eye(cx, cy, rx, ry, z = Z.face) {
  return [
    ell(cx, cy, rx, ry, INK, { z }),
    circ(cx + rx * 0.35, cy - ry * 0.35, Math.max(1.4, rx * 0.38), "#ffffff", { z: z + 1 }),
  ];
}

// Pairs of numbers in a path string, as [cmd, [numbers]] pieces.
function pathParts(d) {
  const parts = [];
  for (const m of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const nums = m[2].trim() === "" ? [] : m[2].trim().split(/[\s,]+/).map(Number);
    parts.push([m[1], nums]);
  }
  return parts;
}

/* ---------- Placing an item with an anchor ---------- */

// Moves and scales a shape drawn in local coordinates: new = local * s + (x, y).
function place(shape, x, y, s) {
  const px = (v) => v * s + x;
  const py = (v) => v * s + y;
  const out = { ...shape };
  if (shape.rot) out.rot = { deg: shape.rot.deg, cx: px(shape.rot.cx), cy: py(shape.rot.cy) };
  if (shape.sw !== undefined) out.sw = shape.sw * s;
  switch (shape.t) {
    case "ellipse": out.cx = px(shape.cx); out.cy = py(shape.cy); out.rx = shape.rx * s; out.ry = shape.ry * s; break;
    case "circle": out.cx = px(shape.cx); out.cy = py(shape.cy); out.r = shape.r * s; break;
    case "rect":
      out.x = px(shape.x); out.y = py(shape.y); out.w = shape.w * s; out.h = shape.h * s;
      if (shape.rx !== undefined) out.rx = shape.rx * s;
      break;
    case "poly": out.pts = shape.pts.map(([a, b]) => [px(a), py(b)]); break;
    case "path":
      out.d = pathParts(shape.d)
        .map(([cmd, nums]) => cmd + nums.map((v, i) => (i % 2 === 0 ? px(v) : py(v)).toFixed(2)).join(" "))
        .join(" ");
      break;
    default: break;
  }
  return out;
}

function placeAll(shapes, x, y, s) {
  return shapes.map((shape) => place(shape, x, y, s));
}

/* ---------- Animals ---------- */

// Body shared by all animals; `bodyRx` makes some rounder.
function bodyShapes(fur, bodyRx) {
  return withZ([
    ell(100, 163, bodyRx, 28, fur.base),
    ell(100, 168, bodyRx * 0.62, 18, fur.light),
    ell(66, 162, 9, 14, fur.base, { rot: { deg: 18, cx: 66, cy: 162 } }),
    ell(134, 162, 9, 14, fur.base, { rot: { deg: -18, cx: 134, cy: 162 } }),
    ell(80, 188, 14, 7, fur.dark),
    ell(120, 188, 14, 7, fur.dark),
  ], Z.body);
}

function catShapes(fur) {
  return [
    ...withZ([stroke("M 134 176 C 168 176 176 144 160 138", fur.base, 10, { linecap: "round" })], Z.behind),
    ...bodyShapes(fur, 34),
    ...withZ([
      poly([[56, 80], [58, 30], [94, 60]], fur.base),
      poly([[144, 80], [142, 30], [106, 60]], fur.base),
      poly([[63, 72], [63, 41], [86, 61]], "#f7b9c4"),
      poly([[137, 72], [137, 41], [114, 61]], "#f7b9c4"),
    ], Z.earBack),
    ...withZ([ell(100, 100, 52, 42, fur.base)], Z.head),
    ...withZ([
      stroke("M 100 64 L 100 74 M 89 66 L 91 75 M 111 66 L 109 75", fur.dark, 3, { linecap: "round" }),
      ...eye(80, 100, 5, 7.5), ...eye(120, 100, 5, 7.5),
      poly([[95, 109], [105, 109], [100, 115]], "#e87d96"),
      stroke("M 100 115 Q 94 123 88 119 M 100 115 Q 106 123 112 119", INK, 2, { linecap: "round" }),
      stroke("M 66 112 L 36 106 M 66 118 L 36 121 M 134 112 L 164 106 M 134 118 L 164 121", INK, 1.6, { linecap: "round", op: 0.7 }),
    ], Z.face),
  ];
}

function dogShapes(fur) {
  return [
    ...withZ([ell(142, 170, 9, 16, fur.dark, { rot: { deg: -35, cx: 142, cy: 170 } })], Z.behind),
    ...bodyShapes(fur, 34),
    ...withZ([ell(100, 100, 50, 42, fur.base)], Z.head),
    ...withZ([
      ell(54, 98, 15, 30, fur.dark, { rot: { deg: 14, cx: 54, cy: 98 } }),
      ell(146, 98, 15, 30, fur.dark, { rot: { deg: -14, cx: 146, cy: 98 } }),
    ], Z.headOver),
    ...withZ([
      ell(100, 113, 25, 18, fur.light),
      ell(100, 125, 5.5, 6.5, "#e87d96"),
      ...eye(81, 92, 5, 7),
      ...eye(119, 92, 5, 7),
      ell(100, 104, 9, 6.5, INK),
      circ(97.5, 102, 2, "#ffffff", { op: 0.6 }),
      stroke("M 100 110 L 100 118 M 100 118 Q 92 126 86 120 M 100 118 Q 108 126 114 120", INK, 2, { linecap: "round" }),
    ], Z.face),
  ];
}

function hamsterShapes(fur) {
  return [
    ...bodyShapes(fur, 40),
    ...withZ([
      circ(60, 62, 14, fur.base), circ(140, 62, 14, fur.base),
      circ(60, 62, 8, "#f7b9c4"), circ(140, 62, 8, "#f7b9c4"),
    ], Z.earBack),
    ...withZ([ell(100, 102, 58, 44, fur.base)], Z.head),
    ...withZ([ell(64, 113, 24, 20, fur.light), ell(136, 113, 24, 20, fur.light)], Z.headOver),
    ...withZ([
      circ(80, 94, 5.5, INK), circ(82, 92, 1.9, "#ffffff"),
      circ(120, 94, 5.5, INK), circ(122, 92, 1.9, "#ffffff"),
      ell(100, 104, 5, 3.5, "#e87d96"),
      rect(96, 108, 8, 8, "#ffffff", { stroke: "#b8a98a", sw: 1, rx: 2 }),
      stroke("M 100 107 Q 94 115 88 111 M 100 107 Q 106 115 112 111", INK, 1.8, { linecap: "round" }),
    ], Z.face),
  ];
}

function capybaraShapes(fur) {
  return [
    ...bodyShapes(fur, 42),
    ...withZ([
      ell(64, 62, 10, 8, fur.dark, { rot: { deg: -20, cx: 64, cy: 62 } }),
      ell(136, 62, 10, 8, fur.dark, { rot: { deg: 20, cx: 136, cy: 62 } }),
    ], Z.earBack),
    ...withZ([rect(48, 58, 104, 84, fur.base, { rx: 42 })], Z.head),
    ...withZ([
      rect(66, 100, 68, 42, fur.dark, { rx: 21 }),
      ell(91, 112, 3, 4, INK), ell(109, 112, 3, 4, INK),
      circ(74, 88, 4.5, INK), circ(75.6, 86.4, 1.6, "#ffffff"),
      circ(126, 88, 4.5, INK), circ(127.6, 86.4, 1.6, "#ffffff"),
      stroke("M 100 118 L 100 124 M 88 128 Q 100 137 112 128", INK, 2, { linecap: "round" }),
    ], Z.face),
  ];
}

const ANIMAL_ART = { cat: catShapes, dog: dogShapes, hamster: hamsterShapes, capybara: capybaraShapes };

/* ---------- Items ----------
   Each item function gets the animal's anchors and returns shapes in absolute coordinates. */

// Headwear is drawn for a head 100 wide with the base line at y = 0 and the top at negative y;
// place() scales it to the animal and puts it on the crown.
function hatAt(a, shapes) {
  const s = a.headWidth / 100;
  return placeAll(shapes, a.crown.x, a.crown.y + 8 * s, s);
}

const ITEM_ART = {
  beanie: (a) => hatAt(a, withZ([
    path("M -50 2 C -54 -34 -24 -46 0 -46 C 24 -46 54 -34 50 2 Z", "#e4572e"),
    rect(-54, -10, 108, 18, "#c23b1c", { rx: 7 }),
    circ(0, -50, 10, "#ffffff", { stroke: "#d8d2c8", sw: 1.5 }),
  ], Z.hat)),

  cap: (a) => hatAt(a, withZ([
    path("M -48 2 C -48 -30 -22 -38 0 -38 C 22 -38 48 -30 48 2 Z", "#3b7dd8"),
    ell(0, 2, 58, 10, "#2a5fa8"),
    circ(0, -38, 4, "#2a5fa8"),
  ], Z.hat)),

  pencil: (a) => hatAt(a, [
    // the pencil first (z just under the band), standing up behind it
    ...withZ([
      rect(18, -2, 12, 8, "#f49ac2", { rx: 2, rot: { deg: 22, cx: 24, cy: 6 } }),
      rect(18, -8, 12, 7, "#b8bcc4", { rot: { deg: 22, cx: 24, cy: 6 } }),
      rect(18, -50, 12, 42, "#ffd23f", { stroke: "#c99a00", sw: 1.5, rot: { deg: 22, cx: 24, cy: 6 } }),
      poly([[18, -50], [30, -50], [24, -64]], "#f1c58f", { rot: { deg: 22, cx: 24, cy: 6 } }),
      poly([[21, -58], [27, -58], [24, -64]], INK, { rot: { deg: 22, cx: 24, cy: 6 } }),
    ], Z.hat - 1),
    ...withZ([
      stroke("M -50 10 Q 0 -14 50 10", "#c99a00", 11, { linecap: "round" }),
      stroke("M -50 10 Q 0 -14 50 10", "#ffd23f", 8, { linecap: "round" }),
    ], Z.hat),
  ]),

  wizard: (a) => hatAt(a, withZ([
    path("M -44 2 C -30 -14 -16 -46 -4 -76 C 8 -66 26 -22 44 2 Z", "#6a4bc4"),
    path("M -46 -6 Q 0 4 46 -6 L 44 2 Q 0 12 -44 2 Z", "#f6c431"),
    ell(0, 4, 58, 10, "#4f349c", { z: Z.hat - 1 }),
    poly([[-4, -42], [-1.5, -35], [6, -35], [0, -30], [2, -22], [-4, -27], [-10, -22], [-8, -30], [-14, -35], [-6.5, -35]], "#ffe27a"),
  ], Z.hat)),

  crown: (a) => hatAt(a, withZ([
    poly([[-46, 4], [-46, -30], [-24, -10], [0, -38], [24, -10], [46, -30], [46, 4]], "#f6c431", { stroke: "#b8860b", sw: 2 }),
    rect(-46, -6, 92, 10, "#e0a81c", { stroke: "#b8860b", sw: 2 }),
    circ(0, -38, 4, "#e0485a"), circ(-46, -30, 3.5, "#4aa3e0"), circ(46, -30, 3.5, "#5ac88f"),
    circ(0, -1, 3.5, "#e0485a"), circ(-24, -1, 3, "#4aa3e0"), circ(24, -1, 3, "#5ac88f"),
  ], Z.hat)),

  glasses: (a) => {
    const d = a.eyeR.x - a.eyeL.x;
    const r = Math.min(d * 0.34, 14.5); // capped: some animals have widely spaced eyes
    const ink = "#3b3f5c";
    return withZ([
      circ(a.eyeL.x, a.eyeL.y, r, "#ffffff", { op: 0.35, stroke: ink, sw: 3 }),
      circ(a.eyeR.x, a.eyeR.y, r, "#ffffff", { op: 0.35, stroke: ink, sw: 3 }),
      stroke(`M ${a.eyeL.x + r} ${a.eyeL.y - 2} Q ${a.eyeL.x + d / 2} ${a.eyeL.y - 6} ${a.eyeR.x - r} ${a.eyeR.y - 2}`, ink, 3, { linecap: "round" }),
      stroke(`M ${a.eyeL.x - r} ${a.eyeL.y - 2} L ${a.eyeL.x - r - 8} ${a.eyeL.y - 5} M ${a.eyeR.x + r} ${a.eyeR.y - 2} L ${a.eyeR.x + r + 8} ${a.eyeR.y - 5}`, ink, 3, { linecap: "round" }),
    ], Z.eyes + 5);
  },

  sunglasses: (a) => {
    const d = a.eyeR.x - a.eyeL.x;
    const rx = Math.min(d * 0.36, 15.5);
    const ry = rx * 0.8;
    return withZ([
      ell(a.eyeL.x, a.eyeL.y, rx, ry, "#1f2233"),
      ell(a.eyeR.x, a.eyeR.y, rx, ry, "#1f2233"),
      stroke(`M ${a.eyeL.x - rx * 0.5} ${a.eyeL.y - ry * 0.5} L ${a.eyeL.x - rx * 0.1} ${a.eyeL.y - ry * 0.1}`, "#ffffff", 2, { linecap: "round", op: 0.45 }),
      stroke(`M ${a.eyeR.x - rx * 0.5} ${a.eyeR.y - ry * 0.5} L ${a.eyeR.x - rx * 0.1} ${a.eyeR.y - ry * 0.1}`, "#ffffff", 2, { linecap: "round", op: 0.45 }),
      stroke(`M ${a.eyeL.x + rx} ${a.eyeL.y - 2} L ${a.eyeR.x - rx} ${a.eyeR.y - 2}`, "#1f2233", 3.5, { linecap: "round" }),
      stroke(`M ${a.eyeL.x - rx} ${a.eyeL.y - 2} L ${a.eyeL.x - rx - 8} ${a.eyeL.y - 5} M ${a.eyeR.x + rx} ${a.eyeR.y - 2} L ${a.eyeR.x + rx + 8} ${a.eyeR.y - 5}`, "#1f2233", 3, { linecap: "round" }),
    ], Z.eyes + 5);
  },

  blush: (a) => withZ([
    ell(a.cheekL.x, a.cheekL.y, 9, 5.5, "#ff6f91", { op: 0.55 }),
    ell(a.cheekR.x, a.cheekR.y, 9, 5.5, "#ff6f91", { op: 0.55 }),
  ], Z.cheek),

  headphones: (a) => {
    const top = a.crown.y - 3; // the band passes just above the head
    const ey = a.earL.y;
    // control height chosen so the middle of the curve passes through `top`
    const cy = (top - 0.25 * (ey - 6)) / 0.75;
    const lx = a.earL.x - 2;
    const rx = a.earR.x + 2;
    return [
      ...withZ([stroke(`M ${lx} ${ey - 6} C ${lx - 6} ${cy} ${rx + 6} ${cy} ${rx} ${ey - 6}`, "#3b3f5c", 7, { linecap: "round" })], Z.ears - 1),
      ...withZ([
        ell(lx, ey, 11, 16, "#e0485a", { stroke: "#b02a3d", sw: 2 }),
        ell(rx, ey, 11, 16, "#e0485a", { stroke: "#b02a3d", sw: 2 }),
        ell(lx + 3, ey, 5, 10, "#2c2f48"),
        ell(rx - 3, ey, 5, 10, "#2c2f48"),
      ], Z.ears),
    ];
  },

  bag: (a) => {
    const b = a.body;
    const w = b.width + 28;
    const top = b.top - 8;
    return [
      ...withZ([
        rect(b.x - w / 2, top, w, b.bottom - top + 1, "#3f8f6b", { rx: 16, stroke: "#2e6e50", sw: 2 }),
        rect(b.x - w / 2 + 12, top + 26, w - 24, 22, "#357a5a", { rx: 8 }),
      ], Z.behind + 1),
      ...withZ([
        stroke(`M ${b.x - 22} ${b.top + 2} Q ${b.x - 32} ${b.top + 26} ${b.x - 26} ${b.bottom - 8}`, "#2e6e50", 6, { linecap: "round" }),
        stroke(`M ${b.x + 22} ${b.top + 2} Q ${b.x + 32} ${b.top + 26} ${b.x + 26} ${b.bottom - 8}`, "#2e6e50", 6, { linecap: "round" }),
        rect(b.x - 31, b.top + 22, 8, 7, "#f6c431", { rx: 1.5 }),
        rect(b.x + 23, b.top + 22, 8, 7, "#f6c431", { rx: 1.5 }),
      ], Z.bodyOver),
    ];
  },
};

export function hasArt(itemId) {
  return typeof ITEM_ART[itemId] === "function" || itemId in FUR_COLORS;
}

/* ---------- The whole character ---------- */

// character: { animal, equipped } (equipped maps slot -> item id). Returns the shapes to draw,
// lowest z first. Nothing is drawn while no animal is chosen.
export function drawCharacter(character) {
  const animal = character.animal;
  if (!ANIMAL_ART[animal]) return [];
  const equipped = character.equipped ?? {};
  const base = FUR_COLORS[equipped.color] ?? NATURAL_FUR[animal];
  const shapes = [...ANIMAL_ART[animal](furOf(base))];
  for (const slot of ["hat", "eyes", "cheek", "ears", "back"]) {
    const art = ITEM_ART[equipped[slot]];
    if (art) shapes.push(...art(ANCHORS[animal]));
  }
  // Array.prototype.sort is stable, so shapes with the same z keep the order they were made in
  return shapes.sort((p, q) => (p.z ?? 0) - (q.z ?? 0));
}

/* ---------- Geometry (for the SVG renderer's helpers and for tests) ---------- */

function rotatePoint([x, y], rot) {
  if (!rot) return [x, y];
  const rad = (rot.deg * Math.PI) / 180;
  const dx = x - rot.cx;
  const dy = y - rot.cy;
  return [rot.cx + dx * Math.cos(rad) - dy * Math.sin(rad), rot.cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
}

function arc(cx, cy, rx, ry, steps = 40) {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

function roundedRect(x, y, w, h, r) {
  r = Math.min(r ?? 0, w / 2, h / 2);
  if (r <= 0) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const corner = (cx, cy, from) => Array.from({ length: 9 }, (_, i) => {
    const a = ((from + (i / 8) * 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return [
    ...corner(x + w - r, y + r, -90), ...corner(x + w - r, y + h - r, 0),
    ...corner(x + r, y + h - r, 90), ...corner(x + r, y + r, 180),
  ];
}

// Splits a path into polylines (curves become short straight pieces). Each is { pts, closed }.
function flattenPath(d) {
  const lines = [];
  let cur = null;
  let pos = [0, 0];
  for (const [cmd, n] of pathParts(d)) {
    if (cmd === "M") {
      cur = { pts: [[n[0], n[1]]], closed: false };
      lines.push(cur);
      pos = [n[0], n[1]];
    } else if (cmd === "L") {
      cur.pts.push([n[0], n[1]]);
      pos = [n[0], n[1]];
    } else if (cmd === "Q") {
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        const u = 1 - t;
        cur.pts.push([u * u * pos[0] + 2 * u * t * n[0] + t * t * n[2], u * u * pos[1] + 2 * u * t * n[1] + t * t * n[3]]);
      }
      pos = [n[2], n[3]];
    } else if (cmd === "C") {
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        cur.pts.push([
          u ** 3 * pos[0] + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t ** 3 * n[4],
          u ** 3 * pos[1] + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t ** 3 * n[5],
        ]);
      }
      pos = [n[4], n[5]];
    } else if (cmd === "Z") {
      cur.closed = true;
    }
  }
  return lines;
}

// The outline(s) of a shape as { pts, closed } with rotation applied.
export function shapePolygons(shape) {
  let lines;
  switch (shape.t) {
    case "ellipse": lines = [{ pts: arc(shape.cx, shape.cy, shape.rx, shape.ry), closed: true }]; break;
    case "circle": lines = [{ pts: arc(shape.cx, shape.cy, shape.r, shape.r), closed: true }]; break;
    case "rect": lines = [{ pts: roundedRect(shape.x, shape.y, shape.w, shape.h, shape.rx), closed: true }]; break;
    case "poly": lines = [{ pts: shape.pts, closed: true }]; break;
    case "path": lines = flattenPath(shape.d); break;
    default: lines = [];
  }
  return lines.map((l) => ({ pts: l.pts.map((p) => rotatePoint(p, shape.rot)), closed: l.closed }));
}

// { minX, minY, maxX, maxY } including half the stroke width.
export function shapeBounds(shape) {
  const grow = shape.stroke ? (shape.sw ?? 1) / 2 : 0;
  const all = shapePolygons(shape).flatMap((l) => l.pts);
  return {
    minX: Math.min(...all.map((p) => p[0])) - grow,
    maxX: Math.max(...all.map((p) => p[0])) + grow,
    minY: Math.min(...all.map((p) => p[1])) - grow,
    maxY: Math.max(...all.map((p) => p[1])) + grow,
  };
}
