const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must point to the isolated specforge_test database",
  );
}

const testDatabaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
if (testDatabaseName !== "specforge_test") {
  throw new Error(
    "Integration tests are restricted to the specforge_test database",
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
