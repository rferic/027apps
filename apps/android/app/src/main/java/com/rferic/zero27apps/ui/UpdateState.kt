package com.rferic.zero27apps.ui

/** The update banner's state; the version comes from the instance, not the store. */
sealed interface UpdateState {
    data object None : UpdateState
    data class Available(val version: String, val apkUrl: String) : UpdateState
    data object Downloading : UpdateState
    data object Installing : UpdateState
    data object Failed : UpdateState
}
