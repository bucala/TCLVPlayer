package sk.tclv.player;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS = "tclv_player";
    private static final String KEY_BACKGROUND_PLAYBACK = "backgroundPlayback";

    private PowerManager.WakeLock backgroundWakeLock;
    private boolean backgroundPlaybackEnabled = false;
    private boolean playbackActive = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TCLVPlayerPlugin.class);
        super.onCreate(savedInstanceState);
        safeConfigureWebView();
        backgroundPlaybackEnabled = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_BACKGROUND_PLAYBACK, false);
        applyBackgroundPlaybackMode();
        safeEnableImmersiveFullscreen();
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(
            ignored -> safeEnableImmersiveFullscreen()
        );
        getWindow().getDecorView().post(this::safeEnableImmersiveFullscreen);
    }

    private void safeConfigureWebView() {
        try {
            configureWebView();
        } catch (Exception ignored) {
        }
    }

    private void configureWebView() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);
        if (isTelevision()) {
            // Android TV emulators/boxes frequently fail to composite the
            // hardware-accelerated WebView surface, showing a solid black
            // screen. Software rendering avoids that GPU compositing path.
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }
    }

    private boolean isTelevision() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        return uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    @Override
    public void onResume() {
        super.onResume();
        applyBackgroundPlaybackMode();
        safeEnableImmersiveFullscreen();
        getWindow().getDecorView().postDelayed(this::safeEnableImmersiveFullscreen, 250);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (backgroundPlaybackEnabled && playbackActive && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
        }
        applyBackgroundPlaybackMode();
    }

    @Override
    public void onDestroy() {
        releaseBackgroundWakeLock();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) safeEnableImmersiveFullscreen();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_UP && dispatchTvKeyToWeb(event.getKeyCode())) {
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private boolean dispatchTvKeyToWeb(int keyCode) {
        String key;
        switch (keyCode) {
            case KeyEvent.KEYCODE_BACK:
                key = "Back";
                break;
            case KeyEvent.KEYCODE_CHANNEL_UP:
                key = "ChannelUp";
                break;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                key = "ChannelDown";
                break;
            case KeyEvent.KEYCODE_GUIDE:
                key = "Guide";
                break;
            case KeyEvent.KEYCODE_INFO:
                key = "Info";
                break;
            default:
                return false;
        }
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return false;
        String js = "window.dispatchEvent(new KeyboardEvent('keydown', { key: '" + key + "', keyCode: " + keyCode + ", bubbles: true }));";
        webView.evaluateJavascript(js, null);
        return true;
    }

    private void safeEnableImmersiveFullscreen() {
        try {
            enableImmersiveFullscreen();
        } catch (Exception ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    private void enableImmersiveFullscreen() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (backgroundPlaybackEnabled) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }

    public void setBackgroundPlaybackEnabled(boolean enabled) {
        backgroundPlaybackEnabled = enabled;
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_BACKGROUND_PLAYBACK, enabled)
            .apply();
        applyBackgroundPlaybackMode();
    }

    public void setPlaybackActive(boolean active) {
        playbackActive = active;
        applyBackgroundPlaybackMode();
    }

    private void applyBackgroundPlaybackMode() {
        runOnUiThread(() -> {
            if (backgroundPlaybackEnabled && playbackActive) {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                acquireBackgroundWakeLock();
            } else {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                releaseBackgroundWakeLock();
            }
        });
    }

    @SuppressWarnings("WakelockTimeout")
    private void acquireBackgroundWakeLock() {
        if (backgroundWakeLock != null && backgroundWakeLock.isHeld()) return;
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) return;
        backgroundWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "TCLVPlayer:BackgroundPlayback"
        );
        backgroundWakeLock.setReferenceCounted(false);
        backgroundWakeLock.acquire();
    }

    private void releaseBackgroundWakeLock() {
        if (backgroundWakeLock != null && backgroundWakeLock.isHeld()) {
            backgroundWakeLock.release();
        }
        backgroundWakeLock = null;
    }
}
