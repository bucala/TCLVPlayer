import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const androidDir = "android";
const manifestPath = join(androidDir, "app", "src", "main", "AndroidManifest.xml");

if (await exists(manifestPath)) {
  console.log("Android project already exists.");
  process.exit(0);
}

if (await exists(androidDir)) {
  console.error(
    "Incomplete android/ folder found, but AndroidManifest.xml is missing. Move or delete the generated android/ folder, then run `npm run android:sync` again.",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["cap", "add", "android"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
