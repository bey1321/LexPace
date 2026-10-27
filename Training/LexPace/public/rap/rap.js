// Shared client-side helpers for the RAP (Accelerated Reading) module.

// The core mechanic: progressively mask a sentence left-to-right over
// `budgetMs` milliseconds. Masked characters never reappear, which is
// what forces forward-only reading and structurally prevents the
// backward re-reading (regressions) known to be elevated in dyslexic
// readers - see the eye-tracking research discussed with the team.
function runMaskingSweep(containerEl, text, budgetMs, onComplete) {
  containerEl.innerHTML = '';
  const chars = text.split('');
  const spans = chars.map((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    containerEl.appendChild(span);
    return span;
  });

  const msPerChar = budgetMs / chars.length;
  let i = 0;

  const interval = setInterval(() => {
    if (i >= spans.length) {
      clearInterval(interval);
      onComplete();
      return;
    }
    spans[i].classList.add('masked');
    i += 1;
  }, msPerChar);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
