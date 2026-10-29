// Acceptance test 2 (Number Sense Practice spec, section 9): "zero violations across at
// least 100,000 generated items, covering every number type x task." No test framework is
// configured in this project yet, so this runs as a plain script:
//   node frontend/src/pages/lexpace/training/numbersense/validate.js
import { SKILLS, TASKS, make, validateItem } from "./engine.js";

const PER_COMBO = 4000; // 7 types x 4 tasks x 4000 = 112,000 items
let total = 0, failed = 0;

for (const skill of SKILLS) {
  for (const task of TASKS) {
    for (let i = 0; i < PER_COMBO; i++) {
      total++;
      const it = make(skill.id, task);
      const errors = validateItem(it);
      if (errors.length) {
        failed++;
        if (failed <= 10) console.error(`[${skill.id}/${task}] ${errors.join("; ")}`, JSON.stringify(it));
      }
    }
  }
}

console.log(`${total} items generated, ${failed} violated an item rule.`);
if (failed > 0) process.exit(1);
