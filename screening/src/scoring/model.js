// Runs the model exported by ml/train.py (multinomial logistic regression) in the browser
// or in Node. No library needed: scale the features, multiply by the weights, softmax.

export function predict(model, features) {
  const x = model.features.map((k, i) => {
    const v = features[k] ?? model.mean[i];
    return (v - model.mean[i]) / (model.scale[i] || 1);
  });
  const z = model.coef.map((w, c) => model.intercept[c] + w.reduce((s, wi, i) => s + wi * x[i], 0));
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const sum = e.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(model.classes.map((c, i) => [c, e[i] / sum]));
  const top = model.classes.reduce((a, b) => (probs[b] > probs[a] ? b : a));
  return { probs, top, risk: 1 - (probs.none ?? 0), trainedOn: model.meta?.trained_on ?? "unknown" };
}
