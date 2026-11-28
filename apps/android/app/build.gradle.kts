import java.util.Base64

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    jvmToolchain(17)
}

val signingEnv = listOf(
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
).associateWith { providers.environmentVariable(it).orNull?.takeIf(String::isNotBlank) }
val releaseSigningEnabled = signingEnv.values.all { it != null }

android {
    namespace = "com.rferic.zero27apps"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.rferic.zero27apps"
        minSdk = 26
        targetSdk = 37
        // major*10000 + minor*100 + patch; the Core derives the same number from
        // the release tag, so the updater compares plain integers.
        versionCode = 2202
        versionName = "0.22.2"
        resValue("string", "app_name", "027Apps")

        // The shell opens against one instance without asking for a URL; a
        // different one is a Settings action. Override per build with
        // -PdefaultInstanceUrl=http://192.168.1.108:3003 for LAN testing.
        val defaultInstance = providers.gradleProperty("defaultInstanceUrl")
            .orElse("https://027apps.ericrf.com")
            .get()
        buildConfigField("String", "DEFAULT_INSTANCE_URL", "\"$defaultInstance\"")

        // Debug-only convenience: the Vercel "Protection Bypass for Automation"
        // token that lets the develop build reach the protected staging
        // deployment. Never committed; pass it per build:
        //   ./gradlew :app:assembleDebug -PvercelProtectionBypass=<token>
        // or as VERCEL_PROTECTION_BYPASS in the environment.
        val vercelBypass = providers.gradleProperty("vercelProtectionBypass")
            .orElse(providers.environmentVariable("VERCEL_PROTECTION_BYPASS"))
            .orElse("")
            .get()
        buildConfigField("String", "VERCEL_PROTECTION_BYPASS", "\"$vercelBypass\"")
    }

    if (releaseSigningEnabled) {
        val keystoreFile = layout.buildDirectory.file("signing/release.jks").get().asFile
        keystoreFile.parentFile.mkdirs()
        keystoreFile.writeBytes(Base64.getMimeDecoder().decode(signingEnv.getValue("ANDROID_KEYSTORE_BASE64")))

        signingConfigs {
            create("release") {
                storeFile = keystoreFile
                storePassword = signingEnv.getValue("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = signingEnv.getValue("ANDROID_KEY_ALIAS")
                keyPassword = signingEnv.getValue("ANDROID_KEY_PASSWORD")
            }
        }
        buildTypes {
            getByName("release") {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    buildTypes {
        debug {
            // Installable next to the real app: a different application id means
            // separate data, separate keystore keys and no "uninstall the other
            // one first". The label and the version make it obvious on screen.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            resValue("string", "app_name", "027Apps Dev")
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.splashscreen)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.supabase.auth)
    implementation(libs.supabase.realtime)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.work.runtime)
    implementation(libs.coil.compose)
    implementation(libs.coil.svg)
    implementation(libs.vico.compose.m3)
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.zxing.core)

    testImplementation(libs.junit)
    testImplementation(libs.ktor.client.mock)
    testImplementation(libs.kotlinx.coroutines.test)
}
