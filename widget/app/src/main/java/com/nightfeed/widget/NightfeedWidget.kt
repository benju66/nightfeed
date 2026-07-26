package com.nightfeed.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import android.widget.Toast
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Date
import java.util.concurrent.TimeUnit

class NightfeedWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        schedule(context)
        Topics.subscribe(context)
        refreshNow(context)
    }

    override fun onEnabled(context: Context) {
        schedule(context)
        Topics.subscribe(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_WET -> {
                buzz(context)
                Toast.makeText(context, "Logging wet diaper…", Toast.LENGTH_SHORT).show()
                WorkManager.getInstance(context)
                    .enqueue(OneTimeWorkRequestBuilder<WetWorker>().setConstraints(net()).build())
            }
            ACTION_SLEEP -> {
                buzz(context)
                Toast.makeText(context, "Updating sleep…", Toast.LENGTH_SHORT).show()
                WorkManager.getInstance(context)
                    .enqueue(OneTimeWorkRequestBuilder<SleepWorker>().setConstraints(net()).build())
            }
            ACTION_REFRESH -> refreshNow(context)
            // APK was just updated: re-assert the push subscription and schedule.
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                schedule(context)
                Topics.subscribe(context)
                refreshNow(context)
            }
        }
    }

    companion object {
        const val ACTION_WET = "com.nightfeed.widget.LOG_WET"
        const val ACTION_SLEEP = "com.nightfeed.widget.TOGGLE_SLEEP"
        const val ACTION_REFRESH = "com.nightfeed.widget.REFRESH"
        const val APP_URL = "https://nightfeed-al972.web.app"

        fun net(): Constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        // Same short confirmation buzz the app gives — matters most here, where
        // the action runs in the background with no screen change.
        private fun buzz(context: Context) {
            try {
                val vib = if (android.os.Build.VERSION.SDK_INT >= 31) {
                    (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as android.os.VibratorManager).defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    context.getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
                }
                vib.vibrate(android.os.VibrationEffect.createOneShot(25, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
            } catch (e: Exception) {
                /* no vibrator */
            }
        }

        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "nightfeed-widget-refresh",
                ExistingPeriodicWorkPolicy.UPDATE,
                PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).setConstraints(net()).build()
            )
        }

        fun refreshNow(context: Context) {
            WorkManager.getInstance(context)
                .enqueue(OneTimeWorkRequestBuilder<RefreshWorker>().setConstraints(net()).build())
        }

        fun render(context: Context, state: WidgetState?) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, NightfeedWidget::class.java))
            if (ids.isEmpty()) return
            mgr.updateAppWidget(ids, buildViews(context, state))
        }

        private fun pendingUrl(context: Context, url: String, req: Int): PendingIntent =
            PendingIntent.getActivity(
                context, req, Intent(Intent.ACTION_VIEW, Uri.parse(url)),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

        private fun pendingBroadcast(context: Context, action: String, req: Int): PendingIntent =
            PendingIntent.getBroadcast(
                context, req, Intent(context, NightfeedWidget::class.java).setAction(action),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

        // Chronometer counts from an elapsedRealtime base; anchor it to a wall-clock event.
        private fun chronoBase(eventTs: Long): Long =
            SystemClock.elapsedRealtime() - (System.currentTimeMillis() - eventTs)

        // Minutes/hours granularity — refreshed on every render (push + poll).
        private fun ago(ts: Long): String {
            val mins = ((System.currentTimeMillis() - ts) / 60000).toInt()
            if (mins < 1) return "just now"
            val h = mins / 60
            return (if (h > 0) h.toString() + "h " + (mins % 60) + "m" else mins.toString() + "m") + " ago"
        }

        fun buildViews(context: Context, state: WidgetState?): RemoteViews {
            val v = RemoteViews(context.packageName, R.layout.widget)
            val timeFmt = DateFormat.getTimeFormat(context)

            v.setOnClickPendingIntent(R.id.root, pendingUrl(context, APP_URL, 0))
            v.setOnClickPendingIntent(R.id.btn_left, pendingUrl(context, "$APP_URL/?action=feed-left", 1))
            v.setOnClickPendingIntent(R.id.btn_right, pendingUrl(context, "$APP_URL/?action=feed-right", 2))
            v.setOnClickPendingIntent(R.id.btn_wet, pendingBroadcast(context, ACTION_WET, 3))
            v.setOnClickPendingIntent(R.id.tv_asof, pendingBroadcast(context, ACTION_REFRESH, 4))
            v.setOnClickPendingIntent(R.id.btn_sleep, pendingBroadcast(context, ACTION_SLEEP, 6))

            if (Prefs.code(context) == null) {
                v.setTextViewText(R.id.tv_state, "Tap to set up")
                v.setViewVisibility(R.id.chrono_state, View.GONE)
                val cfg = PendingIntent.getActivity(
                    context, 5, Intent(context, ConfigActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                v.setOnClickPendingIntent(R.id.root, cfg)
                return v
            }
            if (state == null) {
                v.setTextViewText(R.id.tv_asof, "offline · tap to retry")
                return v
            }

            v.setTextViewText(R.id.tv_title, state.babyName.ifBlank { "Nightfeed" })
            v.setTextViewText(R.id.tv_asof, "as of " + timeFmt.format(Date(state.fetchedAt)) + " ↻")

            val af = state.activeFeed
            when {
                af != null && af.paused -> {
                    v.setTextViewText(R.id.tv_state, "Feeding · paused")
                    v.setViewVisibility(R.id.chrono_state, View.GONE)
                }
                af != null -> {
                    v.setTextViewText(R.id.tv_state, if (af.type == "bottle") "Bottle feeding" else "Feeding · " + af.type)
                    v.setViewVisibility(R.id.chrono_state, View.VISIBLE)
                    v.setChronometer(R.id.chrono_state, chronoBase(af.feedStart), null, true)
                }
                state.sleepStart != null -> {
                    v.setTextViewText(R.id.tv_state, "Sleeping")
                    v.setViewVisibility(R.id.chrono_state, View.VISIBLE)
                    v.setChronometer(R.id.chrono_state, chronoBase(state.sleepStart), null, true)
                }
                state.lastSleepEnd != null -> {
                    v.setTextViewText(R.id.tv_state, "Awake")
                    v.setViewVisibility(R.id.chrono_state, View.VISIBLE)
                    v.setChronometer(R.id.chrono_state, chronoBase(state.lastSleepEnd), null, true)
                }
                else -> {
                    v.setTextViewText(R.id.tv_state, "Awake")
                    v.setViewVisibility(R.id.chrono_state, View.GONE)
                }
            }

            // Feeding block: last fed + the next-feed forecast right beneath it.
            if (state.lastFeedStart != null) {
                v.setTextViewText(R.id.tv_fed, "Fed " + timeFmt.format(Date(state.lastFeedStart)) + " · " + ago(state.lastFeedStart))
            } else {
                v.setTextViewText(R.id.tv_fed, "No feeds yet")
            }
            v.setViewVisibility(R.id.tv_next, View.GONE)
            if (state.feedAlertHours != null && state.lastFeedStart != null && state.activeFeed == null) {
                val nextAt = state.lastFeedStart + (state.feedAlertHours * 3600000).toLong()
                val untilMins = ((nextAt - System.currentTimeMillis()) / 60000).toInt()
                if (untilMins > 0) {
                    val inTxt = if (untilMins >= 60) (untilMins / 60).toString() + "h " + (untilMins % 60) + "m" else untilMins.toString() + "m"
                    v.setViewVisibility(R.id.tv_next, View.VISIBLE)
                    v.setTextViewText(R.id.tv_next, "Next feed ~" + timeFmt.format(Date(nextAt)) + " · in " + inTxt)
                }
            }

            val diaperTxt = if (state.lastDiaperTs != null) "Diaper " + timeFmt.format(Date(state.lastDiaperTs)) else "No diapers yet"
            v.setTextViewText(R.id.tv_counts, diaperTxt + " · Today: " + state.todayFeeds + " feeds · " + state.todayDiapers + " diapers")

            v.setTextViewText(R.id.btn_sleep, if (state.sleepStart != null) "Wake" else "Sleep")

            if (state.dueReminder != null) {
                v.setViewVisibility(R.id.tv_reminder, View.VISIBLE)
                v.setTextViewText(R.id.tv_reminder, "⏰ " + state.dueReminder)
            } else {
                v.setViewVisibility(R.id.tv_reminder, View.GONE)
            }
            return v
        }
    }
}

class RefreshWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        Topics.subscribe(applicationContext) // idempotent; heals lost subscriptions
        val code = Prefs.code(applicationContext) ?: run {
            NightfeedWidget.render(applicationContext, null)
            return Result.success()
        }
        val family = FirestoreClient.getFamily(code) ?: return Result.retry()
        val entries = FirestoreClient.recentEntries(code)
        NightfeedWidget.render(applicationContext, StateBuilder.build(family, entries))
        return Result.success()
    }
}

class SleepWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val code = Prefs.code(applicationContext) ?: return Result.success()
        val family = FirestoreClient.getFamily(code) ?: return Result.success()
        val state = StateBuilder.build(family, null)
        val now = System.currentTimeMillis()
        if (state.sleepStart != null) FirestoreClient.endSleep(code, state.sleepStart, now)
        else FirestoreClient.startSleep(code, now)
        val fresh = FirestoreClient.getFamily(code) ?: return Result.success()
        NightfeedWidget.render(applicationContext, StateBuilder.build(fresh, FirestoreClient.recentEntries(code)))
        return Result.success()
    }
}

class WetWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val code = Prefs.code(applicationContext) ?: return Result.success()
        FirestoreClient.logWetDiaper(code)
        val family = FirestoreClient.getFamily(code) ?: return Result.success()
        NightfeedWidget.render(applicationContext, StateBuilder.build(family, FirestoreClient.recentEntries(code)))
        return Result.success()
    }
}
