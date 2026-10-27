# Configuration

Create a `.env` file yourself (it's git-ignored) with:

```
PORT=3000

# Only needed once you're ready to wire up the real LTI 1.3 launch
# (per the LMS Integration Options doc: ltijs needs a MongoDB connection
# to store platform registrations and keys). Until this is set, the
# server runs in "dev mode" using the /dev/login stub so the RAP
# feature itself can be built and demoed without a live Moodle sandbox.
# LTI_DB_URL=mongodb://localhost/lexpace
# LTI_KEY=some-long-random-secret
```
