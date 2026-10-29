// Character screens. All DOM work for drawing the animals lives here; the shapes themselves come
// from avatar-art.js and the rules from character.js. Text is inserted with textContent / setAttribute
// only (never innerHTML).

import { findAnimal, findItem, SLOTS } from "./character.js";
import { VIEWBOX, drawCharacter } from "./avatar-art.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

// One shape from avatar-art.js -> one SVG element.
function shapeElement(shape) {
  let el;
  switch (shape.t) {
    case "ellipse": el = svgElement("ellipse", { cx: shape.cx, cy: shape.cy, rx: shape.rx, ry: shape.ry }); break;
    case "circle": el = svgElement("circle", { cx: shape.cx, cy: shape.cy, r: shape.r }); break;
    case "rect":
      el = svgElement("rect", { x: shape.x, y: shape.y, width: shape.w, height: shape.h });
      if (shape.rx !== undefined) el.setAttribute("rx", String(shape.rx));
      break;
    case "poly": el = svgElement("polygon", { points: shape.pts.map((p) => p.join(",")).join(" ") }); break;
    case "path": el = svgElement("path", { d: shape.d }); break;
    default: return null;
  }
  el.setAttribute("fill", shape.fill ?? "none");
  if (shape.stroke) {
    el.setAttribute("stroke", shape.stroke);
    el.setAttribute("stroke-width", String(shape.sw ?? 1));
    el.setAttribute("stroke-linecap", shape.linecap ?? "butt");
    el.setAttribute("stroke-linejoin", "round");
  }
  if (shape.op !== undefined) el.setAttribute("opacity", String(shape.op));
  if (shape.rot) el.setAttribute("transform", `rotate(${shape.rot.deg} ${shape.rot.cx} ${shape.rot.cy})`);
  return el;
}

// Text for screen readers, e.g. "고양이, 모자: 비니, 얼굴: 동그란 안경".
export function describeCharacter(character) {
  const animal = findAnimal(character.animal);
  if (!animal) return "아직 친구를 고르지 않았어요";
  const worn = SLOTS.map((slot) => findItem(character.equipped?.[slot])).filter(Boolean).map((i) => i.name);
  return worn.length > 0 ? `${animal.name}, ${worn.join(", ")}` : animal.name;
}

// Draws a character as an <svg> that scales to its container (size in px, or null for 100%).
// `character` only needs { animal, equipped }, so it works for the real character, the try-on
// preview and the gallery page alike. Without an animal a "?" is shown.
export function createAvatar(character, size = null) {
  const svg = svgElement("svg", {
    viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
    role: "img",
    "aria-label": describeCharacter(character),
    class: "avatar",
  });
  if (size) {
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
  }
  const shapes = drawCharacter(character);
  if (shapes.length === 0) {
    svg.append(svgElement("circle", { cx: 100, cy: 100, r: 78, fill: "#e6e1fb", stroke: "#b9b0ee", "stroke-width": 4, "stroke-dasharray": "10 8" }));
    const mark = svgElement("text", { x: 100, y: 128, "text-anchor": "middle", "font-size": 90, "font-weight": 700, fill: "#8a7fd6" });
    mark.textContent = "?";
    svg.append(mark);
    return svg;
  }
  for (const shape of shapes) {
    const el = shapeElement(shape);
    if (el) svg.append(el);
  }
  return svg;
}
