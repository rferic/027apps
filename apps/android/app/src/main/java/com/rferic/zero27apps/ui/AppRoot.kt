package com.rferic.zero27apps.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rferic.zero27apps.ui.components.BrandTile
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.ui.components.GridIcon
import com.rferic.zero27apps.ui.i18n.AppStrings
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.screens.HomeScreen
import com.rferic.zero27apps.ui.screens.InviteScreen
import com.rferic.zero27apps.ui.screens.LoginScreen
import com.rferic.zero27apps.ui.screens.OweNoScreen
import com.rferic.zero27apps.ui.screens.ModulesScreen
import com.rferic.zero27apps.ui.screens.SettingsScreen
import com.rferic.zero27apps.ui.theme.LocalPalette
import com.rferic.zero27apps.ui.theme.ThemePreference
import com.rferic.zero27apps.ui.theme.Zero27AppsTheme
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * The whole app renders from [AppViewModel.state]. A signed-in user gets the
 * three-tab shell; everything else is a full screen, so there is no way to
 * reach a tab without a session. The copy follows the device language.
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

    // Coming back to the app is the natural moment to ask for a newer build;
    // the view model throttles it, so a quick app switch costs nothing.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) viewModel.checkForUpdate()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val theme = (state as? AppState.SignedIn)?.user?.theme?.toThemePreference()
        ?: ThemePreference.SYSTEM
    val profileLocale = (state as? AppState.SignedIn)?.user?.locale
    val language = profileLocale ?: Locale.getDefault().language
    val strings = remember(language) { AppStrings.forLanguage(language) }

    Zero27AppsTheme(preference = theme) {
        Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
            CompositionLocalProvider(LocalStrings provides strings) {
                when (val current = state) {
                    AppState.Loading -> Splash(viewModel.currentInstance())
                    is AppState.NeedsLogin -> LoginScreen(
                        instance = current.instance,
                        knownInstances = instances,
                        state = login,
                        update = update,
                        onLogin = viewModel::login,
                        onRememberInstance = viewModel::rememberInstance,
                        onChangeInstance = viewModel::changeInstance,
                        onInstallUpdate = viewModel::installUpdate,
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
}

/** Splash: the logo, the instance it is connecting to and a quiet spinner. */
@Composable
private fun Splash(instance: String) {
    val palette = LocalPalette.current
    val strings = LocalStrings.current
    // The system splash already showed the mark; repeating it here would flash
    // the logo twice, so this screen is just the instance and a quiet spinner.
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = palette.accent, strokeWidth = 2.dp)
        Spacer(Modifier.height(18.dp))
        Text(
            "${strings.connecting} $instance",
            fontSize = 13.sp,
            color = palette.mutedForeground,
            textAlign = TextAlign.Center,
        )
    }
}

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
    val strings = LocalStrings.current
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
        val message = when (reason) {
            FailureReason.NETWORK -> strings.failureNetwork
            FailureReason.AUTH_UNAVAILABLE -> strings.failureAuthUnavailable
            FailureReason.UNKNOWN -> strings.failureNetwork
        }
        BrandWordmark(height = 26.dp)
        Spacer(Modifier.height(24.dp))
        Text(message, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        // Which instance failed is the first thing to know here.
        Text(
            currentInstance,
            fontSize = 12.sp,
            color = LocalPalette.current.mutedForeground,
            textAlign = TextAlign.Center,
        )
        Button(onClick = onRetry, modifier = Modifier.padding(top = 16.dp)) {
            Text(strings.tryAgain)
        }
        TextButton(onClick = { showPicker = true }) { Text(strings.changeInstance) }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun Shell(
    state: AppState.SignedIn,
    viewModel: AppViewModel,
    instances: List<String>,
    update: UpdateState,
) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var openModule by rememberSaveable { mutableStateOf<String?>(null) }
    val strings = LocalStrings.current
    val palette = LocalPalette.current

    val actions = state.modules.flatMap { module -> module.appActions }.distinctBy { it.key }
    var showActions by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        containerColor = palette.background,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (actions.isNotEmpty() && openModule == null) {
                FloatingActionButton(
                    onClick = { showActions = true },
                    containerColor = palette.accent,
                    contentColor = palette.background,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = strings.add)
                }
            }
        },
        bottomBar = {
            NavigationBar(containerColor = palette.surface, tonalElevation = 0.dp) {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0; openModule = null },
                    icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                    label = { Text(strings.home, fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = palette.accent,
                        selectedTextColor = palette.accent,
                        unselectedIconColor = palette.mutedForeground,
                        unselectedTextColor = palette.mutedForeground,
                        indicatorColor = palette.muted,
                    ),
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1; openModule = null },
                    icon = { GridIcon(tint = if (tab == 1) palette.accent else palette.mutedForeground, modifier = Modifier.size(20.dp)) },
                    label = { Text(strings.modules, fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = palette.accent,
                        selectedTextColor = palette.accent,
                        unselectedIconColor = palette.mutedForeground,
                        unselectedTextColor = palette.mutedForeground,
                        indicatorColor = palette.muted,
                    ),
                )
                NavigationBarItem(
                    selected = tab == 2,
                    onClick = { tab = 2; openModule = null },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    label = { Text(strings.settings, fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = palette.accent,
                        selectedTextColor = palette.accent,
                        unselectedIconColor = palette.mutedForeground,
                        unselectedTextColor = palette.mutedForeground,
                        indicatorColor = palette.muted,
                    ),
                )
            }
        },
    ) { padding ->
        val language = (state as? AppState.SignedIn)?.user?.locale ?: Locale.getDefault().language
        Box(Modifier.padding(padding)) {
            when {
                // A module with screens opens in place of the launcher.
                openModule == "owe-no" && viewModel.api() != null -> OweNoScreen(
                    api = viewModel.api()!!,
                    userId = (state as? AppState.SignedIn)?.user?.id,
                    locale = language,
                    onBack = { openModule = null },
                )
                tab == 1 -> ModulesScreen(state.modules, onOpen = { key -> openModule = key })
                openModule != null -> LaunchedEffect(openModule) {
                    // A module without screens yet still answers, honestly.
                    openModule = null
                    scope.launch { snackbar.showSnackbar(strings.actionSoon) }
                }
                tab == 2 -> SettingsScreen(
                    instance = state.instance,
                    knownInstances = instances,
                    user = state.user,
                    onRememberInstance = viewModel::rememberInstance,
                    onChangeInstance = viewModel::changeInstance,
                    update = update,
                    onCheckUpdates = { viewModel.checkForUpdate(manual = true) },
                    onInstallUpdate = viewModel::installUpdate,
                    onTheme = { viewModel.updateProfile(theme = it) },
                    onLocale = { viewModel.updateProfile(locale = it) },
                    onSignOut = viewModel::signOut,
                )
                else -> HomeScreen(
                    user = state.user,
                    modules = state.modules,
                    widgets = state.widgets,
                    update = update,
                    onInstallUpdate = viewModel::installUpdate,
                )
            }
        }
    }

    if (showActions) {
        ModalBottomSheet(
            onDismissRequest = { showActions = false },
            containerColor = palette.surface,
        ) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
                actions.forEach { action ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                showActions = false
                                when (action.screen) {
                                    "owe_expense", "owe_movement" -> openModule = "owe-no"
                                    else -> scope.launch { snackbar.showSnackbar(strings.actionSoon) }
                                }
                            }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(palette.successSubtle, RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Add,
                                contentDescription = null,
                                tint = palette.accent,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                        Text(action.label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}
