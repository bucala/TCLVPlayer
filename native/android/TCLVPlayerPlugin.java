package sk.tclv.player;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.MotionEvent;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.Tracks;
import androidx.media3.common.C;
import java.util.TreeSet;
import androidx.media3.common.PlaybackException;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.media3.ui.PlayerView;
import androidx.media3.common.util.UnstableApi;
import androidx.core.content.ContextCompat;
import com.google.common.util.concurrent.ListenableFuture;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

import android.app.PictureInPictureParams;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.Rect;
import android.os.Build;
import android.util.Rational;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.Arrays;
import java.util.Locale;

@UnstableApi
@CapacitorPlugin(name = "TCLVPlayer")
public class TCLVPlayerPlugin extends Plugin {
    private volatile MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private PlayerView playerView;
    private String queueVersion = "";
    private boolean visible = false;
    private boolean screenLocked = false;
    private final Handler touchHandler = new Handler(Looper.getMainLooper());
    private final Runnable unlock = () -> notifyListeners("unlockRequested", new JSObject());
    private final ExecutorService exportIO = Executors.newSingleThreadExecutor();
    private final ExecutorService sourceIO = Executors.newSingleThreadExecutor();
    private FileExports fileExports;
    private SourceCache sourceCache;

    @Override
    public void load() {
        fileExports = new FileExports(getContext()); sourceCache = new SourceCache(getContext());
        getActivity().runOnUiThread(() -> {
            if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).setNativePlayer(this);
            SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
            controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
            controllerFuture.addListener(() -> {
                try {
                    controller = controllerFuture.get();
                    controller.addListener(new Player.Listener() {
                        @Override public void onEvents(Player player, Player.Events events) { publishState(); }
                        @Override public void onPlayerError(PlaybackException error) {
                            visible = false; if (playerView != null) playerView.setVisibility(View.GONE);
                            JSObject data = new JSObject(); data.put("error", "Stream is unavailable");
                            notifyListeners("playbackState", data);
                        }
                    });
                    ensureView(); playerView.setPlayer(controller); visible = controller.getMediaItemCount() > 0; publishState();
                } catch (Exception ignored) { controller = null; }
            }, ContextCompat.getMainExecutor(getContext()));
        });
    }
    private void ensureView() {
        if (playerView != null) return;
        ViewGroup parent = getActivity().findViewById(android.R.id.content);
        playerView = (PlayerView) getActivity().getLayoutInflater().inflate(R.layout.tclv_player_view, parent, false);
        playerView.setVisibility(View.GONE);
        playerView.setControllerAutoShow(false);
        playerView.setShowNextButton(true); playerView.setShowPreviousButton(true);
        // Web controls keep D-pad focus unless the viewer explicitly clicks video.
        playerView.setFocusable(false);
        playerView.setOnTouchListener((view, event) -> {
            if (!screenLocked) return false;
            if (event.getAction() == MotionEvent.ACTION_DOWN) touchHandler.postDelayed(unlock, 2000);
            else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) { touchHandler.removeCallbacks(unlock); if (event.getAction() == MotionEvent.ACTION_UP) view.performClick(); }
            return true;
        });
        ((ViewGroup) getActivity().findViewById(android.R.id.content)).addView(playerView, new FrameLayout.LayoutParams(1, 1));
    }
    private void publishState() {
        if (controller == null) return;
        JSObject data = new JSObject();
        data.put("hasMedia", controller.getMediaItemCount() > 0);
        data.put("playing", controller.isPlaying());
        data.put("playWhenReady", controller.getPlayWhenReady());
        data.put("buffering", controller.getPlaybackState() == Player.STATE_BUFFERING);
        MediaItem current = controller.getCurrentMediaItem();
        data.put("id", current == null ? "" : current.mediaId);
        TreeSet<Integer> heights = new TreeSet<>();
        for (Tracks.Group group : controller.getCurrentTracks().getGroups()) if (group.getType() == C.TRACK_TYPE_VIDEO) {
            for (int i = 0; i < group.length; i++) { int height = group.getTrackFormat(i).height; if (height > 0 && group.isTrackSupported(i)) heights.add(height); }
        }
        data.put("qualities", new JSArray(new ArrayList<>(heights)));
        notifyListeners("playbackState", data, true);
    }
    @PluginMethod
    public void nativeReady(PluginCall call) {
        getActivity().runOnUiThread(() -> { JSObject data = new JSObject(); data.put("ready", controller != null); call.resolve(data); publishState(); });
    }
    @PluginMethod
    public void playNative(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (controller == null) { call.reject("Native player is connecting; retry playback"); return; }
            try {
                String version = call.getString("queueVersion", "");
                JSArray channels = call.getArray("channels");
                String selected = call.getString("id", "");
                if (channels != null && !version.equals(queueVersion)) {
                    if (channels.length() > 50000) throw new IllegalArgumentException("Too many channels");
                    List<MediaItem> items = new ArrayList<>(); int selectedIndex = 0;
                    for (int i = 0; i < channels.length(); i++) {
                        JSONObject item = channels.getJSONObject(i);
                        Uri uri = Uri.parse(item.getString("url"));
                        if (!Arrays.asList("http", "https", "rtsp", "rtsps").contains(uri.getScheme())) continue;
                        String id = item.getString("id");
                        if (id.equals(selected)) selectedIndex = items.size();
                        MediaItem.Builder media = new MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(channelMetadata(item));
                        String type = item.optString("type", "");
                        if (type.equals("hls")) media.setMimeType("application/x-mpegURL");
                        items.add(media.build());
                    }
                    if (items.isEmpty()) throw new IllegalArgumentException("No supported channels");
                    controller.setMediaItems(items, selectedIndex, 0); queueVersion = version;
                } else {
                    for (int i = 0; i < controller.getMediaItemCount(); i++) {
                        if (controller.getMediaItemAt(i).mediaId.equals(selected)) { controller.seekToDefaultPosition(i); break; }
                    }
                }
                ensureView(); playerView.setPlayer(controller); visible = true;
                controller.prepare(); controller.play(); call.resolve();
            } catch (Exception ignored) { call.reject("Could not start native playback"); }
        });
    }
    private MediaMetadata channelMetadata(JSONObject item) throws org.json.JSONException {
        MediaMetadata.Builder metadata = new MediaMetadata.Builder().setTitle(item.optString("name", "Channel"))
            .setArtist(item.optString("programme", "TCLVPlayer")).setIsPlayable(true).setMediaType(MediaMetadata.MEDIA_TYPE_TV_CHANNEL);
        String logo = item.optString("logo", "");
        metadata.setArtworkUri(logo.startsWith("https://") || logo.startsWith("http://") ? Uri.parse(logo) :
            Uri.parse("android.resource://" + getContext().getPackageName() + "/" + R.drawable.tclv_icon));
        org.json.JSONArray programmes = item.optJSONArray("programmes");
        int count = programmes == null ? 0 : Math.min(48, programmes.length());
        long[] starts = new long[count], stops = new long[count];
        ArrayList<String> titles = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            JSONObject programme = programmes.getJSONObject(i);
            starts[i] = programme.getLong("start"); stops[i] = programme.getLong("stop");
            String title = programme.optString("title", "");
            titles.add(title.substring(0, Math.min(512, title.length())));
        }
        Bundle extras = new Bundle(); extras.putLongArray("epgStarts", starts); extras.putLongArray("epgStops", stops);
        extras.putStringArrayList("epgTitles", titles);
        return metadata.setExtras(extras).build();
    }
    @PluginMethod
    public void nativeMetadata(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (controller == null) { call.resolve(); return; }
            MediaItem item = controller.getCurrentMediaItem();
            // Late EPG results must not overwrite a different channel or restart its stream.
            if (item == null || !item.mediaId.equals(call.getString("id", ""))) { call.resolve(); return; }
            try {
                controller.replaceMediaItem(controller.getCurrentMediaItemIndex(),
                    item.buildUpon().setMediaMetadata(channelMetadata(call.getData())).build());
                call.resolve();
            } catch (Exception ignored) { call.reject("Could not update media information"); }
        });
    }
    @PluginMethod
    public void controlNative(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (controller == null) { call.resolve(); return; }
            switch (call.getString("action", "")) {
                case "pause": controller.pause(); break;
                case "play": controller.play(); break;
                case "toggle": if (controller.getPlayWhenReady()) controller.pause(); else controller.play(); break;
                case "next": controller.seekToNextMediaItem(); break;
                case "previous": controller.seekToPreviousMediaItem(); break;
                case "stop": controller.stop(); controller.clearMediaItems(); queueVersion = ""; visible = false; if (playerView != null) playerView.setVisibility(View.GONE); break;
                default: break;
            }
            publishState(); call.resolve();
        });
    }
    @PluginMethod
    public void nativeQuality(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (controller != null) {
                int height = call.getInt("height", -1);
                android.app.ActivityManager memory = (android.app.ActivityManager) getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
                boolean lowRamAuto = height <= 0 && memory != null && memory.isLowRamDevice();
                controller.setTrackSelectionParameters(controller.getTrackSelectionParameters().buildUpon()
                    .setMaxVideoSize(lowRamAuto ? 1280 : Integer.MAX_VALUE, height > 0 ? height : lowRamAuto ? 720 : Integer.MAX_VALUE).build());
            }
            call.resolve();
        });
    }
    @PluginMethod
    public void nativeBounds(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ensureView();
            boolean show = call.getBoolean("visible", false) && visible;
            screenLocked = call.getBoolean("locked", false); playerView.setUseController(!screenLocked && !getActivity().isInPictureInPictureMode());
            if (getActivity().isInPictureInPictureMode()) {
                playerView.setVisibility(visible ? View.VISIBLE : View.GONE);
                playerView.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
            } else {
                float scale = getContext().getResources().getDisplayMetrics().density;
                int width = Math.max(1, (int) (call.getDouble("width", 1.0) * scale));
                int height = Math.max(1, (int) (call.getDouble("height", 1.0) * scale));
                FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(width, height);
                layout.leftMargin = Math.max(0, (int) (call.getDouble("left", 0.0) * scale));
                layout.topMargin = Math.max(0, (int) (call.getDouble("top", 0.0) * scale));
                playerView.setLayoutParams(layout); playerView.setVisibility(show ? View.VISIBLE : View.GONE);
            }
            call.resolve();
        });
    }
    public void pipChanged(boolean pip) {
        if (playerView == null) return;
        playerView.setUseController(!pip);
        if (pip) { playerView.setLayoutParams(new FrameLayout.LayoutParams(-1, -1)); playerView.setVisibility(visible ? View.VISIBLE : View.GONE); }
        else { JSObject data = new JSObject(); data.put("pip", false); notifyListeners("pipChanged", data); }
    }
    public void hideControlsForRemote() { if (playerView != null) playerView.hideController(); }
    public boolean hasNativePlayback() { return controller != null && controller.getMediaItemCount() > 0; }
    public void pauseOnBackground() { if (controller != null) controller.pause(); }
    @Override
    protected void handleOnResume() { getActivity().runOnUiThread(this::publishState); }
    @Override
    protected void handleOnDestroy() {
        if (playerView != null) { playerView.setPlayer(null); ((ViewGroup) playerView.getParent()).removeView(playerView); playerView = null; }
        touchHandler.removeCallbacksAndMessages(null);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        controller = null;
        exportIO.execute(() -> fileExports.close()); exportIO.shutdown();
        sourceIO.execute(() -> sourceCache.close()); sourceIO.shutdown();
    }


    @PluginMethod
    public void saveTextFile(PluginCall call) {
        exportIO.execute(() -> {
            String id = null;
            try { id = fileExports.begin(); fileExports.append(id, call.getString("content", ""));
                call.getData().put("exportId", id); getActivity().runOnUiThread(() -> openExportPicker(call));
            } catch (Exception error) { if (id != null) fileExports.discard(id); call.reject("Could not prepare export"); }
        });
    }
    @PluginMethod public void beginTextExport(PluginCall call) {
        exportIO.execute(() -> {
            try { JSObject result = new JSObject(); result.put("id", fileExports.begin()); call.resolve(result); }
            catch (Exception error) { call.reject("Could not prepare export"); }
        });
    }
    @PluginMethod public void appendTextExport(PluginCall call) {
        exportIO.execute(() -> {
            try { fileExports.append(call.getString("id", ""), call.getString("content", "")); call.resolve(); }
            catch (Exception error) { call.reject("Could not write export chunk"); }
        });
    }
    @PluginMethod public void cancelTextExport(PluginCall call) {
        exportIO.execute(() -> { fileExports.discard(call.getString("id", "")); call.resolve(); });
    }
    @PluginMethod public void finishTextExport(PluginCall call) {
        call.getData().put("exportId", call.getString("id", ""));
        getActivity().runOnUiThread(() -> openExportPicker(call));
    }
    private void openExportPicker(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "text/plain"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "export.txt"));
        try {
            startActivityForResult(call, intent, "handleSaveTextFileResult");
        } catch (Exception exception) {
            exportIO.execute(() -> fileExports.discard(call.getString("exportId", "")));
            call.reject("Could not open save dialog");
        }
    }

    @ActivityCallback
    private void handleSaveTextFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            exportIO.execute(() -> fileExports.discard(call.getString("exportId", "")));
            call.reject("Save cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            exportIO.execute(() -> fileExports.discard(call.getString("exportId", "")));
            call.reject("No file selected");
            return;
        }
        exportIO.execute(() -> {
            try { fileExports.save(call.getString("exportId", ""), uri); call.resolve(); }
            catch (Exception error) { call.reject("Could not save export"); }
        });
    }

    @PluginMethod public void fetchEpgSource(PluginCall call) {
        sourceIO.execute(() -> {
            try {
                SourceCache.Download item = sourceCache.fetch(call.getString("url", ""));
                JSObject result = new JSObject(); result.put("id", item.id); result.put("key", item.key);
                result.put("path", item.file.getAbsolutePath()); result.put("bytes", item.file.length()); call.resolve(result);
            } catch (Exception error) {
                String message = String.valueOf(error.getMessage());
                if (message.matches("HTTP \\d{3}") || message.contains("64 MiB") || message.contains("timed out")) call.reject(message);
                else if (error instanceof javax.net.ssl.SSLException) call.reject("TLS certificate or connection error");
                else call.reject("EPG network download failed");
            }
        });
    }
    @PluginMethod public void getEpgCache(PluginCall call) {
        sourceIO.execute(() -> {
            try { JSObject result = new JSObject(); result.put("path", sourceCache.cached(call.getString("key", "")).getAbsolutePath()); call.resolve(result); }
            catch (Exception error) { call.reject("Local EPG cache is unavailable"); }
        });
    }
    @PluginMethod public void commitEpgSource(PluginCall call) {
        sourceIO.execute(() -> {
            try { sourceCache.commit(call.getString("id", "")); call.resolve(); }
            catch (Exception error) { call.reject("Could not save EPG cache"); }
        });
    }
    @PluginMethod public void discardEpgSource(PluginCall call) {
        sourceIO.execute(() -> { sourceCache.discard(call.getString("id", "")); call.resolve(); });
    }

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
        if (!Arrays.asList("http", "https", "rtsp", "rtsps", "rtmp", "rtmps").contains(scheme)) {
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

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("PiP failed: activity is not available");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                if (!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) { call.reject("Picture-in-Picture is not supported on this device"); return; }
                Rect source = new Rect(); if (playerView != null) playerView.getGlobalVisibleRect(source);
                PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9));
                if (!source.isEmpty()) builder.setSourceRectHint(source);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(false);
                if (activity.enterPictureInPictureMode(builder.build())) call.resolve(); else call.reject("Picture-in-Picture is disabled");
            } catch (Exception exception) {
                call.reject("PiP failed: " + exception.getMessage());
            }
        });
    }

    @PluginMethod
    public void setAutostart(PluginCall call) {
        Boolean value = call.getBoolean("enabled");
        boolean enabled = value != null && value;
        try {
            getActivity()
                .getSharedPreferences("tclv_player", android.content.Context.MODE_PRIVATE)
                .edit()
                .putBoolean("autostart", enabled)
                .apply();
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

    @PluginMethod
    public void setPlaybackActive(PluginCall call) {
        Boolean value = call.getBoolean("active");
        boolean active = value != null && value;
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setPlaybackActive(active);
        }
        call.resolve();
    }
}
