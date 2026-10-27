// Turns raw extracted text (from a real PDF/slide/LMS file) into candidate
// RAP practice sentences. This replaces the placeholder content in
// src/seed.js with the real pipeline sketched as /internal/rap/content/process
// in the original spec.
//
// Honesty note: sentence splitting and keyword extraction here are both
// simple heuristics, not real NLP. Good enough to prove the pipeline works
// end-to-end on real material; a production version should swap these for
// a real sentence tokenizer and a real keyword/noun-phrase extractor
// (spaCy, YAKE, RAKE, etc.) rather than the word-length heuristic below.

const { nanoid } = require('nanoid');
const { load, save } = require('../store');

const MIN_WORDS = 7;   // widened slightly from the strict 9-12 in the
const MAX_WORDS = 14;  // protocol spec, to get enough real candidates
                        // out of a modest amount of real source text

const STOPWORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'their', 'have', 'will',
  'shall', 'should', 'must', 'about', 'into', 'than', 'then', 'they',
  'them', 'what', 'when', 'where', 'while', 'which', 'these', 'those',
  'such', 'each', 'every', 'both', 'been', 'were', 'also', 'before',
  'after', 'under', 'over', 'between', 'during', 'without', 'within',
  'your', 'other', 'another', 'more', 'most', 'some', 'any', 'all',
  'there', 'here', 'only', 'even', 'just', 'like', 'make', 'made'
]);

// Naive sentence splitter: break on . ! ? followed by whitespace and a
// capital letter. Misfires on abbreviations (e.g. "Dr." or "e.g.") -
// acceptable for a first real pass, flagged here rather than hidden.
function splitIntoSentences(rawText) {
  const cleaned = rawText
    .replace(/\s*\n\s*/g, ' ')   // collapse line breaks from PDF extraction
    .replace(/[••]/g, '')    // strip bullet characters
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isUsableSentence(sentence) {
  const wordCount = sentence.split(/\s+/).length;
  if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) return false;
  // Filter out obvious non-prose fragments (table rows, headers, lone numbers)
  const letters = (sentence.match(/[A-Za-z]/g) || []).length;
  if (letters < sentence.length * 0.6) return false;
  if (!/[.!?]$/.test(sentence)) return false;
  return true;
}

// Heuristic keyword: longest non-stopword, non-trivial word in the
// sentence. Deliberately simple - see the honesty note at the top of file.
function deriveKeyword(sentence) {
  const words = sentence
    .replace(/[.,!?;:"']/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()));

  if (words.length === 0) {
    const fallback = sentence.replace(/[.,!?;:"']/g, '').split(/\s+/);
    return fallback[fallback.length - 1] || sentence;
  }

  return words.reduce((longest, w) => (w.length > longest.length ? w : longest), words[0]);
}

function extractSentenceCandidates(rawText) {
  return splitIntoSentences(rawText)
    .filter(isUsableSentence)
    .map((text) => ({
      text,
      keyword: deriveKeyword(text),
      wordCount: text.split(/\s+/).length,
      charCount: text.length
    }));
}

function ingestContent({ sourceContentId, courseId, rawText }) {
  const candidates = extractSentenceCandidates(rawText);
  const db = load();

  const existingTexts = new Set(db.sentencePool.map((s) => s.text));
  let added = 0;

  candidates.forEach((c) => {
    if (existingTexts.has(c.text)) return; // avoid duplicate ingestion
    db.sentencePool.push({
      id: nanoid(),
      sourceContentId,
      courseId,
      text: c.text,
      keyword: c.keyword,
      wordCount: c.wordCount,
      charCount: c.charCount,
      used: false,
      usedInSessionId: null
    });
    added += 1;
  });

  save(db);
  return { candidatesFound: candidates.length, added, skippedDuplicates: candidates.length - added };
}

module.exports = { extractSentenceCandidates, ingestContent };
