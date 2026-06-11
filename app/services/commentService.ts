import { eq, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  lessonComments,
  users,
  courses,
  lessons,
  modules,
  UserRole,
} from "~/db/schema";

import { COMMENT_MAX_LENGTH } from "./commentConstants";

export { COMMENT_MAX_LENGTH };

export type CommentWithAuthor = {
  id: number;
  lessonId: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: UserRole;
};

export function listCommentsForLesson(lessonId: number): CommentWithAuthor[] {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      content: lessonComments.content,
      createdAt: lessonComments.createdAt,
      updatedAt: lessonComments.updatedAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(lessonComments)
    .innerJoin(users, eq(users.id, lessonComments.userId))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(desc(lessonComments.createdAt))
    .all() as CommentWithAuthor[];
}

export function createComment(
  lessonId: number,
  userId: number,
  content: string
) {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comment exceeds ${COMMENT_MAX_LENGTH} characters`);
  }

  return db
    .insert(lessonComments)
    .values({ lessonId, userId, content: trimmed })
    .returning()
    .get();
}

export function getCommentById(id: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, id))
    .get();
}

export function getInstructorIdForLesson(lessonId: number): number | null {
  const row = db
    .select({ instructorId: courses.instructorId })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(lessons.id, lessonId))
    .get();
  return row?.instructorId ?? null;
}

export function editComment(opts: {
  commentId: number;
  actingUserId: number;
  content: string;
}):
  | { ok: true; data: typeof lessonComments.$inferSelect }
  | { ok: false; error: string } {
  const comment = getCommentById(opts.commentId);
  if (!comment) return { ok: false, error: "Comment not found" };
  if (comment.deletedAt)
    return { ok: false, error: "Cannot edit a deleted comment" };
  if (comment.userId !== opts.actingUserId)
    return { ok: false, error: "Not authorized to edit this comment" };

  const trimmed = opts.content.trim();
  if (trimmed.length === 0)
    return { ok: false, error: "Comment cannot be empty" };
  if (trimmed.length > COMMENT_MAX_LENGTH)
    return {
      ok: false,
      error: `Comment exceeds ${COMMENT_MAX_LENGTH} characters`,
    };

  const updated = db
    .update(lessonComments)
    .set({ content: trimmed, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, opts.commentId))
    .returning()
    .get();

  return { ok: true, data: updated };
}

export function softDeleteComment(
  commentId: number,
  actingUserId: number,
  actingUserRole: UserRole
) {
  const comment = getCommentById(commentId);
  if (!comment) return null;
  if (comment.deletedAt) return comment;

  const isAuthor = comment.userId === actingUserId;
  const isAdmin = actingUserRole === UserRole.Admin;
  const instructorId =
    isAuthor || isAdmin ? null : getInstructorIdForLesson(comment.lessonId);
  const isInstructor = instructorId === actingUserId;

  if (!isAuthor && !isAdmin && !isInstructor) {
    return null;
  }

  return db
    .update(lessonComments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}
