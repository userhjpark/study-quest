// Character shop logic: animals, items, what is owned and worn, buying, try-on.
// Pure functions, no DOM and no storage. Every function returns a new character instead of
// changing the old one. Coins live in the profile (rewards.js): buying takes the current coins
// and returns the new amount, and main.js stores both.

import { checkPetName, repairPetName } from "./pet-name.js";

export const ANIMAL_PRICE = 60; // the first animal is free, the others cost this

export const ANIMALS = [
  { id: "cat", name: "고양이", price: ANIMAL_PRICE },
  { id: "dog", name: "강아지", price: ANIMAL_PRICE },
  { id: "hamster", name: "햄스터", price: ANIMAL_PRICE },
  { id: "capybara", name: "카피바라", price: ANIMAL_PRICE },
];

// A slot holds one item at a time: a new item replaces the one in the same slot.
export const SLOTS = ["color", "hat", "eyes", "cheek", "ears", "back"];

// Tabs in the shop. "animal" is not a slot: the character has exactly one animal.
export const CATEGORIES = [
  { id: "animal", name: "동물" },
  { id: "color", name: "색상" },
  { id: "hat", name: "모자" },
  { id: "face", name: "얼굴" },
  { id: "prop", name: "소품" },
];

export const ITEMS = [
  { id: "mint", name: "민트", category: "color", slot: "color", price: 25 },
  { id: "sky", name: "하늘", category: "color", slot: "color", price: 25 },
  { id: "pink", name: "분홍", category: "color", slot: "color", price: 25 },
  { id: "yellow", name: "노랑", category: "color", slot: "color", price: 35 },
  { id: "gold", name: "금색", category: "color", slot: "color", price: 120 },

  { id: "beanie", name: "비니", category: "hat", slot: "hat", price: 30 },
  { id: "cap", name: "야구 모자", category: "hat", slot: "hat", price: 40 },
  { id: "pencil", name: "연필 머리띠", category: "hat", slot: "hat", price: 35 },
  { id: "wizard", name: "마법사 모자", category: "hat", slot: "hat", price: 70 },
  { id: "crown", name: "왕관", category: "hat", slot: "hat", price: 150 },

  { id: "glasses", name: "동그란 안경", category: "face", slot: "eyes", price: 30 },
  { id: "sunglasses", name: "선글라스", category: "face", slot: "eyes", price: 50 },
  { id: "blush", name: "볼터치", category: "face", slot: "cheek", price: 25 },

  { id: "headphones", name: "헤드폰", category: "prop", slot: "ears", price: 50 },
  { id: "bag", name: "책가방", category: "prop", slot: "back", price: 45 },
];

export function findAnimal(id) {
  return ANIMALS.find((a) => a.id === id) ?? null;
}

export function findItem(id) {
  return ITEMS.find((i) => i.id === id) ?? null;
}

