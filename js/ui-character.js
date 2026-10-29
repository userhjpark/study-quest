// Character screens. All DOM work for drawing the animals lives here; the shapes themselves come
// from avatar-art.js and the rules from character.js. Text is inserted with textContent / setAttribute
// only (never innerHTML).

import {
  findAnimal, findItem, SLOTS, CATEGORIES, previewCharacter, shopEntries, shopStatus, hasAnimal,
} from "./character.js";
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


/* ---------- Character tab ---------- */

const $ = (id) => document.getElementById(id);

let handlers = null; // { onPick, onCategory, onBuy, onRevert, onStart, onOpen }

export function bindCharacterEvents(h) {
  handlers = h;
  $("char-buy-btn").addEventListener("click", h.onBuy);
  $("char-revert-btn").addEventListener("click", h.onRevert);
  $("char-start-btn").addEventListener("click", h.onStart);
  $("header-avatar").addEventListener("click", h.onOpen);
}

// The small avatar in the header always shows what is really worn (never the try-on).
export function renderHeaderAvatar(character) {
  $("header-avatar").replaceChildren(createAvatar(character));
}

export function setShopCoins(coins) {
  $("char-coins").textContent = String(coins);
}

function button(className, pressed) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  if (pressed !== undefined) el.setAttribute("aria-pressed", String(pressed));
  return el;
}

const STATUS_TEXT = { equipped: "착용 중 · 해제", owned: "장착하기" };

function shopCard(character, entry, status, previewing, firstPick) {
  const isAnimal = findAnimal(entry.id) !== null;
  const card = button(`shop-card is-${previewing ? "previewing" : status}`, status === "equipped" || previewing);
  card.dataset.id = entry.id;

  // Animals are drawn plain; items are drawn on the current character, so the card shows the result.
  const looks = isAnimal ? { animal: entry.id, equipped: {} } : previewCharacter(character, entry.id);
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = entry.name;
  const state = document.createElement("span");
  state.className = "shop-status";
  if (previewing) state.textContent = "입어보는 중";
  else if (status === "equipped" && isAnimal) state.textContent = "함께하는 중";
  else if (status === "new") state.textContent = firstPick ? "무료" : `${entry.price} 코인`;
  else state.textContent = isAnimal ? "바꾸기" : STATUS_TEXT[status];
  card.append(createAvatar(looks), name, state);
  card.addEventListener("click", () => handlers.onPick(entry.id));
  return card;
}

// Draws the whole 캐릭터 tab. view = { character, coins, category, previewId, message, good }.
// previewId is the animal/item being tried on (not owned yet), or null; it never touches saved data.
export function renderCharacterTab({ character, coins, category, previewId, message, good }) {
  const firstPick = !hasAnimal(character);
  const shown = previewId ? previewCharacter(character, previewId) : character;
  const previewEntry = previewId ? (findAnimal(previewId) ?? findItem(previewId)) : null;

  // Keep keyboard focus on the same card after the list is rebuilt.
  const focusedId = document.activeElement?.closest?.(".shop-card")?.dataset.id;

  $("char-title").textContent = firstPick ? "함께할 친구를 골라 주세요" : "내 캐릭터";
  $("char-preview").replaceChildren(createAvatar(shown));
  $("char-caption").textContent = firstPick && !previewEntry
    ? "아래에서 친구를 눌러 모습을 확인해 보세요. 첫 친구는 무료예요!"
    : previewEntry ? `${previewEntry.name}${firstPick ? "" : " (입어보는 중)"}` : describeCharacter(character);
  const msg = $("char-message");
  msg.textContent = message || "";
  msg.classList.toggle("is-good", Boolean(message) && good === true);
  msg.classList.toggle("is-bad", Boolean(message) && good === false);

  $("char-first-actions").hidden = !(firstPick && previewEntry);
  $("char-try-actions").hidden = firstPick || !previewEntry;
  if (previewEntry && !firstPick) $("char-buy-btn").textContent = `구매 (${previewEntry.price}코인)`;

  setShopCoins(coins);
  $("shop-title").textContent = firstPick ? "친구들" : "상점";
  $("shop-categories").hidden = firstPick;
  $("shop-hint").textContent = firstPick
    ? ""
    : "안 가진 것을 누르면 먼저 입어볼 수 있어요. 착용 중인 것을 누르면 벗어요.";

  const chips = $("shop-categories");
  chips.replaceChildren();
  for (const c of CATEGORIES) {
    const chip = button("chip", c.id === category);
    chip.textContent = c.name;
    chip.addEventListener("click", () => handlers.onCategory(c.id));
    chips.append(chip);
  }

  const grid = $("shop-grid");
  grid.replaceChildren();
  for (const entry of shopEntries(firstPick ? "animal" : category)) {
    grid.append(shopCard(character, entry, shopStatus(character, entry.id), entry.id === previewId, firstPick));
  }
  if (focusedId) grid.querySelector(`.shop-card[data-id="${focusedId}"]`)?.focus();
}
