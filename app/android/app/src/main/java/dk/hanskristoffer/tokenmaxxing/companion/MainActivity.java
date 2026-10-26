package dk.hanskristoffer.tokenmaxxing.companion;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;


/** A game companion with no JS/native bridge, filesystem access, desktop helper or device token. */
public class MainActivity extends ComponentActivity {
    private WebView web;
    private TextView status;
    private boolean failed;
    private final OnBackPressedCallback back = new OnBackPressedCallback(false) {
        @Override public void handleOnBackPressed() { web.goBack(); }
    };

    @Override
    @SuppressLint("SetJavaScriptEnabled") // The existing game needs JavaScript; no native bridge is exposed.
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(27, 31, 42));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setPadding(dp(12), dp(8), dp(12), dp(8));
        status.setVisibility(View.GONE);
        status.setOnClickListener(v -> web.loadUrl(PairingLink.gameUrl(BuildConfig.SERVER_URL)));
        root.addView(status);
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (PairingLink.isTrusted(BuildConfig.SERVER_URL, url)) return false;
                // An off-origin navigation never gets the app's session or a native bridge.
                if (request.isForMainFrame() && request.hasGesture()) external(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                failed = false;
                status.setText(R.string.connecting);
                status.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!failed) status.setVisibility(View.GONE);
                back.setEnabled(web.canGoBack());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    failed = true;
                    status.setText(R.string.network_error);
                    status.setVisibility(View.VISIBLE);
                }
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);
        getOnBackPressedDispatcher().addCallback(this, back);
        root.requestApplyInsets();
        web.loadUrl(PairingLink.gameUrl(BuildConfig.SERVER_URL));
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void external(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ignored) { /* A device without a browser keeps the game open. */ }
    }

    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
