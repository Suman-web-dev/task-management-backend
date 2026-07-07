const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');
const config = require('../config');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  });

  const refreshToken = jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });

  return { accessToken, refreshToken };
};

const signup = async (name, email, password, role = 'customer') => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('Email already registered');
    error.name = 'CustomError';
    error.statusCode = 400;
    error.errors = ['Email already exists'];
    throw error;
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  const { accessToken, refreshToken } = generateTokens(user._id);
  await user.addRefreshToken(refreshToken);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

const login = async (email, password) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const error = new Error('Invalid credentials');
    error.name = 'CustomError';
    error.statusCode = 401;
    error.errors = ['Email or password is incorrect'];
    throw error;
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    const error = new Error('Invalid credentials');
    error.name = 'CustomError';
    error.statusCode = 401;
    error.errors = ['Email or password is incorrect'];
    throw error;
  }

  const { accessToken, refreshToken } = generateTokens(user._id);
  await user.addRefreshToken(refreshToken);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

const refreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      const error = new Error('User not found');
      error.name = 'CustomError';
      error.statusCode = 401;
      error.errors = [];
      throw error;
    }

    const tokenExists = user.refreshTokens.some(rt => rt.token === token);
    if (!tokenExists) {
      const error = new Error('Invalid refresh token');
      error.name = 'CustomError';
      error.statusCode = 401;
      error.errors = [];
      throw error;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    await user.removeRefreshToken(token);
    await user.addRefreshToken(newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const customError = new Error('Invalid or expired refresh token');
      customError.name = 'CustomError';
      customError.statusCode = 401;
      customError.errors = [];
      throw customError;
    }
    throw error;
  }
};

const logout = async (userId, refreshToken, accessToken) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  // Remove refresh token
  await user.removeRefreshToken(refreshToken);

  // Blacklist access token
  const decoded = jwt.decode(accessToken);
  const expiresAt = new Date(decoded.exp * 1000);
  
  await BlacklistedToken.create({
    token: accessToken,
    userId: userId,
    expiresAt,
  });

  return { message: 'Logged out successfully' };
};

const logoutAll = async (userId, accessToken) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  // Clear all refresh tokens
  await user.clearRefreshTokens();

  // Blacklist current access token
  const decoded = jwt.decode(accessToken);
  const expiresAt = new Date(decoded.exp * 1000);
  
  await BlacklistedToken.create({
    token: accessToken,
    userId: userId,
    expiresAt,
  });

  return { message: 'Logged out from all devices' };
};

module.exports = {
  signup,
  login,
  refreshToken,
  logout,
  logoutAll,
};
