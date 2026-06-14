package sk.tclv.player;

import android.app.PictureInPictureParams;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Rational;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TCLVPlayer")
public class TCLVPlayerPlugin extends Plugin {
    @PluginMethod
    public void openExternalPlayer(PluginCall call) {
        String player = call.getString("player");
        if (player == null) player = "vlc";
        String url = call.getString("url");
        if (url == null) {
            call.reject("Missing stream URL");
            return;
        }

        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!scheme.equals("http") && !scheme.equals("https") && !scheme.equals("rtsp") && !scheme.equals("rtmp") && !scheme.equals("file")) {
            call.reject("Unsupported URL scheme: " + scheme);
            return;
        }

        try {
            String packageName = null;
            String playerKey = player.toLowerCase();
            if (playerKey.equals("vlc")) packageName = "org.videolan.vlc";
            if (playerKey.equals("mpv")) packageName = "is.xyz.mpv";

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "video/*");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (packageName != null) intent.setPackage(packageName);

            Intent finalIntent = intent;
            if (packageName != null && getActivity().getPackageManager().resolveActivity(intent, 0) == null) {
                finalIntent = new Intent(Intent.ACTION_VIEW);
                finalIntent.setDataAndType(uri, "video/*");
                finalIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }
            getActivity().startActivity(finalIntent);
            call.resolve();
        } catch (Exception ex) {
            call.reject("Could not open external player: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void enterPip(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("PiP requires Android 8.0+");
            return;
        }
        try {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .build();
            getActivity().enterPictureInPictureMode(params);
            call.resolve();
        } catch (Exception ex) {
            call.reject("PiP failed: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void setAutostart(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) enabled = false;
        try {
            ComponentName receiver = new ComponentName(getActivity(), BootReceiver.class);
            int state = enabled
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            getActivity().getPackageManager().setComponentEnabledSetting(receiver, state, PackageManager.DONT_KILL_APP);
            call.resolve();
        } catch (Exception ex) {
            call.reject("Autostart toggle failed: " + ex.getMessage());
        }
    }
}
