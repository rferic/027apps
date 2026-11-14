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
        versionCode = 303
        versionName = "0.3.3"
        resValue("string", "app_name", "027Apps")

        // The shell opens against one instance without asking for a URL; a
        // different one is a Settings action. Override per build with
        // -PdefaultInstanceUrl=http://192.168.1.108:3003 for LAN testing.
        val defaultInstance = providers.gradleProperty("defaultInstanceUrl")
            .orElse("https://027apps.ericrf.com")
            .get()
        buildConfigField("String", "DEFAULT_INSTANCE_URL", "\"$defaultInstance\"")
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
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)

    testImplementation(libs.junit)
    testImplementation(libs.ktor.client.mock)
    testImplementation(libs.kotlinx.coroutines.test)
}
