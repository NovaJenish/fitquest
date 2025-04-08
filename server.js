const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { exec } = require("child_process");

const app = express();
const db = new sqlite3.Database("./fitquest.db");

// ------------------ MIDDLEWARE ------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "fitquest_secret", // For production, use an environment variable for the secret
    resave: false,
    saveUninitialized: true,
  })
);

// Set view engine and static assets
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// ------------------ AUTHENTICATION MIDDLEWARE ------------------
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// ------------------ ROUTES ------------------

// Home redirect
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// ----- LOGIN -----
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, user) => {
      if (err) {
        console.error("Database error on login:", err);
        return res.render("login", { error: "Database error." });
      }
      if (!user) {
        return res.render("login", { error: "Invalid email or password." });
      }
      req.session.user = user;
      res.redirect("/dashboard");
    }
  );
});

// ----- SIGNUP -----
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, existingUser) => {
    if (err) {
      console.error("Database error on signup:", err);
      return res.render("signup", { error: "Database error." });
    }
    if (existingUser) {
      return res.render("signup", { error: "Email already exists." });
    }
    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [name, email, password],
      function (err) {
        if (err) {
          console.error("Error creating user:", err);
          return res.render("signup", { error: "Failed to create user." });
        }
        // Create a session for the new user.
        req.session.user = { id: this.lastID, username: name, email, password };
        res.redirect("/dashboard");
      }
    );
  });
});

// ----- LOGOUT -----
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Error destroying session:", err);
    res.redirect("/login");
  });
});

// ----- DASHBOARD -----
app.get("/dashboard", isAuthenticated, (req, res) => {
  db.all("SELECT * FROM challenges", (err, challenges) => {
    if (err) {
      console.error("Error fetching challenges:", err);
      challenges = [];
    }
    res.render("dashboard", { user: req.session.user, challenges });
  });
});

// ----- CHALLENGES -----
app.get("/challenges", isAuthenticated, (req, res) => {
  db.all("SELECT * FROM challenges", (err, challenges) => {
    if (err || !Array.isArray(challenges)) {
      challenges = [];
    }
    db.all(
      "SELECT challenge_id FROM user_challenges WHERE user_id = ?",
      [req.session.user.id],
      (err, userChallenges) => {
        let joined = [];
        if (!err && userChallenges && Array.isArray(userChallenges)) {
          joined = userChallenges.map((uc) => uc.challenge_id);
        }
        res.render("challenges", { user: req.session.user, challenges, joined });
      }
    );
  });
});

app.post("/challenges/join", isAuthenticated, (req, res) => {
  const { challengeId } = req.body;
  db.get(
    "SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?",
    [req.session.user.id, challengeId],
    (err, row) => {
      if (err) {
        console.error("Error checking user challenge:", err);
        return res.redirect("/challenges");
      }
      if (row) {
        return res.redirect("/challenges");
      }
      db.run(
        "INSERT INTO user_challenges (user_id, challenge_id) VALUES (?, ?)",
        [req.session.user.id, challengeId],
        function (err) {
          if (err) console.error("Error inserting user challenge:", err);
          // Update leaderboard points
          db.get("SELECT points FROM challenges WHERE id = ?", [challengeId], (err, challenge) => {
            if (challenge) {
              db.get("SELECT * FROM leaderboard WHERE user_id = ?", [req.session.user.id], (err, leaderboardEntry) => {
                if (leaderboardEntry) {
                  db.run(
                    "UPDATE leaderboard SET points = points + ? WHERE user_id = ?",
                    [challenge.points, req.session.user.id]
                  );
                } else {
                  db.run(
                    "INSERT INTO leaderboard (user_id, points) VALUES (?, ?)",
                    [req.session.user.id, challenge.points]
                  );
                }
                res.redirect("/challenges");
              });
            } else {
              res.redirect("/challenges");
            }
          });
        }
      );
    }
  );
});

// ----- PROGRESS -----
app.get("/progress", isAuthenticated, (req, res) => {
  db.all(
    "SELECT * FROM progress WHERE user_id = ? ORDER BY date DESC",
    [req.session.user.id],
    (err, progressRecords) => {
      if (err || !Array.isArray(progressRecords)) {
        progressRecords = [];
      }
      res.render("progress", { user: req.session.user, progress: progressRecords });
    }
  );
});

app.post("/progress", isAuthenticated, (req, res) => {
  const { date, steps, calories, distance } = req.body;
  db.run(
    "INSERT INTO progress (user_id, date, steps, calories, distance) VALUES (?, ?, ?, ?, ?)",
    [req.session.user.id, date, steps, calories, distance],
    function (err) {
      if (err) {
        console.error("Error inserting progress record:", err);
      }
      res.redirect("/progress");
    }
  );
});

// ----- LEADERBOARD -----
app.get("/leaderboard", isAuthenticated, (req, res) => {
  db.all(
    `SELECT l.points, u.username, u.profile_picture
     FROM leaderboard l
     JOIN users u ON l.user_id = u.id
     ORDER BY l.points DESC`,
    (err, leaderboard) => {
      if (err || !leaderboard) {
        leaderboard = [];
      }
      res.render("leaderboard", { user: req.session.user, leaderboard });
    }
  );
});

// ----- REWARDS -----
app.get("/rewards", isAuthenticated, (req, res) => {
  db.all("SELECT * FROM rewards", (err, rewards) => {
    if (err || !Array.isArray(rewards)) {
      rewards = [];
    }
    db.all(
      "SELECT reward_id FROM user_rewards WHERE user_id = ?",
      [req.session.user.id],
      (err, userRewards) => {
        let earned = [];
        if (!err && userRewards && Array.isArray(userRewards)) {
          earned = userRewards.map((ur) => ur.reward_id);
        }
        db.get("SELECT points FROM leaderboard WHERE user_id = ?", [req.session.user.id], (err, leaderboardEntry) => {
          let points = leaderboardEntry && leaderboardEntry.points ? leaderboardEntry.points : 0;
          res.render("rewards", { user: req.session.user, rewards, earned, points });
        });
      }
    );
  });
});

