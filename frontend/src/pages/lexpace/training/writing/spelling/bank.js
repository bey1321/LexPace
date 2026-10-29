// Placeholder spelling word bank, ported from the approved prototype. Spec section 2a:
// flow 2a (course files -> word extraction -> Generator AI -> Checker AI -> SAS review) is not
// built in this pass, so this is clearly placeholder content, not real course vocabulary -
// same deferral as the other two trainings' preparation flows.

export const BANK = {
  environment: { parts: ["environ", "ment"], family: ["environmental", "environmentally"], miss: "enviroment", ctx: "The study measured noise in the work environment.", traps: [[6, 1, "sound"]], check: "Split confirmed in morphology database. Misspelling is not a dictionary word." },
  government: { traps: [[5, 1, "sound"]] },
  receive: { parts: ["re", "ceive"], family: ["receipt", "receiver", "reception"], miss: "recieve", ctx: "Students receive feedback within one week.", traps: [[3, 2, "pattern"]], check: "Split confirmed in morphology database. Misspelling is not a dictionary word." },
  perceive: { traps: [[4, 2, "pattern"]] },
  responsibility: { parts: ["respons", "ibil", "ity"], family: ["response", "responsible", "responsibly"], miss: "responsability", ctx: "Each member takes responsibility for one section.", traps: [[7, 7, "part"]], check: "Split confirmed in morphology database. Misspelling is not a dictionary word." },
  possibility: { traps: [[2, 2, "pattern"], [4, 7, "part"]] },
  significance: { parts: ["signific", "ance"], family: ["significant", "significantly", "insignificant"], miss: "significence", ctx: "The results showed no statistical significance.", traps: [[8, 4, "part"]], check: "Split confirmed in morphology database. Misspelling is not a dictionary word." },
  appearance: { traps: [[1, 2, "pattern"], [6, 4, "part"]] },
  occurred: { parts: ["occur", "r", "ed"], family: ["occur", "occurring", "occurrence"], miss: "occured", ctx: "The error occurred during data entry.", traps: [[1, 2, "pattern"], [4, 2, "pattern"]], check: "Split from doubling rule (stress on last syllable). Misspelling is not a dictionary word." },
  referred: { traps: [[4, 2, "pattern"]] },
};

export const CTX_HELD = {
  government: "The government published a new report.",
  perceive: "Readers perceive the argument as weak.",
  possibility: "There is a possibility of error in the data.",
  appearance: "The appearance of the chart was improved.",
  referred: "The author referred to two earlier studies.",
};

// Matched pairs: first word of each pair is trained, second is held out for the end test.
export const PAIRS = [
  ["environment", "government"], ["receive", "perceive"], ["responsibility", "possibility"],
  ["significance", "appearance"], ["occurred", "referred"],
];

export function buildStartingTest() {
  const flat = [];
  PAIRS.forEach((p) => flat.push(p[0], p[1]));
  // Interleaved order, matching the prototype's fixed demo order.
  return [flat[0], flat[3], flat[4], flat[7], flat[8], flat[1], flat[2], flat[5], flat[6], flat[9]];
}

// Rapid Reading items: course words and two non-words, each shown once.
export const RR_ITEMS = ["analysis", "hypothesis", "criteria", "receive", "plintoment", "framework", "significance", "dravition"];
export const NONWORDS = { plintoment: true, dravition: true };
