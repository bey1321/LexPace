// Business logic for the Accelerated Reading (RAP) module.
// Every number/rule in here is tied to a specific research finding
// discussed and agreed on with the team - see the comments.

const { nanoid } = require('nanoid');
const { load, save } = require('../store');

const TARGET_SESSION_COUNT = 20;       // ~20 sessions matches the studied protocols
const SENTENCES_PER_SESSION = 8;
const RECALIBRATE_EVERY_N_SESSIONS = 5;
const ACCELERATION_RATIO = 1.10;       // +10% over baseline - the one ratio the
                                       // dosage-response evidence actually supports
                                       // (20%/30% faster showed no added benefit)

const CALIBRATION_PASSAGE = {
  id: 'calibration-passage-1',
  text: `Reading is a skill that combines several separate abilities working together. `
      + `A reader has to recognize letters, connect them to sounds, and hold the `
      + `meaning of a sentence in mind long enough to link it to the next one. `
      + `For some readers, one or more of these steps takes extra effort, even `
      + `when the reader is just as intelligent and capable as anyone else. `
      + `Understanding exactly which step is harder for a given person is the `
      + `first real step toward helping them read more comfortably.`
};
CALIBRATION_PASSAGE.wordCount = CALIBRATION_PASSAGE.text.split(/\s+/).length;

function getProfile(db, userId) {
  return db.rapProfiles.find((p) => p.userId === userId) || null;
}

function upsertProfile(db, userId, patch) {
  let profile = getProfile(db, userId);
  if (!profile) {
    profile = { userId, dyslexiaProfile: 'unprofiled' };
    db.rapProfiles.push(profile);
  }
  Object.assign(profile, patch);
  return profile;
}

function wpm(wordCount, timeMs) {
  const minutes = timeMs / 60000;
  if (minutes <= 0) return 0;
  return Math.round(wordCount / minutes);
}

// ---- Calibration -----------------------------------------------------

function startCalibration() {
  return CALIBRATION_PASSAGE;
}

function submitCalibration(userId, timeMs) {
  const db = load();
  const baseline = wpm(CALIBRATION_PASSAGE.wordCount, timeMs);
  const target = Math.round(baseline * ACCELERATION_RATIO);

  const profile = upsertProfile(db, userId, {
    baselineWpm: baseline,
    baselineMeasuredAt: new Date().toISOString(),
    targetWpm: target
  });

  save(db);
  return profile;
}

// ---- Eligibility / enrollment -----------------------------------------

// Based on the double-deficit research finding: students with both a
// phonological deficit and a rapid-naming deficit together responded
// LEAST well to this kind of training, so it's offered but not pushed.
function computeEligibility(dyslexiaProfile) {
  if (!dyslexiaProfile || dyslexiaProfile === 'unprofiled') {
    return { eligibilityStatus: 'not_yet_profiled', reason: 'Complete screening first to get a tailored recommendation.' };
  }
  if (dyslexiaProfile === 'double_deficit') {
    return {
      eligibilityStatus: 'available_not_recommended',
      reason: 'Research on this specific profile found accelerated reading training helps less reliably than for other profiles. It is still available if you would like to try it.'
    };
  }
  return {
    eligibilityStatus: 'recommended',
    reason: 'Based on your screening profile, this training has published evidence of helping readers like you.'
  };
}

function getEligibility(userId) {
  const db = load();
  const profile = getProfile(db, userId);
  return computeEligibility(profile ? profile.dyslexiaProfile : 'unprofiled');
}

function enroll(userId) {
  const db = load();
  const profile = upsertProfile(db, userId, {
    enrolledAt: new Date().toISOString(),
    targetSessionCount: TARGET_SESSION_COUNT
  });
  save(db);
  return profile;
}

// ---- Sessions -----------------------------------------------------------

function getNextSession(userId) {
  const db = load();
  const profile = getProfile(db, userId);
  if (!profile || !profile.targetWpm) {
    throw new Error('Student must complete calibration before starting a session.');
  }

  const unused = db.sentencePool.filter((s) => !s.used);
  if (unused.length < SENTENCES_PER_SESSION) {
    throw new Error('Not enough unused practice sentences left in the pool - needs more content ingested.');
  }

  const chosen = unused.slice(0, SENTENCES_PER_SESSION);
  const sessionNumber = db.sessions.filter((s) => s.userId === userId).length + 1;

  const session = {
    id: nanoid(),
    userId,
    sessionNumber,
    startedAt: new Date().toISOString(),
    completedAt: null,
    targetWpmSnapshot: profile.targetWpm,
    status: 'in_progress',
    sentenceIds: chosen.map((s) => s.id),
    comprehensionTotal: 0,
    comprehensionCorrect: 0,
    actualAvgWpmAchieved: null
  };
  db.sessions.push(session);
  save(db);

  // Per-sentence reading time budget, derived from this student's target pace.
  const sentences = chosen.map((s) => ({
    id: s.id,
    text: s.text,
    keyword: s.keyword,
    wordCount: s.wordCount,
    budgetMs: Math.round((s.wordCount / profile.targetWpm) * 60000)
  }));

  return { sessionId: session.id, targetWpm: profile.targetWpm, sentences };
}

