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

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", () => {
      const n = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "New Enrollment",
        "Alice enrolled in Test Course",
        "/instructor/1/students"
      );

      expect(n).toBeDefined();
      expect(n.recipientUserId).toBe(base.instructor.id);
      expect(n.type).toBe(schema.NotificationType.Enrollment);
      expect(n.title).toBe("New Enrollment");
      expect(n.message).toBe("Alice enrolled in Test Course");
      expect(n.linkUrl).toBe("/instructor/1/students");
      expect(n.isRead).toBe(false);
      expect(n.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications ordered newest first", () => {
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "First", "msg1", "/a");
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "Second", "msg2", "/b");

      const list = getNotifications(base.instructor.id, 10, 0);
      expect(list[0].title).toBe("Second");
      expect(list[1].title).toBe("First");
    });

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        createNotification(base.instructor.id, schema.NotificationType.Enrollment, `N${i}`, "msg", "/x");
      }

      const list = getNotifications(base.instructor.id, 3, 0);
      expect(list).toHaveLength(3);
    });

    it("respects offset", () => {
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "First", "msg", "/a");
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "Second", "msg", "/b");

      const list = getNotifications(base.instructor.id, 10, 1);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("First");
    });

    it("returns empty array when user has no notifications", () => {
      expect(getNotifications(base.instructor.id, 10, 0)).toHaveLength(0);
    });
  });

  describe("getUnreadCount", () => {
    it("returns count of unread notifications", () => {
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "A", "msg", "/a");
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "B", "msg", "/b");

      expect(getUnreadCount(base.instructor.id)).toBe(2);
    });

    it("does not count read notifications", () => {
      const n = createNotification(base.instructor.id, schema.NotificationType.Enrollment, "A", "msg", "/a");
      markAsRead(n.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("returns 0 when user has no notifications", () => {
      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", () => {
      const n = createNotification(base.instructor.id, schema.NotificationType.Enrollment, "A", "msg", "/a");
      expect(n.isRead).toBe(false);

      const updated = markAsRead(n.id);
      expect(updated?.isRead).toBe(true);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications for a user as read", () => {
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "A", "msg", "/a");
      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "B", "msg", "/b");

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("does not affect other users notifications", () => {
      const other = testDb
        .insert(schema.users)
        .values({ name: "Other Instructor", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "A", "msg", "/a");
      createNotification(other.id, schema.NotificationType.Enrollment, "B", "msg", "/b");

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
      expect(getUnreadCount(other.id)).toBe(1);
    });
  });

  describe("user-scoping", () => {
    it("getNotifications only returns notifications for the given user", () => {
      const other = testDb
        .insert(schema.users)
        .values({ name: "Other", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();

      createNotification(base.instructor.id, schema.NotificationType.Enrollment, "Mine", "msg", "/a");
      createNotification(other.id, schema.NotificationType.Enrollment, "Theirs", "msg", "/b");

      const list = getNotifications(base.instructor.id, 10, 0);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("Mine");
    });
  });
});
