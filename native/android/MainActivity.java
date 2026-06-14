package sk.tclv.player;

import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS = "tclv_player";
    private static final String KEY_BACKGROUND_PLAYBACK = "backgroundPlayback";
    private PowerManager.WakeLock backgroundWakeLock;
    private boolean backgroundPlaybackEnabled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TCLVPlayerPlugin.class);
        enableImmersiveFullscreen();
        super.onCreate(savedInstanceState);
        configureWebView();
        backgroundPlaybackEnabled = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_BACKGROUND_PLAYBACK, false);
        applyBackgroundPlaybackMode();
        enableImmersiveFullscreen();
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(visibility -> enableImmersiveFullscreen());
        getWindow().getDecorView().post(this::enableImmersiveFullscreen);
    }

    private void configureWebView() {
        if (bridge == null || bridge.getWebView() == null) return;
        WebSettings settings = bridge.getWebView().getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyBackgroundPlaybackMode();
        enableImmersiveFullscreen();
        getWindow().getDecorView().postDelayed(this::enableImmersiveFullscreen, 250);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (backgroundPlaybackEnabled && bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().onResume();
        }
    }

    @Override
    public void onDestroy() {
        releaseBackgroundWakeLock();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enableImmersiveFullscreen();
    }

    private void enableImmersiveFullscreen() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (backgroundPlaybackEnabled) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = window.getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attrs);
        }

        View decor = window.getDecorView();
        int flags =
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        decor.setSystemUiVisibility(flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    public void setBackgroundPlaybackEnabled(boolean enabled) {
        backgroundPlaybackEnabled = enabled;
        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_BACKGROUND_PLAYBACK, enabled)
            .apply();
        applyBackgroundPlaybackMode();
    }

    private void applyBackgroundPlaybackMode() {
        if (backgroundPlaybackEnabled) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            acquireBackgroundWakeLock();
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            releaseBackgroundWakeLock();
        }
    }

    private void acquireBackgroundWakeLock() {
        if (backgroundWakeLock != null && backgroundWakeLock.isHeld()) return;
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        backgroundWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TCLVPlayer:BackgroundPlayback");
        backgroundWakeLock.setReferenceCounted(false);
        backgroundWakeLock.acquire();
    }

    private void releaseBackgroundWakeLock() {
        if (backgroundWakeLock != null && backgroundWakeLock.isHeld()) backgroundWakeLock.release();
        backgroundWakeLock = null;
    }
}