app.post("/rewards/claim", isAuthenticated, (req, res) => {
  const { rewardId } = req.body;
  db.get(
    "SELECT * FROM user_rewards WHERE user_id = ? AND reward_id = ?",
    [req.session.user.id, rewardId],
    (err, row) => {
      if (row) return res.redirect("/rewards");
      db.get("SELECT points FROM rewards WHERE id = ?", [rewardId], (err, reward) => {
        if (reward) {
          db.get("SELECT points FROM leaderboard WHERE user_id = ?", [req.session.user.id], (err, leaderboardEntry) => {
            const userPoints = leaderboardEntry ? leaderboardEntry.points : 0;
            if (userPoints >= reward.points_required) {
              db.run(
                "INSERT INTO user_rewards (user_id, reward_id) VALUES (?, ?)",
                [req.session.user.id, rewardId],
                (err) => {
                  if (err) console.error("Error claiming reward:", err);
                  res.redirect("/rewards");
                }
              );
            } else {
              res.redirect("/rewards");
            }
          });
        } else {
          res.redirect("/rewards");
        }
      });
    }
  );
});

// ----- CHAT -----
app.get("/chat", isAuthenticated, (req, res) => {
  db.all(
    `SELECT m.*, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.group_id = 1 ORDER BY m.created_at ASC`,
    (err, messages) => {
      if (err || !messages) {
        messages = [];
      }
      db.all("SELECT id, username FROM users", (err, onlineUsers) => {
        if (err || !onlineUsers) {
          onlineUsers = [];
        }
        res.render("chat", { user: req.session.user, messages, onlineUsers });
      });
    }
  );
});

// Clear Chat Route
app.post("/chat/clear", isAuthenticated, (req, res) => {
  db.run("DELETE FROM messages WHERE group_id = 1", (err) => {
    if (err) {
      console.error("Error clearing chat:", err);
    }
    res.redirect("/chat");
  });
});

app.post("/chat", isAuthenticated, (req, res) => {
  const { message } = req.body;
  db.run(
    "INSERT INTO messages (group_id, user_id, message) VALUES (1, ?, ?)",
    [req.session.user.id, message],
    (err) => {
      if (err) {
        console.error("Error sending chat message:", err);
      }
      res.redirect("/chat");
    }
  );
});

// ----- PROFILE -----
// GET route to render profile page.
app.get("/profile", isAuthenticated, (req, res) => {
  res.render("profile", { user: req.session.user });
});

// POST route to update profile.
app.post("/profile", isAuthenticated, (req, res) => {
  const { name, bio, age, gender, height, weight } = req.body;
  const userId = req.session.user.id;

  // Convert empty strings to null and convert numeric values.
  const ageVal = age === "" ? null : parseInt(age);
  const heightVal = height === "" ? null : parseFloat(height);
  const weightVal = weight === "" ? null : parseFloat(weight);

  db.run(
    `UPDATE users 
     SET username = ?, bio = ?, age = ?, gender = ?, height = ?, weight = ?
     WHERE id = ?`,
    [name, bio, ageVal, gender, heightVal, weightVal, userId],
    function (err) {
      if (err) {
        console.error("Error updating profile:", err);
        return res.status(500).send("Profile update failed.");
      }
      // Refresh the user session with updated info.
      db.get("SELECT * FROM users WHERE id = ?", [userId], (err, updatedUser) => {
        if (err) {
          console.error("Error fetching updated user:", err);
          return res.redirect("/profile");
        }
        req.session.user = updatedUser;
        res.redirect("/profile");
      });
    }
  );
});

// ----- SETTINGS -----
// GET route to render the settings page.
app.get("/settings", isAuthenticated, (req, res) => {
  res.render("settings", { user: req.session.user });
});

// POST route to update settings.
app.post("/settings", isAuthenticated, (req, res) => {
  const { password, notifications, dailyGoal } = req.body;
  
  // Use the new password if provided; otherwise, keep the current one.
  const newPassword =
    password && password.trim() !== "" ? password : req.session.user.password;
  
  // Convert dailyGoal to an integer if provided, else fallback to current value.
  const dailyGoalVal =
    dailyGoal && dailyGoal.trim() !== "" ? parseInt(dailyGoal) : req.session.user.daily_goal;
  
  // Convert notification setting to a number (1 for enabled, 0 otherwise).
  const notificationsValue = notifications === "enabled" ? 1 : 0;
  
  // Update settings in one combined query.
  db.run(
    "UPDATE users SET password = ?, notifications_enabled = ?, daily_goal = ? WHERE id = ?",
    [newPassword, notificationsValue, dailyGoalVal, req.session.user.id],
    function (err) {
      if (err) {
        console.error("Error updating settings:", err);
        return res.status(500).send("Error updating settings.");
      }
      // After updating, reload the updated user data.
      db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, updatedUser) => {
        if (err) {
          console.error("Error fetching updated user:", err);
          return res.redirect("/settings");
        }
        // Refresh the session data so that the changes reflect on the settings page.
        req.session.user = updatedUser;
        res.redirect("/settings");
      });
    }
  );
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`FitQuest server running on ${url}`);
  let command;
  if (process.platform === "win32") {
    command = `start ${url}`;
  } else if (process.platform === "darwin") {
    command = `open ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }
  exec(command);
});
