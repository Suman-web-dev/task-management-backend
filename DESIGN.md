# Design Document

This document explains the key design decisions and technical approaches used in the Order Management System.

## Table of Contents

1. [Stock Race Condition Handling](#stock-race-condition-handling)
2. [Coupon Concurrency Safety](#coupon-concurrency-safety)
3. [Idempotency Implementation](#idempotency-implementation)
4. [Auto-Cancellation Strategy](#auto-cancellation-strategy)
5. [Refresh Token Invalidation](#refresh-token-invalidation)
6. [Trade-offs and Design Decisions](#trade-offs-and-design-decisions)

---

## Stock Race Condition Handling

### Problem
When two customers simultaneously try to purchase the last unit of a product, a naive "find-then-save" approach can lead to overselling:
1. Customer A reads stock = 1
2. Customer B reads stock = 1
3. Customer A decrements stock to 0 and saves
4. Customer B decrements stock to 0 and saves
5. Result: Stock = 0, but both customers think they purchased it

### Solution: Atomic Conditional Updates

We use MongoDB's `findOneAndUpdate` with a conditional query to ensure atomic stock deduction:

```javascript
const result = await Product.findOneAndUpdate(
  {
    _id: item.product,
    isActive: true,
    stock: { $gte: item.quantity }, // Condition: stock must be >= quantity
  },
  {
    $inc: { stock: -item.quantity }, // Atomic decrement
  },
  { session, new: true }
);

if (!result) {
  throw new Error(`Insufficient stock for product ${item.product}`);
}
```

**How it works:**
- MongoDB evaluates the condition and performs the update atomically
- If the condition fails (stock < quantity), the update doesn't happen
- Only one concurrent request will succeed when stock is at the threshold
- The other request receives `null` and we throw an error

**Transaction Integration:**
- Stock deduction is wrapped in a MongoDB transaction
- If any part of order creation fails, the transaction is aborted
- This ensures stock is never deducted without a successful order

**Why not find-then-save?**
- Find-then-save creates a race condition window between read and write
- Requires additional locking mechanisms or version fields
- More complex and error-prone

---

## Coupon Concurrency Safety

### Problem
When 100 parallel requests use a coupon with a 50-usage limit, we must ensure exactly 50 succeed. A naive approach could allow over-usage.

### Solution: Atomic Increment with Condition Check

We use MongoDB transactions with atomic updates to ensure coupon usage limits are respected:

```javascript
// Step 1: Check global usage limit atomically
const couponUpdate = await Coupon.findOneAndUpdate(
  {
    _id: coupon._id,
    currentUsage: { $lt: coupon.maxUsage }, // Condition
  },
  {
    $inc: { currentUsage: 1 }, // Atomic increment
  },
  { session, new: true }
);

if (!couponUpdate) {
  throw new Error('Coupon usage limit exceeded');
}

// Step 2: Check per-user usage limit atomically
const userUsageEntry = couponUpdate.userUsage.find(
  u => u.userId.toString() === userId.toString()
);

if (userUsageEntry && userUsageEntry.count >= coupon.perUserUsage) {
  // Rollback global usage increment
  await Coupon.findByIdAndUpdate(
    coupon._id,
    { $inc: { currentUsage: -1 } },
    { session }
  );
  throw new Error('You have reached the maximum usage limit for this coupon');
}

// Step 3: Increment user usage
if (userUsageEntry) {
  await Coupon.findOneAndUpdate(
    { _id: coupon._id, 'userUsage.userId': userId },
    { $inc: { 'userUsage.$.count': 1 } },
    { session }
  );
} else {
  await Coupon.findByIdAndUpdate(
    coupon._id,
    { $push: { userUsage: { userId, count: 1 } } },
    { session }
  );
}
```

**How it works:**
1. Global usage check: The `currentUsage < maxUsage` condition is evaluated atomically with the increment
2. Only requests that pass this condition proceed
3. Per-user check is performed after global check
4. If per-user limit is exceeded, we rollback the global increment
5. All operations are in a transaction - if any step fails, everything is rolled back

**Reversion on Order Cancellation:**
When an order is cancelled or payment fails, we atomically decrement both global and per-user usage:

```javascript
// Decrement global usage
await Coupon.findByIdAndUpdate(
  coupon._id,
  { $inc: { currentUsage: -1 } },
  { session }
);

// Decrement user usage
if (userUsageEntry.count === 1) {
  await Coupon.findByIdAndUpdate(
    coupon._id,
    { $pull: { userUsage: { userId } } },
    { session }
  );
} else {
  await Coupon.findOneAndUpdate(
    { _id: coupon._id, 'userUsage.userId': userId },
    { $inc: { 'userUsage.$.count': -1 } },
    { session }
  );
}
```

**Why this approach?**
- Atomic operations at the database level eliminate race conditions
- Transactions ensure all-or-nothing semantics
- No need for distributed locks or external coordination
- Scales well with MongoDB's built-in concurrency control

---

## Idempotency Implementation

### Problem
Network failures can cause clients to retry requests. Without idempotency, retrying an order placement would create duplicate orders and deduct stock multiple times.

### Solution: Idempotency-Key Header

Clients provide a unique `Idempotency-Key` header. We store this key with the order and return the existing order if the key is reused.

```javascript
// Check for existing order with same idempotency key
if (idempotencyKey) {
  const existingOrder = await Order.findOne({ idempotencyKey });
  if (existingOrder) {
    return { order: existingOrder, isIdempotent: true };
  }
}

// Create new order with idempotency key
const order = await Order.create({
  // ... other fields
  idempotencyKey,
});
```

**Key Design Decisions:**

1. **Sparse Unique Index**: The `idempotencyKey` field has a sparse unique index
   - Allows null values (orders without idempotency keys)
   - Ensures uniqueness for non-null values at the database level

2. **Client-Generated Keys**: Clients generate the keys (UUIDs recommended)
   - Server doesn't need to track issued keys
   - Simpler implementation
   - Client controls key lifecycle

3. **No Expiration**: Keys don't expire
   - Simpler implementation
   - Clients can reuse keys for different operations if needed
   - Trade-off: Potential for key collision over very long periods

4. **Response Code**: Returns 200 for idempotent requests, 201 for new orders
   - Allows clients to distinguish between new and cached responses

**Why not server-generated keys?**
- Server-generated keys require additional storage and cleanup
- Client-generated keys are simpler and follow HTTP idempotency patterns
- Clients can use business identifiers (e.g., checkout session ID)

---

## Auto-Cancellation Strategy

### Problem
Orders that remain PENDING (unpaid) for too long should be automatically cancelled to free up stock for other customers.

### Why MongoDB TTL Index Alone is Insufficient

A MongoDB TTL (Time-To-Live) index can automatically delete documents after a set time. However, it's not suitable for this use case because:

1. **No Side Effects**: TTL indexes only delete documents - they cannot execute logic
   - We need to restore stock when cancelling
   - We need to revert coupon usage
   - We need to record the cancellation in the audit trail

2. **No Transaction Support**: TTL deletions happen outside of transactions
   - Stock restoration and coupon reversion must be atomic
   - Without transactions, we could have inconsistent state

3. **No Business Logic**: Cannot implement conditional logic
   - Different cancellation reasons
   - Notification triggers
   - Integration with payment gateways

4. **No Audit Trail**: Silent deletion without history
   - We need to record who cancelled and why
   - Important for customer service and analytics

### Solution: Background Job with node-cron

We use a scheduled background job that runs every 5 minutes:

```javascript
cron.schedule('*/5 * * * *', async () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const pendingOrders = await Order.find({
    status: 'PENDING',
    paymentStatus: 'PENDING',
    createdAt: { $lt: fifteenMinutesAgo },
  });

  for (const order of pendingOrders) {
    await updateOrderStatus(
      order._id,
      'CANCELLED',
      order.user,
      'system',
      'Auto-cancelled due to payment timeout'
    );
  }
});
```

**Advantages:**
- Executes full business logic (stock restoration, coupon reversion, audit trail)
- Runs within transactions for consistency
- Can be extended with notifications, integrations, etc.
- Easy to monitor and debug

**Trade-offs:**
- Not exactly real-time (up to 5 minute delay)
- Requires the application to be running
- Slightly more complex than TTL index

**Alternative Considered:**
- **Message Queue (BullMQ/Agenda)**: More robust for distributed systems, but adds complexity
- **Change Streams**: Real-time but requires additional infrastructure
- **Cron job is sufficient** for this use case given the 15-minute threshold

---

## Refresh Token Invalidation

### Problem
When a user logs out, the refresh token should be invalidated to prevent reuse. We need a strategy to track and invalidate tokens.

### Solution: Database Storage with TTL

Refresh tokens are stored in the user document with an embedded array:

```javascript
refreshTokens: [{
  token: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800, // 7 days in seconds
  },
}]
```

**How it works:**

1. **Login**: Token is added to the array
   ```javascript
   user.refreshTokens.push({ token: refreshToken });
   await user.save();
   ```

2. **Logout**: Specific token is removed
   ```javascript
   user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);
   await user.save();
   ```

3. **Logout All**: All tokens are cleared
   ```javascript
   user.refreshTokens = [];
   await user.save();
   ```

4. **Token Refresh**: Old token is removed, new token is added
   ```javascript
   await user.removeRefreshToken(oldToken);
   await user.addRefreshToken(newToken);
   ```

5. **Automatic Cleanup**: MongoDB's TTL index removes expired tokens automatically

**Why this approach over alternatives?**

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Database Storage** | Simple, no external dependency, automatic cleanup | Slightly slower than Redis | ✅ Chosen |
| **Redis Blacklist** | Fast, scalable | Additional infrastructure, no automatic cleanup | Not chosen |
| **Token Version** | Stateless, fast | Requires version bump on logout, doesn't support selective logout | Not chosen |
| **JWT Blacklist** | Flexible | Requires external storage, manual cleanup | Not chosen |

**Trade-offs:**
- Database storage is slightly slower than Redis but sufficient for this use case
- TTL index provides automatic cleanup without manual jobs
- Supports both single-device and all-device logout

---

## Trade-offs and Design Decisions

### 1. MongoDB Transactions vs. Individual Atomic Operations

**Decision**: Use MongoDB transactions for complex multi-document operations (order creation, cancellation).

**Rationale:**
- Ensures all-or-nothing semantics across multiple documents
- Simplifies rollback logic
- MongoDB 4.0+ has robust transaction support

**Trade-offs:**
- Slightly slower than individual operations
- Requires careful session management
- Not suitable for very high-throughput scenarios (acceptable here)

### 2. State Machine vs. Scattered If-Else

**Decision**: Implement order status transitions as a state machine with a transition map.

**Rationale:**
- Centralized transition logic is easier to maintain
- Impossible to have invalid transitions
- Clear visualization of allowed flows
- Easy to add new states or transitions

**Trade-offs:**
- Slightly more code upfront
- Less flexible for ad-hoc state changes (which is good - prevents bugs)

### 3. Price Snapshot vs. Reference to Product

**Decision**: Store product price in order items at purchase time.

**Rationale:**
- Historical orders reflect actual prices paid
- Price changes don't affect old orders
- Required for accurate revenue reporting
- Standard e-commerce practice

**Trade-offs:**
- Slightly more storage
- Price changes require data migration if we want to update historical data (not needed)

### 4. Soft Delete vs. Hard Delete for Products

**Decision**: Use soft delete with `isActive` flag.

**Rationale:**
- Preserves product data in old orders
- Can reactivate products if needed
- Audit trail of product lifecycle
- Standard practice for e-commerce

**Trade-offs:**
- Queries must always filter by `isActive`
- Slightly more complex queries
- Storage accumulation over time (acceptable)

### 5. Pagination: Cursor vs. Offset

**Decision**: Use offset-based pagination with page/limit parameters.

**Rationale:**
- Simpler to implement and use
- Sufficient for the expected data volume
- Easier for clients to navigate

**Trade-offs:**
- Performance degrades with large offsets
- Can miss or duplicate items if data changes during pagination
- For very large datasets, cursor-based pagination would be better

### 6. Rate Limiting: In-Memory vs. Redis

**Decision**: Use in-memory rate limiting with express-rate-limit.

**Rationale:**
- No external dependency
- Sufficient for single-instance deployment
- Simple configuration

**Trade-offs:**
- Doesn't work across multiple server instances
- Lost on server restart
- For distributed systems, Redis-backed rate limiting would be needed

### 7. Background Job: node-cron vs. BullMQ

**Decision**: Use node-cron for auto-cancellation job.

**Rationale:**
- Simple, no external queue dependency
- Sufficient for the 5-minute interval
- Easy to monitor and debug

**Trade-offs:**
- Not distributed - job runs on one instance
- No retry mechanism if job fails
- For production at scale, BullMQ or similar would be better

### 8. Validation: Joi vs. Zod

**Decision**: Use Joi for request validation.

**Rationale:**
- Mature, well-documented library
- Good integration with Express
- Comprehensive validation features

**Trade-offs:**
- Slightly larger bundle size than Zod
- Zod has better TypeScript support (not relevant here as we're using JavaScript)

### 9. Error Handling: Custom Error Class vs. HTTP Errors

**Decision**: Use custom error class with status codes.

**Rationale:**
- Consistent error format across the application
- Easy to extend with custom error types
- Centralized error handling in middleware

**Trade-offs:**
- Slightly more boilerplate
- Worth it for consistency and maintainability

---

## Future Improvements

1. **Redis Caching**: Cache product listings to reduce database load
2. **Docker Deployment**: Add Dockerfile and docker-compose for easy deployment
3. **Request Logging**: Add correlation IDs for distributed tracing
4. **API Documentation**: Integrate Swagger/OpenAPI for interactive docs
5. **Payment Gateway Integration**: Replace simulated payment with real gateway
6. **Email Notifications**: Send emails for order confirmations, cancellations
7. **Webhooks**: Allow external systems to subscribe to order events
8. **Metrics and Monitoring**: Add Prometheus metrics and health checks
9. **Rate Limiting with Redis**: For distributed deployment
10. **Message Queue**: Use BullMQ for reliable background job processing
