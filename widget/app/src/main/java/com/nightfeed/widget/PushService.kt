package com.nightfeed.widget

import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// A silent data message arrives whenever either phone changes family data;
// the only job here is to kick an immediate widget refresh.
class PushService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        NightfeedWidget.refreshNow(applicationContext)
    }

    override fun onNewToken(token: String) {
        // Topic subscriptions survive token rotation; re-assert to be safe.
        Topics.subscribe(applicationContext)
    }
}

object Topics {
    fun subscribe(context: android.content.Context) {
        val code = Prefs.code(context) ?: return
        FirebaseMessaging.getInstance().subscribeToTopic("family-$code")
    }

    fun switch(context: android.content.Context, oldCode: String?, newCode: String) {
        if (oldCode != null && oldCode != newCode) {
            FirebaseMessaging.getInstance().unsubscribeFromTopic("family-$oldCode")
        }
        FirebaseMessaging.getInstance().subscribeToTopic("family-$newCode")
    }
}
