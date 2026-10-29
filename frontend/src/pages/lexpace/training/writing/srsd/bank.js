// Placeholder SRSD content (sample essay, modelling script, quiz, essay prompts), ported from
// the approved prototype. Spec section 4a's preparation flow (Generator AI -> Checker AI ->
// staff approval, once per sample essay/modelling script) is not built in this pass - the same
// deferral as the other trainings' preparation flows.

export const PARTS = [
  { id: "claim", name: "Your position (claim)", re: /\b(should|must|ought to|i (believe|think|argue)|in my (view|opinion))\b/i },
  { id: "reason", name: "At least one reason", re: /\b(because|since|first(ly)?|second(ly)?|another reason|one reason)\b/i },
  { id: "evidence", name: "Evidence or an example", re: /\b(for example|for instance|according to|research|studies|study|survey|data|percent|\d+\s?%)\b/i },
  { id: "other", name: "The other side's argument", re: /\b(some (people|students|staff|critics) (argue|say|believe|think)|others (argue|say|believe)|critics|opponents|on the other hand)\b/i },
  { id: "answer", name: "Your answer to the other side", re: null },
  { id: "concl", name: "A conclusion", re: /\b(in conclusion|overall|therefore|to sum up|in summary|thus)\b/i },
];

export const SAMPLE = [
  ["Universities should record all lectures.", "claim"],
  ["Recordings help students review difficult material.", "reason"],
  ["In one survey, 70% of students said they rewatched lectures before exams.", "evidence"],
  ["Some people argue that recordings reduce attendance.", "other"],
  ["However, students who rewatch lectures still attend most classes, and recordings mainly help those who missed a session.", "answer"],
  ["Therefore, recording lectures is a simple way to support learning.", "concl"],
];

export const LABELS = { claim: "Claim", reason: "Reason", evidence: "Evidence", other: "Other side", answer: "Answer to other side", concl: "Conclusion" };

export const MODEL = [
  { t: "Question: Should university exams be open-book? I start with STOP. S: suspend judgment. Before deciding, I list ideas for both sides.", n: "FOR: tests understanding, not memory\nFOR: closer to real work, where you can check sources\nAGAINST: students may prepare less\nAGAINST: harder to write fair questions" },
  { t: "T: take a side. The 'for' ideas look stronger to me, so I will argue for open-book exams.", n: "MY SIDE: open-book exams" },
  { t: "O: organize. I pick my two strongest reasons and the one 'against' idea I can answer best.", n: "Reason 1: tests understanding\nReason 2: closer to real work\nOther side to answer: students prepare less" },
  { t: "P: plan more as I write. Now DARE. D: develop a topic sentence that states my position.", w: "Universities should make more exams open-book." },
  { t: "A: add supporting ideas, each with an example.", w: "Open-book exams test whether students can use knowledge, not just recall it; for example, students must apply a theory to a new case. They are also closer to real work, where professionals check sources." },
  { t: "R: reject an argument for the other side. I state it fairly, then answer it.", w: "Some people argue that students will prepare less. However, without preparation students cannot find and apply information in the time allowed." },
  { t: "E: end with a conclusion. I restate my position without adding new arguments.", w: "Therefore, open-book exams are a fairer test of what university students need to do." },
  { t: "Last, I check my essay against DARE: topic sentence, supporting ideas, the other side answered, conclusion. All parts are there." },
];

export const QUIZ = [
  { q: "What did the writer do first?", o: ["Wrote the topic sentence", "Listed ideas for both sides", "Wrote the conclusion"], c: 1 },
  { q: "What does R in DARE ask you to do?", o: ["Repeat your claim", "Reject an argument for the other side", "Read the question again"], c: 1 },
  { q: "What should the conclusion avoid?", o: ["Restating the position", "Adding new arguments", "Using full sentences"], c: 1 },
];

export const MEM = [
  ["S", "suspend", /suspend/], ["T", "take a side", /take/], ["O", "organize", /organi[sz]e/], ["P", "plan more as you write", /plan/],
  ["D", "develop a topic sentence", /develop|topic/], ["A", "add supporting ideas", /add|support/],
  ["R", "reject an argument for the other side", /reject/], ["E", "end with a conclusion", /end|conclu/],
];

export const PROMPTS5 = [
  "Should universities replace some lectures with online videos?",
  "Should students be graded on class participation?",
  "Should group projects be part of every course?",
  "Should universities ban phones in lectures?",
];

export const SHEETS = [
  ["S · List ideas for both sides:", "T · My side:", "O · My strongest reasons, and one 'other side' idea I can answer:", "D · My topic sentence:", "A · Supporting ideas and evidence:", "R · Other side and my answer:", "E · My conclusion:"],
  ["S", "T", "O", "D", "A", "R", "E"],
  [],
];
export const SHEET_NAME = ["Full planning sheet", "Short planning sheet (letters only)", "Blank page"];

export const STAGE_NAME = ["1 · Background knowledge", "2 · Discuss it", "3 · Model it", "4 · Memorize it", "5 · Support it", "6 · Independent"];

export const STAGE4_SESSIONS_REQUIRED = 2; // fixed: "8 of 8, twice, in separate sessions"
export const STAGE5_STREAK = 2; // pilot default (spec section 9)
