package sk.tclv.player;

import android.content.Context;
import android.net.Uri;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Private temporary files; callers perform all methods on the export I/O executor. */
public final class FileExports {
    private final Context context;
    private final Map<String, File> files = new HashMap<>();
    private final File directory;
    private static final long MAX_BYTES = 256L * 1024 * 1024;

    public FileExports(Context context) {
        this.context = context; directory = new File(context.getCacheDir(), "file-exports");
        directory.mkdirs();
        File[] stale = directory.listFiles();
        if (stale != null) for (File file : stale) if (file.lastModified() < System.currentTimeMillis() - 3600000) file.delete();
    }
    public String begin() throws IOException {
        if (files.size() >= 2) throw new IOException("Another export is still active");
        String id = UUID.randomUUID().toString();
        File file = File.createTempFile("backup-", ".tmp", directory);
        files.put(id, file); return id;
    }
    private File require(String id) throws IOException {
        File file = files.get(id);
        if (file == null) throw new IOException("Export has expired");
        return file;
    }
    public void append(String id, String text) throws IOException {
        if (text.length() > 131072) throw new IOException("Export chunk is too large");
        File file = require(id); byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (file.length() + bytes.length > MAX_BYTES) throw new IOException("Backup exceeds 256 MiB");
        try (OutputStream out = new BufferedOutputStream(new FileOutputStream(file, true))) { out.write(bytes); }
    }
    public void save(String id, Uri destination) throws IOException {
        File file = require(id);
        try (InputStream in = new BufferedInputStream(new FileInputStream(file));
             OutputStream out = context.getContentResolver().openOutputStream(destination, "wt")) {
            if (out == null) throw new IOException("Could not open destination");
            byte[] buffer = new byte[32768]; int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
        } finally { discard(id); }
    }
    public void discard(String id) { File file = files.remove(id); if (file != null) file.delete(); }
    public void close() { for (File file : files.values()) file.delete(); files.clear(); }
}
