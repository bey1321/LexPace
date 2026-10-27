const express = require('express');
const rapService = require('../services/rapService');

const router = express.Router();

// All routes expect req.user to already be set by the LTI launch
// (or the /dev/login stub in dev mode) - see src/lti.js.
function requireUser(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Not authenticated - launch LexPace from the course first.' });
  }
  next();
}

router.use(requireUser);

router.post('/calibration/start', (req, res) => {
  res.json(rapService.startCalibration());
});

router.post('/calibration/submit', (req, res) => {
  const { timeMs } = req.body;
  if (!timeMs || timeMs <= 0) {
    return res.status(400).json({ error: 'timeMs is required and must be positive.' });
  }
  const profile = rapService.submitCalibration(req.user.id, timeMs);
  res.json(profile);
});

router.get('/eligibility', (req, res) => {
  res.json(rapService.getEligibility(req.user.id));
});

router.post('/enroll', (req, res) => {
  res.json(rapService.enroll(req.user.id));
});

router.get('/session/next', (req, res) => {
  try {
    res.json(rapService.getNextSession(req.user.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/session/:id/complete', (req, res) => {
  try {
    const session = rapService.completeSession(req.user.id, req.params.id, req.body.sentenceResults || []);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/progress', (req, res) => {
  res.json(rapService.getProgress(req.user.id));
});

// Role-gated in a real deployment (SAS staff / advisor only).
// Left open here for demo purposes - add real role checking before
// this ever touches real student data.
router.get('/oversight/:studentId', (req, res) => {
  res.json(rapService.getOversightSummary(req.params.studentId));
});

module.exports = router;
