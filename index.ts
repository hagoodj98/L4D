import express from "express";
import bodyParser from "body-parser";
import passport from "./passport/passport.js";
import session from "express-session";
import ErrorHandler from "./utils/error.js";
import notificationRoutes from "./src/routes/notifications.js";
import responseBodyRoutes from "./src/routes/post_type_response_body.js";
import authRoutes from "./src/routes/auth.js";
import postTypeReactionsRoutes from "./src/routes/post_type_reactions.js";
import forumRoutes from "./src/routes/forum.js";
import notificationMiddleware from "./middleware/notification.js";

const app = express();
const port = 3000;

const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    name: "zombieslayers.sid",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
    secret: process.env.SESSION_SECRET || "test-session-secret",
    resave: false,
    saveUninitialized: false,
    // Refresh cookie expiry on each request while a user is active.
    rolling: true,
  }),
);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
// Initialize Passport and restore authentication state from the session on each request.
app.use(passport.initialize());
app.use(passport.session());

// Notification middleware goes AFTER Passport
app.use(notificationMiddleware);

app.use("/forum/response-body", responseBodyRoutes);
app.use("/notifications", notificationRoutes);
app.use("/auth", authRoutes);
app.use("/post-type-reaction", postTypeReactionsRoutes);
app.use("/forum", forumRoutes);

const isUserAuthenticated = async (
  req: Express.Request,
  res: Express.Response & {
    render: (view: string, options?: any) => void;
    locals: any;
  },
  page: string,
) => {
  if (!req.isAuthenticated()) return res.render(`${page}.ejs`);

  res.render(`${page}.ejs`, {
    currentUser: req.user.display_name,
    paginationNumber: res.locals.paginationNumber,
  });
};

app.get("/", (req, res) => {
  isUserAuthenticated(req, res, "index");
});
app.get("/survivors", (req, res) => {
  isUserAuthenticated(req, res, "survivors");
});
app.get("/specialinfected", (req, res) => {
  isUserAuthenticated(req, res, "specialinfected");
});
app.get("/community", (req, res) => {
  isUserAuthenticated(req, res, "community");
});

app.use((err: unknown, req: any, res: any, _next: any) => {
  // Convert structured domain errors into user-facing redirects/messages.
  if (err instanceof ErrorHandler) {
    if (err.message === "Validation failed") {
      req.session.formErrors = err.details;
      return res.redirect("/auth/login");
    }
    if (err.details?.message === "Invalid password") {
      req.session.formErrors = err.details.message;
      return res.redirect("/auth/login");
    }
    if (err.details?.message === "User not found") {
      req.session.formErrors = err.details.message;
      return res.redirect("/auth/login");
    }
    if (err.message === "Registration failed") {
      req.session.formErrors = err.details;
      return res.redirect("/auth/register");
    }
    if (err.message === "User already exists") {
      req.session.formErrors = err.details;
      return res.redirect("/auth/register");
    }
    if (
      err.message === "Invalid post data" ||
      err.message === "Invalid reply data"
    ) {
      req.session.formErrors = err.details;
      return res.redirect("/forum/forumpost");
    }
  }
  console.error(err);

  return res.status(500).send("Internal Server Error");
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port);
  console.log(`app listening on port, ${port}`);
}

export default app;
