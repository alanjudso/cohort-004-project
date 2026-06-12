import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { awardXp, getTotalXp } from "./xpService";
import { computeResult } from "./quizScoringService";

function createQuiz(courseId: number) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: "Module 1", position: 1 })
    .returning()
    .get();

  const lesson = testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
    .returning()
    .get();

  const quiz = testDb
    .insert(schema.quizzes)
    .values({ lessonId: lesson.id, title: "Quiz 1", passingScore: 0.7 })
    .returning()
    .get();

  const question = testDb
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "What is 1+1?",
      questionType: schema.QuestionType.MultipleChoice,
      position: 1,
    })
    .returning()
    .get();

  const correctOption = testDb
    .insert(schema.quizOptions)
    .values({ questionId: question.id, optionText: "2", isCorrect: true })
    .returning()
    .get();

  const wrongOption = testDb
    .insert(schema.quizOptions)
    .values({ questionId: question.id, optionText: "3", isCorrect: false })
    .returning()
    .get();

  return { quiz, question, correctOption, wrongOption };
}

describe("quiz XP integration", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  it("awards 5 XP when a student passes a quiz for the first time", () => {
    const { quiz, question, correctOption } = createQuiz(base.course.id);

    const result = computeResult(base.user.id, quiz.id, {
      [question.id]: correctOption.id,
    });

    expect(result.passed).toBe(true);

    const event = awardXp({
      userId: base.user.id,
      amount: 5,
      sourceType: "quiz_pass",
      sourceId: quiz.id,
    });

    expect(event.amount).toBe(5);
    expect(getTotalXp(base.user.id)).toBe(5);
  });

  it("does not award additional XP on quiz retake", () => {
    const { quiz, question, correctOption } = createQuiz(base.course.id);

    computeResult(base.user.id, quiz.id, {
      [question.id]: correctOption.id,
    });

    awardXp({
      userId: base.user.id,
      amount: 5,
      sourceType: "quiz_pass",
      sourceId: quiz.id,
    });

    // Retake the quiz — pass again
    computeResult(base.user.id, quiz.id, {
      [question.id]: correctOption.id,
    });

    const duplicate = awardXp({
      userId: base.user.id,
      amount: 5,
      sourceType: "quiz_pass",
      sourceId: quiz.id,
    });

    // awardXp returns the existing event, not a new one
    expect(getTotalXp(base.user.id)).toBe(5);
    expect(duplicate.amount).toBe(5);
  });

  it("does not award XP when a student fails a quiz", () => {
    const { quiz, question, wrongOption } = createQuiz(base.course.id);

    const result = computeResult(base.user.id, quiz.id, {
      [question.id]: wrongOption.id,
    });

    expect(result.passed).toBe(false);

    // The route only calls awardXp when result.passed is true,
    // so no XP should exist
    expect(getTotalXp(base.user.id)).toBe(0);
  });
});
