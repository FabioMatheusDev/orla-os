package com.tvhome.launcher;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.SystemClock;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Preloaded short effects. Main-thread playback, no network, audio focus or volume changes. */
final class UiSounds {
    private final SharedPreferences preferences;
    private final Set<Integer> loaded = Collections.synchronizedSet(new HashSet<Integer>());
    private final int[] samples = new int[4];
    private SoundPool pool;
    private boolean active;
    private int stream;
    private long lastMove;

    UiSounds(Context context) {
        preferences = context.getSharedPreferences("ui-sounds", Context.MODE_PRIVATE);
        try {
            pool = new SoundPool.Builder().setMaxStreams(1).setAudioAttributes(
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
            pool.setOnLoadCompleteListener((soundPool, id, status) -> { if (status == 0) loaded.add(id); });
            int[] resources = { R.raw.ui_move, R.raw.ui_click, R.raw.ui_select, R.raw.ui_cancel };
            for (int i = 0; i < resources.length; i++) samples[i] = pool.load(context, resources[i], 1);
        } catch (RuntimeException unavailable) {
            if (pool != null) pool.release();
            pool = null;
        }
    }

    boolean enabled() { return preferences.getBoolean("enabled", true); }
    void setEnabled(boolean enabled) {
        preferences.edit().putBoolean("enabled", enabled).apply();
        if (!enabled) stop();
    }
    void play(String effect) {
        if (pool == null || !active || !enabled() || effect == null) return;
        int index;
        switch (effect) {
            case "move": index = 0; break;
            case "click": index = 1; break;
            case "select": index = 2; break;
            case "cancel": index = 3; break;
            default: return;
        }
        long now = SystemClock.uptimeMillis();
        if (index == 0 && now - lastMove < 65) return;
        if (!loaded.contains(samples[index])) return; // Never queue delayed beeps.
        if (index == 0) lastMove = now;
        stop();
        float volume = index == 0 ? .40f : .50f;
        stream = pool.play(samples[index], volume, volume, 1, 0, 1f);
        if (BuildConfig.DEBUG) android.util.Log.i("HomeTVSound", effect + " stream=" + stream);
    }
    private void stop() { if (pool != null && stream != 0) pool.stop(stream); stream = 0; }
    void resume() { active = true; }
    void pause() { active = false; stop(); }
    void close() { active = false; if (pool != null) pool.release(); pool = null; loaded.clear(); }
}
