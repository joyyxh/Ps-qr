package com.printnest.app;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

/**
 * Android Back key and resume for QRquick.
 *
 * Capacitor does not handle the Back key itself, so by default Back closed the app on every
 * screen, including the create-account screen. The page decides first: on a sign-in side screen
 * (create account, reset password, enter code) it goes back to sign in, through window.qrquickBack
 * in web/src/app.js. Only when the page does not handle Back does the WebView history go back, and
 * the app is closed by Android only when there is nothing left to go back to.
 *
 * When the app comes back to the front, the page is asked to close a create-account or
 * forgot-password form (window.qrquickResume), so the app reopens on the protected sign-in screen.
 */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    closeAppIfNothingToBackTo(this);
                    return;
                }
                webView.evaluateJavascript("window.qrquickBack ? window.qrquickBack() : false", value -> {
                    if ("true".equals(value)) {
                        return; // the page went back to its sign-in screen
                    }
                    if (webView.canGoBack()) {
                        webView.goBack();
                        return;
                    }
                    closeAppIfNothingToBackTo(this);
                });
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.evaluateJavascript("window.qrquickResume && window.qrquickResume()", null);
        }
    }

    /** Lets Android handle Back as it always did, with this callback switched off for the one press. */
    private void closeAppIfNothingToBackTo(OnBackPressedCallback callback) {
        callback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        callback.setEnabled(true);
    }
}
