// Authentication wiring.
//
// Real path: ltijs handles the LTI 1.3 launch from Moodle/Canvas/Blackboard
// (per the LMS Integration Options doc) and tells us who the student is.
// That needs a MongoDB connection and a registered platform, neither of
// which exist in this local build yet.
//
// Dev path: when LTI_DB_URL isn't set, we skip ltijs entirely (so there is
// zero risk of it crashing the server on startup) and use a trivial
// /dev/login stub that sets the same req.user shape ltijs would have
// produced, so every route downstream behaves identically either way.

const cookieParser = require('cookie-parser');

function attachDevLogin(app) {
  app.use(cookieParser());

  app.get('/dev/login', (req, res) => {
    const id = req.query.userId || 'demo-student-1';
    const courseId = req.query.course || 'demo-course';
    const role = req.query.role || 'student';
    const payload = Buffer.from(JSON.stringify({ id, courseId, role })).toString('base64');
    res.cookie('lx_user', payload, { httpOnly: true });
    res.redirect('/rap/calibration.html');
  });

  app.use((req, res, next) => {
    const cookie = req.cookies && req.cookies.lx_user;
    if (cookie) {
      try {
        req.user = JSON.parse(Buffer.from(cookie, 'base64').toString('utf-8'));
      } catch (e) {
        req.user = null;
      }
    }
    next();
  });

  console.log('[LexPace] Running in DEV MODE - visit /dev/login to simulate an LTI launch.');
  console.log('[LexPace] Set LTI_DB_URL in .env to wire up a real Moodle/Canvas/Blackboard launch.');
}

function attachRealLti(app) {
  // Sketch of the real wiring, matching the team's documented plan
  // (ltijs + a ready-made library, launched in a new window to avoid
  // third-party cookie restrictions). Left commented out because it
  // needs a live MongoDB connection string and a registered platform
  // to actually run - fill in and uncomment once that's available.
  //
  // const { Provider: lti } = require('ltijs');
  // lti.setup(process.env.LTI_KEY, { url: process.env.LTI_DB_URL }, {
  //   appUrl: '/lti/launch',
  //   loginUrl: '/lti/login'
  // });
  // lti.onConnect((token, req, res) => {
  //   req.user = { id: token.user, courseId: token.platformContext.context.id, role: 'student' };
  //   return res.sendFile(/* path to rap/calibration.html */);
  // });
  // app.use(lti.app);
  // lti.deploy({ app });

  throw new Error('Real LTI wiring is sketched but not active yet - see comments in src/lti.js.');
}

function attachAuth(app) {
  if (process.env.LTI_DB_URL) {
    attachRealLti(app);
  } else {
    attachDevLogin(app);
  }
}

module.exports = { attachAuth };
