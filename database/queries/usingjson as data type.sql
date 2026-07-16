ALTER TABLE users
ALTER COLUMN notification_state TYPE JSONB
USING '{}' ::JSONB;
