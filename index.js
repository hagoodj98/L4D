import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
//import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;

const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "test-session-secret",
    resave: false,
    saveUninitialized: true,
  }),
);

let error;
let existError;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
if (process.env.NODE_ENV !== "test") {
  db.connect();
}

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("index.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("index.ejs");
  }
});
app.get("/survivors", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("survivors.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("survivors.ejs");
  }
});
app.get("/specialinfected", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("specialinfected.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("specialinfected.ejs");
  }
});
app.get("/community", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("community.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("community.ejs");
  }
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    console.log("logged in");

    res.redirect("/forum");
  } else {
    res.render("login.ejs", {
      error: error,
    });
  }
});

app.get("/register", (req, res) => {
  res.render("register.ejs", {
    error: existError,
  });
});

app.get("/forum", async (req, res) => {
  if (req.isAuthenticated()) {
    const result = await db.query(
      "SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE user_id = $1",
      [req.user.id],
    );

    let users = [];

    res.render("forum.ejs", {
      currentUser: req.user.display_name,
      listUser: users,
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/community");
  });
});

app.get("/forumpost", async (req, res) => {
  if (req.isAuthenticated()) {
    const result = await db.query(
      "SELECT * FROM users JOIN posts ON users.id = posts.user_id",
    );

    const users = result.rows;

    res.render("forumpost.ejs", {
      currentUser: req.user.display_name,
      listUser: users,
    });
  } else {
    res.redirect("/login");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/forum",
    failureRedirect: "/login-error",
  }),
);

app.get("/login-error", (req, res) => {
  error = "You tried a password, and it was invalid. Try again";
  res.redirect("/login");
});

app.post("/register", async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/forum");
  }

  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  try {
    const checkEmail = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (checkEmail.rows.length > 0) {
      existError = "You typed an email that already exists, try a new one!";
      res.redirect("/register");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (display_name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [username, email, hash],
          );
          const user = result.rows[0];
          req.login(user, (_err) => {
            res.redirect("/forum");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/ascend", async (req, res) => {
  if (req.isAuthenticated()) {
    const result = await db.query(
      "SELECT * FROM users JOIN posts ON users.id = posts.user_id ORDER BY created_at DESC",
    );
    const users = result.rows;
    res.render("forumpost.ejs", {
      currentUser: req.user.display_name,
      listUser: users,
    });
  }
});
app.post("/descend", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM users JOIN posts ON users.id = posts.user_id ORDER BY created_at ASC",
  );
  const users = result.rows;

  res.render("forumpost.ejs", {
    currentUser: req.user.display_name,
    listUser: users,
  });
});

app.post("/add", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const post = req.body.newPost;
  try {
    let date = new Date();

    await db.query(
      "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3)",
      [post, req.user.id, date],
    );
    res.redirect("/forumpost");
  } catch (err) {
    console.log(err);
  }
});
passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE display_name = $1 ",
        [username],
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found. Please go back.");
      }
    } catch (err) {
      console.log(err);
    }
  }),
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
