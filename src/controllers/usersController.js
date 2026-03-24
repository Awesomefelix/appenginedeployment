const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../utils/logger');

// GET /api/users/me
const getProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, password } = req.body;
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      fields.push(`password_hash = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update.' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, email, role, updated_at`,
      values
    );

    logger.info('User profile updated', { userId: req.user.id });

    res.json({ success: true, message: 'Profile updated successfully.', data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/me
const deleteAccount = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    logger.info('User account deleted', { userId: req.user.id });

    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/users  (admin only)
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [usersResult, countResult] = await Promise.all([
      db.query(
        'SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      db.query('SELECT COUNT(*) FROM users'),
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, deleteAccount, listUsers };
