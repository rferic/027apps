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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rferic.zero27apps.ui.screens.HomeScreen
import com.rferic.zero27apps.ui.screens.LoginScreen
import com.rferic.zero27apps.ui.screens.ModulesScreen
import com.rferic.zero27apps.ui.screens.SettingsScreen
import com.rferic.zero27apps.ui.theme.Zero27AppsTheme

/**
 * The whole app renders from [AppViewModel.state]. A signed-in user gets the
 * three-tab shell; everything else is a full screen, so there is no way to
 * reach a tab without a session.
 */
@Composable
fun AppRoot(viewModel: AppViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val login by viewModel.login.collectAsStateWithLifecycle()
    val theme = (state as? AppState.SignedIn)?.user?.theme?.toThemePreference()
        ?: com.rferic.zero27apps.ui.theme.ThemePreference.SYSTEM

    Zero27AppsTheme(preference = theme) {
        when (val current = state) {
            AppState.Loading -> LoadingScreen()
            is AppState.NeedsLogin -> LoginScreen(
                instance = current.instance,
                state = login,
                onLogin = viewModel::login,
                onChangeInstance = viewModel::changeInstance,
            )
            is AppState.SignedIn -> Shell(current, viewModel)
            is AppState.Failure -> FailureScreen(current.message, viewModel::refresh)
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
private fun FailureScreen(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, textAlign = TextAlign.Center)
        Button(onClick = onRetry, modifier = Modifier.padding(top = 16.dp)) { Text("Try again") }
    }
}

@Composable
private fun Shell(state: AppState.SignedIn, viewModel: AppViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                    label = { Text("Home") },
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Filled.Menu, contentDescription = null) },
                    label = { Text("Modules") },
                )
                NavigationBarItem(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    label = { Text("Settings") },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                1 -> ModulesScreen(state.modules)
                2 -> SettingsScreen(
                    instance = state.instance,
                    user = state.user,
                    onChangeInstance = viewModel::changeInstance,
                    onTheme = { viewModel.updateProfile(theme = it) },
                    onLocale = { viewModel.updateProfile(locale = it) },
                    onSignOut = viewModel::signOut,
                )
                else -> HomeScreen(state.user, state.modules)
            }
        }
    }
}
