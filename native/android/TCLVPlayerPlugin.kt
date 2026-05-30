package sk.tclv.player

import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "TCLVPlayer")
class TCLVPlayerPlugin : Plugin() {
    @PluginMethod
    fun openExternalPlayer(call: PluginCall) {
        val player = call.getString("player", "").lowercase()
        val url = call.getString("url", "")
        val title = call.getString("title", "TCLVPlayer")

        if (url.isBlank()) {
            call.reject("Missing stream URL.")
            return
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(url), "video/*")
            putExtra("title", title)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        when (player) {
            "vlc" -> intent.setPackage("org.videolan.vlc")
            "mpv" -> intent.setPackage("is.xyz.mpv")
            else -> {
                call.reject("Unsupported external player.")
                return
            }
        }

        try {
            activity.startActivity(intent)
            call.resolve(JSObject().put("ok", true).put("player", player))
        } catch (error: Exception) {
            call.reject("Player app is not installed or cannot open this stream.", error)
        }
    }
}
