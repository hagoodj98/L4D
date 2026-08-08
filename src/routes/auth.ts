import express from "express";
import passport from "../../passport/passport.js";
import {
  checkingIfExisting,
  createUser,
} from "../../database/repositories/users.js";
import ErrorHandler from "../../utils/error.js";
import bcrypt from "bcrypt";
import { loginSchema, registrationSchema } from "../../utils/zodSchemas.js";

// Create a new router instance
const router = express.Router();

const saltRounds = 10;
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/twitch",
  passport.authenticate("twitch", { scope: ["user:read:email"] }),
);
router.get(
  "/discord",
  passport.authenticate("discord", { scope: ["identify", "email"] }),
);
router.get(
  "/twitch/forum",
  passport.authenticate("twitch", {
    successRedirect: "/forum",
    failureRedirect: "/auth/login",
  }),
);

router.get(
  "/discord/forum",
  passport.authenticate("discord", {
    successRedirect: "/forum",
    failureRedirect: "/auth/login",
  }),
);
router.get(
  "/google/forum",
  passport.authenticate("google", {
    successRedirect: "/forum",
    failureRedirect: "/auth/login",
  }),
);
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/forum");
  } else {
    const formErrors = (req.session as any).formErrors || null;
    (req.session as any).formErrors = null;
    res.render("login.ejs", {
      error: formErrors,
    });
  }
});
router.get("/register", (req, res) => {
  const formErrors = (req.session as any).formErrors || null;

  (req.session as any).formErrors = null;
  res.render("register.ejs", {
    error: formErrors,
  });
});

router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/auth/login");
  });
});

router.post("/login", async (req, res, next) => {
  // Keep local auth result handling in this route so form-specific errors
  // can be normalized into the central error middleware.
  passport.authenticate(
    "local",
    function (
      err: Error | null,
      user: Express.User | false,
      info: { message?: string } | undefined,
    ) {
      const validation = loginSchema.safeParse({
        username: req.body.username,
        password: req.body.password,
      });

      if (!validation.success) {
        const usernameError = validation.error.issues.find(
          (err) => err.path[0] === "username",
        );
        const passwordError = validation.error.issues.find(
          (err) => err.path[0] === "password",
        );
        //
        return next(
          new ErrorHandler(400, "Validation failed", {
            username: usernameError?.message ?? null,
            password: passwordError?.message ?? null,
          }),
        );
      }
      if (err) {
        return next(err);
      }
      if (!user) {
        if (info && info.message === "User not found") {
          return next(new ErrorHandler(401, "User not found", info));
        }

        return next(new ErrorHandler(401, "Invalid credentials", info));
        // return res.redirect("/login-error");
      }
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        return res.redirect("/forum");
      });
    },
  )(req, res, next);
});

router.post("/register", async (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/forum");
  }

  const username: string = req.body.username;
  const email: string = req.body.email;
  const password: string = req.body.password;
  const validation = registrationSchema.safeParse({
    username,
    email,
    password,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Registration failed", {
        username:
          validation.error.issues.find((err) => err.path[0] === "username")
            ?.message ?? null,
        email:
          validation.error.issues.find((err) => err.path[0] === "email")
            ?.message ?? null,
        password:
          validation.error.issues.find((err) => err.path[0] === "password")
            ?.message ?? null,
      }),
    );
  }

  try {
    const userExists = await checkingIfExisting(email, username);
    if (userExists) {
      return next(
        new ErrorHandler(400, "User already exists", {
          duplicateInfo:
            "You typed an email or username that already exists, try a new one!",
        }),
      );
    } else {
      // Hash password before persistence, then create a logged-in session.
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          return next(new ErrorHandler(500, "Error hashing password"));
        } else {
          const user = await createUser(username, email, hash);
          req.logIn(user, (loginError) => {
            if (loginError) {
              return next(loginError);
            }
            return res.redirect("/forum");
          });
        }
      });
    }
  } catch (err) {
    return next(err);
  }
});

export default router;
