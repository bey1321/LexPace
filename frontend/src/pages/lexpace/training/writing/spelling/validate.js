// Acceptance test 4 (Writing Practice spec, section 10): error classification matches the
// prototype on a test set, and flash time changes exactly as specified. Run with:
//   node frontend/src/pages/lexpace/training/writing/spelling/validate.js
import * as CFG from "./config.js";
import { classify, nextFlash, norm } from "./engine.js";

let failed = 0;
function check(name, got, want) {
  if (got !== want) { failed++; console.error(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
}

check("recieve -> pattern", classify("receive", norm("recieve")), "pattern");
check("responsability -> word part", classify("responsibility", norm("responsability")), "part");
check("enviroment -> sound", classify("environment", norm("enviroment")), "sound");

let f = nextFlash(CFG.START_FLASH_MS, 0.9, CFG); check("above 80% -> faster by FLASH_STEP", f.flash, CFG.START_FLASH_MS - CFG.FLASH_STEP_MS);
f = nextFlash(CFG.START_FLASH_MS, 0.8, CFG); check("exactly 80% -> not above, so slower", f.flash, CFG.START_FLASH_MS + CFG.FLASH_STEP_MS);
f = nextFlash(CFG.FLASH_MIN_MS, 1.0, CFG); check("clamps at FLASH_MIN", f.flash, CFG.FLASH_MIN_MS);
f = nextFlash(CFG.FLASH_MAX_MS, 0.0, CFG); check("clamps at FLASH_MAX", f.flash, CFG.FLASH_MAX_MS);

console.log(failed === 0 ? "\nAll spelling checks passed." : `\n${failed} check(s) failed.`);
if (failed > 0) process.exit(1);
