# End-to-End Tests

These tests run against the **Firebase Emulator Suite** to test the SDK with a real Firestore instance.

## Prerequisites

1. **Firebase Tools** must be installed:
   ```bash
   pnpm install
   ```

2. **Firebase Emulator** must be running before executing e2e tests.

## Running E2E Tests

### Option 1: Manual (Recommended for Development)

Start the emulator in one terminal:
```bash
pnpm emulator:start
```

Then run the tests in another terminal:
```bash
pnpm test:e2e
```

### Option 2: One Command

Use Firebase's `emulators:exec` to automatically start, run tests, and stop:
```bash
firebase emulators:exec --only firestore "pnpm test:e2e"
```

## What Gets Tested

### Database Operations (`database.e2e.test.ts`)

**CRUD Operations:**
- ✅ Insert documents with validation
- ✅ Get documents by ID
- ✅ Update documents (patch)
- ✅ Replace entire documents
- ✅ Delete documents

**Query Operations:**
- ✅ Query all documents
- ✅ Filter with `where` clauses
- ✅ Multiple `where` conditions
- ✅ Order results (ascending/descending)
- ✅ Limit results
- ✅ Combined queries (where + order + limit)
- ✅ `first()` helper method

**Advanced Features:**
- ✅ Document relationships and references
- ✅ Querying across relationships
- ✅ Concurrent operations
- ✅ Large data sets (50+ documents)

### Full Workflows (`workflows.e2e.test.ts`)

**User Management:**
- ✅ Create and retrieve users
- ✅ Find users by email
- ✅ Error handling for non-existent users

**Customer Management:**
- ✅ Create customers linked to users
- ✅ Update customer information
- ✅ Delete customers (with validation)
- ✅ Prevent deletion when invoices exist
- ✅ Query customers by user

**Invoice Lifecycle:**
- ✅ Create invoices
- ✅ Update invoice status (draft → sent → paid)
- ✅ Query invoices by status
- ✅ Query invoices by customer
- ✅ Calculate total revenue

**Complete Business Scenarios:**
- ✅ Multi-user isolation
- ✅ Complex workflows with multiple entities
- ✅ Bulk operations
- ✅ Performance with realistic data volumes

## Test Structure

```
tests/e2e/
├── README.md                    # This file
├── helpers/
│   └── emulator.ts             # Emulator connection utilities
├── database.e2e.test.ts        # Low-level database operations
└── workflows.e2e.test.ts       # High-level business workflows
```

## Configuration

### Firebase Configuration (`firebase.json`)

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

### Emulator UI

When the emulator is running, access the UI at:
- **Firestore UI:** http://localhost:4000/firestore
- **Main UI:** http://localhost:4000

## Helper Functions

The `emulator.ts` helper provides:

- `initializeFirebaseEmulator()` - Connect to emulator
- `clearFirestoreData()` - Clean database between tests
- `cleanupFirebase()` - Properly shut down connections
- `isEmulatorRunning()` - Check emulator status

## Troubleshooting

### Error: "Firebase Emulator is not running!"

**Solution:** Start the emulator first:
```bash
pnpm emulator:start
```

### Port Already in Use

**Solution:** Stop other emulator instances or change ports in `firebase.json`.

### Tests Are Slow

E2E tests are slower than unit tests because they use a real database. This is expected.

### Data Persists Between Tests

Each test suite calls `clearFirestoreData()` in `beforeEach()` to ensure a clean slate.

### Connection Issues

The emulator runs on `localhost:8080` by default. Ensure nothing else is using this port.

## Best Practices

1. **Always clean data** between tests using `clearFirestoreData()`
2. **Test real scenarios** - E2E tests should mirror production use cases
3. **Keep tests focused** - Each test should verify one workflow
4. **Use meaningful data** - Use realistic names and values
5. **Test edge cases** - Error conditions, validation, constraints

## Performance Considerations

E2E tests are slower than unit tests:
- **Unit tests:** ~50ms total
- **E2E tests:** ~2-5 seconds total

This is normal and expected. E2E tests verify the SDK works correctly with a real Firestore instance.

## CI/CD Integration

For CI/CD pipelines, use this pattern:

```yaml
# GitHub Actions example
- name: Start Firebase Emulator
  run: pnpm emulator:start &
  
- name: Wait for Emulator
  run: |
    timeout 30 bash -c 'until curl -s http://localhost:8080 > /dev/null; do sleep 1; done'

- name: Run E2E Tests
  run: pnpm test:e2e

- name: Stop Emulator
  run: pkill -f firebase
```

Or use the simpler approach:

```yaml
- name: Run E2E Tests
  run: firebase emulators:exec --only firestore "pnpm test:e2e"
```

## Debugging

### View Emulator Logs

The emulator outputs detailed logs to the console. Watch for:
- Connection attempts
- Query executions
- Errors and warnings

### Inspect Database State

Use the Emulator UI (http://localhost:4000/firestore) to:
- View all collections
- Inspect documents
- See query results
- Monitor operations in real-time

### Run Single Test

```bash
pnpm vitest tests/e2e/database.e2e.test.ts
```

### Verbose Output

```bash
pnpm vitest tests/e2e --reporter=verbose
```

