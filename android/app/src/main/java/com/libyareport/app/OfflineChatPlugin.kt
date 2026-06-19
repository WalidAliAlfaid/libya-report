package com.libyareport.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "OfflineChat")
class OfflineChatPlugin : Plugin() {

    companion object {
        var instance: OfflineChatPlugin? = null
    }

    private var p2pManager: P2PManager? = null

    override fun load() {
        super.load()
        instance = this
        p2pManager = P2PManager(context, object : P2PManager.P2PListener {
            override fun onMessageReceived(msg: Message) {
                val data = JSObject().apply {
                    put("sender", msg.sender)
                    put("content", msg.content)
                    put("timestamp", msg.timestamp)
                    put("isSystem", msg.isSystem)
                    put("lat", msg.lat)
                    put("lng", msg.lng)
                }
                notifyListeners("onMessageReceived", data)
            }

            override fun onConnectionStateChanged(state: String) {
                val data = JSObject().apply {
                    put("state", state)
                }
                notifyListeners("onConnectionStateChanged", data)
            }

            override fun onDiscoveredNodesChanged(nodes: List<String>) {
                val data = JSObject().apply {
                    put("nodes", nodes.joinToString(", "))
                }
                notifyListeners("onDiscoveredNodesChanged", data)
            }
        })
    }

    override fun handleOnDestroy() {
        instance = null
        super.handleOnDestroy()
    }

    fun onSMSReceived(sender: String, messageBody: String) {
        val data = JSObject().apply {
            put("sender", sender)
            put("body", messageBody)
        }
        notifyListeners("onSMSReceived", data)
    }

    @PluginMethod
    fun getPendingSMS(call: PluginCall) {
        val prefs = context.getSharedPreferences("libya_report_sms_prefs", Context.MODE_PRIVATE)
        val smsSet = prefs.getStringSet("pending_sms", emptySet()) ?: emptySet()
        
        val arr = smsSet.map { rawSms ->
            val parts = rawSms.split("##")
            val sender = parts.getOrNull(0) ?: "Unknown"
            val body = parts.getOrNull(1) ?: ""
            JSObject().apply {
                put("sender", sender)
                put("body", body)
            }
        }
        
        // Clear preferences
        prefs.edit().remove("pending_sms").apply()
        
        val res = JSObject().apply {
            put("smsList", arr)
        }
        call.resolve(res)
    }

    @PluginMethod
    fun startMeshEngine(call: PluginCall) {
        p2pManager?.startEngine()
        call.resolve()
    }

    @PluginMethod
    fun stopMeshEngine(call: PluginCall) {
        p2pManager?.stopEngine()
        call.resolve()
    }

    @PluginMethod
    fun sendMeshMessage(call: PluginCall) {
        val text = call.getString("text") ?: ""
        val sender = call.getString("sender") ?: "Anonymous"
        val lat = call.getDouble("lat")
        val lng = call.getDouble("lng")

        p2pManager?.sendMessage(text, sender, lat, lng)
        call.resolve()
    }

    @PluginMethod
    fun getDiscoveredNodes(call: PluginCall) {
        val data = JSObject().apply {
            put("nodes", p2pManager?.discoveredNodes ?: emptyList<String>())
        }
        call.resolve(data)
    }

    @PluginMethod
    fun getMessages(call: PluginCall) {
        val list = p2pManager?.messages ?: emptyList<Message>()
        val arr = list.map { msg ->
            JSObject().apply {
                put("sender", msg.sender)
                put("content", msg.content)
                put("timestamp", msg.timestamp)
                put("isSystem", msg.isSystem)
                put("lat", msg.lat)
                put("lng", msg.lng)
            }
        }
        val data = JSObject().apply {
            put("messages", arr)
        }
        call.resolve(data)
    }
}
