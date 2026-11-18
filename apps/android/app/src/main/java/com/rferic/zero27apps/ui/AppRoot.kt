package com.rferic.zero27apps.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
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
import com.rferic.zero27apps.ui.components.AppAlertDialog
import com.rferic.zero27apps.ui.components.BrandWordmark
import com.rferic.zero27apps.ui.components.GridIcon
import com.rferic.zero27apps.ui.i18n.AppStrings
import com.rferic.zero27apps.ui.i18n.LocalStrings
import com.rferic.zero27apps.ui.migration.MigrationQrScreen
import com.rferic.zero27apps.ui.migration.MigrationScanScreen
import com.rferic.zero27apps.ui.screens.HomeScreen
import com.rferic.zero27apps.ui.screens.InviteScreen
import com.rferic.zero27apps.ui.screens.LoginScreen
import com.rferic.zero27apps.ui.screens.OweNoScreen
import com.rferic.zero27apps.ui.screens.ModulesScreen
import com.rferic.zero27apps.ui.screens.SettingsScreen
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Color
import com.rferic.zero27apps.ui.theme.LocalPalette
import com.rferic.zero27apps.ui.theme.moduleAccent
import com.rferic.zero27apps.ui.theme.appGradient
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
fun AppRoot(
    deepLink: String? = null,
    startAction: String? = null,
    startGroup: String? = null,
    viewModel: AppViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val login by viewModel.login.collectAsStateWithLifecycle()
    val invite by viewModel.invite.collectAsStateWithLifecycle()
    val instances by viewModel.instances.collectAsStateWithLifecycle()
    val privacyMasked by viewModel.privacyMasked.collectAsStateWithLifecycle()
    val update by viewModel.update.collectAsStateWithLifecycle()
    val migration by viewModel.migration.collectAsStateWithLifecycle()
    var scanningMigration by rememberSaveable { mutableStateOf(false) }
    var showingMigrationQr by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(deepLink) {
        val link = deepLink ?: return@LaunchedEffect
        if (!viewModel.onMigrationLink(link)) viewModel.onInviteLink(link)
    }

    // Coming back to the app is the natural moment to ask for a newer build and
    // to notice that the session was revoked while the app was in the
    // background; the view model throttles the update check.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) {
                viewModel.checkForUpdate()
                viewModel.revalidateSession()
            }
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
            CompositionLocalProvider(
                LocalStrings provides strings,
                com.rferic.zero27apps.ui.privacy.LocalPrivacyMasked provides privacyMasked,
                com.rferic.zero27apps.ui.components.LocalTogglePrivacy provides viewModel::togglePrivacy,
            ) {
                when (val current = state) {
                    AppState.Loading -> Splash(viewModel.currentInstance())
                    is AppState.NeedsLogin -> if (scanningMigration) {
                        MigrationScanScreen(
                            state = migration,
                            onScanned = { link ->
                                scanningMigration = false
                                viewModel.acceptMigration(link)
                            },
                            onCancel = { scanningMigration = false },
                        )
                    } else {
                        LoginScreen(
                            instance = current.instance,
                            knownInstances = instances,
                            state = login,
                            update = update,
                            notice = current.notice,
                            onLogin = viewModel::login,
                            onScanMigration = { scanningMigration = true },
                            onRememberInstance = viewModel::rememberInstance,
                            onChangeInstance = viewModel::changeInstance,
                            onForgetInstance = viewModel::forgetInstance,
                            onInstallUpdate = viewModel::installUpdate,
                        )
                    }
                    is AppState.NeedsInvite -> InviteScreen(
                        link = current.link,
                        state = invite,
                        onSubmit = viewModel::acceptInvite,
                        onRetry = viewModel::retryInvitePreview,
                        onCancel = viewModel::cancelInvite,
                    )
                    is AppState.SignedIn -> if (showingMigrationQr) {
                        MigrationQrScreen(
                            instance = current.instance,
                            email = viewModel.currentEmail() ?: current.user.displayName,
                            state = migration,
                            onStart = viewModel::startMigration,
                            onStop = viewModel::stopMigration,
                            onClose = { showingMigrationQr = false },
                        )
                    } else {
                        Shell(
                            current,
                            viewModel,
                            instances,
                            update,
                            startAction,
                            startGroup,
                            onMigrate = { showingMigrationQr = true },
                        )
                    }
                    is AppState.Failure -> FailureScreen(
                        reason = current.reason,
                        knownInstances = instances,
                        currentInstance = viewModel.currentInstance(),
                        onRememberInstance = viewModel::rememberInstance,
                        onChangeInstance = viewModel::changeInstance,
                        onForgetInstance = viewModel::forgetInstance,
                        onRetry = viewModel::refresh,
                    )
                }

                // A link from a browser may name any host: when it is not the
                // instance this install uses, the person confirms first.
                val confirmInstance = migration.confirmInstance
                if (confirmInstance != null) {
                    AppAlertDialog(
                        onDismissRequest = viewModel::stopMigration,
                        title = { Text(strings.migrationTitle) },
                        text = {
                            Text(
                                strings.migrationConfirmInstance.replace(
                                    "{instance}",
                                    confirmInstance.removePrefix("https://").removePrefix("http://"),
                                ),
                            )
                        },
                        confirmButton = {
                            TextButton(onClick = viewModel::confirmMigrationLink) {
                                Text(strings.confirm)
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = viewModel::stopMigration) {
                                Text(strings.cancel)
                            }
                        },
                    )
                }

                // A migration link that could not finish (this phone is already
                // signed in, or the code was used or expired) says why, instead
                // of silently ignoring the link.
                val migrationError = migration.error
                if (migrationError != null && !scanningMigration && !showingMigrationQr) {
                    AppAlertDialog(
                        onDismissRequest = viewModel::stopMigration,
                        title = { Text(strings.migrationTitle) },
                        text = {
                            Text(
                                when (migrationError) {
                                    MigrationError.SIGNED_IN -> strings.migrationSignedIn
                                    MigrationError.AUTH -> strings.migrationInvalid
                                    MigrationError.NETWORK -> strings.failureNetwork
                                    MigrationError.GENERIC -> strings.inviteFailed
                                },
                            )
                        },
                        confirmButton = {
                            if (migrationError == MigrationError.SIGNED_IN) {
                                TextButton(onClick = viewModel::signOutAndMigrate) {
                                    Text(strings.migrationSignOutAndScan)
                                }
                            } else {
                                TextButton(onClick = viewModel::stopMigration) {
                                    Text(strings.migrationClose)
                                }
                            }
                        },
                        dismissButton = if (migrationError == MigrationError.SIGNED_IN) {
                            {
                                TextButton(onClick = viewModel::stopMigration) {
                                    Text(strings.cancel)
                                }
                            }
                        } else {
                            null
                        },
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
    onForgetInstance: (String) -> Unit,
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
            onRemove = onForgetInstance,
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
    initialAction: String? = null,
    initialGroup: String? = null,
    onMigrate: () -> Unit,
) {
    val pushStatus by viewModel.pushStatus.collectAsStateWithLifecycle()
    // D18: the shell restores the last place, but a module always opens at its root.
    val saved = viewModel.lastLocation()
    val savedModule = saved?.takeIf { it.startsWith("module:") }?.removePrefix("module:")
        ?.takeIf { key -> state.modules.any { it.key == key } }
    var tab by rememberSaveable {
        mutableIntStateOf(
            when {
                savedModule != null -> 0
                saved == "modules" -> 1
                saved == "settings" -> 2
                else -> 0
            },
        )
    }
    var openModule by rememberSaveable { mutableStateOf(savedModule) }
    val strings = LocalStrings.current
    val basePalette = LocalPalette.current
    // Inside a module the whole shell takes its colour: buttons, links and the wash.
    val openBranding = state.modules.firstOrNull { it.key == openModule }?.branding
    val palette = basePalette.copy(
        accent = if (openModule == null) basePalette.accent else moduleAccent(openBranding?.color),
        successSubtle = if (openModule == null) {
            basePalette.successSubtle
        } else {
            moduleAccent(openBranding?.color).copy(alpha = 0.12f)
        },
    )

    LaunchedEffect(tab, openModule) {
        val location = when {
            openModule != null -> "module:$openModule"
            tab == 1 -> "modules"
            tab == 2 -> "settings"
            else -> "home"
        }
        viewModel.rememberLocation(location)
    }

    val actions = state.modules.flatMap { module -> module.appActions }.distinctBy { it.key }
    var showActions by remember { mutableStateOf(false) }
    var startAction by remember { mutableStateOf<String?>(null) }
    var targetGroup by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(initialAction, initialGroup) {
        when (initialAction) {
            "owe_expense" -> {
                startAction = "expense"
                openModule = "owe-no"
            }
            "owe_group" -> {
                targetGroup = initialGroup
                openModule = "owe-no"
            }
        }
    }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        modifier = Modifier.background(appGradient(palette)),
        containerColor = Color.Transparent,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (actions.isNotEmpty() && openModule == null && tab == 0) {
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
            Column {
                val available = update as? UpdateState.Available
                if (available != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(palette.accent.copy(alpha = 0.14f))
                            .clickable { viewModel.installUpdate() }
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            strings.newVersion.replace("{version}", available.version),
                            modifier = Modifier.weight(1f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = palette.accent,
                        )
                        Text(
                            strings.updateInstall,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = palette.accent,
                        )
                    }
                }
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
                    startAction = startAction,
                    onStartConsumed = { startAction = null },
                    realtime = viewModel.supabase(),
                    initialGroupId = targetGroup,
                    onInitialGroupConsumed = { targetGroup = null },
                )
                tab == 1 -> ModulesScreen(
                    modules = state.modules,
                    onOpen = { key -> openModule = key },
                    iconUrl = { key -> viewModel.api()?.moduleIconUrl(key) },
                    token = viewModel.accessToken(),
                )
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
                    onForgetInstance = viewModel::forgetInstance,
                    update = update,
                    pushStatus = pushStatus,
                    onRetryPush = viewModel::retryPush,
                    onCheckUpdates = { viewModel.checkForUpdate(manual = true) },
                    onInstallUpdate = viewModel::installUpdate,
                    lastCheckAt = viewModel.lastUpdateCheckAt(),
                    onTheme = { viewModel.updateProfile(theme = it) },
                    onLocale = { viewModel.updateProfile(locale = it) },
                    onMigrate = onMigrate,
                    onSignOut = viewModel::signOut,
                )
                else -> HomeScreen(
                    user = state.user,
                    modules = state.modules,
                    widgets = state.widgets,
                    update = update,
                    onInstallUpdate = viewModel::installUpdate,
                    onOpenModule = { key ->
                        if (key == "owe-no") {
                            startAction = null
                            openModule = "owe-no"
                        } else {
                            scope.launch { snackbar.showSnackbar(strings.actionSoon) }
                        }
                    },
                    onAddExpense = {
                        startAction = "expense"
                        openModule = "owe-no"
                    },
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
                                    "owe_expense", "owe_movement" -> {
                                        startAction = "expense"
                                        openModule = "owe-no"
                                    }
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
                        Text(
                            actionLabel(action, strings),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

/** A module action label in the user's language; the manifest ships English. */
private fun actionLabel(
    action: com.rferic.zero27apps.data.AppActionDto,
    strings: com.rferic.zero27apps.ui.i18n.Strings,
): String = when (action.key) {
    "add_expense" -> strings.addExpense
    else -> action.label
}
