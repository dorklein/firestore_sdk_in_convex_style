# E2E Testing Guide

This document provides a comprehensive guide to running end-to-end (E2E) tests for the Firestore Convex-style SDK.

## Overview

E2E tests use the **Firebase Emulator Suite** to test the SDK against a real Firestore instance. This ensures that:

- ✅ The SDK works correctly with actual Firestore APIs
- ✅ Queries execute properly
- ✅ Data persistence works as expected
- ✅ Complex workflows function end-to-end
- ✅ Performance is acceptable with real data

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Firebase Emulator

In one terminal:
```bash
pnpm emulator:start
```

This starts Firestore emulator on port 8080 and the UI on port 4000.

### 3. Run E2E Tests

In another terminal:
```bash
pnpm test:e2e
```

### Alternative: One Command

Use the helper script to automatically start emulator, run tests, and clean up:

```bash
pnpm test:e2e:run
```

Or use Firebase's built-in command:

```bash
firebase emulators:exec --only firestore "pnpm test:e2e"
```

## What Gets Tested

### Database Operations Test Suite

**File:** `tests/e2e/database.e2e.test.ts`

Tests low-level database operations:
- Insert operations (single, multiple, with/without optional fields)
- Get operations (existing and non-existent documents)
- Patch operations (update specific fields)
- Replace operations (replace entire document)
- Delete operations
- Query operations (where, order, limit, first)
- Document relationships
- Concurrent operations
- Large data sets

**Total:** 26 test cases

### Workflows Test Suite

**File:** `tests/e2e/workflows.e2e.test.ts`

Tests complete business workflows:
- User management (create, retrieve, find by email)
- Customer management (CRUD, validation)
- Invoice lifecycle (draft → sent → paid)
- Revenue calculations
- Multi-user data isolation
- Bulk operations
- Performance with realistic data

**Total:** 16 test cases

## Emulator UI

When the emulator is running, access the web UI:

- **Firestore Data:** http://localhost:4000/firestore
- **Main Dashboard:** http://localhost:4000

Use the UI to:
- Inspect database state during tests
- View collections and documents
- Debug test failures
- Monitor query performance

## Test Results

### Expected Output

```
✓ tests/e2e/database.e2e.test.ts  (26 tests) 2.5s
✓ tests/e2e/workflows.e2e.test.ts  (16 tests) 1.8s

Test Files  2 passed (2)
     Tests  42 passed (42)
  Duration  4.3s
```

### Performance

E2E tests are slower than unit/integration tests:
- **Unit tests:** ~50ms
- **Integration tests:** ~80ms  
- **E2E tests:** ~4-5 seconds

This is expected because they use real Firestore operations.

## Troubleshooting

### "Firebase Emulator is not running!"

**Problem:** Tests fail immediately with this error.

**Solution:** Start the emulator first:
```bash
pnpm emulator:start
```

### Port Already in Use

**Problem:** Emulator fails to start.

**Solution:** 
1. Find and kill process on port 8080:
   ```bash
   lsof -ti:8080 | xargs kill -9
   ```
2. Or change port in `firebase.json`

### Tests Fail Intermittently

**Problem:** Tests pass sometimes, fail other times.

**Solution:** This usually indicates:
1. Data not being cleared between tests
2. Concurrent test execution issues
3. Timing issues

Check that `clearFirestoreData()` is called in `beforeEach()`.

### Slow Test Execution

**Problem:** Tests take a very long time.

**Solution:**
1. This is normal for E2E tests
2. Run specific test files:
   ```bash
   pnpm vitest tests/e2e/database.e2e.test.ts
   ```
3. Use `test.only` for debugging single tests

### Connection Refused

**Problem:** Tests can't connect to emulator.

**Solution:**
1. Verify emulator is running: `curl http://localhost:8080`
2. Check `firebase.json` port configuration
3. Ensure no firewall blocking localhost connections

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Run E2E Tests
        run: firebase emulators:exec --only firestore "pnpm test:e2e"
```

### GitLab CI Example

```yaml
e2e-tests:
  image: node:20
  script:
    - npm install -g pnpm firebase-tools
    - pnpm install
    - firebase emulators:exec --only firestore "pnpm test:e2e"
