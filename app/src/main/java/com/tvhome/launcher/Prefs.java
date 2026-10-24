package com.tvhome.launcher;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.text.TextUtils;

/** Preferências e helpers compartilhados entre a tela e o serviço. */
final class Prefs {
    static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";
    private static final String FILE = "tvhome";
    private static final String KEY_REDIRECT = "redirect_home";

    private Prefs() {}

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    /** Se o botão Home deve abrir esta tela (padrão: sim). */
    static boolean redirect(Context c) {
        return sp(c).getBoolean(KEY_REDIRECT, true);
    }

    static void setRedirect(Context c, boolean on) {
        sp(c).edit().putBoolean(KEY_REDIRECT, on).apply();
    }

    /** A tela inicial da Amazon foi desativada via ADB (modo desempenho)? */
    static boolean amazonHomeDisabled(Context c) {
        try {
            int s = c.getPackageManager().getApplicationEnabledSetting(AMAZON_LAUNCHER);
            return s == PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                    || s == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER
                    || s == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED;
        } catch (IllegalArgumentException e) {
            return false; // pacote não existe neste aparelho
        }
    }

    static String serviceId(Context c) {
        return new ComponentName(c, HomeWatcherService.class).flattenToString();
    }

    /** O serviço de acessibilidade está ligado nas configurações do sistema? */
    static boolean serviceEnabled(Context c) {
        String list = Settings.Secure.getString(c.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (TextUtils.isEmpty(list)) return false;
        String me = serviceId(c);
        String shortMe = c.getPackageName() + "/.HomeWatcherService";
        for (String s : list.split(":")) {
            if (s.equalsIgnoreCase(me) || s.equalsIgnoreCase(shortMe)) return true;
        }
        return false;
    }

    /**
     * Remove o serviço da lista de acessibilidade, preservando os outros.
     * Só funciona se WRITE_SECURE_SETTINGS foi concedida via ADB.
     */
    static boolean disableService(Context c) {
        try {
            String list = Settings.Secure.getString(c.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (TextUtils.isEmpty(list)) return true;
            String me = serviceId(c);
            String shortMe = c.getPackageName() + "/.HomeWatcherService";
            StringBuilder out = new StringBuilder();
            for (String s : list.split(":")) {
                if (s.isEmpty() || s.equalsIgnoreCase(me) || s.equalsIgnoreCase(shortMe)) continue;
                if (out.length() > 0) out.append(':');
                out.append(s);
            }
            Settings.Secure.putString(c.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, out.toString());
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }
}
