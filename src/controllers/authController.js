const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../utils/logger');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    const result = await db.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, name, email, role, created_at`,
      [userId, name.trim(), email.toLowerCase(), hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    logger.info('New user registered', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { email, password } = req.body;

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    logger.info('User logged in', { userId: user.id });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { email } = req.body;

    const result = await db.query('SELECT id, name FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return 200 to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent.',
      });
    }

    const user = result.rows[0];
    const resetToken = uuidv4();
    const expiresAt = new Date(
      Date.now() + (parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 30) * 60 * 1000
    );

    await db.query(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET token = $3, expires_at = $4, created_at = NOW()`,
      [uuidv4(), user.id, resetToken, expiresAt]
    );

    // In production, send an email here (e.g. via SendGrid)
    // For now we return the token in dev mode only
    logger.info('Password reset requested', { userId: user.id });

    const response = {
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.dev_reset_token = resetToken; // Remove in production!
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, forgotPassword };
