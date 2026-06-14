package sk.tclv.player

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebSettings
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private val prefs = "tclv_player"
    private val keyBackgroundPlayback = "backgroundPlayback"
    private var backgroundWakeLock: PowerManager.WakeLock? = null
    private var backgroundPlaybackEnabled = false

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TCLVPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
        configureWebView()
        backgroundPlaybackEnabled = getSharedPreferences(prefs, Context.MODE_PRIVATE)
            .getBoolean(keyBackgroundPlayback, false)
        applyBackgroundPlaybackMode()
        enableImmersiveFullscreen()
        @Suppress("DEPRECATION")
        window.decorView.setOnSystemUiVisibilityChangeListener {
            enableImmersiveFullscreen()
        }
        window.decorView.post { enableImmersiveFullscreen() }
    }

    private fun configureWebView() {
        val webView = bridge?.webView ?: return
        webView.settings.apply {
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            mediaPlaybackRequiresUserGesture = false
            domStorageEnabled = true
            javaScriptEnabled = true
        }
    }

    override fun onResume() {
        super.onResume()
        applyBackgroundPlaybackMode()
        enableImmersiveFullscreen()
        window.decorView.postDelayed({ enableImmersiveFullscreen() }, 250)
    }

    override fun onPause() {
        super.onPause()
        if (backgroundPlaybackEnabled) {
            bridge?.webView?.onResume()
        }
    }

    override fun onDestroy() {
        releaseBackgroundWakeLock()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enableImmersiveFullscreen()
    }

    private fun enableImmersiveFullscreen() {
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        if (backgroundPlaybackEnabled) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    fun setBackgroundPlaybackEnabled(enabled: Boolean) {
        backgroundPlaybackEnabled = enabled
        getSharedPreferences(prefs, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(keyBackgroundPlayback, enabled)
            .apply()
        applyBackgroundPlaybackMode()
    }

    private fun applyBackgroundPlaybackMode() {
        if (backgroundPlaybackEnabled) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            acquireBackgroundWakeLock()
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            releaseBackgroundWakeLock()
        }
    }

    private fun acquireBackgroundWakeLock() {
        if (backgroundWakeLock?.isHeld == true) return
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        backgroundWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "TCLVPlayer:BackgroundPlayback",
        ).apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseBackgroundWakeLock() {
        if (backgroundWakeLock?.isHeld == true) backgroundWakeLock?.release()
        backgroundWakeLock = null
    }
}