function emptyEquipped() {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

export function freshCharacter() {
  return { animal: null, name: "", ownedAnimals: [], ownedItems: [], equipped: emptyEquipped() };
}

// True once the user has picked the free first animal.
export function hasAnimal(character) {
  return character.animal !== null;
}

export function isOwned(character, id) {
  return character.ownedAnimals.includes(id) || character.ownedItems.includes(id);
}

// Whether `id` is what the character currently is / wears.
export function isEquipped(character, id) {
  if (character.animal === id) return true;
  const item = findItem(id);
  return item !== null && character.equipped[item.slot] === id;
}

/* ---------- Getting things ---------- */

// The free first animal. Only works while no animal is owned yet. `petName` is optional (empty =
// the animal's own name is used); a name that is too long is an error and nothing changes.
export function pickFirstAnimal(character, id, petName = "") {
  if (!findAnimal(id)) return { character, error: "알 수 없는 동물이에요." };
  if (character.ownedAnimals.length > 0) return { character, error: "이미 친구를 골랐어요." };
  const named = checkPetName(petName);
  if (named.error) return { character, error: named.error };
  return { character: { ...character, animal: id, name: named.name, ownedAnimals: [id] }, error: null };
}

// The name shown for the pet: the name the user gave, or the animal's own name. "" while no
// animal has been chosen. The name belongs to the pet, so it stays when another animal is worn.
export function petName(character) {
  return character.name || findAnimal(character.animal)?.name || "";
}

// Changes the name later. Empty = back to the animal's own name.
export function renamePet(character, text) {
  if (!hasAnimal(character)) return { character, error: "먼저 함께할 친구를 골라 주세요." };
  const named = checkPetName(text);
  if (named.error) return { character, error: named.error };
  return { character: { ...character, name: named.name }, error: null };
}

export function notEnoughCoinsMessage(price, coins) {
  return `코인이 ${price - coins}개 부족해요.`;
}

// Buys an animal or an item and puts it on at once. Returns { character, coins, error }; with an
// error nothing changes (the same character and coins come back).
export function buy(character, coins, id) {
  const animal = findAnimal(id);
  const item = animal ? null : findItem(id);
  const fail = (error) => ({ character, coins, error });
  if (!animal && !item) return fail("알 수 없는 아이템이에요.");
  if (!hasAnimal(character)) return fail("먼저 함께할 친구를 골라 주세요.");
  if (isOwned(character, id)) return fail("이미 가지고 있어요.");
  const price = (animal ?? item).price;
  if (coins < price) return fail(notEnoughCoinsMessage(price, coins));

  const bought = animal
    ? { ...character, animal: id, ownedAnimals: [...character.ownedAnimals, id] }
    : {
        ...character,
        ownedItems: [...character.ownedItems, id],
        equipped: { ...character.equipped, [item.slot]: id },
      };
  return { character: bought, coins: coins - price, error: null };
}

/* ---------- Wearing things ---------- */

// Puts on an owned item, or switches to an owned animal. Anything not owned changes nothing.
export function equip(character, id) {
  if (!isOwned(character, id)) return character;
  if (findAnimal(id)) return { ...character, animal: id };
  const item = findItem(id);
  return { ...character, equipped: { ...character.equipped, [item.slot]: id } };
}

// Takes off whatever is in a slot. The animal itself cannot be taken off.
export function unequipSlot(character, slot) {
  if (!SLOTS.includes(slot)) return character;
  return { ...character, equipped: { ...character.equipped, [slot]: null } };
}

/* ---------- Shop list ---------- */

// What the cards of a shop tab show: animals for "animal", otherwise the items of that category.
export function shopEntries(category) {
  return category === "animal" ? ANIMALS : ITEMS.filter((item) => item.category === category);
}

// "equipped" = on now (or the animal that is with the user), "owned" = bought but not on, "new" = not bought.
export function shopStatus(character, id) {
  if (isEquipped(character, id)) return "equipped";
  return isOwned(character, id) ? "owned" : "new";
}

// Tapping something owned: put it on, or take it off if it is already on (the animal stays).
export function wearOrTakeOff(character, id) {
  const item = findItem(id);
  if (item && isEquipped(character, id)) return unequipSlot(character, item.slot);
  return equip(character, id);
}

/* ---------- Try-on ---------- */

// The character as it would look with `id` on (an animal or an item the user may not own).
// Only for drawing the big preview: it changes nothing that is saved, and no coins.
export function previewCharacter(character, id) {
  if (findAnimal(id)) return { ...character, animal: id };
  const item = findItem(id);
  if (!item) return character;
  return { ...character, equipped: { ...character.equipped, [item.slot]: id } };
}

/* ---------- Saved data ---------- */

function uniqueKnown(list, find) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list)].filter((id) => typeof id === "string" && find(id));
}

// Saved data can be missing or edited: keep only known, owned things, so the character is always
// drawable. An animal that is not owned falls back to one that is (or none).
export function sanitizeCharacter(raw) {
  const c = raw !== null && typeof raw === "object" ? raw : {};
  const ownedAnimals = uniqueKnown(c.ownedAnimals, findAnimal);
  const ownedItems = uniqueKnown(c.ownedItems, findItem);
  const animal = ownedAnimals.includes(c.animal) ? c.animal : (ownedAnimals[0] ?? null);

  const saved = c.equipped !== null && typeof c.equipped === "object" ? c.equipped : {};
  const equipped = emptyEquipped();
  for (const slot of SLOTS) {
    const item = findItem(saved[slot]);
    if (item && item.slot === slot && ownedItems.includes(item.id)) equipped[slot] = item.id;
  }
  return { animal, name: repairPetName(c.name), ownedAnimals, ownedItems, equipped };
}