```

## Development Workflow

### Writing New E2E Tests

1. **Start emulator** (keep it running during development):
   ```bash
   pnpm emulator:start
   ```

2. **Create test file** in `tests/e2e/`:
   ```typescript
   import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
   import { initializeFirebaseEmulator, clearFirestoreData } from "./helpers/emulator";
   
   describe("My E2E Test", () => {
     let firestore: Firestore;
     
     beforeAll(async () => {
       firestore = initializeFirebaseEmulator();
     });
     
     beforeEach(async () => {
       await clearFirestoreData(firestore);
     });
     
     it("should test something", async () => {
       // Your test here
     });
   });
   ```

3. **Run in watch mode**:
   ```bash
   pnpm vitest tests/e2e --watch
   ```

4. **Debug with UI**:
   - Open http://localhost:4000/firestore
   - Run test
   - Inspect database state

### Best Practices

1. **Clean data between tests**
   ```typescript
   beforeEach(async () => {
     await clearFirestoreData(firestore);
   });
   ```

2. **Use realistic data**
   ```typescript
   await runner.runMutation(createCustomer, {
     name: "Acme Corporation",
     email: "billing@acme.com",
     phone: "+1-555-0123",
   });
   ```

3. **Test complete workflows**
   ```typescript
   // Bad: Testing isolated operation
   it("should create invoice", async () => { ... });
   
   // Good: Testing complete workflow
   it("should handle invoice lifecycle from draft to paid", async () => {
     // Create customer
     // Create invoice
     // Update status
     // Verify queries
   });
   ```

4. **Verify data isolation**
   ```typescript
   it("should isolate data between users", async () => {
     const user1 = await createUser(...);
     const user2 = await createUser(...);
     
     // Create data for user1
     // Query user1's data
     // Verify user2 can't see user1's data
   });
   ```

## Comparison: Unit vs Integration vs E2E

| Aspect | Unit | Integration | E2E |
|--------|------|-------------|-----|
| **Speed** | ~50ms | ~80ms | ~4s |
| **Mocking** | Heavy | Partial | None |
| **Real DB** | ❌ | ❌ | ✅ |
| **Coverage** | Functions | Workflows | Complete |
| **Debugging** | Easy | Medium | Hard |
| **CI Cost** | Low | Low | Medium |

**Recommendation:** Run all three types for comprehensive coverage.

## Monitoring and Debugging

### View Logs

Emulator outputs detailed logs:
```bash
pnpm emulator:start
```

Watch for:
- Document reads/writes
- Query execution times
- Index usage
- Errors and warnings

### Debug Single Test

```bash
pnpm vitest tests/e2e/workflows.e2e.test.ts -t "should create and retrieve a user"
```

### Verbose Output

```bash
pnpm vitest tests/e2e --reporter=verbose
```

### Pause Test Execution

```typescript
it("should do something", async () => {
  await createData();
  
  // Pause here to inspect in UI
  console.log("Open http://localhost:4000/firestore");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 sec pause
  
  await verifyData();
});
```

## Configuration Files

### `firebase.json`

```json
{
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

### `.firebaserc`

```json
{
  "projects": {
    "default": "demo-test-project"
  }
}
```

## Resources

- **Firebase Emulator Docs:** https://firebase.google.com/docs/emulator-suite
- **Vitest Docs:** https://vitest.dev
- **E2E Test README:** [`tests/e2e/README.md`](./tests/e2e/README.md)
- **Main Test README:** [`tests/README.md`](./tests/README.md)

## Summary

E2E tests provide confidence that your SDK works correctly in production-like conditions. While slower than unit tests, they catch issues that mocks cannot simulate.

**Commands Cheat Sheet:**
```bash
# Start emulator (keep running)
pnpm emulator:start

# Run E2E tests (in another terminal)
pnpm test:e2e

# Run with auto-start/stop
pnpm test:e2e:run

# Run specific test file
pnpm vitest tests/e2e/database.e2e.test.ts

# Run in watch mode
pnpm vitest tests/e2e --watch
```

🎉 Happy testing!

