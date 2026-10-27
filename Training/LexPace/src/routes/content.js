const express = require('express');
const { ingestContent } = require('../services/contentIngestionService');

const router = express.Router();

// Internal, not student-facing - triggered whenever new course material
// lands in LexPace's main content pipeline (per the original spec). No
// auth gate here yet since it's not reachable from the public routes in
// this build - add service-to-service auth before this is ever exposed
// outside the server itself.
router.post('/content/process', (req, res) => {
  const { sourceContentId, courseId, rawText } = req.body;
  if (!sourceContentId || !courseId || !rawText) {
    return res.status(400).json({ error: 'sourceContentId, courseId, and rawText are all required.' });
  }
  const result = ingestContent({ sourceContentId, courseId, rawText });
  res.json(result);
});

module.exports = router;
