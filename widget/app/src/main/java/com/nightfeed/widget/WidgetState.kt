package com.nightfeed.widget

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

data class ActiveFeed(val type: String, val feedStart: Long, val paused: Boolean)

data class WidgetState(
    val babyName: String,
    val activeFeed: ActiveFeed?,
    val sleepStart: Long?,
    val lastFeedStart: Long?,
    val lastDiaperTs: Long?,
    val lastSleepEnd: Long?,
    val todayFeeds: Int,
    val todayDiapers: Int,
    val dueReminder: String?,
    val fetchedAt: Long,
)

// Parses Firestore REST JSON into the little world the widget renders.
object StateBuilder {
    private fun fields(doc: JSONObject?): JSONObject? = doc?.optJSONObject("fields")
    private fun str(v: JSONObject?): String? {
        val s = v?.optString("stringValue", "")
        return if (s.isNullOrEmpty()) null else s
    }
    private fun map(v: JSONObject?): JSONObject? = v?.optJSONObject("mapValue")?.optJSONObject("fields")
    private fun bool(v: JSONObject?): Boolean = v?.optBoolean("booleanValue", false) ?: false
    private fun num(v: JSONObject?): Long? = when {
        v == null -> null
        v.has("integerValue") -> v.optString("integerValue").toLongOrNull()
        v.has("doubleValue") -> v.optDouble("doubleValue").toLong()
        else -> null
    }
    private fun numD(v: JSONObject?): Double? = when {
        v == null -> null
        v.has("integerValue") -> v.optString("integerValue").toDoubleOrNull()
        v.has("doubleValue") -> v.optDouble("doubleValue")
        else -> null
    }

    private fun startOfToday(): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    fun build(family: JSONObject, entries: JSONArray?): WidgetState {
        val f = fields(family) ?: JSONObject()
        val now = System.currentTimeMillis()

        val af = map(f.optJSONObject("activeFeed"))
        val activeFeed = if (af != null) {
            val type = str(af.optJSONObject("type")) ?: "left"
            val feedStart = num(af.optJSONObject("feedStart")) ?: num(af.optJSONObject("start")) ?: now
            ActiveFeed(type, feedStart, bool(af.optJSONObject("paused")))
        } else null
        val sleepStart = num(f.optJSONObject("sleepStart"))

        var lastFeedStart: Long? = activeFeed?.feedStart
        var lastDiaperTs: Long? = null
        var lastSleepEnd: Long? = null
        var todayFeeds = 0
        var todayDiapers = 0
        var vitdDoneToday = false
        val today0 = startOfToday()

        if (entries != null) {
            for (i in 0 until entries.length()) {
                val doc = entries.optJSONObject(i)?.optJSONObject("document") ?: continue
                val ef = fields(doc) ?: continue
                val kind = str(ef.optJSONObject("kind")) ?: continue
                val ts = num(ef.optJSONObject("ts")) ?: continue
                when (kind) {
                    "feed" -> {
                        if (lastFeedStart == null || ts > lastFeedStart!!) lastFeedStart = ts
                        if (ts >= today0) todayFeeds++
                    }
                    "diaper" -> {
                        if (lastDiaperTs == null || ts > lastDiaperTs!!) lastDiaperTs = ts
                        if (ts >= today0) todayDiapers++
                    }
                    "sleep" -> {
                        val end = num(ef.optJSONObject("end"))
                        if (end != null && (lastSleepEnd == null || end > lastSleepEnd!!)) lastSleepEnd = end
                    }
                    "health" -> {
                        if (str(ef.optJSONObject("type")) == "vitd" && ts >= today0) vitdDoneToday = true
                    }
                }
            }
        }

        return WidgetState(
            babyName = str(f.optJSONObject("babyName")) ?: "",
            activeFeed = activeFeed,
            sleepStart = sleepStart,
            lastFeedStart = lastFeedStart,
            lastDiaperTs = lastDiaperTs,
            lastSleepEnd = lastSleepEnd,
            todayFeeds = todayFeeds,
            todayDiapers = todayDiapers,
            dueReminder = computeDueReminder(f, vitdDoneToday, now),
            fetchedAt = now,
        )
    }

    private fun minutesOfDayNow(): Int {
        val c = Calendar.getInstance()
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
    }

    private fun parseHHMM(t: String?): Int {
        val parts = (t ?: "09:00").split(":")
        return (parts.getOrNull(0)?.toIntOrNull() ?: 9) * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0)
    }

    private fun sameLocalDay(a: Long, b: Long): Boolean {
        val ca = Calendar.getInstance().apply { timeInMillis = a }
        val cb = Calendar.getInstance().apply { timeInMillis = b }
        return ca.get(Calendar.YEAR) == cb.get(Calendar.YEAR) && ca.get(Calendar.DAY_OF_YEAR) == cb.get(Calendar.DAY_OF_YEAR)
    }

    // Mirrors the app's reminder logic closely enough for a due/not-due line.
    private fun computeDueReminder(f: JSONObject, vitdDoneToday: Boolean, now: Long): String? {
        val vitd = map(f.optJSONObject("vitdReminder"))
        if (vitd != null && bool(vitd.optJSONObject("enabled")) && !vitdDoneToday &&
            minutesOfDayNow() >= parseHHMM(str(vitd.optJSONObject("time")))
        ) return "Vitamin D due"

        val arr = f.optJSONObject("reminders")?.optJSONObject("arrayValue")?.optJSONArray("values") ?: return null
        for (i in 0 until arr.length()) {
            val r = map(arr.optJSONObject(i)) ?: continue
            if (!bool(r.optJSONObject("enabled"))) continue
            val label = str(r.optJSONObject("label")) ?: continue
            val suffix = if (str(r.optJSONObject("who")) == "mom") " (mom)" else ""
            val lastDone = num(r.optJSONObject("lastDone")) ?: 0L
            if (str(r.optJSONObject("mode")) == "daily") {
                if (!sameLocalDay(lastDone, now) && minutesOfDayNow() >= parseHHMM(str(r.optJSONObject("time"))))
                    return "$label$suffix due"
            } else {
                val hours = numD(r.optJSONObject("hours")) ?: 4.0
                if (now >= lastDone + (hours * 3600000).toLong()) return "$label$suffix due"
            }
        }
        return null
    }
}
