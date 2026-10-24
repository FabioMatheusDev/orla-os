package com.tvhome.launcher;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.KeyPairGeneratorSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.math.BigInteger;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Calendar;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.security.auth.x500.X500Principal;

/** Secrets never cross the JavaScript bridge. AES-GCM, with keys protected by Android Keystore. */
final class CredentialVault {
    private static final String ALIAS = "home-tv.catalog.aes.v1", RSA_ALIAS = "home-tv.catalog.wrap.v1";
    private final Context context;
    private final SharedPreferences prefs;
    CredentialVault(Context c) { this(c, "catalog-vault"); }
    CredentialVault(Context c, String preferences) { context = c.getApplicationContext(); prefs = context.getSharedPreferences(preferences, 0); }
    private static String provider(String p) {
        if (!"tmdb".equals(p) && !"mdblist".equals(p)) throw new IllegalArgumentException();
        return p;
    }
    boolean configured(String p) { return prefs.contains(provider(p)); }
    synchronized void remove(String p) { prefs.edit().remove(provider(p)).commit(); }
    synchronized void put(String p, String value) throws Exception {
        provider(p);
        value = value.trim();
        if (!value.matches("[A-Za-z0-9._~-]{8,1024}")) throw new IllegalArgumentException();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(p.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
            Base64.encodeToString(cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString(p, encrypted).commit()) throw new java.io.IOException();
    }
    synchronized String read(String p) throws Exception {
        String data = prefs.getString(provider(p), null);
        if (data == null) return "";
        String[] parts = data.split(":", 2);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        cipher.updateAAD(p.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8);
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (Build.VERSION.SDK_INT >= 23) return Modern.key(store);
        // Android 5.1: wrap a random AES key with a non-exportable RSA Keystore key.
        if (!store.containsAlias(RSA_ALIAS)) {
            Calendar end = Calendar.getInstance(); end.add(Calendar.YEAR, 30);
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA", "AndroidKeyStore");
            generator.initialize(new KeyPairGeneratorSpec.Builder(context).setAlias(RSA_ALIAS)
                .setSubject(new X500Principal("CN=Home TV Catalog")).setSerialNumber(BigInteger.ONE)
                .setStartDate(new java.util.Date()).setEndDate(end.getTime()).setKeySize(2048).build());
            generator.generateKeyPair();
        }
        Cipher wrapping = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        String saved = prefs.getString("wrapped-aes", null);
        if (saved != null) {
            wrapping.init(Cipher.DECRYPT_MODE, store.getKey(RSA_ALIAS, null));
            return new SecretKeySpec(wrapping.doFinal(Base64.decode(saved, Base64.NO_WRAP)), "AES");
        }
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        wrapping.init(Cipher.ENCRYPT_MODE, store.getCertificate(RSA_ALIAS).getPublicKey());
        if (!prefs.edit().putString("wrapped-aes", Base64.encodeToString(wrapping.doFinal(bytes), Base64.NO_WRAP)).commit()) throw new java.io.IOException();
        return new SecretKeySpec(bytes, "AES");
    }
    private static final class Modern {
        static SecretKey key(KeyStore store) throws Exception {
            if (!store.containsAlias(ALIAS)) {
                KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
                generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true).setKeySize(256).build());
                generator.generateKey();
            }
            return (SecretKey) store.getKey(ALIAS, null);
        }
    }
}
