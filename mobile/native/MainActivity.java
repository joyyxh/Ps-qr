package com.printnest.app;

import android.os.Bundle;
import android.util.Log;
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
    public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        if (event.getKeyCode() == android.view.KeyEvent.KEYCODE_BACK) {
            Log.d("QRquickBack", "dispatchKeyEvent BACK action=" + event.getAction() + " tracking=" + event.isTracking() + " canceled=" + event.isCanceled() + " t=" + System.currentTimeMillis());
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onBackPressed() {
        Log.d("QRquickBack", "onBackPressed() t=" + System.currentTimeMillis());
        super.onBackPressed();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                Log.d("QRquickBack", "callback bridge=" + (getBridge() != null) + " t=" + System.currentTimeMillis());
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) { android.webkit.WebBackForwardList list = webView.copyBackForwardList(); Log.d("QRquickBack", "canGoBack=" + webView.canGoBack() + " size=" + list.getSize() + " index=" + list.getCurrentIndex() + " url=" + webView.getUrl()); }
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
