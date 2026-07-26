package com.nightfeed.widget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object Prefs {
    fun code(c: Context): String? = c.getSharedPreferences("nightfeed", 0).getString("code", null)
    fun setCode(c: Context, v: String) {
        c.getSharedPreferences("nightfeed", 0).edit().putString("code", v).apply()
    }
}

// Talks to the same Firestore the PWA uses, via plain REST. The family code is
// the only credential, matching the app's security model.
object FirestoreClient {
    private const val BASE = "https://firestore.googleapis.com/v1/projects/nightfeed-al972/databases/(default)/documents"
    private const val KEY = "AIzaSyCxua3Lyi8woL3MitD34G4Q-TEpR1Goa4I"

    private fun request(method: String, url: String, body: String?): String? {
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            // HttpURLConnection can't speak PATCH; Google APIs accept the override header.
            if (method == "PATCH") {
                conn.requestMethod = "POST"
                conn.setRequestProperty("X-HTTP-Method-Override", "PATCH")
            } else {
                conn.requestMethod = method
            }
            conn.connectTimeout = 10000
            conn.readTimeout = 10000
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            if (conn.responseCode in 200..299) conn.inputStream.bufferedReader().use { it.readText() } else null
        } catch (e: Exception) {
            null
        }
    }

    fun getFamily(code: String): JSONObject? {
        val txt = request("GET", "$BASE/families/$code?key=$KEY", null) ?: return null
        return try { JSONObject(txt) } catch (e: Exception) { null }
    }

    fun recentEntries(code: String): JSONArray? {
        val body = JSONObject().put(
            "structuredQuery", JSONObject()
                .put("from", JSONArray().put(JSONObject().put("collectionId", "entries")))
                .put("orderBy", JSONArray().put(JSONObject()
                    .put("field", JSONObject().put("fieldPath", "ts"))
                    .put("direction", "DESCENDING")))
                .put("limit", 300)
        ).toString()
        val txt = request("POST", "$BASE/families/$code:runQuery?key=$KEY", body) ?: return null
        return try { JSONArray(txt) } catch (e: Exception) { null }
    }

    fun startSleep(code: String, ts: Long): Boolean {
        val body = JSONObject().put("fields", JSONObject()
            .put("sleepStart", JSONObject().put("integerValue", ts.toString()))).toString()
        return request("PATCH", "$BASE/families/$code?updateMask.fieldPaths=sleepStart&key=$KEY", body) != null
    }

    fun endSleep(code: String, sleepStart: Long, end: Long): Boolean {
        val entry = JSONObject().put("fields", JSONObject()
            .put("kind", JSONObject().put("stringValue", "sleep"))
            .put("ts", JSONObject().put("integerValue", sleepStart.toString()))
            .put("end", JSONObject().put("integerValue", end.toString()))
            .put("secs", JSONObject().put("integerValue", ((end - sleepStart) / 1000).toString()))).toString()
        if (request("POST", "$BASE/families/$code/entries?key=$KEY", entry) == null) return false
        val clear = JSONObject().put("fields", JSONObject()
            .put("sleepStart", JSONObject().put("nullValue", JSONObject.NULL))).toString()
        return request("PATCH", "$BASE/families/$code?updateMask.fieldPaths=sleepStart&key=$KEY", clear) != null
    }

    fun logWetDiaper(code: String): Boolean {
        val body = JSONObject().put(
            "fields", JSONObject()
                .put("kind", JSONObject().put("stringValue", "diaper"))
                .put("type", JSONObject().put("stringValue", "wet"))
                .put("ts", JSONObject().put("integerValue", System.currentTimeMillis().toString()))
        ).toString()
        return request("POST", "$BASE/families/$code/entries?key=$KEY", body) != null
    }
}
