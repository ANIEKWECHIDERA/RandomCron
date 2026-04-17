import { spawn } from "node:child_process";
import path from "node:path";

const provider = (process.env.DATABASE_PROVIDER || "sqlite").toLowerCase();
const schema =
  provider === "postgresql" || provider === "postgres" || provider === "prod" || provider === "production"
    ? "prisma/postgresql/schema.prisma"
    : "prisma/schema.prisma";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npm run prisma:* -- <prisma command>");
  process.exit(1);
}

const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
const child = spawn(process.execPath, [prismaCli, ...args, "--schema", schema], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
