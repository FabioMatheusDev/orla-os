package com.tvhome.launcher;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.provider.Settings;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.VideoView;

/**
 * Abertura da orla (motion/): toca uma vez por inicialização da TV, por cima da Home, com o
 * player nativo (o decodificador de hardware dá conta do 4K60; a WebView não). Qualquer tecla
 * pula; o último quadro já é o fundo da Home (#07090C), então a saída não tem corte.
 */
final class Intro {
    private static final String PREFS = "intro", KEY_ON = "enabled", KEY_BOOT = "last_boot";
    private final Activity activity;
    private final SharedPreferences prefs;
    private FrameLayout layer;
    private VideoView video;

    Intro(Activity activity) {
        this.activity = activity;
        prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    boolean enabled() { return prefs.getBoolean(KEY_ON, true); }
    void setEnabled(boolean on) { prefs.edit().putBoolean(KEY_ON, on).apply(); }
    boolean playing() { return layer != null; }

    /** Contador de boots do Android; muda a cada vez que a TV liga (não a cada saída do standby). */
    private int bootCount() {
        try {
            return Settings.Global.getInt(activity.getContentResolver(), Settings.Global.BOOT_COUNT);
        } catch (Settings.SettingNotFoundException e) {
            return -1;
        }
    }

    /** Toca se for a primeira abertura desde que a TV ligou (ou se forced, para testar). */
    void maybePlay(ViewGroup root, boolean forced) {
        int boot = bootCount();
        if (!forced && (!enabled() || boot < 0 || prefs.getInt(KEY_BOOT, -2) == boot)) return;
        prefs.edit().putInt(KEY_BOOT, boot).apply();
        layer = new FrameLayout(activity);
        layer.setBackgroundColor(Color.BLACK);
        video = new VideoView(activity);
        video.setFocusable(false);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        layer.addView(video, lp);
        root.addView(layer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        video.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build());
        video.setVideoURI(Uri.parse("android.resource://" + activity.getPackageName() + "/" + R.raw.orla_intro));
        video.setOnCompletionListener(mp -> finish());
        video.setOnErrorListener((mp, what, extra) -> { finish(); return true; });
        video.setOnInfoListener((mp, what, extra) -> {
            // tira o preto de baixo só quando o primeiro quadro aparece (o vídeo começa no preto mesmo)
            if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) layer.setBackgroundColor(Color.TRANSPARENT);
            return false;
        });
        video.start();
        if (BuildConfig.DEBUG) android.util.Log.i("HomeTVIntro", "play boot=" + boot + " forced=" + forced);
    }

    /** Pula ou termina: some em 160 ms ("Sair" da marca) e libera o player. */
    void finish() {
        final FrameLayout l = layer;
        if (l == null) return;
        layer = null;
        if (BuildConfig.DEBUG) android.util.Log.i("HomeTVIntro", "finish");
        l.animate().alpha(0f).setDuration(160).withEndAction(() -> {
            if (video != null) video.stopPlayback();
            video = null;
            ViewGroup parent = (ViewGroup) l.getParent();
            if (parent != null) parent.removeView(l);
        }).start();
    }

    void pause() { if (layer != null) finish(); }
}
