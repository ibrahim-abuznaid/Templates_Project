import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Generate unique handle from username (async for PostgreSQL)
const generateHandle = async (username) => {
  let handle = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  let counter = 0;
  let finalHandle = handle;
  
  let existing = await db.prepare('SELECT id FROM users WHERE handle = ?').get(finalHandle);
  while (existing) {
    counter++;
    finalHandle = `${handle}${counter}`;
    existing = await db.prepare('SELECT id FROM users WHERE handle = ?').get(finalHandle);
  }
  
  return finalHandle;
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is disabled
    if (user.is_active === false) {
      return res.status(403).json({ error: 'This account has been disabled. Please contact an administrator.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        handle: user.handle,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, username, email, handle, role, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user (admin only)
router.post('/register', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create new users' });
    }

    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'freelancer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const handle = await generateHandle(username);

    const result = await db.prepare(`
      INSERT INTO users (username, email, password, handle, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, email, hashedPassword, handle, role);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.lastInsertRowid,
        username,
        email,
        handle,
        role
      }
    });
  } catch (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== INVITATION SYSTEM =====

// Create invitation (admin only)
router.post('/invitations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can send invitations' });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['admin', 'freelancer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const existingInvite = await db.prepare('SELECT id FROM invitations WHERE email = ? AND accepted_at IS NULL').get(email);
    if (existingInvite) {
      return res.status(400).json({ error: 'Invitation already sent to this email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.prepare(`
      INSERT INTO invitations (email, token, role, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, token, role, req.user.id, expiresAt);

    res.status(201).json({
      message: 'Invitation created successfully',
      invitation: {
        id: result.lastInsertRowid,
        email,
        role,
        token,
        expiresAt,
        inviteLink: `/register?token=${token}`
      }
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all invitations (admin only)
router.get('/invitations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view invitations' });
    }

    const invitations = await db.prepare(`
      SELECT i.*, u.username as invited_by_name
      FROM invitations i
      LEFT JOIN users u ON i.invited_by = u.id
      ORDER BY i.created_at DESC
    `).all();

    res.json(invitations);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check invitation token
router.get('/invitations/check/:token', async (req, res) => {
  try {
    const invitation = await db.prepare(`
      SELECT * FROM invitations 
      WHERE token = ? AND accepted_at IS NULL AND expires_at > NOW()
    `).get(req.params.token);

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    res.json({
      email: invitation.email,
      role: invitation.role
    });
  } catch (error) {
    console.error('Check invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept invitation and create account
router.post('/invitations/accept', async (req, res) => {
  try {
    const { token, username, password } = req.body;

    if (!token || !username || !password) {
      return res.status(400).json({ error: 'Token, username, and password are required' });
    }

    const invitation = await db.prepare(`
      SELECT * FROM invitations 
      WHERE token = ? AND accepted_at IS NULL AND expires_at > NOW()
    `).get(token);

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const handle = await generateHandle(username);

    const result = await db.prepare(`
      INSERT INTO users (username, email, password, handle, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, invitation.email, hashedPassword, handle, invitation.role);

    await db.prepare(`
      UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(invitation.id);

    const user = {
      id: result.lastInsertRowid,
      username,
      email: invitation.email,
      handle,
      role: invitation.role
    };

    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token: jwtToken,
      user
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete invitation (admin only)
router.delete('/invitations/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete invitations' });
    }

    const result = await db.prepare('DELETE FROM invitations WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    res.json({ message: 'Invitation deleted' });
  } catch (error) {
    console.error('Delete invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (for mentions)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT id, username, handle, role
      FROM users
      ORDER BY username
    `).all();

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users with full details (admin only)
router.get('/users/manage', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can access user management' });
    }

    const users = await db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.handle, 
        u.role, 
        COALESCE(u.is_active, true) as is_active,
        u.created_at,
        COUNT(DISTINCT i_assigned.id) as templates_assigned,
        COUNT(DISTINCT i_created.id) as templates_created
      FROM users u
      LEFT JOIN ideas i_assigned ON u.id = i_assigned.assigned_to
      LEFT JOIN ideas i_created ON u.id = i_created.created_by
      GROUP BY u.id, u.username, u.email, u.handle, u.role, u.is_active, u.created_at
      ORDER BY u.created_at DESC
    `).all();

    res.json(users);
  } catch (error) {
    console.error('Get users for management error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle user active status (admin only)
router.put('/users/:id/toggle-active', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage users' });
    }

    const userId = parseInt(req.params.id);

    // Prevent admin from disabling themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newActiveStatus = user.is_active === false ? true : false;

    await db.prepare(`
      UPDATE users 
      SET is_active = ?
      WHERE id = ?
    `).run(newActiveStatus, userId);

    const updatedUser = await db.prepare(`
      SELECT id, username, email, handle, role, is_active, created_at
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      message: newActiveStatus ? 'User account enabled' : 'User account disabled',
      user: updatedUser
    });
  } catch (error) {
    console.error('Toggle user active error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set user active status explicitly (admin only)
router.put('/users/:id/set-active', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage users' });
    }

    const userId = parseInt(req.params.id);
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    // Prevent admin from disabling themselves
    if (userId === req.user.id && !is_active) {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.prepare(`
      UPDATE users 
      SET is_active = ?
      WHERE id = ?
    `).run(is_active, userId);

    const updatedUser = await db.prepare(`
      SELECT id, username, email, handle, role, is_active, created_at
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      message: is_active ? 'User account enabled' : 'User account disabled',
      user: updatedUser
    });
  } catch (error) {
    console.error('Set user active error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
