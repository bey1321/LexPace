// Placeholder sentence-combining bank, ported from the approved prototype. Spec section 3a's
// preparation flow (Generator AI -> Checker AI -> staff approval) is not built in this pass -
// same deferral as the other trainings' preparation flows. Also per spec section 0, the
// 5-item "skip check" is explicitly NOT built, so only the four levels exist here.

function I(k, cue, acc, rule) { return { k, cue, acc, rule }; }

export const R1 = "Join two complete sentences with a comma before and, but, or or so.";
export const R2 = "Words like because, although, when and after join a main idea and a linked idea. If the sentence starts with the linked part, put a comma after it.";
export const R3 = "Use who for people and which for things to add information. Put commas around extra information; use that (no commas) when the information is needed to say which one.";
export const R4 = "A short phrase can rename a noun (Dr. Lee, a psychologist, …) or start the sentence with an -ing word (Using survey data, …). Put commas around the renaming phrase and after the opening phrase.";

export const LEVELS = [
  { name: "Level 1 · and, but, or, so", items: [
    I(["The survey was short.", "Most students completed it."], "and", ["The survey was short, and most students completed it."], R1),
    I(["The sample was large.", "It was not random."], "but", ["The sample was large, but it was not random."], R1),
    I(["Students can submit online.", "They can submit in person."], "or", ["Students can submit online, or they can submit in person.", "Students can submit online or in person."], R1),
    I(["The lecture ended early.", "The lab started on time."], "but", ["The lecture ended early, but the lab started on time."], R1),
    I(["The data were collected in May.", "They were analysed in June."], "and", ["The data were collected in May, and they were analysed in June.", "The data were collected in May and analysed in June."], R1),
  ] },
  { name: "Level 2 · because, although, when, after", items: [
    I(["The results were weak.", "The sample was small."], "because", ["The results were weak because the sample was small.", "Because the sample was small, the results were weak."], R2),
    I(["The method was simple.", "It produced reliable data."], "although", ["Although the method was simple, it produced reliable data.", "Although it was simple, the method produced reliable data."], R2),
    I(["Participants finished the task.", "They completed a questionnaire."], "when", ["When participants finished the task, they completed a questionnaire.", "Participants completed a questionnaire when they finished the task."], R2),
    I(["The essay lost marks.", "It had no references."], "because", ["The essay lost marks because it had no references.", "Because it had no references, the essay lost marks."], R2),
    I(["Students read the article.", "They wrote a summary."], "after", ["After students read the article, they wrote a summary.", "Students wrote a summary after they read the article."], R2),
  ] },
  { name: "Level 3 · who, which, that", items: [
    I(["The author studied 200 schools.", "The author argues for smaller classes."], "who", ["The author, who studied 200 schools, argues for smaller classes.", "The author who studied 200 schools argues for smaller classes."], R3),
    I(["The report was published in 2020.", "The report shows a decline."], "which", ["The report, which was published in 2020, shows a decline."], R3),
    I(["Students need a strategy.", "The strategy fits the task."], "that", ["Students need a strategy that fits the task."], R3),
    I(["The theory explains memory.", "The theory has limits."], "which", ["The theory, which explains memory, has limits."], R3),
    I(["Researchers interviewed teachers.", "The teachers had ten years of experience."], "who", ["Researchers interviewed teachers who had ten years of experience."], R3),
  ] },
  { name: "Level 4 · renaming and -ing phrases (no hint)", items: [
    I(["Dr. Lee found a link.", "Dr. Lee is a psychologist."], null, ["Dr. Lee, a psychologist, found a link.", "A psychologist, Dr. Lee found a link."], R4),
    I(["The study used survey data.", "The study found a clear trend."], null, ["Using survey data, the study found a clear trend."], R4),
    I(["The professor gave clear feedback.", "The professor is an expert in writing."], null, ["The professor, an expert in writing, gave clear feedback.", "An expert in writing, the professor gave clear feedback."], R4),
    I(["The team compared two groups.", "The team found no difference."], null, ["Comparing two groups, the team found no difference."], R4),
    I(["The essay was written in one week.", "The essay received high marks."], null, ["Written in one week, the essay received high marks.", "The essay, written in one week, received high marks."], R4),
  ] },
];
