package com.submittertech.quran;

import android.content.Context;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {

    // A web view opens its store the moment it is built and keeps it open for the life of the
    // process, so a store the app has found unusable can only be thrown away from here, before
    // that happens. The page asks for it by leaving this file behind when it catches the store
    // dropping writes; what was in the store is kept in the file next to it and put back once
    // the new one is up, which is what makes clearing it safe.
    private static final String RESET_MARKER = "state/reset-web-storage";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        clearLocalStorageIfAsked();
        super.onCreate(savedInstanceState);
    }

    private void clearLocalStorageIfAsked() {
        File marker = new File(getFilesDir(), RESET_MARKER);
        if (!marker.exists()) {
            return;
        }

        File webViewDir = getDir("webview", Context.MODE_PRIVATE);
        // Where the web view keeps it now, and where older ones kept it.
        deleteRecursively(new File(webViewDir, "Default/Local Storage"));
        deleteRecursively(new File(webViewDir, "Local Storage"));

        marker.delete();
    }

    private static void deleteRecursively(File file) {
        if (!file.exists()) {
            return;
        }
        // A store that stopped taking writes may have lost the right to be written to at all,
        // and a directory has to be writable for what is inside it to go.
        file.setWritable(true, true);
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }
        file.delete();
    }
}
