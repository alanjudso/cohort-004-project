import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import { eq } from "drizzle-orm";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  listCommentsForLesson,
  createComment,
  editComment,
  softDeleteComment,
  COMMENT_MAX_LENGTH,
} from "./commentService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let lessonId: number;

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson(mod.id, "L1", null, null, 1, null);
    lessonId = lesson.id;
  });

  describe("createComment", () => {
    it("creates a comment with trimmed content", () => {
      const c = createComment(lessonId, base.user.id, "  hello  ");
      expect(c.content).toBe("hello");
      expect(c.lessonId).toBe(lessonId);
      expect(c.userId).toBe(base.user.id);
      expect(c.deletedAt).toBeNull();
    });

    it("rejects empty content", () => {
      expect(() => createComment(lessonId, base.user.id, "   ")).toThrow();
    });

    it("rejects content over the limit", () => {
      const long = "a".repeat(COMMENT_MAX_LENGTH + 1);
      expect(() => createComment(lessonId, base.user.id, long)).toThrow();
    });
  });

  describe("listCommentsForLesson", () => {
    it("returns comments newest-first with author info", () => {
      const a = createComment(lessonId, base.user.id, "first");
      testDb
        .update(schema.lessonComments)
        .set({ createdAt: "2026-01-01T00:00:00Z" })
        .where(eq(schema.lessonComments.id, a.id))
        .run();
      const b = createComment(lessonId, base.instructor.id, "second");

      const list = listCommentsForLesson(lessonId);
      expect(list.map((c) => c.id)).toEqual([b.id, a.id]);
      expect(list[1].authorName).toBe(base.user.name);
      expect(list[0].authorRole).toBe(schema.UserRole.Instructor);
    });

    it("includes updatedAt field", () => {
      createComment(lessonId, base.user.id, "hello");
      const list = listCommentsForLesson(lessonId);
      expect(list[0]).toHaveProperty("updatedAt");
      expect(list[0].updatedAt).toBeNull();
    });

    it("includes soft-deleted comments (renderable as [deleted])", () => {
      const c = createComment(lessonId, base.user.id, "oops");
      softDeleteComment(c.id, base.user.id, schema.UserRole.Student);
      const list = listCommentsForLesson(lessonId);
      expect(list).toHaveLength(1);
      expect(list[0].deletedAt).not.toBeNull();
    });
  });

  describe("editComment", () => {
    it("lets author edit their own comment", () => {
      const c = createComment(lessonId, base.user.id, "original");
      const result = editComment({
        commentId: c.id,
        actingUserId: base.user.id,
        content: "updated",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.content).toBe("updated");
        expect(result.data.updatedAt).not.toBeNull();
      }
    });

    it("trims whitespace on edit", () => {
      const c = createComment(lessonId, base.user.id, "original");
      const result = editComment({
        commentId: c.id,
        actingUserId: base.user.id,
        content: "  trimmed  ",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.content).toBe("trimmed");
      }
    });

    it("refuses edit by non-author", () => {
      const c = createComment(lessonId, base.user.id, "mine");
      const result = editComment({
        commentId: c.id,
        actingUserId: base.instructor.id,
        content: "hijack",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Not authorized");
      }
    });

    it("refuses edit on deleted comment", () => {
      const c = createComment(lessonId, base.user.id, "doomed");
      softDeleteComment(c.id, base.user.id, schema.UserRole.Student);
      const result = editComment({
        commentId: c.id,
        actingUserId: base.user.id,
        content: "revive",
      });
      expect(result.ok).toBe(false);
    });

    it("rejects empty content", () => {
      const c = createComment(lessonId, base.user.id, "original");
      const result = editComment({
        commentId: c.id,
        actingUserId: base.user.id,
        content: "   ",
      });
      expect(result.ok).toBe(false);
    });

    it("rejects content over the limit", () => {
      const c = createComment(lessonId, base.user.id, "original");
      const result = editComment({
        commentId: c.id,
        actingUserId: base.user.id,
        content: "a".repeat(COMMENT_MAX_LENGTH + 1),
      });
      expect(result.ok).toBe(false);
    });

    it("returns error for unknown comment", () => {
      const result = editComment({
        commentId: 999999,
        actingUserId: base.user.id,
        content: "ghost",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("softDeleteComment", () => {
    it("lets author delete own comment", () => {
      const c = createComment(lessonId, base.user.id, "mine");
      const res = softDeleteComment(
        c.id,
        base.user.id,
        schema.UserRole.Student
      );
      expect(res?.deletedAt).not.toBeNull();
    });

    it("lets the course instructor delete any comment on the lesson", () => {
      const c = createComment(lessonId, base.user.id, "mine");
      const res = softDeleteComment(
        c.id,
        base.instructor.id,
        schema.UserRole.Instructor
      );
      expect(res?.deletedAt).not.toBeNull();
    });

    it("lets an admin delete any comment", () => {
      const admin = testDb
        .insert(schema.users)
        .values({
          name: "Admin",
          email: "admin@example.com",
          role: schema.UserRole.Admin,
        })
        .returning()
        .get();
      const c = createComment(lessonId, base.user.id, "mine");
      const res = softDeleteComment(c.id, admin.id, schema.UserRole.Admin);
      expect(res?.deletedAt).not.toBeNull();
    });

    it("refuses delete by an unrelated student", () => {
      const other = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      const c = createComment(lessonId, base.user.id, "mine");
      const res = softDeleteComment(c.id, other.id, schema.UserRole.Student);
      expect(res).toBeNull();
    });

    it("returns null for unknown comment", () => {
      const res = softDeleteComment(
        999999,
        base.user.id,
        schema.UserRole.Student
      );
      expect(res).toBeNull();
    });
  });
});
