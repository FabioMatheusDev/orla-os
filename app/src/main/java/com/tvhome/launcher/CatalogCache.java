package com.tvhome.launcher;

import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

/** Persistent metadata cache. It contains responses only, never credentials or request URLs. */
final class CatalogCache {
    private final File root;
    private final long maxBytes;
    CatalogCache(File root, long maxBytes) { this.root = root; this.maxBytes = maxBytes; root.mkdirs(); }
    static String hash(String value) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder(); for (byte b : bytes) out.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return out.toString();
    }
    synchronized JSONObject read(String key) {
        try {
            File file = new File(root, key + ".json");
            if (file.length() > 2500000) return null;
            JSONObject entry = new JSONObject(new String(new AtomicFile(file).readFully(), StandardCharsets.UTF_8));
            if (System.currentTimeMillis() - entry.optLong("at") > 30L * 86400000) { file.delete(); return null; }
            file.setLastModified(System.currentTimeMillis()); return entry;
        } catch (Exception ignored) { return null; }
    }
    synchronized void put(String key, JSONObject entry) throws Exception {
        byte[] bytes = entry.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 2500000) return;
        AtomicFile file = new AtomicFile(new File(root, key + ".json"));
        FileOutputStream out = null;
        try { out = file.startWrite(); out.write(bytes); file.finishWrite(out); }
        catch (Exception e) { if (out != null) file.failWrite(out); throw e; }
        File[] files = root.listFiles(); if (files == null) return;
        Arrays.sort(files, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
        long size = 0; for (File f : files) size += f.length();
        for (File f : files) { if (size <= maxBytes) break; long length = f.length(); if (f.delete()) size -= length; }
    }
    synchronized void clear() { File[] files = root.listFiles(); if (files != null) for (File f : files) if (f.isFile()) f.delete(); }
}
