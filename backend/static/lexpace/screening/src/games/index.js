import story from "./story.js";
import alike from "./alike.js";
import lab from "./lab.js";
import echo from "./echo.js";
import numbers from "./numbers.js";
import follow from "./follow.js";
import read from "./read.js";

// The journey order. Pass your own list with createJourney(el, { games: [...] }).
// A game is { id, name, icon, blurb, meta, initData(), run(ctx) }. See README for the ctx API.
export const GAMES = [story, alike, lab, echo, numbers, follow, read];
