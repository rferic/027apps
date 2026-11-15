package com.rferic.zero27apps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rferic.zero27apps.ui.theme.LocalPalette

/**
 * The app's modal: a bottom sheet with a drag handle, a short title, a body that
 * scrolls on small screens and one full-width primary action. Material's
 * `AlertDialog` sizes its title like a page heading and floats an oversized box
 * in the middle of the screen, which reads as a stock dialog next to the rest of
 * the product; this keeps the same tokens and rhythm as the screens behind it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppSheet(
    onDismissRequest: () -> Unit,
    title: String,
    subtitle: String? = null,
    primaryLabel: String? = null,
    onPrimary: (() -> Unit)? = null,
    primaryEnabled: Boolean = true,
    destructive: Boolean = false,
    secondaryLabel: String? = null,
    onSecondary: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    val palette = LocalPalette.current
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = state,
        containerColor = palette.surface,
        contentColor = palette.foreground,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 10.dp, bottom = 4.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .background(palette.border, RoundedCornerShape(2.dp)),
            )
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 600.dp)
                .imePadding()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            if (subtitle != null) {
                Text(subtitle, fontSize = 12.sp, color = palette.mutedForeground)
            }
            content()
            if (primaryLabel != null && onPrimary != null) {
                Spacer(Modifier.height(4.dp))
                Button(
                    onClick = onPrimary,
                    enabled = primaryEnabled,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = if (destructive) {
                        ButtonDefaults.buttonColors(
                            containerColor = palette.destructive,
                            contentColor = palette.background,
                        )
                    } else {
                        ButtonDefaults.buttonColors(
                            containerColor = palette.primary,
                            contentColor = palette.primaryForeground,
                        )
                    },
                ) {
                    Text(primaryLabel, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            if (secondaryLabel != null && onSecondary != null) {
                TextButton(onClick = onSecondary, modifier = Modifier.fillMaxWidth()) {
                    Text(secondaryLabel, fontSize = 13.sp, color = palette.mutedForeground)
                }
            }
        }
    }
}

/** Full-width menu row used inside an [AppSheet] when the sheet is a list of options. */
@Composable
fun SheetAction(
    label: String,
    note: String? = null,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    val palette = LocalPalette.current
    Column(Modifier.fillMaxWidth()) {
        TextButton(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth().heightIn(min = 34.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
        ) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
                Text(
                    label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (destructive) palette.destructive else palette.foreground,
                )
            }
        }
        if (note != null) {
            Text(note, fontSize = 11.sp, color = palette.mutedForeground, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/**
 * Sheet with the classic `title / text / confirm / dismiss` shape, so a form can
 * keep its body and still sit in a bottom sheet instead of a centred dialog.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppFormSheet(
    onDismissRequest: () -> Unit,
    title: @Composable () -> Unit,
    text: @Composable () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    tall: Boolean = false,
) {
    val palette = LocalPalette.current
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = state,
        containerColor = palette.surface,
        contentColor = palette.foreground,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 10.dp, bottom = 4.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .background(palette.border, RoundedCornerShape(2.dp)),
            )
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 600.dp)
                .imePadding()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            androidx.compose.runtime.CompositionLocalProvider(
                androidx.compose.material3.LocalTextStyle provides
                    androidx.compose.ui.text.TextStyle(
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = palette.foreground,
                    ),
            ) { title() }
            androidx.compose.runtime.CompositionLocalProvider(
                androidx.compose.material3.LocalTextStyle provides
                    androidx.compose.ui.text.TextStyle(fontSize = 13.sp, color = palette.mutedForeground),
            ) {
                // A bounded box: the body may scroll on its own, and a scrollable
                // measured with infinite height crashes.
                Box(
                    Modifier
                        .fillMaxWidth()
                        .then(if (tall) Modifier.weight(1f) else Modifier.heightIn(max = 360.dp)),
                ) { text() }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                dismissButton?.invoke()
                confirmButton()
            }
        }
    }
}
