import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const binary = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
const hasJava = spawnSync(binary('javac'), ['-version']).status === 0;
it.runIf(hasJava)('streams production Android file/EPG helpers with a 64 MiB heap, preserving data on failures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tclv-native-data-'));
  try {
    const stubs = {
      'android/net/Uri.java': 'package android.net; public class Uri { public String path; public static Uri parse(String value) { Uri uri = new Uri(); uri.path = value; return uri; } }',
      'android/os/SystemClock.java': 'package android.os; public class SystemClock { public static long elapsedRealtime() { return System.nanoTime() / 1000000; } }',
      'android/content/ContentResolver.java': 'package android.content; import java.io.*; import android.net.Uri; public class ContentResolver { public OutputStream openOutputStream(Uri uri, String mode) throws IOException { return new FileOutputStream(uri.path); } }',
      'android/content/Context.java': 'package android.content; import java.io.File; public class Context { private File root; public Context(File root) { this.root = root; } private File directory(String name) { File file = new File(root, name); file.mkdirs(); return file; } public File getFilesDir() { return directory("files"); } public File getCacheDir() { return directory("cache"); } public ContentResolver getContentResolver() { return new ContentResolver(); } }',
    };
    for (const [file, source] of Object.entries(stubs)) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), source); }
    const compiled = spawnSync(binary('javac'), ['-encoding', 'UTF-8', '-d', root, ...Object.keys(stubs).map(file => path.join(root, file)), 'native/android/FileExports.java', 'native/android/SourceCache.java', 'tests/native/CacheHarness.java'], { encoding: 'utf8', timeout: 30000 });
    expect(compiled.status, compiled.stderr).toBe(0);
    const run = spawnSync(binary('java'), ['--add-modules', 'jdk.httpserver', '-Xmx64m', '-cp', root, 'sk.tclv.player.CacheHarness', root], { encoding: 'utf8', timeout: 30000 });
    expect(run.stderr).toBe(''); expect(run.status).toBe(0); expect(run.stdout).toContain('Native data helpers passed');
  } finally { await rm(root, { recursive: true, force: true }); }
}, 70000);
