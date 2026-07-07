require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const checkUser = async () => {
  try {
    await connectDB();
    const admin = await User.findOne({ email: 'admin@example.com' }).select('+password');
    
    if (!admin) {
      console.log('Admin user NOT found in database');
    } else {
      console.log('Admin user found:');
      console.log('  Email:', admin.email);
      console.log('  Name:', admin.name);
      console.log('  Role:', admin.role);
      console.log('  Password hash exists:', !!admin.password);
      console.log('  Password hash length:', admin.password ? admin.password.length : 0);
    }
    
    const allUsers = await User.find({});
    console.log('\nAll users in database:', allUsers.length);
    allUsers.forEach(u => console.log(`  - ${u.email} (${u.role})`));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkUser();
