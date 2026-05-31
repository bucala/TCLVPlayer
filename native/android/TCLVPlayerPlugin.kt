package sk.tclv.player

import android.content.Intent
import android.net.Uri
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "TCLVPlayer")
class TCLVPlayerPlugin : Plugin() {

    @PluginMethod
    fun openExternalPlayer(call: PluginCall) {
        val player = call.getString("player") ?: "vlc"
        val url = call.getString("url") ?: run {
            call.reject("Missing stream URL"); return
        }
        val uri = Uri.parse(url)
        val scheme = uri.scheme?.lowercase() ?: ""
        if (scheme !in listOf("http", "https", "rtsp", "rtmp", "file")) {
            call.reject("Unsupported URL scheme: $scheme"); return
        }
        try {
            val packageName = when (player.lowercase()) {
                "vlc" -> "org.videolan.vlc"
                "mpv" -> "is.xyz.mpv"
                else -> null
            }
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/*")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (packageName != null) setPackage(packageName)
            }
            val finalIntent = if (packageName != null &&
                activity.packageManager.resolveActivity(intent, 0) == null) {
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "video/*")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else { intent }
            activity.startActivity(finalIntent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not open external player: ${e.message}")
        }
    }
}
