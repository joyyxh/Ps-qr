package com.printnest.app;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

/**
 * Android Back key for QRquick.
 *
 * Capacitor does not handle the Back key itself, so by default Back closed the app on every
 * screen, including the create-account screen. The owner's side screens (create account, reset
 * password, enter code) are pages in the WebView history, so Back first goes back through the
 * WebView. The app is closed by Android only when there is nothing left to go back to.
 */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                // Nothing to go back to in the app: let Android handle Back as it always did.
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
