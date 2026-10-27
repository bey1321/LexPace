require('dotenv').config();
const express = require('express');
const path = require('path');

const { attachAuth } = require('./lti');
const rapRoutes = require('./routes/rap');
const contentRoutes = require('./routes/content');
const { run: ingestRealCourseMaterial } = require('./ingestRealCourseMaterial');

// Real ingestion pipeline running on actual CSCI 450 syllabus prose,
// replacing the placeholder seed.js sample sentences.
ingestRealCourseMaterial();

const app = express();
app.use(express.json());
attachAuth(app);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/rap', rapRoutes);
app.use('/internal/rap', contentRoutes);

app.get('/', (req, res) => {
  res.send(
    '<h1>LexPace (dev build)</h1>' +
    '<p>No live LMS connected yet, so this is dev mode.</p>' +
    '<p><a href="/dev/login">Simulate an LTI launch</a> to try the Accelerated Reading module.</p>'
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[LexPace] listening on http://localhost:${PORT}`);
});
