package com.rferic.zero27apps.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.rferic.zero27apps.BuildConfig
import com.rferic.zero27apps.InstanceStore
import com.rferic.zero27apps.auth.EncryptedStringStore
import com.rferic.zero27apps.auth.KeystoreSecretCipher
import com.rferic.zero27apps.auth.SupabaseFactory
import com.rferic.zero27apps.data.ApiClient
import com.rferic.zero27apps.prefs.PrefsStringStore
import androidx.glance.appwidget.updateAll
import io.github.jan.supabase.auth.auth
import io.ktor.client.engine.okhttp.OkHttp
import java.util.concurrent.TimeUnit

/**
 * Refreshes the home widget: restores the encrypted session, reads the user's
 * groups and their balance, and stores the numbers the widget paints.
 */
class OweWidgetWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val context = applicationContext
        val prefs = PrefsStringStore(context)
        val instanceStore = InstanceStore(prefs, BuildConfig.DEFAULT_INSTANCE_URL)
        val sessionStore = EncryptedStringStore(KeystoreSecretCipher(), prefs, "session")
        val supabaseFactory = SupabaseFactory(sessionStore)
        val store = WidgetSnapshotStore(context)

        var api: ApiClient? = null
        var supabase: io.github.jan.supabase.SupabaseClient? = null
        try {
            api = ApiClient(
                baseUrl = instanceStore.current(),
                engine = OkHttp.create(),
                token = { supabase?.auth?.currentSessionOrNull()?.accessToken },
                refresh = {
                    runCatching {
                        supabase?.auth?.refreshCurrentSession()
                        true
                    }.getOrDefault(false)
                },
            )
            val instance = api.instance()
            val auth = instance.auth ?: return finish(context, store, WidgetSnapshot())
            supabase = supabaseFactory.create(auth.supabaseUrl, auth.supabaseAnonKey)
            supabase.auth.awaitInitialization()
            val session = supabase.auth.currentSessionOrNull()
                ?: return finish(context, store, WidgetSnapshot())
            val locale = runCatching { api.me().locale }.getOrNull() ?: "en"
            val groups = api.oweGroups().filter { it.role == "active" }
            val rows = mutableListOf<WidgetGroup>()
            var net = 0L
            var owedToYou = 0L
            var youOwe = 0L
            var currency = "EUR"
            for (group in groups.take(6)) {
                val detail = runCatching { api.oweGroup(group.id) }.getOrNull() ?: continue
                val mine = detail.members.firstOrNull { it.userId == session.user?.id } ?: continue
                val balances = runCatching { api.oweBalances(group.id) }.getOrDefault(emptyList())
                val amount = balances.firstOrNull { it.memberId == mine.id }?.amountMinor ?: 0L
                currency = detail.group.currency
                net += amount
                if (amount > 0) owedToYou += amount else youOwe += -amount
                rows += WidgetGroup(detail.group.name, amount)
            }
            finish(
                context,
                store,
                WidgetSnapshot(
                    signedIn = true,
                    currency = currency,
                    netMinor = net,
                    owedToYouMinor = owedToYou,
                    youOweMinor = youOwe,
                    groups = rows.take(4),
                    locale = locale,
                    updatedAt = System.currentTimeMillis(),
                ),
            )
        } catch (_: Exception) {
            // Keep the previous snapshot: a network blip must not blank the widget.
            Result.retry()
        } finally {
            api?.close()
        }
        return Result.success()
    }

    private suspend fun finish(context: Context, store: WidgetSnapshotStore, snapshot: WidgetSnapshot): Result {
        store.write(snapshot)
        OweWidget().updateAll(context)
        return Result.success()
    }

    companion object {
        private const val PERIODIC = "owe-widget-periodic"
        private const val ONCE = "owe-widget-once"

        /** Called when the app starts so the widget matches the session at once. */
        fun refreshNow(context: Context) {
            WorkManager.getInstance(context).enqueue(
                OneTimeWorkRequestBuilder<OweWidgetWorker>().build(),
            )
        }

        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<OweWidgetWorker>(30, TimeUnit.MINUTES).build(),
            )
            WorkManager.getInstance(context).enqueueUniqueWork(
                ONCE,
                androidx.work.ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<OweWidgetWorker>().build(),
            )
        }
    }
}
