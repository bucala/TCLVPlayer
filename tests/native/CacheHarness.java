package sk.tclv.player;

import android.content.Context;
import android.net.Uri;
import java.io.*;
import java.net.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.GZIPOutputStream;
import com.sun.net.httpserver.HttpServer;

/** Runs the production disk/HTTP helpers with only Android platform I/O stubbed. */
public final class CacheHarness {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private interface Operation { void run() throws Exception; }
    private static void rejects(Operation operation, String message) throws Exception {
        try { operation.run(); } catch (IOException expected) { check(expected.getMessage().contains(message), expected.toString()); return; }
        throw new AssertionError("Expected rejection: " + message);
    }
    public static void main(String[] args) throws Exception {
        File root = new File(args[0]); Context context = new Context(root);
        FileExports exports = new FileExports(context);
        String export = exports.begin(), second = exports.begin();
        rejects(() -> exports.begin(), "active"); exports.discard(second);
        String part = "Čas 😀 \\\"\n".repeat(4000);
        for (int i = 0; i < 48; i++) exports.append(export, part);
        File destination = new File(root, "saved.json"); exports.save(export, Uri.parse(destination.toString()));
        check(Files.readString(destination.toPath()).equals(part.repeat(48)), "Lossless UTF-8 chunks");
        rejects(() -> exports.append(export, "expired"), "expired");
        String cancel = exports.begin(); exports.discard(cancel);
        rejects(() -> exports.append(cancel, "expired"), "expired");
        String bounded = exports.begin(); rejects(() -> exports.append(bounded, "x".repeat(131073)), "large");
        File[] pending = new File(context.getCacheDir(), "file-exports").listFiles();
        check(pending.length == 1, "No stale export files");
        try (RandomAccessFile sparse = new RandomAccessFile(pending[0], "rw")) { sparse.setLength(256L * 1024 * 1024); }
        rejects(() -> exports.append(bounded, "x"), "256 MiB"); exports.close();
        check(new File(context.getCacheDir(), "file-exports").list().length == 0, "Export cleanup");

        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><tv><channel id=\"fixture\"><display-name>Čas</display-name></channel></tv>";
        ByteArrayOutputStream gzipBytes = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(gzipBytes)) { gzip.write(xml.getBytes(StandardCharsets.UTF_8)); }
        File bomb = new File(root, "large.gz");
        try (OutputStream gzip = new GZIPOutputStream(new FileOutputStream(bomb))) { byte[] block = new byte[16384]; Arrays.fill(block, (byte) 'x'); for (int i = 0; i < 4160; i++) gzip.write(block); }
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath(); byte[] body;
            switch (path) {
                case "/404": exchange.sendResponseHeaders(404, -1); exchange.close(); return;
                case "/redirect": exchange.getResponseHeaders().set("Location", "/plain"); exchange.sendResponseHeaders(302, -1); exchange.close(); return;
                case "/huge": exchange.sendResponseHeaders(200, 65L * 1024 * 1024); exchange.close(); return;
                case "/bomb":
                    exchange.sendResponseHeaders(200, bomb.length());
                    try (OutputStream out = exchange.getResponseBody()) { Files.copy(bomb.toPath(), out); } catch (IOException ignored) {}
                    return;
                case "/compressed": body = gzipBytes.toByteArray(); break;
                case "/legacy": body = xml.replace("UTF-8", "windows-1250").getBytes(Charset.forName("windows-1250")); break;
                case "/utf16": body = xml.replace("UTF-8", "UTF-16").getBytes(StandardCharsets.UTF_16); break;
                default: body = xml.getBytes(StandardCharsets.UTF_8);
            }
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream out = exchange.getResponseBody()) { out.write(body); }
        });
        server.start();
        try {
            SourceCache cache = new SourceCache(context); String base = "http://127.0.0.1:" + server.getAddress().getPort();
            String key = null;
            for (String path : List.of("/plain", "/compressed", "/redirect", "/legacy", "/utf16")) {
                SourceCache.Download item = cache.fetch(base + path);
                check(Files.readString(item.file.toPath()).contains("Čas"), "Decode " + path);
                rejects(() -> cache.cached(item.key), "unavailable");
                cache.commit(item.id); check(cache.cached(item.key).isFile(), "Commit " + path); key = item.key;
            }
            File good = cache.cached(key); String before = Files.readString(good.toPath());
            SourceCache.Download discarded = cache.fetch(base + "/plain"); cache.discard(discarded.id);
            check(!discarded.file.exists(), "Discard unvalidated candidate");
            rejects(() -> cache.fetch(base + "/404"), "HTTP 404");
            rejects(() -> cache.fetch(base + "/huge"), "64 MiB");
            rejects(() -> cache.fetch(base + "/bomb"), "64 MiB");
            rejects(() -> cache.fetch("file:///private/fixture"), "protocol");
            rejects(() -> cache.cached("../fixture"), "key");
            check(Files.readString(good.toPath()).equals(before), "Failed refresh preserves cache");
            File cacheDirectory = new File(context.getFilesDir(), "epg-cache");
            check(cacheDirectory.list((dir, name) -> name.endsWith(".tmp")).length == 0, "Failed download cleanup");
            SourceCache.Download close = cache.fetch(base + "/plain"); cache.close();
            check(!close.file.exists(), "Pending download cleanup");
            System.out.println("Native data helpers passed with 64 MiB Java heap");
        } finally { server.stop(0); }
    }
}
