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
```

## Test Structure

### Unit Tests (`tests/unit/`)

Unit tests focus on testing individual components in isolation:

- **`validators.test.ts`** - Tests for all validator functions (string, number, id, etc.)
- **`schema.test.ts`** - Tests for schema definition and validation
- **`database.test.ts`** - Tests for database operations (CRUD, queries)
- **`functions.test.ts`** - Tests for query/mutation definitions and FunctionRunner

### Integration Tests (`tests/integration/`)

Integration tests verify complete workflows across multiple components:

- **`full-workflow.test.ts`** - End-to-end business scenarios:
  - User management workflow
  - Customer creation and management
  - Invoice lifecycle (creation, status updates, queries)
  - Multi-user data isolation
  - Complete business flows
  - Error handling and validation

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

