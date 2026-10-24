package com.tvhome.launcher;

import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.URL;
import java.util.Arrays;
import javax.net.ssl.HttpsURLConnection;

/** Public TMDB image cache, capped at 60 MiB. No credentials, redirects or arbitrary hosts. */
final class CatalogImages {
    private final File directory;
    CatalogImages(File directory) { this.directory = directory; directory.mkdirs(); }
    synchronized WebResourceResponse intercept(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !"image.tmdb.org".equals(uri.getHost()) || uri.getQuery() != null ||
            !uri.getPath().matches("/t/p/(w92|w185|w300|w342|w500|w780)/[A-Za-z0-9_-]+\\.(jpg|png)")) return null;
        try {
            File file = new File(directory, CatalogCache.hash(uri.toString()));
            if (!file.exists()) {
                HttpsURLConnection connection = (HttpsURLConnection)new URL(uri.toString()).openConnection();
                connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(4500); connection.setReadTimeout(6000);
                try {
                    if (connection.getResponseCode() != 200) return empty();
                    byte[] bytes;
                    try (java.io.InputStream in = connection.getInputStream()) { bytes = CatalogNative.bounded(in, 1800000); }
                    File temp = new File(directory, file.getName() + ".tmp");
                    try (FileOutputStream out = new FileOutputStream(temp)) { out.write(bytes); }
                    if (!temp.renameTo(file)) { temp.delete(); return empty(); }
                } finally { connection.disconnect(); }
            }
            file.setLastModified(System.currentTimeMillis());
            WebResourceResponse response = new WebResourceResponse(uri.getPath().endsWith(".png") ? "image/png" : "image/jpeg", null, new FileInputStream(file));
            response.setResponseHeaders(java.util.Collections.singletonMap("Access-Control-Allow-Origin", "*"));
            prune(); return response;
        } catch (Exception ignored) { return empty(); }
    }
    private static WebResourceResponse empty() { return new WebResourceResponse("image/jpeg", null, new java.io.ByteArrayInputStream(new byte[0])); }
    private void prune() {
        File[] files = directory.listFiles(); if (files == null) return;
        long size = 0; for (File f : files) size += f.length();
        Arrays.sort(files, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
        for (File f : files) { if (size <= 60L * 1024 * 1024) break; long bytes = f.length(); if (f.delete()) size -= bytes; }
    }
}
