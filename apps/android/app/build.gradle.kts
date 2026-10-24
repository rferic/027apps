plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

kotlin {
    jvmToolchain(17)
}

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
