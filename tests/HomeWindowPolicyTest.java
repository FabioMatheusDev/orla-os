package com.tvhome.launcher;

public final class HomeWindowPolicyTest {
    public static void main(String[] args) {
        String pkg = "com.amazon.tv.launcher";
        String home = pkg + ".ui.HomeActivity_vNext";
        check(HomeWindowPolicy.isHome(pkg, home, home));
        check(HomeWindowPolicy.isHome(pkg, pkg + ".ui.HomeActivity", null));
        check(HomeWindowPolicy.isHome(pkg, pkg + ".ui.FutureHome", pkg + ".ui.FutureHome"));
        check(!HomeWindowPolicy.isHome(pkg, pkg + ".ui.SettingsActivity", home));
        check(!HomeWindowPolicy.isHome(pkg, pkg + ".ui.MainSettingsActivity", home));
        check(!HomeWindowPolicy.isHome(pkg, "android.app.Dialog", home));
        check(!HomeWindowPolicy.isHome(pkg, "android.widget.FrameLayout", home));
        check(!HomeWindowPolicy.isHome("com.amazon.tv.settings.v2", home, home));
        check(!HomeWindowPolicy.isHome("com.tvhome.launcher", home, home));
        check(!HomeWindowPolicy.isHome(pkg, null, home));
        check(!HomeWindowPolicy.isHome(null, home, home));
        System.out.println("11 Home window checks passed");
    }
    private static void check(boolean value) { if (!value) throw new AssertionError("Invalid Home classification"); }
}