function completeSession(userId, sessionId, sentenceResults) {
  // sentenceResults: [{ sentenceId, actualTimeMs, comprehensionCorrect }]
  const db = load();
  const session = db.sessions.find((s) => s.id === sessionId && s.userId === userId);
  if (!session) throw new Error('Session not found for this student.');

  let totalWords = 0;
  let totalMs = 0;
  let correct = 0;

  sentenceResults.forEach((r) => {
    const sentence = db.sentencePool.find((s) => s.id === r.sentenceId);
    if (!sentence) return;

    sentence.used = true;
    sentence.usedInSessionId = sessionId;

    totalWords += sentence.wordCount;
    totalMs += r.actualTimeMs;
    if (r.comprehensionCorrect) correct += 1;

    db.attempts.push({
      id: nanoid(),
      sessionId,
      sentenceId: r.sentenceId,
      isCorrect: !!r.comprehensionCorrect,
      responseTimeMs: r.actualTimeMs
    });
  });

  session.completedAt = new Date().toISOString();
  session.status = 'completed';
  session.comprehensionTotal = sentenceResults.length;
  session.comprehensionCorrect = correct;
  session.actualAvgWpmAchieved = wpm(totalWords, totalMs);

  save(db);
  maybeRecalibrate(userId);

  return session;
}

// Recalibrate every Nth session using *actual* achieved reading speed,
// not by simply increasing the acceleration percentage - the evidence
// found no extra benefit above +10%, so only the baseline itself moves.
function maybeRecalibrate(userId) {
  const db = load();
  const userSessions = db.sessions
    .filter((s) => s.userId === userId && s.status === 'completed')
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  if (userSessions.length === 0 || userSessions.length % RECALIBRATE_EVERY_N_SESSIONS !== 0) {
    return;
  }

  const recent = userSessions.slice(-RECALIBRATE_EVERY_N_SESSIONS);
  const rollingWpm = Math.round(
    recent.reduce((sum, s) => sum + (s.actualAvgWpmAchieved || 0), 0) / recent.length
  );
  const rollingComprehensionPct = Math.round(
    (recent.reduce((sum, s) => sum + s.comprehensionCorrect, 0) /
      recent.reduce((sum, s) => sum + s.comprehensionTotal, 0)) * 100
  );

  const newTarget = Math.round(rollingWpm * ACCELERATION_RATIO);

  const profile = getProfile(db, userId);
  profile.baselineWpm = rollingWpm;
  profile.targetWpm = newTarget;

  db.recalibrations.push({
    userId,
    recalibratedAt: new Date().toISOString(),
    rollingWpm,
    rollingComprehensionPct,
    newTargetWpm: newTarget
  });

  save(db);
}

// ---- Progress / oversight -----------------------------------------------

function getProgress(userId) {
  const db = load();
  const profile = getProfile(db, userId);
  const sessions = db.sessions
    .filter((s) => s.userId === userId && s.status === 'completed')
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  return {
    baselineWpm: profile ? profile.baselineWpm : null,
    targetWpm: profile ? profile.targetWpm : null,
    sessionsCompleted: sessions.length,
    targetSessionCount: profile ? profile.targetSessionCount || TARGET_SESSION_COUNT : TARGET_SESSION_COUNT,
    wpmTrend: sessions.map((s) => ({ sessionNumber: s.sessionNumber, wpm: s.actualAvgWpmAchieved })),
    comprehensionTrend: sessions.map((s) => ({
      sessionNumber: s.sessionNumber,
      pct: s.comprehensionTotal ? Math.round((s.comprehensionCorrect / s.comprehensionTotal) * 100) : null
    }))
  };
}

// Deliberately returns compliance/trend only, never raw answers or content -
// same privacy-minimization principle used throughout the rest of LexPace.
function getOversightSummary(studentId) {
  const progress = getProgress(studentId);
  const db = load();
  const sessions = db.sessions.filter((s) => s.userId === studentId && s.status === 'completed');
  const lastSession = sessions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

  return {
    sessionsCompleted: progress.sessionsCompleted,
    targetSessionCount: progress.targetSessionCount,
    lastSessionDate: lastSession ? lastSession.completedAt : null,
    onTrack: progress.sessionsCompleted > 0
  };
}

module.exports = {
  startCalibration,
  submitCalibration,
  getEligibility,
  enroll,
  getNextSession,
  completeSession,
  getProgress,
  getOversightSummary
};
