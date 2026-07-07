const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');
const config = require('../config');

class CustomError extends Error {
  constructor(message, statusCode = 400, errors = []) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new CustomError('No token provided', 401);
    }

    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      throw new CustomError('Token has been revoked', 401);
    }
    
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      throw new CustomError('User not found', 401);
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const error = new CustomError('Not authorized to access this route', 403);
      return next(error);
    }
    next();
  };
};

module.exports = { authenticate, authorize, CustomError };
