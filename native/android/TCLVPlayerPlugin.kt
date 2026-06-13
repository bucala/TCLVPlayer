package sk.tclv.player

import android.app.PictureInPictureParams
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Rational
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
                "system", "native" -> null
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

    @PluginMethod
    fun enterPip(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("PiP requires Android 8.0+"); return
        }
        try {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            activity.enterPictureInPictureMode(params)
            call.resolve()
        } catch (e: Exception) {
            call.reject("PiP failed: ${e.message}")
        }
    }

    @PluginMethod
    fun setAutostart(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        try {
            val receiver = ComponentName(activity, BootReceiver::class.java)
            val state = if (enabled)
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            else
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            activity.packageManager.setComponentEnabledSetting(
                receiver, state, PackageManager.DONT_KILL_APP
            )
            call.resolve()
        } catch (e: Exception) {
            call.reject("Autostart toggle failed: ${e.message}")
        }
    }
}
