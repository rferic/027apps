import java.util.Base64

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
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
        versionCode = 1
        versionName = "0.1.0"
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
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.activity.compose)

    testImplementation(libs.junit)
}
