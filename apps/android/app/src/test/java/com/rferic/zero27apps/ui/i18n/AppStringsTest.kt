package com.rferic.zero27apps.ui.i18n

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppStringsTest {
    @Test
    fun `picks the language of the device when it is supported`() {
        assertEquals("Entrar", AppStrings.forLanguage("es").signIn)
        assertEquals("Entra", AppStrings.forLanguage("ca").signIn)
        assertEquals("Accedi", AppStrings.forLanguage("it").signIn)
        assertEquals("Se connecter", AppStrings.forLanguage("fr").signIn)
        assertEquals("Anmelden", AppStrings.forLanguage("de").signIn)
        assertEquals("Entrar", AppStrings.forLanguage("pt").signIn)
        assertEquals("Entrar", AppStrings.forLanguage("gl").signIn)
        assertEquals("Hasi saioa", AppStrings.forLanguage("eu").signIn)
    }

    @Test
    fun `falls back to English for anything else`() {
        assertEquals("Sign in", AppStrings.forLanguage("nl").signIn)
        assertEquals("Sign in", AppStrings.forLanguage(null).signIn)
        assertEquals("Sign in", AppStrings.forLanguage("").signIn)
    }

    @Test
    fun `every locale is complete`() {
        // A blank field would render as an empty label; the nine locales must
        // carry the whole copy, not a partial translation.
        val all = listOf(
            AppStrings.en, AppStrings.es, AppStrings.ca, AppStrings.it, AppStrings.fr,
            AppStrings.de, AppStrings.pt, AppStrings.gl, AppStrings.eu,
        )
        for (strings in all) {
            val texts = listOf(
                strings.email, strings.password, strings.signIn, strings.signingIn,
                strings.changeInstance, strings.instance, strings.newInstanceUrl,
                strings.add, strings.use, strings.cancel, strings.invalidUrl,
                strings.tryAgain, strings.failureNetwork, strings.failureAuthUnavailable,
                strings.loginWrong, strings.loginUnconfirmed, strings.loginFailed,
                strings.inviteTitle, strings.inviteName, strings.invitePasswordHint,
                strings.join, strings.joining, strings.notNow, strings.inviteExpired,
                strings.inviteUsed, strings.inviteNotFound, strings.inviteEmailMismatch,
                strings.inviteFailed, strings.home, strings.modules, strings.settings,
                strings.hello, strings.yourAccount, strings.moduleAvailable,
                strings.modulesAvailable, strings.noModulesHome, strings.noModulesLauncher,
                strings.theme, strings.language, strings.signOut, strings.signedInAs,
                strings.themeSystem, strings.themeLight, strings.themeDark,
                strings.updateAvailable, strings.updateInstall, strings.updateDownloading,
                strings.updateInstalling, strings.updateFailed, strings.connecting,
                strings.privateSpace, strings.mySpace, strings.onlyActive, strings.change,
                strings.sessionNote, strings.welcome, strings.version,
            )
            assertTrue(texts.all { it.isNotBlank() })
        }
    }
}
