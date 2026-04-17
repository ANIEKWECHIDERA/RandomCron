import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.cronjob.count();
  if (count > 0) {
    return;
  }

  await prisma.cronjob.createMany({
    data: [
      {
        title: "JSON Health Check",
        url: "https://httpbin.org/json",
        method: "GET",
        minIntervalMs: 60_000,
        maxIntervalMs: 180_000,
        timeoutMs: 30_000,
        maxRetries: 10,
        enabled: false,
        headers: { Accept: "application/json" },
      },
      {
        title: "Text Endpoint",
        url: "https://httpbin.org/html",
        method: "GET",
        minIntervalMs: 60_000,
        maxIntervalMs: 240_000,
        timeoutMs: 30_000,
        maxRetries: 10,
        enabled: false,
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
