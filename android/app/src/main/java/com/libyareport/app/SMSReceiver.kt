package com.libyareport.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

class SMSReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (message in messages) {
                val sender = message.displayOriginatingAddress ?: "Unknown"
                val body = message.displayMessageBody ?: ""
                
                if (body.startsWith("LBREPORT:") || body.startsWith("LBMSG:")) {
                    Log.d("SMSReceiver", "Captured LibbyReport SMS from $sender: $body")
                    
                    val plugin = OfflineChatPlugin.instance
                    if (plugin != null) {
                        plugin.onSMSReceived(sender, body)
                    } else {
                        val prefs = context.getSharedPreferences("libya_report_sms_prefs", Context.MODE_PRIVATE)
                        val pending = prefs.getStringSet("pending_sms", emptySet()) ?: emptySet()
                        val updated = pending.toMutableSet()
                        updated.add("$sender##$body")
                        prefs.edit().putStringSet("pending_sms", updated).apply()
                    }
                }
            }
        }
    }
}
