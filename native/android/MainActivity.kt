package sk.tclv.player

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebSettings
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TCLVPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
        configureWebView()
        enableImmersiveFullscreen()
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
        enableImmersiveFullscreen()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enableImmersiveFullscreen()
    }

    private fun enableImmersiveFullscreen() {
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.BLACK
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
}
