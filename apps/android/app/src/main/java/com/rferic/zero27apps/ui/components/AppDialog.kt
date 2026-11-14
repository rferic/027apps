package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * Every modal in the app uses the product surface, radius and text colours
 * instead of Material's defaults, so a dialog never looks like another app.
 */
@Composable
fun AppAlertDialog(
    onDismissRequest: () -> Unit,
    title: @Composable () -> Unit,
    text: @Composable () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
) {
    val palette = LocalPalette.current
    AlertDialog(
        onDismissRequest = onDismissRequest,
        title = title,
        text = text,
        confirmButton = confirmButton,
        dismissButton = dismissButton,
        containerColor = palette.surface,
        titleContentColor = palette.foreground,
        textContentColor = palette.mutedForeground,
        tonalElevation = 0.dp,
        shape = RoundedCornerShape(20.dp),
    )
}
