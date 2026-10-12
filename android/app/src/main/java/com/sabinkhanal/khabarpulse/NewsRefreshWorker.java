package com.sabinkhanal.khabarpulse;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Fetches the public news.json and caches the top headlines for the widget. */
public class NewsRefreshWorker extends Worker {
    static final String FEED = "https://sabin78910.github.io/khabar-pulse/news.json";
    static final String PREFS = "khabar_widget";
    static final String KEY_ROWS = "rows";
    private static final String WORK_NAME = "khabar-widget-refresh";
    private static final int MAX_BYTES = 8 * 1024 * 1024;

    public NewsRefreshWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void schedule(Context context) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NewsRefreshWorker.class, 30, TimeUnit.MINUTES)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    static void cancel(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
    }

    static List<WidgetRows.Row> cached(Context context) {
        return WidgetRows.decode(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ROWS, "[]"));
    }

    @NonNull
    @Override
    public Result doWork() {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(FEED).openConnection();
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(15_000);
            if (conn.getResponseCode() != 200) return Result.retry();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = conn.getInputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > MAX_BYTES) return Result.failure();
                }
            }
            List<WidgetRows.Row> rows = WidgetRows.parse(out.toString(StandardCharsets.UTF_8.name()), 3);
            if (rows.isEmpty()) return Result.retry();
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_ROWS, WidgetRows.encode(rows)).apply();
            NewsWidgetProvider.refreshAll(getApplicationContext());
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
