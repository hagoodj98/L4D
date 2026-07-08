import db from "../databaseConnection.js";

export const updateNotificationsRead = async (userId) => {
  const sql = String.raw;
  const updateNotificationsReadQuery = sql`
    UPDATE users
    SET notifications_read = true
    WHERE id = $1 AND notifications_read = false RETURNING *;
  `;
  const result = await db.query(updateNotificationsReadQuery, [userId]);
  return result.rows;
};
export const getNotificationsReadStatus = async (userId) => {
  const sql = String.raw;
  const getNotificationsReadStatusQuery = sql`
    SELECT notifications_read FROM users WHERE id = $1;
  `;
  const result = await db.query(getNotificationsReadStatusQuery, [userId]);
  return result.rows[0];
};
