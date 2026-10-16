package sk.tclv.player;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.net.Uri;
import androidx.media3.common.util.BitmapLoader;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSourceBitmapLoader;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

/** System media surfaces may centre-crop artwork, so give them a padded square. */
@UnstableApi
public final class ChannelArtworkLoader implements BitmapLoader {
    private final DataSourceBitmapLoader delegate;

    public ChannelArtworkLoader(Context context) {
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(10000).setReadTimeoutMs(10000);
        delegate = new DataSourceBitmapLoader.Builder(context)
            .setDataSourceFactory(new DefaultDataSource.Factory(context, http))
            .setMaximumOutputDimension(512).build();
    }
    @Override public boolean supportsMimeType(String mimeType) { return delegate.supportsMimeType(mimeType); }
    @Override public ListenableFuture<Bitmap> decodeBitmap(byte[] data) { return fit(delegate.decodeBitmap(data)); }
    @Override public ListenableFuture<Bitmap> loadBitmap(Uri uri) { return fit(delegate.loadBitmap(uri)); }

    private ListenableFuture<Bitmap> fit(ListenableFuture<Bitmap> future) {
        return Futures.transform(future, source -> {
            Bitmap square = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(square);
            canvas.drawColor(Color.rgb(24, 24, 28));
            float scale = Math.min(416f / source.getWidth(), 416f / source.getHeight());
            float width = source.getWidth() * scale, height = source.getHeight() * scale;
            canvas.drawBitmap(source, null, new RectF((512 - width) / 2, (512 - height) / 2,
                (512 + width) / 2, (512 + height) / 2), new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG));
            return square;
        }, DataSourceBitmapLoader.DEFAULT_EXECUTOR_SERVICE.get());
    }
}
