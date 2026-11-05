// Placeholder sentence bank, ported from the approved prototype's hard-coded examples.
// Spec section 0: "The hard-coded sentences are examples. Replace them with the bank from
// flow 3a." Flow 3a (course files -> extract -> Generator AI -> Checker AI -> SAS approval)
// is not built in this pass, so this is clearly-flagged placeholder content, not real course
// material. Each sentence keeps its `seen` field from the prototype, but nothing in this
// build reads it yet - Fix B (prior-exposure tagging via the LMS activity log) is explicitly
// deferred, so `seen` is inert data here, not real tagging.

function I(s, src, seen, q, o, c) { return { s, src, seen, q, o, c }; }

export const PRACTICE = [
  I("Good academic writing states its main claim clearly in the introduction.", "Practice", false,
    "Where should the main claim be stated?", ["In the conclusion", "In the introduction", "In the reference list", "Only in the title"], 1),
  I("Writers cite sources so readers can check where information came from.", "Practice", false,
    "Why do writers cite sources?", ["So readers can check where information came from", "So the essay becomes longer", "So readers can check the writer's grammar", "So the writer can skip the conclusion"], 0),
];

export const BASELINE = [
  I("The writing centre asks students to book tutorials two days ahead.", "Week 1 · Course guide", false, "How far ahead should students book a tutorial?", ["One day ahead", "Two days ahead", "One week ahead", "On the same day"], 1),
  I("The first draft should be half the length of the final essay.", "Week 1 · Course guide", false, "How long should the first draft be?", ["Half the length of the final essay", "The same length as the final essay", "A quarter of the final essay", "Twice the length of the final essay"], 0),
  I("In this course every essay must use at least four scholarly sources.", "Week 1 · Assessment overview", true, "How many scholarly sources must every essay use?", ["At least two", "Exactly four", "At least four", "At least six"], 2),
  I("Late essays lose five percent of the grade for each late day.", "Week 1 · Assessment overview", false, "What happens to a late essay?", ["It loses ten percent per late day", "It loses five percent in total", "It cannot be submitted", "It loses five percent per late day"], 3),
  I("Students revise their thesis statement after receiving feedback from two classmates.", "Week 2 · Drafting the thesis", false, "When do students revise their thesis statement?", ["After feedback from the instructor", "After feedback from two classmates", "Before writing the introduction", "After the final grade is released"], 1),
  I("The reflective journal is written weekly and is not graded for grammar.", "Week 2 · Reflective journal", false, "What is true about the reflective journal?", ["It is written monthly", "It is written weekly and graded for grammar", "It is written weekly and not graded for grammar", "It replaces the final essay"], 2),
  I("Quotations longer than forty words are set as an indented block.", "Week 3 · Using quotations", false, "How are quotations longer than forty words shown?", ["As an indented block", "In bold text", "In a footnote", "In quotation marks only"], 0),
  I("The library's research guide lists databases for each subject on campus.", "Week 1 · Library orientation", true, "What does the library's research guide list?", ["Opening hours for each campus", "Tutors for each course", "Databases for each subject", "Past exam papers"], 2),
  I("Group presentations in week ten must last no longer than twelve minutes.", "Week 4 · Presentation brief", false, "How long may the week ten group presentations last?", ["Up to ten minutes", "At least twelve minutes", "Up to twenty minutes", "Up to twelve minutes"], 3),
  I("An annotated bibliography summarises each source and explains why it is useful.", "Week 4 · Annotated bibliography", false, "What does an annotated bibliography do for each source?", ["Lists only its title and author", "Summarises it and explains why it is useful", "Summarises it without any comment", "Copies its abstract"], 1),
  I("The final portfolio combines your best essay with two revised journal entries.", "Week 5 · Portfolio guide", false, "What does the final portfolio combine?", ["All essays and all journal entries", "Your best essay and one presentation", "Your best essay and two revised journal entries", "Two essays and one journal entry"], 2),
  I("Instructors return marked drafts within one week through the course site.", "Week 5 · Feedback policy", false, "How are marked drafts returned?", ["Within one week, by email", "Within one week, through the course site", "Within two weeks, through the course site", "In class, after two weeks"], 1),
];

export const BASELINE_EXTRA = [
  I("Each tutorial session lasts thirty minutes and focuses on one writing goal.", "Week 5 · Writing centre", false, "How long is each tutorial session?", ["Fifteen minutes", "Forty-five minutes", "Thirty minutes", "One hour"], 2),
  I("Peer review comments must point to one strength and one weakness.", "Week 5 · Peer review guide", false, "What must peer review comments point to?", ["Two weaknesses", "Only strengths", "Grammar mistakes only", "One strength and one weakness"], 3),
  I("The midterm essay compares two articles that take opposite positions.", "Week 6 · Midterm brief", false, "What does the midterm essay compare?", ["Two articles that take opposite positions", "Two articles that agree", "One article and one book", "Three articles on one topic"], 0),
  I("Students may resubmit one essay after discussing the feedback with their tutor.", "Week 6 · Feedback policy", false, "When may students resubmit an essay?", ["After the final exam", "After discussing feedback with their tutor", "Whenever they like", "After two classmates approve it"], 1),
];

export const TRAINING = [
  I("The week six essay answers one counterargument with two pieces of evidence.", "Week 6 · Responding to opposing views", false, "How many pieces of evidence answer the counterargument in the week six essay?", ["One", "Two", "Three", "Four"], 1),
  I("Paraphrase quizzes in week three are open book and take twenty minutes.", "Week 3 · Using sources", true, "How long does a week three paraphrase quiz take?", ["Ten minutes", "Twenty minutes", "Thirty minutes", "Forty minutes"], 1),
  I("Each paragraph draft is checked by a tutor before the class discussion.", "Week 6 · Paragraph structure", false, "Who checks each paragraph draft before the class discussion?", ["A classmate", "A tutor", "The librarian", "The student alone"], 1),
  I("Students search two library databases before choosing sources for their essay.", "Week 7 · Finding scholarly sources", false, "How many library databases do students search before choosing sources?", ["One", "Two", "Three", "Five"], 1),
  I("The academic tone workshop runs on Tuesday afternoons in the main library.", "Week 7 · Academic tone", false, "When does the academic tone workshop run?", ["Monday mornings", "Tuesday afternoons", "Tuesday mornings", "Thursday afternoons"], 1),
  I("Each body paragraph in the first essay stays under two hundred words.", "Week 2 · Essay structure", true, "What is the length limit for each body paragraph in the first essay?", ["Under one hundred words", "Under two hundred words", "Over two hundred words", "Under three hundred words"], 1),
  I("Conclusions in this course end with one question for future research.", "Week 8 · Writing conclusions", false, "How should conclusions in this course end?", ["With a quotation", "With one question for future research", "With a summary table", "With two new sources"], 1),
  I("The citation workshop recording stays on the course site for two weeks.", "Week 8 · Citation workshop", false, "How long does the workshop recording stay on the course site?", ["Two days", "One week", "Two weeks", "Until the final exam"], 2),
];

export const TRAINING_RESERVE = [
  I("Feedback on the outline focuses on structure rather than on grammar.", "Week 8 · Outline feedback", false, "What does feedback on the outline focus on?", ["Grammar", "Structure", "Spelling", "Citations"], 1),
  I("Students present their research question to the class in week nine.", "Week 9 · Research proposal", false, "When do students present their research question?", ["Week seven", "Week eight", "Week nine", "Week ten"], 2),
  I("The research proposal must name one database and three possible sources.", "Week 9 · Research proposal", false, "How many possible sources must the research proposal name?", ["One", "Two", "Three", "Four"], 2),
];
