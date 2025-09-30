# Test Suite

This directory contains comprehensive unit and integration tests for the Firestore Convex-style SDK.

## Test Framework

We use **Vitest** - a modern, fast testing framework with excellent TypeScript support.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run only E2E tests (requires Firebase emulator)
pnpm test:e2e

# Start Firebase emulator
pnpm emulator:start
```

## Test Structure

### Unit Tests (`tests/unit/`)

Fast, isolated tests using mocked dependencies.

Unit tests focus on testing individual components in isolation:

- **`validators.test.ts`** - Tests for all validator functions (string, number, id, etc.)
- **`schema.test.ts`** - Tests for schema definition and validation
- **`database.test.ts`** - Tests for database operations (CRUD, queries)
- **`functions.test.ts`** - Tests for query/mutation definitions and FunctionRunner

### Integration Tests (`tests/integration/`)

Tests that verify workflows across multiple components using mocks:

- **`full-workflow.test.ts`** - End-to-end business scenarios:
  - User management workflow
  - Customer creation and management
  - Invoice lifecycle (creation, status updates, queries)
  - Multi-user data isolation
  - Complete business flows
  - Error handling and validation

### E2E Tests (`tests/e2e/`)

End-to-end tests that run against **Firebase Emulator**. These test the SDK with a real Firestore instance.

**Requirements:** Firebase Emulator must be running

- **`database.e2e.test.ts`** - Database CRUD and query operations against real Firestore
- **`workflows.e2e.test.ts`** - Complete business workflows with real data persistence

See [`tests/e2e/README.md`](./e2e/README.md) for detailed E2E test documentation.

## Test Coverage

The test suite aims for high coverage of:

- ✅ All validator types and edge cases
- ✅ Schema definition and validation
- ✅ Database CRUD operations
- ✅ Query builder functionality
- ✅ Function definitions (queries and mutations)
- ✅ Function execution and argument validation
- ✅ Error handling and propagation
- ✅ Type safety validation
- ✅ Multi-table relationships
- ✅ Data isolation between users

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";
import * as v from "../../src/validators";

describe("MyFeature", () => {
  it("should do something", () => {
    const result = v.string();
    expect(result).toBeDefined();
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { FunctionRunner } from "../../src/functions";

describe("My Workflow", () => {
  let runner: FunctionRunner<any>;

  beforeEach(() => {
    // Setup
  });

  it("should complete full workflow", async () => {
    // Test implementation
  });
});
```

## Mocking

Tests use Vitest's built-in mocking capabilities (`vi.fn()`) to mock Firestore operations. The mock implementations provide realistic behavior for:

- Document CRUD operations
- Query filtering and ordering
- Collection operations
- Error conditions

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: pnpm test

- name: Check coverage
  run: pnpm test:coverage
```

## Debugging Tests

Run specific test files:

```bash
pnpm vitest tests/unit/validators.test.ts
```

Run tests matching a pattern:

```bash
pnpm vitest --grep "should create a user"
```

Run in debug mode with verbose output:

```bash
pnpm vitest --reporter=verbose
```

