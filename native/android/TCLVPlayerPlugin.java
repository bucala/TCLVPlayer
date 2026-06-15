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

import java.util.Arrays;
import java.util.Locale;

@CapacitorPlugin(name = "TCLVPlayer")
public class TCLVPlayerPlugin extends Plugin {
    @PluginMethod
    public void openExternalPlayer(PluginCall call) {
        String player = call.getString("player");
        String url = call.getString("url");
        if (player == null) player = "vlc";
        if (url == null) {
            call.reject("Missing stream URL");
            return;
        }

        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!Arrays.asList("http", "https", "rtsp", "rtmp", "file").contains(scheme)) {
            call.reject("Unsupported URL scheme: " + scheme);
            return;
        }

        try {
            String packageName;
            switch (player.toLowerCase(Locale.ROOT)) {
                case "vlc":
                    packageName = "org.videolan.vlc";
                    break;
                case "mpv":
                    packageName = "is.xyz.mpv";
                    break;
                case "system":
                case "native":
                default:
                    packageName = null;
                    break;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "video/*");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (packageName != null) intent.setPackage(packageName);

            Intent finalIntent = intent;
            if (packageName != null &&
                getActivity().getPackageManager().resolveActivity(intent, 0) == null) {
                finalIntent = new Intent(Intent.ACTION_VIEW);
                finalIntent.setDataAndType(uri, "video/*");
                finalIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }

            getActivity().startActivity(finalIntent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Could not open external player: " + exception.getMessage());
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
        } catch (Exception exception) {
            call.reject("PiP failed: " + exception.getMessage());
        }
    }

    @PluginMethod
    public void setAutostart(PluginCall call) {
        Boolean value = call.getBoolean("enabled");
        boolean enabled = value != null && value;
        try {
            ComponentName receiver = new ComponentName(getActivity(), BootReceiver.class);
            int state = enabled
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            getActivity().getPackageManager().setComponentEnabledSetting(
                receiver,
                state,
                PackageManager.DONT_KILL_APP
            );
            call.resolve();
        } catch (Exception exception) {
            call.reject("Autostart toggle failed: " + exception.getMessage());
        }
    }

    @PluginMethod
    public void setBackgroundPlayback(PluginCall call) {
        Boolean value = call.getBoolean("enabled");
        boolean enabled = value != null && value;
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setBackgroundPlaybackEnabled(enabled);
        }
        call.resolve();
    }
}
