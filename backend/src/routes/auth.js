const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { sequelize, Sequelize, useRealDb } = require('../config/database');
const store = require('../data/mockStore');

const router = express.Router();
const jwtIssuer = process.env.JWT_ISSUER || 'finance-system';
const jwtAudience = process.env.JWT_AUDIENCE || 'finance-desktop';
const allowPublicRegister = process.env.ALLOW_PUBLIC_REGISTER === 'true';

const { authenticateToken } = require('../middleware/auth');

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  // 兼容 snake_case 和 camelCase 两种命名风格
  const { password, password_hash, passwordHash, ...rest } = user;
  return rest;
};

router.post(
  '/login',
  [body('username').notEmpty().trim(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: '请求参数错误', details: errors.array() });
      }

      const { username, password } = req.body;
      let user = null;
      let validPassword = false;

      if (useRealDb && sequelize) {
        const users = await sequelize.query(
          'SELECT * FROM users WHERE username = ? AND status = 1',
          { replacements: [username], type: Sequelize.QueryTypes.SELECT }
        );
        user = users[0] || null;
        validPassword = Boolean(user) && (await bcrypt.compare(password, user.password_hash));
      } else {
        user = store.findUserByUsername(username);
        validPassword = Boolean(user) && (await store.verifyUserPassword(user, password));
      }

      if (!user || !validPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ error: 'JWT 配置缺失' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        jwtSecret,
        {
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          issuer: jwtIssuer,
          audience: jwtAudience,
          algorithm: 'HS256',
        }
      );

      if (useRealDb && sequelize) {
        await sequelize.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', {
          replacements: [user.id],
        });
      } else {
        store.touchLastLogin(user.id);
      }

      res.json({
        success: true,
        token,
        user: sanitizeUser(user),
        requirePasswordChange:
          !useRealDb && (await store.isUsingDefaultAdminPassword(user, password)),
      });
    } catch (error) {
      console.error('登录错误:', error.message);
      res.status(500).json({ error: '服务器错误' });
    }
  }
);

router.post(
  '/register',
  [
    body('username').notEmpty().trim().isLength({ min: 3, max: 20 }),
    body('password')
      .isLength({ min: 8, max: 64 })
      .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
      .withMessage('密码至少 8 位，且必须包含字母和数字'),
    body('role').optional().isIn(['admin', 'operator', 'viewer']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: '请求参数错误', details: errors.array() });
      }

      const { username, password, phone, email, role } = req.body;
      const requestedRole = role || 'viewer';
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      let actor = null;

      if (token) {
        try {
          actor = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: jwtIssuer,
            audience: jwtAudience,
          });
        } catch (verifyError) {
          actor = null;
        }
      }

      if (!allowPublicRegister && (!actor || actor.role !== 'admin')) {
        return res.status(403).json({ error: '仅管理员可创建账户' });
      }
      if ((!actor || actor.role !== 'admin') && requestedRole === 'admin') {
        return res.status(403).json({ error: '无权限创建管理员账户' });
      }

      if (useRealDb && sequelize) {
        const existing = await sequelize.query('SELECT id FROM users WHERE username = ?', {
          replacements: [username],
          type: Sequelize.QueryTypes.SELECT,
        });

        if (existing.length > 0) {
          return res.status(409).json({ error: '用户名已存在' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await sequelize.query(
          `INSERT INTO users (username, password_hash, phone, email, role)
           VALUES (?, ?, ?, ?, ?)`,
          {
            replacements: [username, passwordHash, phone, email, requestedRole],
          }
        );

        return res.status(201).json({
          success: true,
          message: '用户创建成功',
          userId: result.insertId,
        });
      }

      const existingUser = store.findUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: '用户名已存在' });
      }

      const user = store.createUser({
        username,
        password,
        phone,
        email,
        role: requestedRole,
      });

      res.status(201).json({
        success: true,
        message: '用户创建成功',
        userId: user.id,
      });
    } catch (error) {
      console.error('注册错误:', error.message);
      res.status(500).json({ error: '服务器错误' });
    }
  }
);

router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: '访问令牌缺失' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });

    if (useRealDb && sequelize) {
      const users = await sequelize.query(
        'SELECT id, username, role, phone, email, created_at FROM users WHERE id = ?',
        { replacements: [decoded.userId], type: Sequelize.QueryTypes.SELECT }
      );

      const user = users[0];
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      return res.json({ success: true, user });
    }

    const user = store.findUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('获取用户信息错误:', error.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post(
  '/change-password',
  [
    body('oldPassword').notEmpty(),
    body('newPassword')
      .isLength({ min: 8, max: 64 })
      .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
      .withMessage('新密码至少 8 位，且必须包含字母和数字'),
  ],
  authenticateToken,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: '请求参数错误', details: errors.array() });
      }

      const { oldPassword, newPassword } = req.body;

      if (useRealDb && sequelize) {
        const users = await sequelize.query('SELECT id, password_hash FROM users WHERE id = ?', {
          replacements: [req.user.userId],
          type: Sequelize.QueryTypes.SELECT,
        });

        const user = users[0];
        if (!user) {
          return res.status(404).json({ error: '用户不存在' });
        }

        const validOld = await bcrypt.compare(oldPassword, user.password_hash);
        if (!validOld) {
          return res.status(400).json({ error: '原密码错误' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await sequelize.query('UPDATE users SET password_hash = ? WHERE id = ?', {
          replacements: [passwordHash, req.user.userId],
        });
      } else {
        const result = await store.changeUserPassword({
          userId: req.user.userId,
          oldPassword,
          newPassword,
        });

        if (!result.ok) {
          return res.status(400).json({ error: result.error || '修改密码失败' });
        }
      }

      return res.json({ success: true, message: '密码修改成功，请重新登录' });
    } catch (error) {
      console.error('修改密码错误:', error.message);
      return res.status(500).json({ error: '服务器错误' });
    }
  }
);

module.exports = router;
