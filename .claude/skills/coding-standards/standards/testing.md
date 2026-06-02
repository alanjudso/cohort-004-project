# Testing Standards

Framework: vitest with globals enabled.

## DB mock setup

Every test file must mock the db module **before** importing the service under test:

```ts
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// import service AFTER the mock
import { myService } from "~/services/myService";
```

## beforeEach

Always initialize a fresh db and seed base data:

```ts
beforeEach(() => {
  testDb = createTestDb();
  seedBaseData(testDb);
});
```
