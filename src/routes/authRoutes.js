const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateSignup, validateLogin, validateRefreshToken } = require('../validators/authValidator');

router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
