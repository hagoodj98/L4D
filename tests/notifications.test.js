import { beforeEach, describe, expect, it } from "vitest";
import { dbState, resetDbState, setupPgMock } from "./helpers/forum-mock.js";
import { registerAndLogin } from "./helpers/forum-test-helpers.js";

setupPgMock();
process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("Notification read state", () => {
  beforeEach(() => {
    resetDbState();
  });

  it("loads cached notifications and persists read state through the public route", async () => {
    dbState.pendingNotificationState = [
      {
        id: "notification-1",
        user_name: "user97",
        notification_type: "posts_down",
        reaction_type: "like",
        post_id: 1,
        created_at: "2026-07-01T12:00:00.000Z",
        wasRead: false,
      },
    ];

    const agent = await registerAndLogin(app, {
      username: "notificationuser",
      email: "notificationuser@example.com",
    });

    const beforeRead = await agent.get("/notifications/load-notifications");

    expect(beforeRead.status).toBe(200);
    expect(beforeRead.body.notifications).toHaveLength(1);
    expect(beforeRead.body.notifications[0].wasRead).toBe(false);

    const readResponse = await agent
      .post("/notifications/read-notifications")
      .send({});

    expect(readResponse.status).toBe(200);
    expect(dbState.users[0].notification_state.notifications[0].wasRead).toBe(
      true,
    );

    const afterReload = await agent.get("/notifications/load-notifications");

    expect(afterReload.status).toBe(200);
    expect(afterReload.body.notifications).toHaveLength(1);
    expect(afterReload.body.notifications[0].wasRead).toBe(true);
  });
});
