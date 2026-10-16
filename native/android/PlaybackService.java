package sk.tclv.player;

import android.app.PendingIntent;
import android.app.ActivityManager;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import android.content.Intent;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.common.MediaItem;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.Objects;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.CacheBitmapLoader;
import androidx.media3.common.util.UnstableApi;

/** The foreground service owns playback; a WebView pause never owns the decoder. */
@UnstableApi
public class PlaybackService extends MediaSessionService {
    private MediaSession session;
    private final Handler metadataHandler = new Handler(Looper.getMainLooper());
    private final Runnable metadataTick = new Runnable() {
        @Override public void run() { refreshProgramme(); metadataHandler.postDelayed(this, 30000); }
    };
    private void refreshProgramme() {
        if (session == null) return;
        Player player = session.getPlayer();
        MediaItem item = player.getCurrentMediaItem();
        if (item == null || item.mediaMetadata.extras == null) return;
        Bundle extras = item.mediaMetadata.extras;
        long[] starts = extras.getLongArray("epgStarts"), stops = extras.getLongArray("epgStops");
        ArrayList<String> titles = extras.getStringArrayList("epgTitles");
        if (starts == null || stops == null || titles == null) return;
        String programme = "TCLVPlayer"; long now = System.currentTimeMillis();
        for (int i = 0; i < Math.min(titles.size(), Math.min(starts.length, stops.length)); i++) {
            if (starts[i] <= now && now < stops[i]) { programme = titles.get(i); break; }
        }
        if (!Objects.equals(item.mediaMetadata.artist, programme)) player.replaceMediaItem(player.getCurrentMediaItemIndex(),
            item.buildUpon().setMediaMetadata(item.mediaMetadata.buildUpon().setArtist(programme).build()).build());
    }
    @Override
    public void onCreate() {
        super.onCreate();
        ActivityManager memory = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        boolean lowRam = memory != null && memory.isLowRamDevice();
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent("TCLVPlayer/1.3 Android")
            .setConnectTimeoutMs(15000).setReadTimeoutMs(20000)
            .setAllowCrossProtocolRedirects(false);
        ExoPlayer player = new ExoPlayer.Builder(this, new DefaultRenderersFactory(this).setEnableDecoderFallback(true))
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http)))
            .setLoadControl(new DefaultLoadControl.Builder()
                .setBufferDurationsMs(5000, 20000, 1000, 2000)
                .setTargetBufferBytes((lowRam ? 8 : 16) * 1024 * 1024)
                .setPrioritizeTimeOverSizeThresholds(false).build())
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
            .setHandleAudioBecomingNoisy(true).setWakeMode(C.WAKE_MODE_NETWORK).build();
        if (lowRam) player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setMaxVideoSize(1280, 720).build());
        player.setRepeatMode(Player.REPEAT_MODE_ALL);
        Intent launch = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent activity = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        session = new MediaSession.Builder(this, player).setSessionActivity(activity)
            .setBitmapLoader(new CacheBitmapLoader(new ChannelArtworkLoader(this)))
            .setCallback(new MediaSession.Callback() {
                @Override public MediaSession.ConnectionResult onConnect(MediaSession session, MediaSession.ControllerInfo controller) {
                    if (!getPackageName().equals(controller.getPackageName()) && !controller.isTrusted()) return MediaSession.ConnectionResult.reject();
                    return MediaSession.Callback.super.onConnect(session, controller);
                }
            }).build();
        player.addListener(new Player.Listener() {
            @Override public void onMediaItemTransition(@Nullable MediaItem item, int reason) { refreshProgramme(); }
        });
        metadataHandler.post(metadataTick);
        // MediaSessionService maintains the foreground notification (artwork, play/pause,
        // previous/next), lock-screen controls, Bluetooth and audio focus on all API levels.
    }
    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) { return session; }
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        boolean background = getSharedPreferences("tclv_player", MODE_PRIVATE).getBoolean("backgroundPlayback", true);
        if (!background || session == null || !session.getPlayer().getPlayWhenReady()) {
            if (session != null) session.getPlayer().stop();
            stopSelf();
        }
    }
    @Override
    public void onDestroy() {
        metadataHandler.removeCallbacksAndMessages(null);
        if (session != null) { session.getPlayer().release(); session.release(); session = null; }
        super.onDestroy();
    }
}
