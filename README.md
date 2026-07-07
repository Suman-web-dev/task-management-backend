# Order Management System

A production-quality Order Management System REST API built with Node.js, Express, and MongoDB. This system handles product catalog management, order processing with complex pricing logic, coupon system with concurrency safety, and comprehensive reporting.

## Features

### Authentication & Authorization
- JWT-based authentication with access token + refresh token flow
- Server-side refresh token invalidation on logout (stored in database)
- Role-based access control (admin, customer)
- Password hashing with bcrypt
- Rate limiting on authentication endpoints

### Product Catalog & Inventory
- Admin can create/update products with soft delete (isActive flag)
- Public product listing with pagination, category filter, price-range filter
- Text search on name and description using MongoDB text index
- Stock management with atomic updates to prevent overselling
- Low-stock endpoint for admin monitoring

### Order Processing
- Complex pricing logic:
  - Automatic 10% discount for orders above ₹1,000
  - Coupon system with expiry, usage limits (global and per-user)
  - Automatic discount and coupon cannot combine - best discount applied
- Price snapshot stored in orders (price changes don't affect old orders)
- Idempotency support via Idempotency-Key header
- Stock deduction with atomic conditional updates
- Payment simulation with rollback on failure

### Order Lifecycle
- State machine for status transitions: PENDING → CONFIRMED → SHIPPED → DELIVERED, plus CANCELLED
- Invalid transitions are rejected
- Customer can cancel only before SHIPPED
- Cancellation restores stock and reverses coupon usage atomically
- Complete audit trail for every status change

### Background Jobs
- Auto-cancellation of unpaid pending orders after 15 minutes
- Runs every 5 minutes using node-cron
- Restores stock and coupon usage on cancellation

### Reporting (MongoDB Aggregation)
- Last 30 days: total revenue, total orders, average order value (single $facet pipeline)
- Daily revenue trend for last 30 days
- Top 5 best-selling products by quantity
- Category-wise sales breakdown with percentage share
- Top 5 customers by lifetime spend

### API Quality
- Consistent error format: `{ success, message, errors }`
- Request validation with Joi on all endpoints
- Rate limiting on order placement (5 orders/minute per user)
- Proper HTTP status codes
- Clean architecture: routes → controllers → services → models

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validation**: Joi
- **Rate Limiting**: express-rate-limit
- **Background Jobs**: node-cron
- **Testing**: Jest

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd order-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/order-management-system
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
LOW_STOCK_THRESHOLD=10
```

4. Start MongoDB:
```bash
# Using MongoDB locally
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

5. Seed the database:
```bash
npm run seed
```

This creates:
- Admin user: `admin@example.com` / `admin123`
- Customer users: `john@example.com` / `customer123`, `jane@example.com` / `customer123`
- Sample products across categories
- Sample coupons

6. Start the server:
```bash
npm run dev
```

For production:
```bash
npm start
```

## API Documentation

### Authentication

#### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer"
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "..."
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "..."
}
```

### Products

#### Get Products (Public)
```http
GET /api/products?page=1&limit=10&category=Electronics&minPrice=500&maxPrice=5000&search=wireless&sortBy=price&sortOrder=asc
```

#### Get Product by ID (Public)
```http
GET /api/products/:id
```

#### Create Product (Admin Only)
```http
POST /api/products
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Wireless Headphones",
  "description": "High-quality wireless headphones",
  "price": 2999,
  "stock": 50,
  "category": "Electronics"
}
```

#### Update Product (Admin Only)
```http
PUT /api/products/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "price": 2799,
  "stock": 45
}
```

#### Get Low Stock Products (Admin Only)
```http
GET /api/products/admin/low-stock?threshold=10
Authorization: Bearer <access_token>
```

### Orders

#### Create Order (Customer Only)
```http
POST /api/orders
Authorization: Bearer <access_token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "items": [
    {
      "product": "<product_id>",
      "quantity": 2
    }
  ],
  "couponCode": "SAVE100",
  "simulatePayment": true
}
```

#### Get My Orders (Customer Only)
```http
GET /api/orders/my-orders?page=1&limit=10&status=CONFIRMED
Authorization: Bearer <access_token>
```

#### Get Order by ID
```http
GET /api/orders/:id
Authorization: Bearer <access_token>
```

#### Cancel Order (Customer Only)
```http
POST /api/orders/:id/cancel
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "No longer needed"
}
```

#### Update Order Status (Admin Only)
```http
PATCH /api/orders/:id/status
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "CONFIRMED",
  "reason": "Payment verified"
}
```

#### Get Order History
```http
GET /api/orders/:id/history
Authorization: Bearer <access_token>
```

### Coupons (Admin Only)

#### Create Coupon
```http
POST /api/coupons
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "code": "SAVE100",
  "type": "flat",
  "value": 100,
  "expiryDate": "2024-12-31T23:59:59Z",
  "maxUsage": 100,
  "perUserUsage": 5,
  "minOrderValue": 500
}
```

#### Get Coupons
```http
GET /api/coupons?page=1&limit=10&isActive=true
Authorization: Bearer <access_token>
```

### Reports (Admin Only)

#### Last 30 Days Summary
```http
GET /api/reports/summary
Authorization: Bearer <access_token>
```

#### Daily Revenue Trend
```http
GET /api/reports/daily-revenue
Authorization: Bearer <access_token>
```

#### Top Selling Products
```http
GET /api/reports/top-products
Authorization: Bearer <access_token>
```

#### Category Sales Breakdown
```http
GET /api/reports/category-breakdown
Authorization: Bearer <access_token>
```

#### Top Customers
```http
GET /api/reports/top-customers
Authorization: Bearer <access_token>
```

## Testing

Run unit tests:
```bash
npm test
```

Tests cover:
- Automatic discount calculation
- Coupon discount calculation (flat and percentage)
- Best discount selection logic
- Edge cases (minimum order values, caps, etc.)

## MongoDB Indexes

The following indexes are created for optimal query performance:

### User Collection
- `email` (unique) - For login/signup lookups

### Product Collection
- Text index on `name` and `description` - For full-text search
- `category, isActive` - For category filtering
- `price, isActive` - For price range filtering
- `createdAt` (descending) - For default sorting
- `price` - For price-based sorting
- `stock, isActive` - For low stock queries

### Coupon Collection
- `code` (unique) - For coupon lookups
- `isActive, expiryDate` - For finding active coupons
- `userUsage.userId` - For per-user usage tracking

### Order Collection
- `user, createdAt` (descending) - For user order history
- `idempotencyKey` (sparse unique) - For idempotency
- `status, createdAt` (descending) - For status-based queries
- `status, paymentStatus, createdAt` - For auto-cancellation job
- `createdAt` (descending) - For reporting
- `total` (descending) - For revenue-based reporting

### OrderHistory Collection
- `order, createdAt` (descending) - For order history lookups
- `changedBy, createdAt` (descending) - For user activity tracking

## Project Structure

```
order-management-system/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── index.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── couponController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Coupon.js
│   │   ├── Order.js
│   │   └── OrderHistory.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── orderRoutes.js
│   │   ├── couponRoutes.js
│   │   └── reportRoutes.js
│   ├── scripts/
│   │   └── seed.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── productService.js
│   │   ├── pricingService.js
│   │   ├── couponService.js
│   │   ├── couponManagementService.js
│   │   ├── orderService.js
│   │   └── reportService.js
│   ├── validators/
│   │   ├── authValidator.js
│   │   ├── productValidator.js
│   │   ├── orderValidator.js
│   │   └── couponValidator.js
│   ├── jobs/
│   │   └── autoCancelJob.js
│   └── server.js
├── tests/
│   └── pricingService.test.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── DESIGN.md
```

## Design Decisions

See [DESIGN.md](DESIGN.md) for detailed explanations of:
- Stock race condition handling
- Coupon concurrency safety
- Idempotency implementation
- Auto-cancellation strategy
- Trade-offs made

## License

ISC
