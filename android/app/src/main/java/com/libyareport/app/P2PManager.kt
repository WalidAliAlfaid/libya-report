package com.libyareport.app

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket

class P2PManager(private val context: Context, private val listener: P2PListener) {

    interface P2PListener {
        fun onMessageReceived(msg: Message)
        fun onConnectionStateChanged(state: String)
        fun onDiscoveredNodesChanged(nodes: List<String>)
    }

    private val manager: WifiP2pManager? =
        context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    private var channel: WifiP2pManager.Channel? = null

    // Cache list
    val messages = mutableListOf<Message>()
    var connectionState = "Idle"
        private set(value) {
            field = value
            listener.onConnectionStateChanged(value)
        }

    val discoveredNodes = mutableListOf<String>()

    private val mainHandler = Handler(Looper.getMainLooper())
    private var scanRunnable: Runnable? = null
    private var isRunning = false
    private var wifiP2pReceiver: BroadcastReceiver? = null

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var udpListenSocket: DatagramSocket? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var tcpServerSocket: ServerSocket? = null
    private val activeTcpSockets = mutableListOf<Socket>()
    private val relayedMessageSignatures = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private val UDP_PORT = 8889

    init {
        channel = manager?.initialize(context, Looper.getMainLooper(), null)
        setupWifiP2pListeners()
    }

    private fun setupWifiP2pListeners() {
        if (manager == null || channel == null) return

        val txtListener = WifiP2pManager.DnsSdTxtRecordListener { _, txtMap, srcDevice ->
            val nodeName = srcDevice.deviceName.ifEmpty { "Node_${srcDevice.deviceAddress.takeLast(5)}" }
            postToMain {
                if (!discoveredNodes.contains(nodeName)) {
                    discoveredNodes.add(nodeName)
                    listener.onDiscoveredNodesChanged(discoveredNodes.toList())
                }
                for (i in 0..4) {
                    val packet = txtMap["m$i"] ?: continue
                    ingestPacket(packet)
                }
            }
        }
        manager.setDnsSdResponseListeners(channel, null, txtListener)
    }

    /** Thread-safe: merge a raw packet string into the messages list and gossip relay it */
    private fun ingestPacket(packet: String) {
        val parts = packet.split("|")
        if (parts.size < 3) return
        val sender = parts[0]
        val content = parts[1]
        val ts = parts[2].toLongOrNull() ?: return
        
        // Extract optional GPS
        val lat = if (parts.size > 3) parts[3].toDoubleOrNull() else null
        val lng = if (parts.size > 4) parts[4].toDoubleOrNull() else null

        val msg = Message(sender = sender, content = content, timestamp = ts, lat = lat, lng = lng)
        val signature = "${msg.sender}|${msg.timestamp}"

        val duplicate = messages.any {
            it.sender == msg.sender &&
            it.content == msg.content &&
            kotlin.math.abs(it.timestamp - msg.timestamp) < 3000L
        }
        if (!duplicate) {
            messages.add(msg)
            messages.sortWith(compareBy { it.timestamp })
            
            // Notify listener (web plugin)
            listener.onMessageReceived(msg)

            // Auto re-advertise updated rolling message list via Wi-Fi Direct
            advertiseViaWifiP2p()

            // If not sent by me and not already relayed, gossip relay over UDP and TCP
            if (!relayedMessageSignatures.contains(signature)) {
                relayedMessageSignatures.add(signature)
                Log.d("P2PManager", "Gossip relaying message from $sender: $content")
                sendUdpBroadcast(msg)
                sendTcpMessage(msg)
            }
        }
    }

    private fun postToMain(block: () -> Unit) {
        mainHandler.post(block)
    }

    // ─── Engine lifecycle ───────────────────────────────────────────────────

    fun startEngine() {
        if (isRunning) return
        isRunning = true
        postToMain { connectionState = "Broadcasting & Scanning" }

        startUdpListener()
        startTcpListener()
        registerWifiP2pReceiver()

        // Publish local services and scan setup once
        advertiseViaWifiP2p()
        setupWifiP2pDiscoveryRequest()

        // Loop to just trigger the discovery scan (15s interval is perfect for Wi-Fi Direct)
        scanRunnable = object : Runnable {
            override fun run() {
                if (!isRunning) return
                triggerWifiP2pDiscovery()
                mainHandler.postDelayed(this, 15_000)
            }
        }
        mainHandler.post(scanRunnable!!)
    }

