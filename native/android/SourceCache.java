package sk.tclv.player;

import android.content.Context;
import android.os.SystemClock;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

/** Downloads XMLTV to private disk, never serializing the complete body through WebView. */
public final class SourceCache {
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private final File directory;
    private final Map<String, Download> pending = new HashMap<>();
    public static final class Download {
        public final String id, key; public final File file;
        Download(String id, String key, File file) { this.id = id; this.key = key; this.file = file; }
    }
    public SourceCache(Context context) {
        directory = new File(context.getFilesDir(), "epg-cache"); directory.mkdirs();
        File[] files = directory.listFiles();
        if (files != null) for (File file : files) if (file.getName().endsWith(".tmp")) file.delete();
    }
    public File cached(String key) throws IOException {
        if (!key.matches("[a-f0-9]{64}")) throw new IOException("Invalid cache key");
        File file = new File(directory, key + ".xml");
        if (!file.isFile()) throw new IOException("Local EPG cache is unavailable");
        file.setLastModified(System.currentTimeMillis()); return file;
    }
    public Download fetch(String address) throws Exception {
        if (pending.size() >= 2) throw new IOException("EPG cache is busy");
        URL url = new URL(address); String key = hash(address);
        long deadline = SystemClock.elapsedRealtime() + 60000;
        for (int redirect = 0; redirect <= 5; redirect++) {
            if (!url.getProtocol().equals("https") && !url.getProtocol().equals("http")) throw new IOException("Unsupported source protocol");
            long remaining = deadline - SystemClock.elapsedRealtime();
            if (remaining <= 0) throw new IOException("EPG download timed out");
            int timeout = (int) Math.min(15000, remaining);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(timeout); connection.setReadTimeout(timeout);
            connection.setRequestProperty("User-Agent", "TCLVPlayer/1.3 Android");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache"); connection.setUseCaches(false);
            File temp = null;
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String next = connection.getHeaderField("Location");
                    if (next == null) throw new IOException("HTTP " + status);
                    url = new URL(url, next); continue;
                }
                if (status < 200 || status >= 300) throw new IOException("HTTP " + status);
                if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("EPG exceeds 64 MiB");
                temp = File.createTempFile("epg-", ".tmp", directory);
                try (InputStream network = new LimitedInput(connection.getInputStream(), deadline);
                     PushbackInputStream compressed = new PushbackInputStream(new BufferedInputStream(network), 2)) {
                    int a = compressed.read(), b = compressed.read();
                    if (b != -1) compressed.unread(b); if (a != -1) compressed.unread(a);
                    InputStream decoded = a == 0x1f && b == 0x8b ? new GZIPInputStream(compressed) : compressed;
                    try (PushbackInputStream xml = new PushbackInputStream(new LimitedInput(decoded, deadline), 1024)) {
                        byte[] prefix = new byte[512]; int count = 0, read;
                        while (count < prefix.length && (read = xml.read(prefix, count, prefix.length - count)) > 0) count += read;
                        int bom = 0; Charset charset = StandardCharsets.UTF_8;
                        if (count >= 3 && (prefix[0] & 255) == 239 && (prefix[1] & 255) == 187 && (prefix[2] & 255) == 191) bom = 3;
                        else if (count >= 2 && (prefix[0] & 255) == 255 && (prefix[1] & 255) == 254) { charset = StandardCharsets.UTF_16LE; bom = 2; }
                        else if (count >= 2 && (prefix[0] & 255) == 254 && (prefix[1] & 255) == 255) { charset = StandardCharsets.UTF_16BE; bom = 2; }
                        else {
                            Matcher encoding = Pattern.compile("encoding\\s*=\\s*['\"]([^'\"]+)['\"]", Pattern.CASE_INSENSITIVE)
                                .matcher(new String(prefix, 0, count, StandardCharsets.US_ASCII));
                            if (encoding.find()) charset = Charset.forName(encoding.group(1));
                        }
                        xml.unread(prefix, bom, count - bom);
                        try (Reader reader = new InputStreamReader(xml, charset);
                             Writer writer = new OutputStreamWriter(new LimitedOutput(new FileOutputStream(temp)), StandardCharsets.UTF_8)) {
                            char[] buffer = new char[16384];
                            while ((read = reader.read(buffer)) != -1) writer.write(buffer, 0, read);
                        }
                    }
                }
                Download result = new Download(UUID.randomUUID().toString(), key, temp); pending.put(result.id, result); return result;
            } catch (Exception error) { if (temp != null) temp.delete(); throw error; }
            finally { connection.disconnect(); }
        }
        throw new IOException("Too many redirects");
    }
    public void commit(String id) throws IOException {
        Download item = pending.remove(id); if (item == null) throw new IOException("Download has expired");
        File destination = new File(directory, item.key + ".xml");
        if (!item.file.renameTo(destination)) { item.file.delete(); throw new IOException("Could not save EPG cache"); }
        File[] files = directory.listFiles((dir, name) -> name.endsWith(".xml"));
        if (files == null) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        long size = 0; for (File file : files) size += file.length();
        for (File file : files) if (size > 256L * 1024 * 1024 && !file.equals(destination)) { long length = file.length(); if (file.delete()) size -= length; }
    }
    public void discard(String id) { Download item = pending.remove(id); if (item != null) item.file.delete(); }
    public void close() { for (Download item : pending.values()) item.file.delete(); pending.clear(); }
    private static String hash(String text) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        StringBuilder key = new StringBuilder(); for (byte value : digest) key.append(String.format(Locale.ROOT, "%02x", value & 255)); return key.toString();
    }
    private static final class LimitedInput extends FilterInputStream {
        private long count = 0; private final long deadline;
        LimitedInput(InputStream in, long deadline) { super(in); this.deadline = deadline; }
        private void check(int read) throws IOException { if (read > 0) count += read; if (count > MAX_BYTES) throw new IOException("EPG exceeds 64 MiB"); if (SystemClock.elapsedRealtime() > deadline) throw new IOException("EPG download timed out"); }
        @Override public int read() throws IOException { int value = in.read(); check(value < 0 ? 0 : 1); return value; }
        @Override public int read(byte[] bytes, int offset, int length) throws IOException { int read = in.read(bytes, offset, length); check(read); return read; }
    }
    private static final class LimitedOutput extends FilterOutputStream {
        private long count = 0;
        LimitedOutput(OutputStream out) { super(out); }
        @Override public void write(int value) throws IOException { if (++count > MAX_BYTES) throw new IOException("EPG exceeds 64 MiB"); out.write(value); }
        @Override public void write(byte[] bytes, int offset, int length) throws IOException { count += length; if (count > MAX_BYTES) throw new IOException("EPG exceeds 64 MiB"); out.write(bytes, offset, length); }
    }
}
