import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(rootDir, "android");
const localPropertiesPath = join(androidDir, "local.properties");

process.chdir(rootDir);

const options = {
  open: args.has("--open"),
  build: args.has("--build"),
  release: args.has("--release"),
  skipSync: args.has("--skip-sync"),
};

console.log("TCLVPlayer Android Studio generator");
console.log(`Project: ${rootDir}`);

configureAndroidEnvironment();

if (!options.skipSync) {
  run("npm", ["run", "prepare:web"]);
  run("npm", ["run", "android:init"]);
  run("npm", ["run", "android:apply-template"]);
  run("npx", ["cap", "sync", "android"]);
}

await ensureLocalProperties();

if (options.build) {
  const task = options.release ? "assembleRelease" : "assembleDebug";
  run(wrapperCommand(), [task], { cwd: androidDir });
}

if (options.open) {
  run("npx", ["cap", "open", "android"]);
}

console.log("");
console.log("Android Studio project is ready in ./android");
console.log("Open it with: npm run android:studio");
console.log("Build debug APK with: npm run android:apk");

function run(command, commandArgs, runOptions = {}) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}`);
  const invocation = resolveInvocation(command, commandArgs);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: runOptions.cwd || rootDir,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveInvocation(command, commandArgs) {
  if (process.platform !== "win32") {
    return { command, args: commandArgs };
  }

  if (command === "npm" || command === "npx" || command.endsWith(".bat")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...commandArgs] };
  }

  return { command, args: commandArgs };
}

function wrapperCommand() {
  return process.platform === "win32" ? "gradlew.bat" : "./gradlew";
}

function configureAndroidEnvironment() {
  const androidStudioJbr = "C:\\Program Files\\Android\\Android Studio\\jbr";
  const androidSdk = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "Android", "Sdk");

  if (!process.env.JAVA_HOME && process.platform === "win32") {
    process.env.JAVA_HOME = androidStudioJbr;
    prependPath(join(androidStudioJbr, "bin"));
    console.log(`JAVA_HOME not set, using Android Studio JBR: ${process.env.JAVA_HOME}`);
  }

  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT && process.platform === "win32") {
    process.env.ANDROID_HOME = androidSdk;
    process.env.ANDROID_SDK_ROOT = androidSdk;
    console.log(`ANDROID_HOME not set, using default SDK: ${process.env.ANDROID_HOME}`);
  }
}

function prependPath(path) {
  const delimiter = process.platform === "win32" ? ";" : ":";
  process.env.PATH = `${path}${delimiter}${process.env.PATH || ""}`;
}

async function ensureLocalProperties() {
  const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdkDir) {
    console.warn("ANDROID_HOME/ANDROID_SDK_ROOT is not set; Android Studio may ask for SDK location.");
    return;
  }

  await mkdir(androidDir, { recursive: true });
  const escapedSdk = sdkDir.replaceAll("\\", "\\\\");
  const desiredLine = `sdk.dir=${escapedSdk}`;

  let current = "";
  try {
    current = await readFile(localPropertiesPath, "utf8");
  } catch {
    // Missing local.properties is expected on a freshly generated Android project.
  }

  if (current.includes("sdk.dir=")) return;

  const next = current.trim() ? `${current.trimEnd()}\n${desiredLine}\n` : `${desiredLine}\n`;
  await writeFile(localPropertiesPath, next);
}
