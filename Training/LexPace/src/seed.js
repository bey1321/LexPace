// Seeds a small sample sentence pool so the RAP feature is demoable
// without the real lecture-content ingestion pipeline being built yet.
// Each real deployment would instead populate sentencePool from
// POST /internal/rap/content/process whenever new course material
// is processed by the rest of LexPace.

const { nanoid } = require('nanoid');
const { load, save } = require('./store');

const SAMPLE_SENTENCES = [
  { text: 'The cell membrane controls what enters and leaves the cell.', keyword: 'cell membrane' },
  { text: 'Supply and demand together determine the market price of a good.', keyword: 'supply and demand' },
  { text: 'Newton observed that every action produces an equal and opposite reaction.', keyword: 'Newton' },
  { text: 'The French Revolution began in the year seventeen eighty nine.', keyword: 'French Revolution' },
  { text: 'Photosynthesis converts sunlight into chemical energy stored in glucose.', keyword: 'photosynthesis' },
  { text: 'A balanced chemical equation has the same atoms on both sides.', keyword: 'chemical equation' },
  { text: 'The hippocampus plays a key role in forming new memories.', keyword: 'hippocampus' },
  { text: 'Courts rely on precedent to decide how similar cases should be resolved.', keyword: 'precedent' },
  { text: 'Sound waves travel faster through water than they do through air.', keyword: 'sound waves' },
  { text: 'The mitochondria generate most of the energy a cell needs to function.', keyword: 'mitochondria' },
  { text: 'Inflation measures how quickly prices rise across an entire economy.', keyword: 'inflation' },
  { text: 'Shakespeare wrote most of his plays during the late fifteen hundreds.', keyword: 'Shakespeare' },
  { text: 'Enzymes speed up chemical reactions without being consumed themselves.', keyword: 'enzymes' },
  { text: 'The three branches of government check and balance each other.', keyword: 'branches of government' },
  { text: 'Glaciers carve valleys by slowly grinding rock as they move.', keyword: 'glaciers' }
];

function seed() {
  const db = load();
  if (db.sentencePool.length > 0) return; // already seeded

  db.sentencePool = SAMPLE_SENTENCES.map(({ text, keyword }) => ({
    id: nanoid(),
    sourceContentId: 'sample-course-reading',
    courseId: 'demo-course',
    text,
    keyword,
    wordCount: text.split(/\s+/).length,
    charCount: text.length,
    used: false,
    usedInSessionId: null
  }));

  save(db);
  console.log(`Seeded ${db.sentencePool.length} sample sentences.`);
}

module.exports = { seed };
