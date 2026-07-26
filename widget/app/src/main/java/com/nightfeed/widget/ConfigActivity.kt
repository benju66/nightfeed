package com.nightfeed.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

// One-time setup: enter the family code (validated against Firestore), then
// the widget takes over. Also reachable from the app drawer to change codes.
class ConfigActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        val pad = (16 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad * 2, pad, pad)
            setBackgroundColor(Color.parseColor("#161826"))
            gravity = Gravity.CENTER_HORIZONTAL
        }

        root.addView(TextView(this).apply {
            text = "Nightfeed Widget"
            textSize = 22f
            setTextColor(Color.parseColor("#9184D9"))
        })
        root.addView(TextView(this).apply {
            text = "Enter your family code (shown in the Nightfeed app under Settings → Family)."
            textSize = 14f
            setTextColor(Color.parseColor("#A3A3AB"))
            setPadding(0, pad / 2, 0, pad)
        })

        val input = EditText(this).apply {
            hint = "Family code"
            setText(Prefs.code(this@ConfigActivity) ?: "")
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            setTextColor(Color.parseColor("#E9E9ED"))
            setHintTextColor(Color.parseColor("#77777F"))
            textSize = 20f
        }
        root.addView(input)

        val save = Button(this).apply {
            text = "Save"
            setTextColor(Color.parseColor("#E9E9ED"))
        }
        root.addView(save)

        // Sideloaded apps get aggressive battery limits, which delays push
        // refreshes; this asks Android to exempt the widget.
        val battery = Button(this).apply {
            text = "Improve reliability (allow background)"
            setTextColor(Color.parseColor("#C7C0F0"))
        }
        root.addView(battery)
        battery.setOnClickListener {
            try {
                val pm = getSystemService(POWER_SERVICE) as android.os.PowerManager
                if (pm.isIgnoringBatteryOptimizations(packageName)) {
                    Toast.makeText(this, "Already allowed — you're set", Toast.LENGTH_SHORT).show()
                } else {
                    startActivity(
                        Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                            .setData(android.net.Uri.parse("package:$packageName"))
                    )
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Open Settings → Apps → Nightfeed Widget → Battery → Unrestricted", Toast.LENGTH_LONG).show()
            }
        }
        setContentView(root)

        val widgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        save.setOnClickListener {
            val code = input.text.toString().trim().uppercase()
            if (code.length < 4) {
                Toast.makeText(this, "Enter the code from the app", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            save.isEnabled = false
            Thread {
                val ok = FirestoreClient.getFamily(code) != null
                runOnUiThread {
                    if (!ok) {
                        save.isEnabled = true
                        Toast.makeText(this, "No family found with that code — check it and your connection", Toast.LENGTH_LONG).show()
                    } else {
                        val oldCode = Prefs.code(this)
                        Prefs.setCode(this, code)
                        Topics.switch(this, oldCode, code)
                        NightfeedWidget.schedule(this)
                        NightfeedWidget.refreshNow(this)
                        Toast.makeText(this, "Connected — add the widget to your home screen", Toast.LENGTH_LONG).show()
                        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                        }
                        finish()
                    }
                }
            }.start()
        }
    }
}
