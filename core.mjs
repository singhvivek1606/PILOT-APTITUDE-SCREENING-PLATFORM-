// Pure test data and scoring logic. No DOM or dependencies.
export const PARAMETERS = Object.freeze([
  { key: "altitude", label: "ALTITUDE", unit: "FT", suffix: "a" },
  { key: "speed", label: "SPEED", unit: "KTS", suffix: "s" },
  { key: "heading", label: "HEADING", unit: "DEG", suffix: "h" },
  { key: "radio", label: "RADIO", unit: "MHz", suffix: "r" }
]);

export const MEMORY_ROUNDS = 5;
export const ASSESSMENT_LIMIT = 2;
export const CONTROL_DURATION_SECONDS = 60;
export const PRACTICE_CONTROL_SECONDS = 25;
export const TRIAL_CONTROL_SECONDS = 12;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function randomInt(min, max, rng) {
  return min + Math.floor(clamp(rng(), 0, 0.999999999) * (max - min + 1));
}
export function difficultyForRound(startDifficulty, index) {
  const patterns = {
    easy: ["easy", "easy", "medium", "medium", "hard"],
    medium: ["medium", "medium", "medium", "hard", "hard"],
    hard: ["hard", "hard", "hard", "hard", "hard"]
  };
  return (patterns[startDifficulty] || patterns.medium)[clamp(index, 0, MEMORY_ROUNDS - 1)];
}
export function studySeconds(difficulty) {
  return ({ easy: 8, medium: 6, hard: 5 })[difficulty] || 6;
}
export function generateMemoryRound(difficulty = "medium", rng = Math.random) {
  const altitude = String(randomInt(3, 39, rng) * 1000);
  const speed = String(randomInt(14, 41, rng) * 10);
  const heading = String(randomInt(0, 35, rng) * 10).padStart(3, "0");
  const frequency = randomInt(118, 136, rng) + randomInt(0, 3, rng) * 0.25;
  const radio = frequency.toFixed(2);
  const values = { altitude, speed, heading, radio };
  const order = PARAMETERS.map(p => p.key);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(0, i, rng);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const targetCount = ({ easy: 1, medium: 2, hard: 4 })[difficulty] || 2;
  return { difficulty, values, targets: order.slice(0, targetCount) };
}
export function displayMemoryValue(key, value) {
  if (key === "altitude") return Number(value).toLocaleString("en-US");
  return String(value);
}
export function isCorrectMemoryAnswer(key, answer, expected) {
  if (typeof answer !== "string" && typeof answer !== "number") return false;
  let clean = String(answer).trim().toLowerCase().replace(/[\s,]/g, "");
  if (clean.endsWith(key === "altitude" ? "a" : key === "speed" ? "s" : key === "heading" ? "h" : "r")) {
    clean = clean.slice(0, -1);
  }
  if (!/^\d+(\.\d+)?$/.test(clean) || !Number.isFinite(Number(clean))) return false;
  return Number(clean) === Number(expected);
}
export function evaluateMemoryAnswers(round, answers) {
  const details = round.targets.map(key => ({
    key, expected: round.values[key], actual: String(answers[key] ?? "").trim(),
    correct: isCorrectMemoryAnswer(key, answers[key], round.values[key])
  }));
  return { correct: details.filter(d => d.correct).length, total: details.length, details };
}
export function summarizeMemoryRounds(rounds) {
  const correct = rounds.reduce((sum, r) => sum + r.correct, 0);
  const total = rounds.reduce((sum, r) => sum + r.total, 0);
  const avgRecallSec = rounds.length ? rounds.reduce((sum, r) => sum + r.recallSeconds, 0) / rounds.length : 0;
  const accuracy = total ? Math.round(100 * correct / total) : 0;
  const speedScore = rounds.length ? Math.round(clamp(100 - 4 * avgRecallSec, 0, 100)) : 0;
  const score = Math.round(0.85 * accuracy + 0.15 * speedScore);
  return { score, accuracy, speedScore, avgRecallSec: Number(avgRecallSec.toFixed(1)), correct, total, rounds: rounds.length };
}
export function summarizeControl({ totalMs = 0, onTargetMs = 0, deviationIntegral = 0, corrections = 0 } = {}) {
  const safeTotal = Math.max(0, Number(totalMs) || 0);
  const safeHits = clamp(Number(onTargetMs) || 0, 0, safeTotal);
  const safeCorrections = Math.max(0, Math.floor(Number(corrections) || 0));
  const onTarget = safeTotal ? Math.round(100 * safeHits / safeTotal) : 0;
  // Deviation is normalized: 0 means dead center; 100 means one gauge-radius away.
  const avgDeviation = safeTotal ? Number((100 * Math.max(0, deviationIntegral) / safeTotal).toFixed(1)) : 0;
  const proximityScore = safeTotal ? Math.round(clamp(100 - avgDeviation, 0, 100)) : 0;
  const durationSeconds = safeTotal / 1000;
  const smoothnessScore = durationSeconds ? Math.round(clamp(100 - safeCorrections * 35 / durationSeconds, 0, 100)) : 0;
  const score = Math.round(0.60 * onTarget + 0.30 * proximityScore + 0.10 * smoothnessScore);
  return { score, onTarget, avgDeviation, corrections: safeCorrections, proximityScore, smoothnessScore, durationSeconds: Number(durationSeconds.toFixed(1)) };
}
export function formatTime(seconds) {
  const n = Math.max(0, Math.ceil(seconds));
  return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
}