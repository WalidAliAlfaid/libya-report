package com.libyareport.app

data class Message(
    val sender: String,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isSystem: Boolean = false,
    val lat: Double? = null,
    val lng: Double? = null
)
