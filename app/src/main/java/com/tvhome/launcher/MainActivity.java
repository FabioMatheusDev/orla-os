package com.tvhome.launcher;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

/** Tela inicial: uma WebView em tela cheia com a interface em assets/www. */
public class MainActivity extends Activity {
    static final String EXTRA_FROM_HOME = "from_home";
    private WebView web;
    private CatalogNative catalog;
    private UiSounds sounds;
    private Intro intro;
    private boolean introKeyDown;
    private static java.lang.ref.WeakReference<MainActivity> current = new java.lang.ref.WeakReference<>(null);
    private boolean resumed;
    static boolean isHomeVisible() {
        MainActivity activity = current.get();
        return activity != null && activity.resumed && activity.hasWindowFocus();
    }
    private void trace(String phase) { if (BuildConfig.DEBUG) android.util.Log.i("HomeTVPerf", phase + " t=" + android.os.SystemClock.uptimeMillis()); }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = new java.lang.ref.WeakReference<>(this); trace("create");
        overridePendingTransition(0, 0);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#07090C"));
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setSoundEffectsEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        CatalogImages images = new CatalogImages(new java.io.File(getCacheDir(), "catalog-images"));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/www/");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith("file:///android_asset/www/");
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return images.intercept(request.getUrl());
            }
        });
        catalog = new CatalogNative(this, web);
        sounds = new UiSounds(this);
        intro = new Intro(this);
        web.addJavascriptInterface(new Bridge(this, catalog, sounds, intro), "Android");
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.addView(web);
        setContentView(root);
        web.requestFocus();
        web.loadUrl("file:///android_asset/www/index.html");
        // abertura: 1ª abertura desde que a TV ligou; em debug, "--ez play_intro true" força para testar
        intro.maybePlay(root, BuildConfig.DEBUG && getIntent().getBooleanExtra("play_intro", false));
    }

    private void js(String code) {
        if (web != null) web.evaluateJavascript("window.tvKey && window.tvKey('" + code + "')", null);
    }

    private boolean okLong;

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        // durante a abertura, qualquer tecla pula (e não chega à página, nem o soltar)
        if (intro != null && intro.playing() && e.getAction() == KeyEvent.ACTION_DOWN) { introKeyDown = true; intro.finish(); return true; }
        if (introKeyDown) { if (e.getAction() == KeyEvent.ACTION_UP) introKeyDown = false; return true; }
        // Segurar OK (≥0,4 s): avisa a página ("longok") e não deixa o soltar virar um clique.
        // A repetição da tecla não chega à página de forma confiável, por isso é detectada aqui.
        if (k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER) {
            if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() > 0) {
                boolean held = e.isLongPress() || e.getEventTime() - e.getDownTime() >= 400;
                if (!okLong && held) {
                    okLong = true;
                    js("longok");
                }
                return true;
            }
            if (e.getAction() == KeyEvent.ACTION_DOWN) okLong = false;
            if (e.getAction() == KeyEvent.ACTION_UP && okLong) {
                okLong = false;
                return true;
            }
        }
        if (k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_BACK) {
            // Como tela inicial, o Voltar nunca fecha o app: só fecha painéis abertos.
            if (e.getAction() == KeyEvent.ACTION_UP) js(k == KeyEvent.KEYCODE_MENU ? "menu" : "back");
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        trace("new-intent"); overridePendingTransition(0, 0);
        if (BuildConfig.DEBUG && intent.getBooleanExtra("play_intro", false) && intro != null && !intro.playing())
            intro.maybePlay((android.view.ViewGroup) web.getParent(), true);
        js("home");
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true; trace("resume");
        if (web != null) web.onResume();
        if (sounds != null) sounds.resume();
        js("resume");
    }

    @Override
    protected void onPause() {
        resumed = false;
        if (intro != null) intro.pause();
        if (sounds != null) sounds.pause();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (current.get() == this) current.clear();
        if (catalog != null) catalog.close();
        if (sounds != null) sounds.close();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
