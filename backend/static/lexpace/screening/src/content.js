// Item banks. Check every item by hand before the pilot.
// Override with createJourney(el, { content: { alike: {...} } }), e.g. for an Arabic version.

export const DEFAULT_CONTENT = {
  // Short ARHQ: items 15, 17, 18, 19, 21 (Khanolainen et al., 2024). 0–4 scale.
  // TODO: copy the exact answer labels for each item from the IDA form.
  story: {
    items: [
      { id: 15, q: "How much difficulty did you have learning to read in elementary (primary) school?", left: "None", mid: "Some", right: "A great deal" },
      { id: 17, q: "Did you ever reverse the order of letters or numbers when you were a child?", left: "No", mid: "Sometimes", right: "Often" },
      { id: 18, q: "Did you have difficulty learning letter and/or color names when you were a child?", left: "None", mid: "Some", right: "A great deal" },
      { id: 19, q: "How would you compare your reading skill to that of others in your elementary classes?", left: "Above average", mid: "Average", right: "Below average" },
      { id: 21, q: "Did you experience difficulty in high school or college English classes?", left: "None", mid: "Some", right: "A great deal" },
    ],
  },

  // [sounds like a real word, foil]. Levels: 1 simple · 2 clusters · 3 two syllables · 4 tricky spellings.
  alike: {
    practice: ["kar", "kir"],
    levels: {
      1: [["kat", "kib"], ["bote", "bufe"], ["sed", "sab"], ["hed", "hif"], ["gote", "gofe"], ["rane", "rame"], ["nite", "nibe"], ["leef", "leeb"]],
      2: [["brane", "brone"], ["trane", "trone"], ["clok", "clek"], ["skool", "skeel"], ["grene", "grune"], ["flore", "flome"], ["snoe", "snie"], ["plase", "plose"]],
      3: [["fether", "fother"], ["munny", "minny"], ["pensil", "pensol"], ["taybul", "taybil"], ["wimmen", "wimmon"], ["bizzy", "bozzy"], ["sistur", "sostur"], ["docter", "dacter"]],
      4: [["nolledge", "nalledge"], ["sircle", "sorcle"], ["kwestion", "kwastion"], ["ofise", "ofose"], ["rythum", "rothum"], ["phinish", "phanish"], ["skwair", "skwoir"], ["yoosual", "yaasual"]],
    },
  },

  // [heard word, correct, wrong]. The unchanged word is always the third option.
  // Levels: 1 drop first sound · 2 drop first sound of a cluster · 3 drop second sound.
  lab: {
    practice: { item: ["smab", "mab", "sab"], ask: "first" },
    ask: { 1: "first", 2: "first", 3: "second" },
    levels: {
      1: [["bim", "im", "bi"], ["dop", "op", "do"], ["fip", "ip", "fi"], ["gub", "ub", "gu"], ["kam", "am", "ka"], ["lun", "un", "lu"], ["mib", "ib", "mi"], ["pog", "og", "po"]],
      2: [["blim", "lim", "bim"], ["frop", "rop", "fop"], ["plid", "lid", "pid"], ["drem", "rem", "dem"], ["stog", "tog", "sog"], ["clup", "lup", "cup"], ["snad", "nad", "sad"], ["glon", "lon", "gon"]],
      3: [["blim", "bim", "lim"], ["frop", "fop", "rop"], ["plid", "pid", "lid"], ["drem", "dem", "rem"], ["stog", "sog", "tog"], ["glon", "gon", "lon"], ["spev", "sev", "pev"], ["brin", "bin", "rin"]],
    },
  },

  // Levels 1–2 regular, 3–4 irregular. p = misspellings that still sound right.
  echo: {
    practice: { w: "table", s: "Put the cup on the table." },
    // Always asked after the adaptive rounds, so every student gets an irregular-word score.
    probes: [
      { w: "laugh", s: "Her joke made us laugh.", p: ["laf", "laff", "larf"] },
      { w: "heart", s: "Exercise is good for your heart.", p: ["hart", "haart"] },
    ],
    levels: {
      1: [{ w: "garden", s: "We sat in the garden." }, { w: "window", s: "Open the window, please." }, { w: "market", s: "She went to the market." }, { w: "basket", s: "Put the fruit in the basket." }, { w: "picnic", s: "We had a picnic by the beach." }, { w: "sunset", s: "The sunset was orange." }, { w: "napkin", s: "Take a napkin." }],
      2: [{ w: "important", s: "This lecture is important.", p: ["importent", "importint"] }, { w: "fantastic", s: "The view was fantastic.", p: ["fantastik"] }, { w: "membership", s: "Renew your gym membership.", p: ["membirship"] }, { w: "understand", s: "I understand the question.", p: ["understend"] }, { w: "remember", s: "Try to remember the date.", p: ["remembur"] }, { w: "transportation", s: "Public transportation is cheap.", p: ["transportashun", "transportasion"] }, { w: "independent", s: "She is very independent.", p: ["independant", "indipendent"] }],
      3: [{ w: "island", s: "They swam to the island.", p: ["iland", "eyeland", "ailand"] }, { w: "answer", s: "Write your answer here.", p: ["anser", "ansser"] }, { w: "friend", s: "She is my best friend.", p: ["frend", "frennd"] }, { w: "people", s: "Many people came.", p: ["peeple", "peepul", "pepole"] }, { w: "busy", s: "The shop is busy today.", p: ["bizzy", "bizy", "bisy"] }, { w: "women", s: "The women won the match.", p: ["wimmen", "wimen", "wimin"] }, { w: "enough", s: "We have enough time.", p: ["enuf", "enuff", "inuf"] }],
      4: [{ w: "rhythm", s: "She clapped to the rhythm.", p: ["rythm", "rithum", "rythem", "rhythum"] }, { w: "receipt", s: "Keep the receipt from the shop.", p: ["reseet", "receet", "reciet", "reseat"] }, { w: "debt", s: "He paid back his debt.", p: ["det", "dett"] }, { w: "choir", s: "The choir sang loudly.", p: ["quire", "kwire", "quier"] }, { w: "knowledge", s: "Reading builds knowledge.", p: ["nowledge", "nollege", "knowlege", "nolledge"] }, { w: "yacht", s: "They sailed a small yacht.", p: ["yot", "yott", "yaht"] }, { w: "psychology", s: "She studies psychology.", p: ["sychology", "sikology", "psycology", "sychollogy"] }],
    },
  },

  numbers: {},

  follow: {
    tokens: [
      { c: "blue", s: "circle" }, { c: "blue", s: "square" }, { c: "orange", s: "triangle" }, { c: "orange", s: "circle" },
      { c: "green", s: "square" }, { c: "green", s: "star" }, { c: "purple", s: "triangle" }, { c: "purple", s: "star" },
    ],
  },

  read: {
    passage: [
      "Salma arrived at the engineering lab early on her first day. Her lab partner, Yusuf, came in a few minutes later carrying two cups of karak tea.",
      "Their task was to build a circuit that made a small light blink once every second. Yusuf connected the wires while Salma read the instructions. At first, the light stayed on without blinking.",
      "Salma noticed that one wire was in the wrong row. She moved it, and the light began to blink. They agreed that next week, Yusuf would read the instructions and Salma would build.",
    ],
    questions: [
      { q: "What did Yusuf bring to the lab?", o: ["Two cups of karak tea", "A new laptop", "Sandwiches", "A spare light"], a: 0 },
      { q: "What made the light start blinking?", o: ["Moving one wire", "Changing the light", "Turning off the fan", "Restarting a computer"], a: 0 },
      { q: "What will Salma do next week?", o: ["Build the circuit", "Read the instructions", "Write the report", "Time the light"], a: 0 },
    ],
  },
};
