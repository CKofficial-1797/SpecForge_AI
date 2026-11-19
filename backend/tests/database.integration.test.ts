import { describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

describe("PostgreSQL integration", () => {
  it("connects to the configured PostgreSQL database", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      }),
    });
    try {
      await expect(prisma.$connect()).resolves.toBeUndefined();
      await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined();
    } finally {
      await prisma.$disconnect();
    }
  });
});
