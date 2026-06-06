import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log("Created .env from .env.example");
} else if (fs.existsSync(envPath)) {
  console.log(".env already exists");
} else {
  console.log("No .env.example found; skipping .env bootstrap");
}
