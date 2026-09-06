// Checks that every verbatim string the spec requires actually appears in the
// rendered landing page, and that the excluded content does not.
// Compares against the live page rather than the source, so entity escaping and
// JSX whitespace collapsing are exercised too.

const res = await fetch("http://localhost:3000/");
const html = await res.text();

// Strip tags, decode the entities we use, collapse whitespace — so JSX line breaks
// inside a sentence do not cause false failures.
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&mdash;|&#x2014;/g, "—")
  .replace(/&ndash;/g, "–")
  .replace(/&rsquo;|&#x2019;/g, "’")
  .replace(/&uacute;/g, "ú")
  .replace(/&oacute;/g, "ó")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;|&#x20;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const MUST_CONTAIN = [
  // FR2 hero
  ["FR2", "About Home Base / 2021—present"],
  ["FR2", "A home is more than the sum of its rooms."],
  ["FR2", "It is the work you put into it. The decisions made quietly, over years. Home Base is a place to keep that story — clear, useful and ready for whoever comes next."],
  ["FR2", "Read our story"],
  ["FR2", "The house book, reimagined"],
  // FR3 why we exist
  ["FR3", "Why we exist"],
  ["FR3", "The handover should feel like a beginning, not an interrogation."],
  ["FR3", "We kept hearing the same story: a new owner arrives with a folder of invoices, a handful of half-remembered answers, and a long list of things they wish they had asked. Important knowledge disappears between owners."],
  ["FR3", "Home Base began as a simple question: what if every property had a living record? Not a compliance file, but a generous, honest account of the care that has gone into it."],
  ["FR3", "We built the tool we wanted to receive ourselves — a quiet place for the facts, the photographs and the little decisions that make a house a home."],
  // FR4 husbok
  ["FR4", "A tradition worth keeping"],
  ["FR4", "The Nordic"],
  ["FR4", "húsbók"],
  ["FR4", "In Scandinavia, a house book has long been part of the life of a well-kept home."],
  ["FR4", "It holds the practical knowledge that otherwise lives in one person’s head: when the roof was repaired, which paint is on the hallway walls, where the water shuts off. More than a ledger, it is an act of stewardship — a promise that the house will be understood and cared for."],
  ["FR4", "We borrowed the idea, then made it useful for Australian homes. A digital house book that is as considered as the homes it records."],
  // FR5 slab
  ["FR5", "Why it matters"],
  ["FR5", "The details are small."],
  ["FR5", "The difference is lasting."],
  // FR6 how it works
  ["FR6", "How Home Base works"],
  ["FR6", "One calm place for the life of your property."],
  ["FR6", "Set the scene"],
  ["FR6", "Add your property, its history and the people who know it best."],
  ["FR6", "Keep the record"],
  ["FR6", "Log maintenance, renovations and documents as life happens."],
  ["FR6", "Build confidence"],
  ["FR6", "See what has been done, when, and by whom — at a glance."],
  ["FR6", "Pass it on"],
  ["FR6", "Share a complete, useful record at sale or settlement."],
  // FR9 footer
  ["FR9", "A property’s home passport. Made in Australia."],
  ["FR9", "Founded 2021 / Sydney + Melbourne"],
];

// AC3 (no team section) and AC4 (no statistics anywhere).
const MUST_NOT_CONTAIN = [
  ["AC3", "The people"],
  ["AC3", "Made by people who notice things"],
  ["AC3", "Elise Marangos"],
  ["AC3", "Tom Whelan"],
  ["AC3", "#team"],
  ["AC4", "2,400"],
  ["AC4", "87"],
  ["AC4", "4.8"],
  ["AC4", "properties with a clearer story"],
  ["AC4", "suburbs across Australia"],
  ["AC4", "average handover confidence"],
];

let failures = 0;

console.log("=== REQUIRED COPY ===");
for (const [fr, needle] of MUST_CONTAIN) {
  const ok = text.includes(needle);
  if (!ok) failures++;
  const label = needle.length > 62 ? needle.slice(0, 59) + "..." : needle;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${fr}  ${label}`);
}

console.log("\n=== MUST BE ABSENT ===");
for (const [ac, needle] of MUST_NOT_CONTAIN) {
  const ok = !text.includes(needle);
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${ac}  ${needle}`);
}

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
