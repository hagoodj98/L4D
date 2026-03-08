import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import Twitch from "passport-twitch-strategy";
import DiscordStrategy from "passport-discord";
import bcrypt from "bcrypt";
import db from "../database/databaseConnection.js";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
} from "../providerCredentials.js";
import {
  findCredentialsFromLocalPassportStrategy,
  findExistingUserViaPassportStrategyThroughProvider,
  receivedExistingUserViaPassportStrategyProvider,
  createUserViaPassportStrategyProvider,
} from "../database/repositories/users.js";

const TwitchStrategy = Twitch.Strategy;

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await findCredentialsFromLocalPassportStrategy(
        username,
        "local",
      );
      if (result) {
        const user = result;
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false, { message: "Invalid password" });
            }
          }
        });
      } else {
        return cb(null, false, { message: "User not found" });
      }
    } catch (err) {
      return cb(err);
    }
  }),
);
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/forum",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async function verify(accessToken, refreshToken, profile, cb) {
      try {
        const existingGoogleUser =
          await findExistingUserViaPassportStrategyThroughProvider(
            profile,
            "google",
          );

        if (existingGoogleUser) {
          return cb(null, existingGoogleUser);
        }

        const googleEmail = profile.emails?.[0]?.value;
        if (!googleEmail) {
          return cb(
            new Error("Google account did not return an email address"),
          );
        }

        const existingEmailUser =
          await receivedExistingUserViaPassportStrategyProvider(profile);

        if (existingEmailUser) {
          const linkedUser = await db.query(
            `UPDATE users
             SET google_id = $1, provider = 'google'
             WHERE id = $2
             RETURNING *`,
            [profile.id, existingEmailUser.id],
          );
          return cb(null, linkedUser.rows[0]);
        }

        const newUser = await createUserViaPassportStrategyProvider(
          profile,
          "google",
        );

        return cb(null, newUser);
      } catch (err) {
        return cb(err);
      }
    },
  ),
);
passport.use(
  "twitch",
  new TwitchStrategy(
    {
      clientID: TWITCH_CLIENT_ID,
      clientSecret: TWITCH_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/twitch/forum",
    },
    async function verify(accessToken, refreshToken, profile, cb) {
      try {
        const existingTwitchUser =
          await findExistingUserViaPassportStrategyThroughProvider(
            profile,
            "twitch",
          );

        if (existingTwitchUser) {
          return cb(null, existingTwitchUser);
        }

        const twitchEmail = profile?.email;
        if (!twitchEmail) {
          return cb(
            new Error("Twitch account did not return an email address"),
          );
        }

        const existingEmailUser =
          await receivedExistingUserViaPassportStrategyProvider(profile);

        if (existingEmailUser) {
          const linkedUser = await db.query(
            `UPDATE users
             SET twitch_id = $1, provider = 'twitch'
             WHERE id = $2
             RETURNING *`,
            [profile.id, existingEmailUser.id],
          );
          return cb(null, linkedUser.rows[0]);
        }

        const newUser = await createUserViaPassportStrategyProvider(
          profile,
          "twitch",
        );

        return cb(null, newUser);
      } catch (err) {
        return cb(err);
      }
    },
  ),
);
passport.use(
  "discord",
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/discord/forum",
      scope: ["identify", "email"],
    },
    async function verify(accessToken, refreshToken, profile, cb) {
      try {
        const existingDiscordUser =
          await findExistingUserViaPassportStrategyThroughProvider(
            profile,
            "discord",
          );

        if (existingDiscordUser) {
          return cb(null, existingDiscordUser);
        }

        const discordEmail = profile?.email;
        if (!discordEmail) {
          return cb(
            new Error("Discord account did not return an email address"),
          );
        }

        const existingEmailUser =
          await receivedExistingUserViaPassportStrategyProvider(profile);

        if (existingEmailUser) {
          const linkedUser = await db.query(
            `UPDATE users
             SET discord_id = $1, provider = 'discord'
             WHERE id = $2
             RETURNING *`,
            [profile.id, existingEmailUser.id],
          );
          return cb(null, linkedUser.rows[0]);
        }

        const newUser = await createUserViaPassportStrategyProvider(
          profile,
          "discord",
        );

        return cb(null, newUser);
      } catch (err) {
        return cb(err);
      }
    },
  ),
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

export default passport;
