require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Coupon.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
    });
    console.log('Created admin user:', admin.email);

    // Create customer users
    const customerPassword = await bcrypt.hash('customer123', 10);
    const customer1 = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: customerPassword,
      role: 'customer',
    });
    const customer2 = await User.create({
      name: 'Jane Smith',
      email: 'jane@example.com',
      password: customerPassword,
      role: 'customer',
    });
    console.log('Created customer users');

    // Create products
    const products = await Product.create([
      {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 2999,
        stock: 50,
        category: 'Electronics',
        isActive: true,
      },
      {
        name: 'Smart Watch',
        description: 'Fitness tracking smartwatch with heart rate monitor',
        price: 4999,
        stock: 30,
        category: 'Electronics',
        isActive: true,
      },
      {
        name: 'Running Shoes',
        description: 'Comfortable running shoes for daily exercise',
        price: 1999,
        stock: 100,
        category: 'Footwear',
        isActive: true,
      },
      {
        name: 'Cotton T-Shirt',
        description: '100% cotton comfortable t-shirt',
        price: 499,
        stock: 200,
        category: 'Clothing',
        isActive: true,
      },
      {
        name: 'Laptop Backpack',
        description: 'Durable backpack with laptop compartment',
        price: 1499,
        stock: 75,
        category: 'Accessories',
        isActive: true,
      },
      {
        name: 'Bluetooth Speaker',
        description: 'Portable bluetooth speaker with excellent sound quality',
        price: 1299,
        stock: 5, // Low stock for testing
        category: 'Electronics',
        isActive: true,
      },
      {
        name: 'Yoga Mat',
        description: 'Non-slip yoga mat for exercise',
        price: 799,
        stock: 60,
        category: 'Sports',
        isActive: true,
      },
      {
        name: 'Water Bottle',
        description: 'Insulated water bottle keeps drinks cold for 24 hours',
        price: 599,
        stock: 150,
        category: 'Accessories',
        isActive: true,
      },
    ]);
    console.log(`Created ${products.length} products`);

    // Create coupons
    const coupons = await Coupon.create([
      {
        code: 'SAVE100',
        type: 'flat',
        value: 100,
        maxCap: null,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        maxUsage: 100,
        perUserUsage: 5,
        minOrderValue: 500,
        isActive: true,
      },
      {
        code: 'PERCENT20',
        type: 'percentage',
        value: 20,
        maxCap: 500,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        maxUsage: 50,
        perUserUsage: 3,
        minOrderValue: 1000,
        isActive: true,
      },
      {
        code: 'FIRST50',
        type: 'flat',
        value: 50,
        maxCap: null,
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        maxUsage: 1000,
        perUserUsage: 1,
        minOrderValue: 0,
        isActive: true,
      },
    ]);
    console.log(`Created ${coupons.length} coupons`);

    console.log('\n=== Seed Data Summary ===');
    console.log('Admin Credentials:');
    console.log('  Email: admin@example.com');
    console.log('  Password: admin123');
    console.log('\nCustomer Credentials:');
    console.log('  Email: john@example.com');
    console.log('  Password: customer123');
    console.log('  Email: jane@example.com');
    console.log('  Password: customer123');
    console.log('\nAvailable Coupons:');
    console.log('  SAVE100 - Flat ₹100 off (min ₹500)');
    console.log('  PERCENT20 - 20% off, max ₹500 (min ₹1000)');
    console.log('  FIRST50 - Flat ₹50 off, one-time use per user');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

connectDB().then(() => seedData());
