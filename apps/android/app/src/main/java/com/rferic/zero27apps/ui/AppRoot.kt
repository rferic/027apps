package com.rferic.zero27apps.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.util.Locale
import com.rferic.zero27apps.ui.screens.HomeScreen
import com.rferic.zero27apps.ui.screens.InviteScreen
import com.rferic.zero27apps.ui.screens.LoginScreen
import com.rferic.zero27apps.ui.screens.ModulesScreen
import com.rferic.zero27apps.ui.screens.SettingsScreen
import com.rferic.zero27apps.ui.i18n.AppStrings
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.theme.Zero27AppsTheme

/**
 * The whole app renders from [AppViewModel.state]. A signed-in user gets the
 * three-tab shell; everything else is a full screen, so there is no way to
 * reach a tab without a session.
 */
@Composable
fun AppRoot(deepLink: String? = null, viewModel: AppViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val login by viewModel.login.collectAsStateWithLifecycle()
    val invite by viewModel.invite.collectAsStateWithLifecycle()
    val instances by viewModel.instances.collectAsStateWithLifecycle()
    val update by viewModel.update.collectAsStateWithLifecycle()

    LaunchedEffect(deepLink) {
        if (deepLink != null) viewModel.onInviteLink(deepLink)
    }
    val theme = (state as? AppState.SignedIn)?.user?.theme?.toThemePreference()
        ?: com.rferic.zero27apps.ui.theme.ThemePreference.SYSTEM

    val strings = remember { AppStrings.forLanguage(Locale.getDefault().language) }

    Zero27AppsTheme(preference = theme) {
      CompositionLocalProvider(LocalStrings provides strings) {
        when (val current = state) {
            AppState.Loading -> LoadingScreen()
            is AppState.NeedsLogin -> LoginScreen(
                instance = current.instance,
                knownInstances = instances,
                state = login,
                onLogin = viewModel::login,
                onRememberInstance = viewModel::rememberInstance,
                onChangeInstance = viewModel::changeInstance,
            )
            is AppState.NeedsInvite -> InviteScreen(
                link = current.link,
                state = invite,
                onSubmit = viewModel::acceptInvite,
                onCancel = viewModel::cancelInvite,
            )
            is AppState.SignedIn -> Shell(current, viewModel, instances, update)
            is AppState.Failure -> FailureScreen(
                reason = current.reason,
                knownInstances = instances,
                currentInstance = viewModel.currentInstance(),
                onRememberInstance = viewModel::rememberInstance,
                onChangeInstance = viewModel::changeInstance,
                onRetry = viewModel::refresh,
            )
        }
      }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

/**
 * A failure never traps the user: if the saved instance is unreachable, the
 * same picker that the login screen offers is right here.
 */
@Composable
private fun FailureScreen(
    reason: FailureReason,
    knownInstances: List<String>,
    currentInstance: String,
    onRememberInstance: (String) -> String?,
    onChangeInstance: (String) -> Boolean,
    onRetry: () -> Unit,
) {
    var showPicker by rememberSaveable { mutableStateOf(false) }
    if (showPicker) {
        InstancePickerDialog(
            known = knownInstances,
            current = currentInstance,
            onAdd = onRememberInstance,
            onPick = { url ->
                showPicker = false
                onChangeInstance(url)
            },
            onDismiss = { showPicker = false },
        )
    }
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        val strings = LocalStrings.current
        val message = when (reason) {
            FailureReason.NETWORK -> strings.failureNetwork
            FailureReason.AUTH_UNAVAILABLE -> strings.failureAuthUnavailable
            FailureReason.UNKNOWN -> strings.failureNetwork
        }
        Text(message, textAlign = TextAlign.Center)
        Button(onClick = onRetry, modifier = Modifier.padding(top = 16.dp)) {
            Text(strings.tryAgain)
        }
        TextButton(onClick = { showPicker = true }) { Text(strings.changeInstance) }
    }
}

@Composable
private fun Shell(
    state: AppState.SignedIn,
    viewModel: AppViewModel,
    instances: List<String>,
    update: UpdateState,
) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val strings = LocalStrings.current
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                    label = { Text(strings.home) },
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Filled.Menu, contentDescription = null) },
                    label = { Text(strings.modules) },
                )
                NavigationBarItem(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    label = { Text(strings.settings) },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                1 -> ModulesScreen(state.modules)
                2 -> SettingsScreen(
                    instance = state.instance,
                    knownInstances = instances,
                    user = state.user,
                    onRememberInstance = viewModel::rememberInstance,
                    onChangeInstance = viewModel::changeInstance,
                    onTheme = { viewModel.updateProfile(theme = it) },
                    onLocale = { viewModel.updateProfile(locale = it) },
                    onSignOut = viewModel::signOut,
                )
                else -> HomeScreen(
                    user = state.user,
                    modules = state.modules,
                    update = update,
                    onInstallUpdate = viewModel::installUpdate,
                )
            }
        }
    }
}
