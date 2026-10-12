package com.sabinkhanal.khabarpulse;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import java.util.List;

/** 4x2 home-screen widget: BS date and the top three headlines. Tapping opens the app. */
public class NewsWidgetProvider extends AppWidgetProvider {
    private static final int[] TITLES = {R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3};
    private static final int[] SOURCES = {R.id.widget_source_1, R.id.widget_source_2, R.id.widget_source_3};

    @Override
    public void onEnabled(Context context) {
        NewsRefreshWorker.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        NewsRefreshWorker.cancel(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        NewsRefreshWorker.schedule(context);
        List<WidgetRows.Row> rows = NewsRefreshWorker.cached(context);
        if (rows.isEmpty()) {
            WorkManager.getInstance(context).enqueue(OneTimeWorkRequest.from(NewsRefreshWorker.class));
        }
        for (int id : ids) manager.updateAppWidget(id, build(context, rows));
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NewsWidgetProvider.class));
        List<WidgetRows.Row> rows = NewsRefreshWorker.cached(context);
        for (int id : ids) manager.updateAppWidget(id, build(context, rows));
    }

    private static RemoteViews build(Context context, List<WidgetRows.Row> rows) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_news);
        v.setTextViewText(R.id.widget_date, BsDate.today());
        for (int i = 0; i < TITLES.length; i++) {
            if (i < rows.size()) {
                v.setTextViewText(TITLES[i], rows.get(i).title);
                v.setTextViewText(SOURCES[i], rows.get(i).sources);
            } else {
                v.setTextViewText(TITLES[i], i == 0 ? context.getString(R.string.widget_empty) : "");
                v.setTextViewText(SOURCES[i], "");
            }
        }
        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
