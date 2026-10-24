package com.tvhome.launcher;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.content.pm.ApplicationInfo;
import android.content.res.Resources;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.media.tv.TvContract;
import android.util.DisplayMetrics;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/** Funções nativas expostas para o JavaScript como window.Android. */
public class Bridge {
    private final Activity activity;
    private final CatalogNative catalog;
    private final UiSounds sounds;
    private final Intro intro;

    Bridge(Activity activity, CatalogNative catalog, UiSounds sounds, Intro intro) {
        this.intro = intro;
        this.activity = activity;
        this.catalog = catalog;
        this.sounds = sounds;
    }

    @JavascriptInterface public boolean introEnabled() { return intro.enabled(); }
    @JavascriptInterface public void setIntroEnabled(boolean enabled) { intro.setEnabled(enabled); }
    @JavascriptInterface public boolean uiSoundsEnabled() { return sounds.enabled(); }
    @JavascriptInterface public void setUiSoundsEnabled(boolean enabled) { activity.runOnUiThread(() -> sounds.setEnabled(enabled)); }
    @JavascriptInterface public void playUiSound(String effect) { activity.runOnUiThread(() -> sounds.play(effect)); }

    @JavascriptInterface public String catalogStatus() { return catalog.status(); }
    @JavascriptInterface public void catalogRequest(String id, String provider, String path, String params) { catalog.request(id, provider, path, params); }
    @JavascriptInterface public void openCatalogSettings() { catalog.settings(); }
    @JavascriptInterface public void runCatalogChecks(String id) { if (BuildConfig.DEBUG) catalog.checks(id); }
    @JavascriptInterface public void configureCatalogSections(String publicSections) { catalog.configureSections(publicSections); }

    /** Lista de apps abríveis: [{"pkg":"...","label":"..."}]. */
    @JavascriptInterface
    public String getApps() {
        PackageManager pm = activity.getPackageManager();
        Map<String, String> apps = new LinkedHashMap<>();
        String[] cats = {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER};
        for (String cat : cats) {
            Intent q = new Intent(Intent.ACTION_MAIN).addCategory(cat);
            for (ResolveInfo r : pm.queryIntentActivities(q, 0)) {
                String p = r.activityInfo.packageName;
                if (p.equals(activity.getPackageName()) || apps.containsKey(p)) continue;
                apps.put(p, String.valueOf(r.loadLabel(pm)));
            }
        }
        JSONArray arr = new JSONArray();
        try {
            for (Map.Entry<String, String> e : apps.entrySet()) {
                arr.put(new JSONObject().put("pkg", e.getKey()).put("label", e.getValue()));
            }
        } catch (JSONException ignored) {
        }
        return arr.toString();
    }

