// Real test of the ingestion pipeline, using actual prose extracted from
// the CSCI 450 (Information Security and Privacy) syllabus you shared -
// genuine university material, not invented demo text. Only the prose
// sections are included here; the weekly schedule table and PLO/CLO
// mapping tables were deliberately left out, since the pipeline filters
// for real sentences, not table fragments (see isUsableSentence()).

const { ingestContent } = require('./services/contentIngestionService');

const CSCI_450_RAW_TEXT = `
This course is a survey of information security considerations as they apply to information
systems analysis, design, and operations. Topics include information security vulnerabilities,
threats, and risk management. Furthermore, the course introduces several cryptographic
algorithms in addition to the privacy and secrecy of statistical databases and e-government
applications.

AURAK students are expected to attend all learning and teaching sessions associated with
the courses in which they are enrolled. Students must notify their course instructors in advance
that they will be absent from scheduled class sessions. Students must obtain prior permission
from their instructors for planned absences of two or more consecutive class sessions.

Students with disabilities may find they require additional support, services, or considerations.
AURAK will endeavor to support students with disabilities where resources are available.
Disability accommodations are never applied retroactively to a given academic semester.
Students needing support must make the request from the Department of Counseling.

The American University of Ras Al Khaimah strongly supports the concept of academic
integrity. The Honor Code is an integral part of university life at the university. Students
are responsible for understanding and abiding by the code's provisions. Cheating, plagiarism,
and all other forms of academic fraud are unacceptable at this university.

Plagiarism submitting the work of others as one's own is a serious offense. In the academic
world, plagiarism is considered a form of theft. Information from sources must be given
credit through specific citations in every case. Merely rearranging a sentence or changing
a few words is not sufficient. All sources used in an academic paper must be listed with
full bibliographic details at the end.

Every student, faculty member, and administrator is responsible for upholding the highest
standards of academic integrity at AURAK. It is the responsibility of the instructor to provide
students with additional guidelines. Students are required to obtain permission prior to
submitting work that was previously submitted elsewhere.

University policy is that assignments are due on the date assigned. Instructors may refuse
to accept late assignments or lower the grade. All mobile phones and other communication
devices should be turned off before entering the classroom. Students may not have a mobile
telephone in their possession while completing examinations.

English is the common language of the AURAK campus for everyone. AURAK brings together
students and faculty from diverse cultural and linguistic backgrounds. This diversity provides
an opportunity to share different experiences and enlarge understanding of the world.
`;

function run() {
  const result = ingestContent({
    sourceContentId: 'csci450-syllabus-2026',
    courseId: 'csci450',
    rawText: CSCI_450_RAW_TEXT
  });
  console.log('Real-content ingestion result:', result);
}

module.exports = { run, CSCI_450_RAW_TEXT };

if (require.main === module) run();
