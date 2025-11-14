const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userId = uuidv4();

  db.run(
    'INSERT INTO users (id, username, password, coins) VALUES (?, ?, ?, 1000)',
    [userId, username, hashedPassword],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username already taken' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
      res.json({ success: true, userId, username });
    }
  );
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      db.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      res.json({
        success: true,
        userId: user.id,
        username: user.username,
        coins: user.coins,
      });
    }
  );
});

// Guest login
router.post('/guest', (req, res) => {
  const guestId = 'guest_' + uuidv4();
  res.json({
    success: true,
    userId: guestId,
    username: 'Guest',
    coins: 1000,
    isGuest: true,
  });
});

// Get user profile
router.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;

  db.get(
    'SELECT id, username, coins, created_at, total_games_played, total_winnings FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch profile' });
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json(user);
    }
  );
});

// Set PIN
router.post('/set-pin', (req, res) => {
  const { userId, pin } = req.body;

  if (!pin || pin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  }

  const hashedPin = bcrypt.hashSync(pin, 10);

  db.run(
    'UPDATE users SET pin = ? WHERE id = ?',
    [hashedPin, userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to set PIN' });
      res.json({ success: true });
    }
  );
});

// Reset coins (with confirmation)
router.post('/reset-coins', (req, res) => {
  const { userId } = req.body;

  db.run(
    'UPDATE users SET coins = 1000 WHERE id = ?',
    [userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to reset coins' });
      res.json({ success: true, coins: 1000 });
    }
  );
});

// Update coins
router.post('/update-coins', isAuthenticated, (req, res) => {
  const { userId, amount, gameId, type } = req.body;

  db.serialize(() => {
    db.run(
      'UPDATE users SET coins = coins + ? WHERE id = ?',
      [amount, userId]
    );

    db.run(
      'INSERT INTO transactions (user_id, game_id, amount, type) VALUES (?, ?, ?, ?)',
      [userId, gameId, amount, type]
    );

    db.get(
      'SELECT coins FROM users WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) return res.status(500).json({ error: 'Failed to update coins' });
        res.json({ success: true, coins: user.coins });
      }
    );
  });
});

module.exports = router;
