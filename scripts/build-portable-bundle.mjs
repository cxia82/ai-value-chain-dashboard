import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist", "ai-value-chain-dashboard-portable");

const copyTargets = [
  "src",
  "public",
  "scripts",
  "tests",
  "package.json",
  "package-lock.json",
  ".env.example",
  "README.md",
  "start-dashboard.bat",
  "start-dashboard.sh",
  "start-dashboard.command"
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const target of copyTargets) {
  const from = path.join(root, target);
  const to = path.join(outDir, target);
  if (!fs.existsSync(from)) {
    continue;
  }
  fs.cpSync(from, to, { recursive: true });
}

const quickStart = `# Portable Quick Start\n\n## Windows\n1. Double-click start-dashboard.bat\n2. Open http://localhost:3000\n\n## macOS\n1. Open Terminal in this folder\n2. Run: chmod +x start-dashboard.command start-dashboard.sh\n3. Run: ./start-dashboard.command\n4. Open http://localhost:3000\n\n## Notes\n- First run installs dependencies and creates .env automatically.\n- Requires Node.js 20+ and npm.\n`;

fs.writeFileSync(path.join(outDir, "PORTABLE-QUICKSTART.md"), quickStart, "utf8");

console.log(`Portable bundle created at: ${outDir}`);
