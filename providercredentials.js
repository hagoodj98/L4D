import env from "dotenv";
env.config();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "test-google-client-id";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "test-google-client-secret";
const TWITCH_CLIENT_ID =
  process.env.TWITCH_CLIENT_ID || "test-twitch-client-id";
const TWITCH_CLIENT_SECRET =
  process.env.TWITCH_CLIENT_SECRET || "test-twitch-client-secret";
const DISCORD_CLIENT_ID =
  process.env.DISCORD_CLIENT_ID || "test-discord-client-id";
const DISCORD_CLIENT_SECRET =
  process.env.DISCORD_CLIENT_SECRET || "test-discord-client-secret";

export {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
};
