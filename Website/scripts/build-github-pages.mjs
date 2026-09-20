import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const stash = path.join(root, ".github-pages-server-routes");
const serverRoutes = [path.join(root, "app/api"), path.join(root, "app/auth")];
const moved = [];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function build() {
  return new Promise((resolve, reject) => {
    const nextBinary = path.join(root, "node_modules/next/dist/bin/next");
    const child = spawn(process.execPath, [nextBinary, "build"], {
      cwd: root,
      env: { ...process.env, GITHUB_PAGES: "true", NEXT_PUBLIC_GITHUB_PAGES: "true" },
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Next.js build stopped with ${signal}.`));
      else if (code === 0) resolve();
      else reject(new Error(`Next.js build exited with status ${code}.`));
    });
  });
}

await fs.mkdir(stash, { recursive: false });
try {
  for (const source of serverRoutes) {
    if (!(await exists(source))) continue;
    const relative = path.relative(root, source).replaceAll(path.sep, "--");
    const target = path.join(stash, relative);
    await fs.rename(source, target);
    moved.push({ source, target });
  }
  await build();
} finally {
  for (const { source, target } of moved.reverse()) {
    if (await exists(target)) await fs.rename(target, source);
  }
  await fs.rm(stash, { recursive: true, force: true });
}
