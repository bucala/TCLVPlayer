package sk.tclv.player;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.media3.common.util.UnstableApi;

import com.getcapacitor.BridgeActivity;

@UnstableApi
public class MainActivity extends BridgeActivity {
    private static final String PREFS = "tclv_player";
    private static final String KEY_BACKGROUND_PLAYBACK = "backgroundPlayback";

    private TCLVPlayerPlugin nativePlayer;
    public void setNativePlayer(TCLVPlayerPlugin plugin) { nativePlayer = plugin; }
    private boolean backgroundPlaybackEnabled = true;
    private boolean playbackActive = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TCLVPlayerPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                WebView web = getBridge() == null ? null : getBridge().getWebView();
                if (web == null) { moveTaskToBack(true); return; }
                web.evaluateJavascript("typeof handleBackStep === 'function' && handleBackStep()", result -> {
                    if (!"true".equals(result)) moveTaskToBack(true);
                });
            }
        });
        safeConfigureWebView();
        backgroundPlaybackEnabled = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_BACKGROUND_PLAYBACK, true);
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
        if (isTelevision() && isProbablyEmulator()) {
            // Android TV *emulators* frequently fail to composite the
            // hardware-accelerated WebView surface (SwiftShader/software GPU
            // quirk), showing a solid black screen. Software rendering
            // avoids that. Real TV boxes don't have this problem and forcing
            // software rendering on them is a severe performance regression
            // (every paint — scrolling, video, focus changes — goes through
            // the CPU instead of the GPU), so scope this to emulators only.
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }
    }

    private boolean isTelevision() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        return uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private boolean isProbablyEmulator() {
        String fingerprint = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT;
        String model = Build.MODEL == null ? "" : Build.MODEL;
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        String product = Build.PRODUCT == null ? "" : Build.PRODUCT;
        String hardware = Build.HARDWARE == null ? "" : Build.HARDWARE;
        return fingerprint.startsWith("generic")
            || fingerprint.contains("emulator")
            || model.contains("Emulator")
            || model.contains("Android SDK built for")
            || manufacturer.contains("Genymotion")
            || hardware.contains("goldfish")
            || hardware.contains("ranchu")
            || product.contains("sdk_gphone")
            || product.contains("google_sdk");
    }

    @Override
    public void onResume() {
        super.onResume();
        applyBackgroundPlaybackMode();
        safeEnableImmersiveFullscreen();
        getWindow().getDecorView().postDelayed(this::safeEnableImmersiveFullscreen, 250);
    }

    @Override
    public void onStop() {
        super.onStop();
        if (!backgroundPlaybackEnabled && !isInPictureInPictureMode() && nativePlayer != null) nativePlayer.pauseOnBackground();
    }
    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration configuration) {
        super.onPictureInPictureModeChanged(inPip, configuration);
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setVisibility(inPip ? View.INVISIBLE : View.VISIBLE);
        if (nativePlayer != null) nativePlayer.pipChanged(inPip);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) safeEnableImmersiveFullscreen();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        String key;
        switch (code) {
            case KeyEvent.KEYCODE_CHANNEL_UP: key = "ChannelUp"; break;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: key = "ChannelDown"; break;
            case KeyEvent.KEYCODE_GUIDE: key = "Guide"; break;
            case KeyEvent.KEYCODE_INFO: key = "Info"; break;
            case KeyEvent.KEYCODE_DPAD_UP: key = "ArrowUp"; break;
            case KeyEvent.KEYCODE_DPAD_DOWN: key = "ArrowDown"; break;
            case KeyEvent.KEYCODE_DPAD_LEFT: key = "ArrowLeft"; break;
            case KeyEvent.KEYCODE_DPAD_RIGHT: key = "ArrowRight"; break;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: key = "MediaPlayPause"; break;
            default: return super.dispatchKeyEvent(event);
        }
        WebView web = getBridge() == null ? null : getBridge().getWebView();
        if (web == null || isInPictureInPictureMode()) return super.dispatchKeyEvent(event);
        // One physical keydown becomes exactly one focused DOM event. Consume keyup
        // too, preventing Android's default spatial traversal from moving a second time.
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (key.startsWith("Arrow")) { if (nativePlayer != null) nativePlayer.hideControlsForRemote(); web.requestFocus(); }
            String js = "(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:'" + key
                + "',keyCode:" + code + ",bubbles:true,cancelable:true,repeat:" + (event.getRepeatCount() > 0) + "}));";
            web.evaluateJavascript(js, null);
        }
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
            if (playbackActive) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }
}
