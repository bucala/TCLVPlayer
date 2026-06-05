package sk.tclv.player

import android.os.Bundle
import android.webkit.WebSettings
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TCLVPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
        configureWebView()
    }

    private fun configureWebView() {
        val webView = bridge?.webView ?: return
        webView.post {
            webView.settings.apply {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                mediaPlaybackRequiresUserGesture = false
                domStorageEnabled = true
                javaScriptEnabled = true
            }
        }
    }
}
