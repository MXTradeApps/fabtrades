import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/sync/sync_rate_limiter.dart';
import '../auth/sign_in_sheet.dart';

/// Pull-to-refresh for Binder / Want List: reconcile with the server when
/// signed in, subject to [SyncRateLimiter.pullCooldown].
Future<void> refreshBinderSync(BuildContext context, WidgetRef ref) async {
  final account = ref.read(accountProvider).value;
  if (account == null) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: const Text('Sign in to sync your binder across devices.'),
          action: SnackBarAction(
            label: 'Sign in',
            onPressed: () => presentSignIn(context, source: 'binder_sync'),
          ),
        ),
      );
    return;
  }

  final result =
      await ref.read(syncProvider.notifier).syncFromPullToRefresh(account.id);
  if (!context.mounted) return;
  if (result == PullSyncResult.rateLimited) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('Synced recently — try again in a moment.'),
          duration: Duration(seconds: 2),
        ),
      );
  }
}
