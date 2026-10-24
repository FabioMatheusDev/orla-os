package com.tvhome.launcher;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;

/**
 * O Fire OS não deixa trocar a tela inicial padrão. Este serviço observa
 * apenas quando a janela da tela inicial da Amazon vem para frente
 * (botão Home do controle) e abre a Home TV por cima.
 *
 * Não lê o conteúdo da tela (canRetrieveWindowContent=false) e só recebe
 * eventos do pacote com.amazon.tv.launcher.
 *
 * Para desligar: botão "Restaurar tela original" no painel, ou scripts/restore.
 */
public class HomeWatcherService extends AccessibilityService {
    private long lastLaunch;
    private String resolvedHome;

    @Override protected void onServiceConnected() {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setPackage(Prefs.AMAZON_LAUNCHER);
        android.content.pm.ResolveInfo resolved = getPackageManager().resolveActivity(home, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
        resolvedHome = resolved != null && resolved.activityInfo != null ? resolved.activityInfo.name : null;
        if (BuildConfig.DEBUG) android.util.Log.i("HomeTVPerf", "service-connected t=" + SystemClock.uptimeMillis());
    }

    private boolean launchHome(String route) {
        if (BuildConfig.DEBUG) android.util.Log.i("HomeTVPerf", "route=" + route + " t=" + SystemClock.uptimeMillis());
        if (MainActivity.isHomeVisible()) return true;
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        i.putExtra(MainActivity.EXTRA_FROM_HOME, true);
        try { startActivity(i); return true; } catch (Exception ignored) { return false; }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        CharSequence pkg = event.getPackageName();
        if (pkg == null || !Prefs.AMAZON_LAUNCHER.contentEquals(pkg)) return;
        CharSequence windowClass = event.getClassName();
        if (!HomeWindowPolicy.isHome(pkg.toString(), windowClass == null ? null : windowClass.toString(), resolvedHome)) return;
        if (!Prefs.redirect(this)) return;

        long now = SystemClock.uptimeMillis();
        if (MainActivity.isHomeVisible()) return;
        if (now - lastLaunch < 600) return; // ignore duplicate events from the same Amazon transition
        lastLaunch = now;
        launchHome("window");
    }

    @Override
    public void onInterrupt() {}
}
