const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./fitquest.db");

db.serialize(() => {
  // Create the users table with additional profile fields.
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT UNIQUE,
      password TEXT,
      bio TEXT,
      profile_picture TEXT,
      age INTEGER,
      gender TEXT,
      height REAL,
      weight REAL,
      notifications_enabled INTEGER DEFAULT 1,
      privacy_setting TEXT DEFAULT 'Public',
      account_option TEXT DEFAULT 'Basic',
      daily_goal INTEGER DEFAULT 10000
    )
  `, (err) => {
    if (err) console.error("Error creating users table:", err);
  });

  // Create the challenges table.
  db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      points INTEGER
    )
  `, (err) => {
    if (err) console.error("Error creating challenges table:", err);
  });

  // Create the leaderboard table.
  db.run(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      user_id INTEGER PRIMARY KEY,
      points INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error("Error creating leaderboard table:", err);
  });

  // Create the progress table.
  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      date TEXT,
      steps INTEGER,
      calories INTEGER,
      distance REAL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error("Error creating progress table:", err);
  });

  // Create the rewards table.
  db.run(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      image TEXT,
      points_required INTEGER
    )
  `, (err) => {
    if (err) console.error("Error creating rewards table:", err);
  });

  // Create the user_rewards table.
  db.run(`
    CREATE TABLE IF NOT EXISTS user_rewards (
      user_id INTEGER,
      reward_id INTEGER,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, reward_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(reward_id) REFERENCES rewards(id)
    )
  `, (err) => {
    if (err) console.error("Error creating user_rewards table:", err);
  });

  // Create the user_challenges table.
  db.run(`
    CREATE TABLE IF NOT EXISTS user_challenges (
      user_id INTEGER,
      challenge_id INTEGER,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, challenge_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(challenge_id) REFERENCES challenges(id)
    )
  `, (err) => {
    if (err) console.error("Error creating user_challenges table:", err);
  });

  // Create the groups table (for chat).
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `, (err) => {
    if (err) console.error("Error creating groups table:", err);
  });

  // Create the messages table (for chat).
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER,
      user_id INTEGER,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(group_id) REFERENCES groups(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error("Error creating messages table:", err);
  });

  // Insert baseline user.
  db.run(`
    INSERT OR IGNORE INTO users (id, username, email, password)
    VALUES (1, 'JohnDoe', 'john@example.com', '1234')
  `, (err) => {
    if (err) console.error("Error inserting baseline user:", err);
  });

  // Insert baseline challenges.
  db.run(`
    INSERT OR IGNORE INTO challenges (id, name, description, points)
    VALUES (1, 'Run 5km', 'Complete a 5km run', 50)
  `, (err) => {
    if (err) console.error("Error inserting challenge 1:", err);
  });
  db.run(`
    INSERT OR IGNORE INTO challenges (id, name, description, points)
    VALUES (2, '100 Push-ups', 'Do 100 push-ups', 30)
  `, (err) => {
    if (err) console.error("Error inserting challenge 2:", err);
  });
  db.run(`
    INSERT OR IGNORE INTO challenges (id, name, description, points)
    VALUES (3, 'Drink 2L Water', 'Stay hydrated!', 20)
  `, (err) => {
    if (err) console.error("Error inserting challenge 3:", err);
  });
  db.run(`
    INSERT OR IGNORE INTO challenges (id, name, description, points)
    VALUES (4, 'Cycle 10km', 'Complete a 10km cycling ride', 40)
  `, (err) => {
    if (err) console.error("Error inserting challenge 4:", err);
  });
  db.run(`
    INSERT OR IGNORE INTO challenges (id, name, description, points)
    VALUES (5, '15 Minute HIIT', 'Complete a 15-minute high-intensity interval training session', 35)
  `, (err) => {
    if (err) console.error("Error inserting challenge 5:", err);
  });

  // Insert baseline rewards.
  db.run(`
    INSERT OR IGNORE INTO rewards (id, name, description, image, points_required)
    VALUES (1, '5K Runner Badge', 'Awarded for completing a 5km run', '/images/badge1.png', 50)
  `, (err) => {
    if (err) console.error("Error inserting reward 1:", err);
  });
  db.run(`
    INSERT OR IGNORE INTO rewards (id, name, description, image, points_required)
    VALUES (2, 'Push-up Pro', 'Awarded for completing 100 push-ups', '/images/badge2.png', 30)
  `, (err) => {
    if (err) console.error("Error inserting reward 2:", err);
  });

  // Insert baseline group for chat.
  db.run(`
    INSERT OR IGNORE INTO groups (id, name)
    VALUES (1, 'Fitness Buddies')
  `, (err) => {
    if (err) console.error("Error inserting baseline group:", err);
  });
});

db.close(() => {
  console.log("Database setup completed.");
});
