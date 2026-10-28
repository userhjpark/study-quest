// Concept notes: pure functions, no DOM and no storage.
// Every function returns a new list instead of changing the old one.

export const SAMPLE_CONCEPTS = [
  { id: "s1", term: "Photosynthesis", definition: "How plants turn light, water and carbon dioxide into sugar and oxygen" },
  { id: "s2", term: "Mitochondria", definition: "The part of a cell that releases energy from food" },
  { id: "s3", term: "Inflation", definition: "A general rise in prices over time" },
  { id: "s4", term: "Opportunity cost", definition: "The value of the best alternative you give up when you choose something" },
  { id: "s5", term: "Algorithm", definition: "A step-by-step set of instructions for solving a problem" },
];

export function addConcept(concepts, term, definition) {
  const t = String(term).trim();
  const d = String(definition).trim();
  if (!t || !d) {
    return { concepts, error: "Please fill in both the concept and its definition." };
  }
  const exists = concepts.some((c) => c.term.toLowerCase() === t.toLowerCase());
  if (exists) {
    return { concepts, error: "That concept is already in your list." };
  }
  const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return { concepts: [...concepts, { id, term: t, definition: d }], error: null };
}

export function deleteConcept(concepts, id) {
  return concepts.filter((c) => c.id !== id);
}

// Stored data could be edited or damaged, so keep only well-formed entries.
export function sanitizeConcepts(list) {
  if (!Array.isArray(list)) return null;
  return list.filter(
    (c) => c && typeof c.id === "string" && typeof c.term === "string" && typeof c.definition === "string"
  );
}