    fun stopEngine() {
        isRunning = false
        scanRunnable?.let { mainHandler.removeCallbacks(it) }
        clearWifiP2pServices()
        stopUdpListener()
        stopTcpListener()
        unregisterWifiP2pReceiver()
        postToMain { connectionState = "Idle" }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    fun sendMessage(text: String, senderName: String, lat: Double?, lng: Double?) {
        val msg = Message(sender = senderName, content = text, lat = lat, lng = lng)
        messages.add(msg)
        messages.sortWith(compareBy { it.timestamp })

        // Broadcast to others
        advertiseViaWifiP2p()
        sendUdpBroadcast(msg)
        sendTcpMessage(msg)
    }

    // ─── Wi-Fi P2P Service Advertisement ────────────────────────────────────

    @SuppressLint("MissingPermission")
    private fun advertiseViaWifiP2p() {
        if (manager == null || channel == null) return
        val record = mutableMapOf<String, String>()
        messages.takeLast(5).forEachIndexed { i, m ->
            var recordVal = "${m.sender}|${m.content}|${m.timestamp}"
            if (m.lat != null && m.lng != null) {
                recordVal += "|${m.lat}|${m.lng}"
            }
            record["m$i"] = recordVal
        }
        val svcInfo = WifiP2pDnsSdServiceInfo.newInstance("OfflineBroadcast", "_presence._tcp", record)
        manager.clearLocalServices(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                manager.addLocalService(channel, svcInfo, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        Log.d("P2PManager", "WifiP2p local service advertised successfully")
                    }
                    override fun onFailure(r: Int) {
                        Log.e("P2PManager", "Failed to add local WifiP2p service: $r")
                    }
                })
            }
            override fun onFailure(r: Int) {
                Log.e("P2PManager", "Failed to clear local WifiP2p services: $r")
            }
        })
    }

    @SuppressLint("MissingPermission")
    private fun setupWifiP2pDiscoveryRequest() {
        if (manager == null || channel == null) return
        val req = WifiP2pDnsSdServiceRequest.newInstance()
        manager.clearServiceRequests(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                manager.addServiceRequest(channel, req, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        Log.d("P2PManager", "WifiP2p service request added successfully")
                        triggerWifiP2pDiscovery()
                    }
                    override fun onFailure(r: Int) {
                        Log.e("P2PManager", "Failed to add WifiP2p service request: $r")
                    }
                })
            }
            override fun onFailure(r: Int) {
                Log.e("P2PManager", "Failed to clear WifiP2p service requests: $r")
            }
        })
    }

    @SuppressLint("MissingPermission")
    private fun triggerWifiP2pDiscovery() {
        if (manager == null || channel == null) return
        manager.discoverServices(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.d("P2PManager", "WifiP2p discoverServices initiated")
            }
            override fun onFailure(r: Int) {
                Log.e("P2PManager", "Failed to initiate WifiP2p discoverServices: $r")
            }
        })
    }

    private fun clearWifiP2pServices() {
        manager?.clearLocalServices(channel, null)
        manager?.clearServiceRequests(channel, null)
    }

    private fun registerWifiP2pReceiver() {
        if (wifiP2pReceiver != null) return
        val intentFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
            addAction(WifiManager.WIFI_STATE_CHANGED_ACTION)
        }
        wifiP2pReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val action = intent?.action ?: return
                Log.d("P2PManager", "Received Broadcast Action: $action")
                when (action) {
                    WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                        if (state == WifiP2pManager.WIFI_P2P_STATE_ENABLED) {
                            Log.d("P2PManager", "Wi-Fi P2P is enabled")
                        } else {
                            Log.d("P2PManager", "Wi-Fi P2P is not enabled")
                        }
                    }
                }
            }
        }
        context.registerReceiver(wifiP2pReceiver, intentFilter)
    }

    private fun unregisterWifiP2pReceiver() {
        wifiP2pReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: Exception) {}
        }
        wifiP2pReceiver = null
    }

    // ─── UDP Broadcast (same local Wi-Fi) ───────────────────────────────────

    private fun startUdpListener() {
        try {
            val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            multicastLock = wifi?.createMulticastLock("OfflineTextingMulticastLock")?.apply {
                setReferenceCounted(true)
                acquire()
            }
        } catch (e: Exception) {
            Log.e("P2PManager", "Failed to acquire multicast lock", e)
        }

        scope.launch {
            try {
                udpListenSocket = DatagramSocket(UDP_PORT).also { it.broadcast = true }
                val buf = ByteArray(2048)
                Log.d("P2PManager", "UDP listener started on port $UDP_PORT")
                while (isActive && isRunning) {
                    val pkt = DatagramPacket(buf, buf.size)
                    udpListenSocket?.receive(pkt) ?: break
                    val raw = String(pkt.data, 0, pkt.length).trim()
                    val parts = raw.split("|")
                    if (parts.size >= 3) {
                        postToMain {
                            val nodeName = "UDP:${parts[0]}"
                            if (!discoveredNodes.contains(nodeName)) {
                                discoveredNodes.add(nodeName)
                                listener.onDiscoveredNodesChanged(discoveredNodes.toList())
                            }
                            ingestPacket(raw)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("P2PManager", "UDP listener error", e)
            }
        }
    }

    private fun stopUdpListener() {
        try {
            udpListenSocket?.close()
        } catch (_: Exception) {}
        udpListenSocket = null

        try {
            multicastLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
            multicastLock = null
        } catch (e: Exception) {
            Log.e("P2PManager", "Error releasing multicast lock", e)
        }
    }

    private fun getBroadcastAddresses(): List<InetAddress> {
        val addresses = mutableListOf<InetAddress>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                if (networkInterface.isLoopback || !networkInterface.isUp) continue
                for (interfaceAddress in networkInterface.interfaceAddresses) {
                    val broadcast = interfaceAddress.broadcast
                    if (broadcast != null) {
                        addresses.add(broadcast)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("P2PManager", "Error finding broadcast addresses", e)
        }
        try {
            addresses.add(InetAddress.getByName("255.255.255.255"))
        } catch (_: Exception) {}
        return addresses.distinct()
    }

    private fun sendUdpBroadcast(msg: Message) {
        scope.launch {
            try {
                DatagramSocket().use { sock ->
                    sock.broadcast = true
                    var payload = "${msg.sender}|${msg.content}|${msg.timestamp}"
                    if (msg.lat != null && msg.lng != null) {
                        payload += "|${msg.lat}|${msg.lng}"
                    }
                    val data = payload.toByteArray()
                    val targets = getBroadcastAddresses()
                    for (target in targets) {
                        try {
                            val pkt = DatagramPacket(data, data.size, target, UDP_PORT)
                            sock.send(pkt)
                        } catch (ex: Exception) {
                            Log.e("P2PManager", "Failed to send to $target", ex)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("P2PManager", "UDP send error", e)
            }
        }
    }

    // ─── TCP fallback ────────────────────────────────────────────────────────

    private fun startTcpListener() {
        scope.launch(Dispatchers.IO) {
            try {
                tcpServerSocket = ServerSocket(UDP_PORT)
                Log.d("P2PManager", "TCP server listening on port $UDP_PORT")
                while (isActive && isRunning) {
                    val socket = tcpServerSocket?.accept() ?: break
                    handleTcpClient(socket)
                }
            } catch (e: Exception) {
                Log.e("P2PManager", "TCP listener error", e)
            }
        }
    }

    private fun stopTcpListener() {
        try {
            tcpServerSocket?.close()
        } catch (_: Exception) {}
        tcpServerSocket = null

        synchronized(activeTcpSockets) {
            for (socket in activeTcpSockets) {
                try { socket.close() } catch (_: Exception) {}
            }
            activeTcpSockets.clear()
        }
    }

    private fun handleTcpClient(socket: Socket) {
        synchronized(activeTcpSockets) {
            if (activeTcpSockets.any { it.inetAddress == socket.inetAddress && !it.isClosed }) {
                try { socket.close() } catch (_: Exception) {}
                return
            }
            activeTcpSockets.add(socket)
        }
        scope.launch(Dispatchers.IO) {
            try {
                val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
                while (isActive && isRunning) {
                    val line = reader.readLine() ?: break
                    postToMain {
                        val parts = line.split("|")
                        if (parts.size >= 3) {
                            val nodeName = "TCP:${parts[0]}"
                            if (!discoveredNodes.contains(nodeName)) {
                                discoveredNodes.add(nodeName)
                                listener.onDiscoveredNodesChanged(discoveredNodes.toList())
                            }
                            ingestPacket(line)
                        }
                    }
                }
            } catch (_: Exception) {
            } finally {
                synchronized(activeTcpSockets) {
                    activeTcpSockets.remove(socket)
                }
                try { socket.close() } catch (_: Exception) {}
            }
        }
    }

    private fun sendTcpMessage(msg: Message) {
        scope.launch(Dispatchers.IO) {
            var payload = "${msg.sender}|${msg.content}|${msg.timestamp}"
            if (msg.lat != null && msg.lng != null) {
                payload += "|${msg.lat}|${msg.lng}"
            }
            val targets = synchronized(activeTcpSockets) { activeTcpSockets.toList() }
            for (socket in targets) {
                try {
                    val writer = PrintWriter(socket.getOutputStream(), true)
                    writer.println(payload)
                } catch (e: Exception) {
                    Log.e("P2PManager", "TCP send error", e)
                }
            }
        }
    }
}