    /**
     * Banner (320x180) ou ícone do app como data URL.
     * Retorna "banner:data:image/png;base64,..." ou "icon:data:..." ou "".
     */
    @JavascriptInterface
    public String getArt(String pkg) {
        try {
            PackageManager pm = activity.getPackageManager();
            // A versão de maior densidade que o app tiver (xxxhdpi costuma ser 1280×720), não a da
            // densidade da TV: a capa sai nítida no card.
            Resources res = pm.getResourcesForApplication(pkg);
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            int bannerId = 0, iconId = 0;
            Intent li = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (li == null) li = pm.getLaunchIntentForPackage(pkg);
            ResolveInfo ri = li == null ? null : pm.resolveActivity(li, 0);
            if (ri != null) {
                bannerId = ri.activityInfo.banner;
                iconId = ri.activityInfo.getIconResource();
            }
            if (bannerId == 0) bannerId = ai.banner;
            if (iconId == 0) iconId = ai.icon;
            Drawable d = bannerId != 0 ? highRes(res, bannerId) : null;
            if (d == null && li != null) d = pm.getActivityBanner(li);
            if (d == null) d = pm.getApplicationBanner(pkg);
            boolean isBanner = d != null;
            if (d == null && iconId != 0) d = highRes(res, iconId);
            if (d == null) d = pm.getApplicationIcon(pkg);
            // banner em 640×360 (o dobro do card), ícone em até 256: o WebView só reduz, nunca amplia
            int w = isBanner ? 640 : Math.max(128, Math.min(256, sourceWidth(d)));
            int h = isBanner ? 360 : w;
            if (d instanceof BitmapDrawable) {
                ((BitmapDrawable) d).setFilterBitmap(true);
                ((BitmapDrawable) d).setAntiAlias(true);
            }
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, w, h);
            d.draw(c);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            bmp.recycle();
            return (isBanner ? "banner:" : "icon:") + "data:image/png;base64,"
                    + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    private static Drawable highRes(Resources res, int id) {
        try {
            return res.getDrawableForDensity(id, DisplayMetrics.DENSITY_XXXHIGH, null);
        } catch (Resources.NotFoundException e) {
            return null;
        }
    }

    private static int sourceWidth(Drawable d) {
        if (d instanceof BitmapDrawable && ((BitmapDrawable) d).getBitmap() != null) {
            return ((BitmapDrawable) d).getBitmap().getWidth();
        }
        return d.getIntrinsicWidth() > 0 ? d.getIntrinsicWidth() * 2 : 256;
    }

    @JavascriptInterface
    public boolean launch(String pkg) {
        PackageManager pm = activity.getPackageManager();
        Intent i = null;
        // O ícone do Appstore (AppsGridLauncherActivity) abre a loja dentro da tela da Amazon,
        // e o HomeWatcherService a trocaria pela Home TV na hora. Esta é a tela da própria loja.
        if ("com.amazon.venezia".equals(pkg)) {
            i = new Intent("com.amazon.venezia.ade.FEATURED_LAUNCH").setPackage(pkg);
            if (pm.resolveActivity(i, 0) == null) i = null;
        }
        if (i == null) i = pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return false;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        final Intent fi = i;
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(fi);
            } catch (ActivityNotFoundException ignored) {
            }
        });
        return true;
    }

    @JavascriptInterface
    public void openSettings() {
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(allSettingsIntent().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException | SecurityException ignored) {
            }
        });
    }

    /**
     * No Fire OS, Settings.ACTION_SETTINGS passa por um intermediário que abre a tela inicial da
     * Amazon antes das configurações, e o HomeWatcherService trocaria tudo pela Home TV. A
     * categoria LEANBACK_SETTINGS abre a tela de configurações da Amazon direto.
     */
    private Intent allSettingsIntent() {
        Intent direct = new Intent(Intent.ACTION_MAIN)
                .addCategory("android.intent.category.LEANBACK_SETTINGS")
                .setPackage(Prefs.AMAZON_LAUNCHER);
        if (activity.getPackageManager().resolveActivity(direct, PackageManager.MATCH_DEFAULT_ONLY) != null) return direct;
        return new Intent(Settings.ACTION_SETTINGS);
    }

    /**
     * Atalhos para seções das configurações do Fire OS, só de uma lista fixa.
     * Tela e sons, Preferências, Acessibilidade e Conta exigem uma permissão de assinatura
     * da Amazon (LAUNCHER_SETTINGS): ficam acessíveis por "Todas as configurações".
     */
    @JavascriptInterface
    public boolean openSetting(String key) {
        Intent i;
        switch (key == null ? "" : key) {
            case "all": i = allSettingsIntent(); break;
            case "network": i = new Intent(Settings.ACTION_WIFI_SETTINGS); break;
            case "apps": i = new Intent(Settings.ACTION_MANAGE_ALL_APPLICATIONS_SETTINGS); break;
            case "bluetooth": i = new Intent().setClassName("com.amazon.tv.settings.v2",
                    "com.amazon.tv.settings.v2.tv.controllers_bluetooth_devices.ControllersAndBluetoothActivity"); break;
            case "device": i = new Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS); break;
            case "about": i = new Intent("com.amazon.device.settings.action.ABOUT"); break;
            default: return false;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        final Intent fi = i;
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(fi);
            } catch (ActivityNotFoundException | SecurityException ignored) {
            }
        });
        return true;
    }

    /**
     * Apps de TV ao vivo conhecidos, usados só se o link padrão de canais não abrir nada.
     * Fire OS (Amazon), Google/AOSP Live Channels, TCL, MediaTek, Sony e outros (lista do Free My TV).
     */
    private static final String[] LIVE_TV_APPS = {"com.amazon.tv.livetv", "com.google.android.tv", "com.android.tv",
            "com.tcl.tv", "com.mediatek.wwtv.tvcenter", "com.sony.dtv.tvx", "com.smartdevice.livetv",
            "com.mediatek.tv.oneworld.tvcenter"};

    /**
     * TV ao vivo: o link padrão de canais do Android (TvContract) abre o app de TV ao vivo do aparelho
     * (no Fire OS, o da Amazon, sem passar pela tela inicial). Sem ele, o primeiro app conhecido instalado.
     */
    private Intent liveTvIntent() {
        PackageManager pm = activity.getPackageManager();
        Intent channels = new Intent(Intent.ACTION_VIEW, TvContract.Channels.CONTENT_URI);
        if (pm.resolveActivity(channels, 0) != null) return channels;
        for (String pkg : LIVE_TV_APPS) {
            Intent app = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (app == null) app = pm.getLaunchIntentForPackage(pkg);
            if (app != null) return app;
        }
        return null;
    }

    /** Pacote do app de TV ao vivo, ou "" se o aparelho não tem: a interface esconde o card. */
    @JavascriptInterface
    public String liveTvPackage() {
        Intent i = liveTvIntent();
        if (i == null) return "";
        if (i.getPackage() != null) return i.getPackage();
        ResolveInfo ri = activity.getPackageManager().resolveActivity(i, 0);
        return ri != null && ri.activityInfo != null ? ri.activityInfo.packageName : "";
    }

    @JavascriptInterface
    public boolean openLiveTv() {
        Intent i = liveTvIntent();
        if (i == null) return false;
        final Intent fi = i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(fi);
            } catch (ActivityNotFoundException | SecurityException ignored) {
            }
        });
        return true;
    }

    /** Abre o trailer no app do YouTube; só aceita um id de vídeo do YouTube. */
    @JavascriptInterface
    public boolean openTrailer(String key) {
        if (key == null || !key.matches("[A-Za-z0-9_-]{6,20}")) return false;
        Uri uri = Uri.parse("https://www.youtube.com/watch?v=" + key);
        PackageManager pm = activity.getPackageManager();
        Intent i = new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        for (String yt : new String[]{"com.amazon.firetv.youtube", "com.google.android.youtube.tv"}) {
            if (pm.getLaunchIntentForPackage(yt) != null || pm.getLeanbackLaunchIntentForPackage(yt) != null) {
                i.setPackage(yt);
                break;
            }
        }
        final Intent fi = i;
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(fi);
            } catch (ActivityNotFoundException | SecurityException e) {
                // O app do YouTube não aceitou o link: abre o app sem o vídeo.
                Intent l = fi.getPackage() == null ? null : pm.getLeanbackLaunchIntentForPackage(fi.getPackage());
                if (l != null) {
                    try {
                        activity.startActivity(l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (ActivityNotFoundException ignored) {
                    }
                }
            }
        });
        return true;
    }

    /** {"redirect":bool,"service":bool} */
    @JavascriptInterface
    public String homeStatus() {
        try {
            return new JSONObject()
                    .put("redirect", Prefs.redirect(activity))
                    .put("service", Prefs.serviceEnabled(activity))
                    .put("amazonDisabled", Prefs.amazonHomeDisabled(activity))
                    .toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public void setRedirect(boolean on) {
        Prefs.setRedirect(activity, on);
    }

    /**
     * Botão de segurança: para de interceptar o Home, tenta desligar o serviço
     * de acessibilidade e abre a tela inicial original da Amazon.
     */
    @JavascriptInterface
    public boolean restoreOriginalHome() {
        // Com a home da Amazon desativada só o ADB (scripts/restore) consegue reativá-la.
        if (Prefs.amazonHomeDisabled(activity)) return false;
        Prefs.setRedirect(activity, false);
        boolean off = Prefs.disableService(activity);
        activity.runOnUiThread(() -> {
            Intent i = activity.getPackageManager().getLaunchIntentForPackage(Prefs.AMAZON_LAUNCHER);
            if (i == null) i = activity.getPackageManager().getLeanbackLaunchIntentForPackage(Prefs.AMAZON_LAUNCHER);
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    activity.startActivity(i);
                } catch (ActivityNotFoundException ignored) {
                }
            }
        });
        return off;
    }
}
