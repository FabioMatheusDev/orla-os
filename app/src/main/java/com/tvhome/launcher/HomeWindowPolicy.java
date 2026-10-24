package com.tvhome.launcher;

/** Only the real Amazon HOME activity is a Home-button transition, never settings. */
final class HomeWindowPolicy {
    static boolean isHome(String pkg, String windowClass, String resolvedHome) {
        if (!"com.amazon.tv.launcher".equals(pkg) || windowClass == null) return false;
        return windowClass.equals(resolvedHome)
            || windowClass.equals("com.amazon.tv.launcher.ui.HomeActivity_vNext")
            || windowClass.equals("com.amazon.tv.launcher.ui.HomeActivity");
    }
}
