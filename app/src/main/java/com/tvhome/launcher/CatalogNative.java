package com.tvhome.launcher;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Log;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.HashMap;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;

/** BYOK transport: all authenticated requests and credential access stay in this process. */
final class CatalogNative {
    private final Activity activity;
    private final WebView web;
    private final CredentialVault vault;
    private final CatalogCache cache;
    private final SharedPreferences usage;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ThreadPoolExecutor executor = new ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(24));
    private final Map<String, List<String>> pending = new HashMap<>();
    private final Map<String, Long> blocked = new HashMap<>();
    private final Map<String, String> lastErrors = new HashMap<>();
    private long nextRead, generation, lastQuotaNotice;
    private int hits, misses, staleHits, errors;
    private boolean closed;
    CatalogNative(Activity activity, WebView web) {
        this.activity = activity; this.web = web; vault = new CredentialVault(activity);
        cache = new CatalogCache(new java.io.File(activity.getFilesDir(), "catalog-metadata"), 8L * 1024 * 1024);
        usage = activity.getSharedPreferences("catalog-usage", 0);
    }
    synchronized String status() {
        JSONObject out = new JSONObject();
        try {
            out.put("tmdb", vault.configured("tmdb")).put("mdblist", vault.configured("mdblist"))
                .put("transport", "native-byok").put("hits", hits).put("misses", misses).put("staleHits", staleHits).put("errors", errors)
                .put("mdblistCallsToday", day().equals(usage.getString("day", "")) ? usage.getInt("dayCalls", 0) : 0)
                .put("mdblistBudget", 1000);
            if (day().equals(usage.getString("serverDay", ""))) out.put("mdblistAccountLimit", usage.getInt("serverLimit", 1000)).put("mdblistAccountRemaining", usage.getInt("serverRemaining", -1));
            out.put("sectionOverrides", new JSONObject(activity.getSharedPreferences("catalog-options", 0).getString("sections", "{}")));
            out.put("lastErrors", new JSONObject(lastErrors));
        } catch (Exception ignored) { }
        return out.toString();
    }
    private static String day() { return new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT) {{ setTimeZone(java.util.TimeZone.getTimeZone("UTC")); }}.format(new java.util.Date()); }
    private synchronized void rate(String provider) throws Failure {
        long now = System.currentTimeMillis();
        if ("mdblist".equals(provider) && usage.getLong("dailyBlockedUntil", 0) > now) throw dailyQuota();
        long until = blocked.containsKey(provider) ? blocked.get(provider) : 0;
        if (until > now) throw new Failure(429, "WAIT", (int)Math.ceil((until - now) / 1000.0));
        if ("mdblist".equals(provider)) {
            String today = day(); long window = now / 300000;
            int count = today.equals(usage.getString("day", "")) ? usage.getInt("dayCalls", 0) : 0;
            int reads = window == usage.getLong("window", -1) ? usage.getInt("reads", 0) : 0;
            if (count >= 1000) throw dailyQuota();
            if (!CatalogPolicy.budgetAllowed(count, reads)) throw new Failure(429, "RATE_WINDOW", (int)(300 - now / 1000 % 300));
            if (!usage.edit().putString("day", today).putInt("dayCalls", count + 1).putLong("window", window).putInt("reads", reads + 1).commit())
                throw new Failure(0, "STORAGE", 0);
        }
    }
    void request(String id, String provider, String path, String parameters) {
        if (id == null || !id.matches("[a-zA-Z0-9_-]{1,80}")) return;
        try {
            if (!CatalogPolicy.pathAllowed(provider, path)) throw new Failure(400, "INVALID_REQUEST", 0);
            JSONObject params = new JSONObject(parameters);
            TreeMap<String, String> sorted = new TreeMap<>();
            java.util.Iterator<String> keys = params.keys();
            while (keys.hasNext()) {
                String key = keys.next(), value = params.getString(key);
                if (!CatalogPolicy.paramAllowed(key, value)) throw new Failure(400, "INVALID_PARAMETER", 0);
                sorted.put(key, value);
            }
            if (path.startsWith("/catalog/") && sorted.containsKey("offset")) throw new Failure(400, "CURSOR_REQUIRED", 0);
            if (path.endsWith("/updates") && sorted.containsKey("since") && sorted.containsKey("cursor")) throw new Failure(400, "INVALID_PAGINATION", 0);
            String key = CatalogCache.hash(provider + path + new JSONObject(sorted).toString());
            final long epoch;
            synchronized (this) {
                if (closed) return;
                if (pending.containsKey(key)) { if (pending.get(key).size() < 20) pending.get(key).add(id); else reply(id, error(new Failure(429, "BUSY", 1))); return; }
                List<String> list = new ArrayList<>(); list.add(id); pending.put(key, list); epoch = generation;
            }
            try {
                executor.execute(() -> {
                    JSONObject result;
                    try { result = load(provider, path, sorted, key, epoch); }
                    catch (Failure e) { result = error(e); }
                    catch (Exception e) { result = error(new Failure(0, "NETWORK", 0)); }
                    List<String> ids;
                    synchronized (CatalogNative.this) { ids = pending.remove(key); }
                    if (ids != null) for (String requestId : ids) reply(requestId, result);
                });
            } catch (java.util.concurrent.RejectedExecutionException e) {
                synchronized (this) { pending.remove(key); } reply(id, error(new Failure(429, "BUSY", 1)));
            }
        } catch (Failure e) { reply(id, error(e)); }
        catch (Exception e) { reply(id, error(new Failure(400, "INVALID_REQUEST", 0))); }
    }
    private JSONObject load(String provider, String path, TreeMap<String, String> params, String key, long epoch) throws Exception {
        JSONObject saved = cache.read(key); long now = System.currentTimeMillis();
        if (saved != null) recordUpdate(saved.optLong("at"));
        long ttl = CatalogPolicy.ttl(provider, path);
        if (params.containsKey("append_to_response") && params.get("append_to_response").contains("watch/providers")) ttl = Math.min(ttl, 43200000L);
        if (saved != null && now - saved.optLong("at") < ttl) {
            synchronized (this) { hits++; } return success(saved.get("data"), saved.optJSONObject("headers"), true, false, null);
        }
        synchronized (this) { misses++; }
        try {
            String secret;
            try { secret = vault.read(provider); } catch (Exception e) { throw new Failure(401, "KEYSTORE", 0); }
            if (secret.isEmpty()) throw new Failure(401, "NO_KEY", 0);
            JSONObject fetched = null;
            for (int attempt = 0; attempt < 2; attempt++) {
                try { fetched = fetch(provider, path, params, secret, epoch); break; }
                catch (Failure e) {
                    if (e.status < 500 || attempt == 1) throw e;
                    Thread.sleep(350 + new java.security.SecureRandom().nextInt(200));
                }
            }
            JSONObject entry = new JSONObject().put("at", now).put("data", fetched.get("data")).put("headers", fetched.get("headers"));
            synchronized (this) {
                if (epoch != generation) throw new Failure(409, "CREDENTIALS_CHANGED", 0);
                lastErrors.remove(provider);
                cache.put(key, entry);
                recordUpdate(now);
            }
            return success(entry.get("data"), entry.getJSONObject("headers"), false, false, null);
        } catch (Failure e) {
            if ("DAILY_QUOTA".equals(e.code)) notifyDailyQuota();
            synchronized (this) { errors++; lastErrors.put(provider, e.code); }
            Log.w("HomeTVCatalog", provider + " " + e.code + " status=" + e.status);
            if (saved != null && CatalogPolicy.transientFailure(e.status)) {
                synchronized (this) { staleHits++; }
                return success(saved.get("data"), saved.optJSONObject("headers"), true, true, e.code);
            }
            throw e;
        } catch (Exception e) {
            synchronized (this) { errors++; }
            if (saved != null) { synchronized (this) { staleHits++; } return success(saved.get("data"), saved.optJSONObject("headers"), true, true, "NETWORK"); }
            throw new Failure(0, "NETWORK", 0);
        }
    }
    private JSONObject fetch(String provider, String path, TreeMap<String, String> params, String secret, long epoch) throws Exception {
        long delay;
        synchronized (this) { long now = System.currentTimeMillis(); delay = Math.max(0, nextRead - now); nextRead = Math.max(now, nextRead) + 200; }
        if (delay > 0) Thread.sleep(delay);
        rate(provider);
        StringBuilder address = new StringBuilder("tmdb".equals(provider) ? "https://api.themoviedb.org/3" : "https://api.mdblist.com").append(path).append('?');
        for (Map.Entry<String, String> item : params.entrySet()) address.append(URLEncoder.encode(item.getKey(), "UTF-8")).append('=').append(URLEncoder.encode(item.getValue(), "UTF-8")).append('&');
        boolean bearer = "tmdb".equals(provider) && secret.length() > 40;
        if (!bearer) address.append("tmdb".equals(provider) ? "api_key=" : "apikey=").append(URLEncoder.encode(secret, "UTF-8"));
        HttpsURLConnection connection = (HttpsURLConnection)new URL(address.toString()).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(7000); connection.setReadTimeout(9000);
        connection.setRequestProperty("Accept", "application/json");
        if (bearer) connection.setRequestProperty("Authorization", "Bearer " + secret);
        try {
            int status;
            try { status = connection.getResponseCode(); } catch (java.io.IOException e) { throw new Failure(0, "NETWORK", 0); }
            synchronized (this) { if (epoch != generation) throw new Failure(409, "CREDENTIALS_CHANGED", 0); }
            if ("mdblist".equals(provider)) recordQuota(connection);
            if (status == 401 || status == 403) synchronized (this) { blocked.put(provider, System.currentTimeMillis() + 300000); }
            JSONObject headers = new JSONObject();
            for (String name : new String[] {"X-Has-More", "X-RateLimit-Remaining", "Retry-After"}) {
                String value = connection.getHeaderField(name); if (value != null) headers.put(name.toLowerCase(java.util.Locale.ROOT), value);
            }
            if (status == 202 || status == 429 || ("mdblist".equals(provider) && "0".equals(connection.getHeaderField("X-RateLimit-Remaining")))) {
                int seconds = retryAfter(connection.getHeaderField("Retry-After"));
                if ("0".equals(connection.getHeaderField("X-RateLimit-Remaining"))) {
                    try { seconds = Math.max(seconds, (int)(Long.parseLong(connection.getHeaderField("X-RateLimit-Reset")) - System.currentTimeMillis() / 1000)); } catch (Exception ignored) { seconds = Math.max(seconds, 300); }
                }
                synchronized (this) { blocked.put(provider, System.currentTimeMillis() + seconds * 1000L); }
            }
            if ("mdblist".equals(provider) && status == 429) {
                String quotaError = "";
                try (InputStream stream = connection.getErrorStream()) {
                    if (stream != null) quotaError = new JSONObject(new String(bounded(stream, 4096), StandardCharsets.UTF_8)).optString("error");
                } catch (Exception ignored) { }
                if (CatalogPolicy.dailyLimitFailure(status, quotaError, "0".equals(connection.getHeaderField("X-RateLimit-Remaining")) ? 0 : -1)) {
                    usage.edit().putString("serverDay", day()).putInt("serverRemaining", 0).putLong("dailyBlockedUntil", nextDay()).apply(); throw dailyQuota();
                }
            }
            if (status < 200 || status >= 300 || status == 202) throw new Failure(status, status == 202 ? "PENDING" : "HTTP_" + status, retryAfter(connection.getHeaderField("Retry-After")));
            byte[] bytes;
            try (InputStream in = connection.getInputStream()) { bytes = bounded(in, 2500000); }
            Object data = new JSONTokener(new String(bytes, StandardCharsets.UTF_8)).nextValue();
            if (!(data instanceof JSONObject) && !(data instanceof JSONArray)) throw new Failure(502, "INVALID_RESPONSE", 0);
            return new JSONObject().put("data", data).put("headers", headers);
        } finally { connection.disconnect(); }
    }
    static byte[] bounded(InputStream input, int max) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int n;
        while ((n = input.read(buffer)) != -1) { if (out.size() + n > max) throw new java.io.IOException(); out.write(buffer, 0, n); }
        return out.toByteArray();
    }
    private static int retryAfter(String value) {
        try { return Math.max(1, Math.min(86400, Integer.parseInt(value))); } catch (Exception ignored) { }
        try { long at = new java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", java.util.Locale.US).parse(value).getTime(); return Math.max(1, Math.min(86400, (int)((at - System.currentTimeMillis()) / 1000))); }
        catch (Exception ignored) { return 2; }
    }
    private static JSONObject success(Object data, JSONObject headers, boolean cached, boolean stale, String warning) throws Exception {
        return new JSONObject().put("ok", true).put("data", data).put("headers", headers == null ? new JSONObject() : headers)
            .put("cached", cached).put("stale", stale).put("warning", warning == null ? JSONObject.NULL : warning);
    }
    private static JSONObject error(Failure error) {
        JSONObject out = new JSONObject();
        try { out.put("ok", false).put("status", error.status).put("code", error.code).put("retryAfter", error.retry); } catch (Exception ignored) { }
        return out;
    }
    private void reply(String id, JSONObject result) {
        ui.post(() -> { if (!closed) web.evaluateJavascript("window.CatalogNative&&window.CatalogNative.receive(" + JSONObject.quote(id) + "," + result + ")", null); });
    }
    private synchronized void recordUpdate(long at) {
        if (at > usage.getLong("lastCatalogUpdate", 0)) usage.edit().putLong("lastCatalogUpdate", at).apply();
    }
    private static long nextDay() { return CatalogPolicy.dailyResetAt(System.currentTimeMillis()); }
    private Failure dailyQuota() { notifyDailyQuota(); return new Failure(429, "DAILY_QUOTA", (int)Math.max(1, (nextDay() - System.currentTimeMillis()) / 1000)); }
    private synchronized void notifyDailyQuota() {
        long now = android.os.SystemClock.elapsedRealtime();
        if (lastQuotaNotice != 0 && now - lastQuotaNotice < 60000) return;
        lastQuotaNotice = now;
        ui.post(() -> { if (!closed) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('catalogquota',{detail:{resetAt:" + nextDay() + "}}))", null); });
    }
    private synchronized void recordQuota(HttpsURLConnection connection) {
        try {
            int limit = Integer.parseInt(connection.getHeaderField("X-RateLimit-Limit"));
            int remaining = Integer.parseInt(connection.getHeaderField("X-RateLimit-Remaining"));
            if (limit < 1 || remaining < 0 || remaining > limit) return;
            if (day().equals(usage.getString("serverDay", "")) && limit == usage.getInt("serverLimit", -1)) remaining = Math.min(remaining, usage.getInt("serverRemaining", remaining));
            usage.edit().putString("serverDay", day()).putInt("serverLimit", limit).putInt("serverRemaining", remaining).apply();
            if (remaining == 0) { usage.edit().putLong("dailyBlockedUntil", nextDay()).apply(); notifyDailyQuota(); }
        } catch (Exception ignored) { }
    }
    private android.view.View settingsHeader() {
        android.widget.LinearLayout box = new android.widget.LinearLayout(activity);
        box.setOrientation(android.widget.LinearLayout.VERTICAL); box.setPadding(32, 24, 32, 12);
        android.widget.TextView title = new android.widget.TextView(activity);
        title.setText("Catálogo e chaves — neste aparelho"); title.setTextSize(22);
        android.widget.TextView info = new android.widget.TextView(activity);
        long at = usage.getLong("lastCatalogUpdate", 0);
        String updated = at > 0 ? "Última atualização: " + android.text.format.DateFormat.getDateFormat(activity).format(new java.util.Date(at)) + " às " + android.text.format.DateFormat.getTimeFormat(activity).format(new java.util.Date(at)) : "Nenhuma atualização do catálogo neste aparelho";
        int localCalls = day().equals(usage.getString("day", "")) ? usage.getInt("dayCalls", 0) : 0;
        boolean account = day().equals(usage.getString("serverDay", ""));
        int limit = account ? usage.getInt("serverLimit", 1000) : 1000;
        int remaining = account ? usage.getInt("serverRemaining", Math.max(0, 1000 - localCalls)) : Math.max(0, 1000 - localCalls);
        String counter = "MDBList hoje: " + (account ? limit - remaining : localCalls) + " / " + limit + " · Restam " + remaining + (account ? " (conta, última resposta)" : " (neste aparelho)");
        String renewal = "Renova às " + android.text.format.DateFormat.getTimeFormat(activity).format(new java.util.Date(nextDay())) + " (00:00 UTC) · Sem consulta, o cache não gasta cota.";
        info.setText("Fontes: MDBList + TMDB\n" + updated + "\n" + counter + "\n" + renewal); info.setTextSize(14); info.setPadding(0, 14, 0, 0);
        box.addView(title); box.addView(info); return box;
    }
    void settings() {
        ui.post(() -> new AlertDialog.Builder(activity).setCustomTitle(settingsHeader())
            .setItems(new String[] {"TMDB: " + (vault.configured("tmdb") ? "configurada" : "não configurada"), "MDBList: " + (vault.configured("mdblist") ? "configurada" : "não configurada"), "Limpar somente cache do catálogo", "Sobre os dados"}, (d, which) -> {
                if (which < 2) edit(which == 0 ? "tmdb" : "mdblist");
                if (which == 2) { cache.clear(); usage.edit().remove("lastCatalogUpdate").apply(); changed(); Toast.makeText(activity, "Cache do catálogo limpo", Toast.LENGTH_SHORT).show(); }
                if (which == 3) web.evaluateJavascript("window.dispatchEvent(new Event('catalogabout'))", null);
            }).setNegativeButton("Fechar", null).show());
    }
    private void edit(String provider) {
        EditText input = new EditText(activity); input.setSingleLine(true); input.setTextSize(20);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        if (android.os.Build.VERSION.SDK_INT >= 26) input.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO);
        input.setHint(vault.configured(provider) ? "Configurada. Digite somente para substituir." : "Digite sua própria API key");
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle(provider.equals("tmdb") ? "TMDB — API key ou token de leitura" : "MDBList — API key")
            .setView(input).setNegativeButton("Cancelar", null).setPositiveButton("Salvar", null).setNeutralButton("Remover", null).create();
        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                final String value = input.getText().toString().trim();
                if (value.isEmpty()) { dialog.dismiss(); return; }
                if (!value.matches("[A-Za-z0-9._~-]{8,1024}")) { input.setError("Confira o formato da chave"); return; }
                try { executor.execute(() -> {
                    try { vault.put(provider, value); invalidateCredentials(provider); ui.post(() -> { input.setText(""); dialog.dismiss(); changed(); Toast.makeText(activity, "Chave salva com proteção do Keystore", Toast.LENGTH_SHORT).show(); }); }
                    catch (Exception ignored) { ui.post(() -> input.setError("Não foi possível proteger a chave neste aparelho")); }
                }); } catch (java.util.concurrent.RejectedExecutionException ignored) { input.setError("Catálogo ocupado. Tente novamente em instantes."); }
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> new AlertDialog.Builder(activity).setMessage("Remover a chave deste provedor e limpar o cache do catálogo?")
                .setNegativeButton("Cancelar", null).setPositiveButton("Remover", (a, b) -> { vault.remove(provider); invalidateCredentials(provider); input.setText(""); dialog.dismiss(); changed(); }).show());
        });
        dialog.show(); dialog.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE); input.requestFocus();
    }
    void configureSections(String json) {
        if (json == null || json.length() > 20000) return;
        try {
            JSONArray sections = new JSONArray(json);
            if (sections.length() > 40) return;
            String[] titles = new String[sections.length()];
            for (int i = 0; i < sections.length(); i++) titles[i] = sections.getJSONObject(i).getString("title");
            ui.post(() -> new AlertDialog.Builder(activity).setTitle("Fileiras — listas e ordem neste aparelho").setItems(titles, (d, index) -> {
                try {
                    JSONObject section = sections.getJSONObject(index); String id = section.getString("id");
                    if (!id.matches("[a-z0-9-]{1,60}")) return;
                    JSONObject stored = new JSONObject(activity.getSharedPreferences("catalog-options", 0).getString("sections", "{}"));
                    JSONObject previous = stored.optJSONObject(id);
                    android.widget.LinearLayout box = new android.widget.LinearLayout(activity); box.setOrientation(android.widget.LinearLayout.VERTICAL); box.setPadding(30, 10, 30, 10);
                    EditText list = new EditText(activity); list.setSingleLine(true); list.setInputType(InputType.TYPE_CLASS_NUMBER); list.setHint("ID da sua lista MDBList (vazio mantém a fonte padrão)");
                    if (previous != null && previous.optLong("sourceListId") > 0) list.setText(String.valueOf(previous.optLong("sourceListId")));
                    EditText order = new EditText(activity); order.setSingleLine(true); order.setInputType(InputType.TYPE_CLASS_NUMBER); order.setHint("Ordem da fileira"); order.setText(String.valueOf(section.optInt("displayOrder", index)));
                    android.widget.CheckBox enabled = new android.widget.CheckBox(activity); enabled.setText("Exibir esta fileira"); enabled.setChecked(section.optBoolean("enabled", true));
                    box.addView(list); box.addView(order); box.addView(enabled);
                    AlertDialog editor = new AlertDialog.Builder(activity).setTitle(section.getString("title")).setView(box).setNegativeButton("Cancelar", null).setPositiveButton("Salvar", null).create();
                    editor.setOnShowListener(a -> editor.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                        try {
                            String value = list.getText().toString().trim(); long listId = value.isEmpty() ? 0 : Long.parseLong(value);
                            int position = Integer.parseInt(order.getText().toString().trim());
                            if (listId < 0 || listId > Integer.MAX_VALUE || position < 0 || position > 1000) { list.setError("Confira ID e ordem"); return; }
                            JSONObject updated = new JSONObject().put("sourceListId", listId == 0 ? JSONObject.NULL : listId).put("displayOrder", position).put("enabled", enabled.isChecked());
                            if (listId > 0) updated.put("source", "mdblist");
                            stored.put(id, updated);
                            if (!activity.getSharedPreferences("catalog-options", 0).edit().putString("sections", stored.toString()).commit()) throw new java.io.IOException();
                            editor.dismiss(); web.evaluateJavascript("window.dispatchEvent(new Event('catalogoptionschange'))", null);
                        } catch (Exception ignored) { list.setError("Confira o ID numérico e a ordem"); }
                    })); editor.show();
                } catch (Exception ignored) { Toast.makeText(activity, "Não foi possível abrir esta fileira", Toast.LENGTH_SHORT).show(); }
            }).setNegativeButton("Fechar", null).show());
        } catch (Exception ignored) { }
    }
    private synchronized void invalidateCredentials(String provider) {
        generation++; blocked.clear(); lastErrors.clear(); cache.clear();
        SharedPreferences.Editor update = usage.edit().remove("lastCatalogUpdate");
        if ("mdblist".equals(provider)) update.remove("serverDay").remove("serverLimit").remove("serverRemaining").remove("dailyBlockedUntil");
        update.apply();
    }
    private void changed() { web.evaluateJavascript("window.dispatchEvent(new Event('catalogcredentialschange'))", null); }
    void checks(String id) {
        if (!BuildConfig.DEBUG || id == null || !id.matches("[a-zA-Z0-9_-]{1,80}")) return;
        executor.execute(() -> {
            JSONObject result = new JSONObject();
            try {
                CredentialVault test = new CredentialVault(activity, "catalog-vault-selftest");
                String fixture = "BYOK_TEST_NOT_REAL_0123456789";
                test.put("tmdb", fixture);
                result.put("keystoreRoundTrip", fixture.equals(test.read("tmdb")));
                String encrypted = activity.getSharedPreferences("catalog-vault-selftest", 0).getString("tmdb", "");
                result.put("ciphertextOnly", !encrypted.contains(fixture) && encrypted.contains(":"));
                test.remove("tmdb"); result.put("testCredentialRemoved", !test.configured("tmdb"));
                java.io.File directory = new java.io.File(activity.getCacheDir(), "catalog-selftest");
                CatalogCache temporary = new CatalogCache(directory, 512);
                String key = CatalogCache.hash("fixture");
                temporary.put(key, new JSONObject().put("at", System.currentTimeMillis()).put("data", new JSONObject().put("id", 550)));
                result.put("persistentCacheRoundTrip", new CatalogCache(directory, 512).read(key).getJSONObject("data").getInt("id") == 550);
                for (int i = 0; i < 10; i++) temporary.put(CatalogCache.hash("fixture" + i), new JSONObject().put("at", System.currentTimeMillis()).put("data", new JSONObject().put("id", i)));
                long bytes = 0; for (java.io.File file : directory.listFiles()) bytes += file.length();
                result.put("cacheBounded", bytes <= 512); temporary.clear();
                reply(id, success(result, null, false, false, null));
            } catch (Exception ignored) { reply(id, error(new Failure(0, "SELF_TEST_FAILED", 0))); }
        });
    }
    void close() { synchronized (this) { closed = true; } executor.shutdownNow(); }
    private static final class Failure extends Exception {
        final int status, retry; final String code;
        Failure(int status, String code, int retry) { this.status = status; this.code = code; this.retry = retry; }
    }
}
