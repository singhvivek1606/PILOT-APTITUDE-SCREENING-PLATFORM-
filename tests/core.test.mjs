import test from "node:test";
import assert from "node:assert/strict";
import {
  PARAMETERS, ASSESSMENT_LIMIT, CONTROL_DURATION_SECONDS,
  difficultyForRound, studySeconds, generateMemoryRound, displayMemoryValue,
  isCorrectMemoryAnswer, evaluateMemoryAnswers, summarizeMemoryRounds,
  summarizeControl, formatTime
} from "../core.mjs";

test("module configuration and progressive difficulty", () => {
  assert.equal(PARAMETERS.length, 4);
  assert.equal(ASSESSMENT_LIMIT, 2);
  assert.equal(CONTROL_DURATION_SECONDS, 60);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => difficultyForRound("easy", i)),
    ["easy", "easy", "medium", "medium", "hard"]);
  assert.equal(studySeconds("hard"), 5);
});

test("randomized memory data has valid aviation parameter formats", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (const rng of [() => 0, () => 0.5, () => 0.999]) {
      const round = generateMemoryRound(difficulty, rng);
      assert.equal(new Set(round.targets).size, round.targets.length);
      assert.equal(round.targets.length, { easy: 1, medium: 2, hard: 4 }[difficulty]);
      assert.match(round.values.altitude, /^\d+$/);
      assert.match(round.values.speed, /^\d+$/);
      assert.match(round.values.heading, /^\d{3}$/);
      assert.match(round.values.radio, /^\d{3}\.\d{2}$/);
      assert.ok(Number(round.values.altitude) >= 3000 && Number(round.values.altitude) <= 39000);
      assert.ok(Number(round.values.speed) >= 140 && Number(round.values.speed) <= 410);
      assert.ok(Number(round.values.heading) >= 0 && Number(round.values.heading) < 360);
      assert.ok(Number(round.values.radio) >= 118 && Number(round.values.radio) < 137);
    }
  }
});

test("memory answers accept letter suffixes, commas and leading zeroes", () => {
  assert.equal(isCorrectMemoryAnswer("altitude", "12,000a", "12000"), true);
  assert.equal(isCorrectMemoryAnswer("speed", "240s", "240"), true);
  assert.equal(isCorrectMemoryAnswer("heading", "90h", "090"), true);
  assert.equal(isCorrectMemoryAnswer("radio", "121.5r", "121.50"), true);
  assert.equal(isCorrectMemoryAnswer("speed", "241s", "240"), false);
  assert.equal(isCorrectMemoryAnswer("speed", "240xyz", "240"), false);
  assert.equal(displayMemoryValue("altitude", "12000"), "12,000");
});

test("memory grading counts requested values, not displayed values", () => {
  const round = { targets: ["speed", "radio"], values: { altitude: "12000", speed: "240", heading: "090", radio: "121.50" } };
  const graded = evaluateMemoryAnswers(round, { speed: "240s", radio: "120.50" });
  assert.equal(graded.correct, 1);
  assert.equal(graded.total, 2);
  assert.deepEqual(graded.details.map(x => x.correct), [true, false]);
});

test("memory weighted score is transparent and deterministic", () => {
  const summary = summarizeMemoryRounds([
    { correct: 2, total: 2, recallSeconds: 8 },
    { correct: 1, total: 2, recallSeconds: 12 }
  ]);
  assert.equal(summary.accuracy, 75);
  assert.equal(summary.avgRecallSec, 10);
  assert.equal(summary.speedScore, 60);
  assert.equal(summary.score, 73);
  assert.equal(summarizeMemoryRounds([]).score, 0);
});

test("control scores and boundary cases are bounded", () => {
  const result = summarizeControl({ totalMs: 60000, onTargetMs: 45000, deviationIntegral: 12000, corrections: 12 });
  assert.equal(result.onTarget, 75);
  assert.equal(result.avgDeviation, 20);
  assert.equal(result.proximityScore, 80);
  assert.equal(result.smoothnessScore, 93);
  assert.equal(result.score, 78);
  assert.equal(summarizeControl({ totalMs: 0 }).score, 0);
  assert.equal(summarizeControl({ totalMs: 1000, onTargetMs: 4000 }).onTarget, 100);
});

test("timer labels stay readable", () => {
  assert.equal(formatTime(60), "01:00");
  assert.equal(formatTime(12.1), "00:13");
  assert.equal(formatTime(-5), "00:00");
});
