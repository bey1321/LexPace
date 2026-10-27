// Minimal file-based JSON store.
// Chosen deliberately over something like better-sqlite3 to avoid any
// native-module build step on a fresh machine (sqlite needs node-gyp /
// a C++ toolchain; this doesn't). Good enough for a hackathon build;
// swap for a real database before any real deployment.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

const EMPTY_DB = {
  rapProfiles: [],       // one per user
  sentencePool: [],      // candidate practice sentences
  sessions: [],          // rap_session rows
  attempts: [],          // rap_sentence_attempt rows
  recalibrations: [],    // rap_recalibration_log rows
  oversightLinks: []     // rap_oversight_link rows
};

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { load, save };
