import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/providers.dart';
import '../features/binder/binder_settings_screen.dart';
import '../features/life_tracker/life_tracker_screen.dart';
import '../features/settings/account_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/trade/trade_history_screen.dart';
import 'theme.dart';
import 'ui.dart';

/// Opens the More sheet: every destination that is not a bottom tab, the
/// account row, and when prices were last updated. Replaces the old
/// per-screen hamburger menu, matching the web's phone More sheet.
///
/// Pushed screens open on [context]'s navigator (the active tab), so the tab
/// bar stays visible, except Life Tracker which covers it.
Future<void> showMoreSheet(BuildContext context) {
  final parentContext = context;
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    routeSettings: const RouteSettings(name: 'More'),
    builder: (sheetContext) => _MoreSheet(parentContext: parentContext),
  );
}

class _MoreSheet extends ConsumerWidget {
  const _MoreSheet({required this.parentContext});

  final BuildContext parentContext;

  void _push(BuildContext sheetContext, Widget screen, String name,
      {bool root = false}) {
    Navigator.of(sheetContext).pop();
    Navigator.of(parentContext, rootNavigator: root).push(
      MaterialPageRoute<void>(
        builder: (_) => screen,
        settings: RouteSettings(name: name),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final account = ref.watch(accountProvider).value;
    final signedIn = account != null;
    final updatedAt = ref.watch(priceUpdatedAtProvider);

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Panel(
              onTap: () => _push(context, const AccountScreen(), 'Account'),
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: t.accentSoft,
                    foregroundColor: t.accentText,
                    child: signedIn
                        ? Text(account.initials,
                            style: const TextStyle(fontWeight: FontWeight.w700))
                        : const Icon(Icons.person_outline),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          signedIn ? 'My Account' : 'Sign up',
                          style: theme.textTheme.titleSmall,
                        ),
                        Text(
                          signedIn
                              ? account.label
                              : 'Sync your Binder and trades across devices',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: t.textFaint),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _MoreTile(
              icon: Icons.history_rounded,
              label: 'Trade History',
              onTap: () => _push(
                  context, const TradeHistoryScreen(), 'Trade History'),
            ),
            _MoreTile(
              icon: Icons.favorite_outline,
              label: 'Life Tracker',
              // Root navigator so the tracker covers the tab bar.
              onTap: () => _push(
                  context, const LifeTrackerScreen(), 'Life Tracker',
                  root: true),
            ),
            _MoreTile(
              icon: Icons.upload_file_outlined,
              label: 'Import from Fabrary',
              onTap: () {
                Navigator.of(context).pop();
                showDialog<void>(
                  context: parentContext,
                  builder: (_) => const BinderSettingsScreen(),
                );
              },
            ),
            _MoreTile(
              icon: Icons.tune_rounded,
              label: 'Settings',
              onTap: () =>
                  _push(context, const SettingsScreen(), 'Settings'),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: PriceStamp(updatedAt: updatedAt),
            ),
          ],
        ),
      ),
    );
  }
}

class _MoreTile extends StatelessWidget {
  const _MoreTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.lgAll),
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: t.sunken,
          borderRadius: AppRadii.mdAll,
        ),
        child: Icon(icon, size: 20, color: t.textMuted),
      ),
      title: Text(label,
          style: Theme.of(context)
              .textTheme
              .bodyLarge
              ?.copyWith(fontWeight: FontWeight.w600)),
      trailing: Icon(Icons.chevron_right, color: t.textFaint),
      onTap: onTap,
    );
  }
}

/// "Prices updated …" line with a live dot, as in the web sidebar footer.
class PriceStamp extends StatelessWidget {
  const PriceStamp({super.key, required this.updatedAt});
  final DateTime? updatedAt;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final when = updatedAt == null
        ? '…'
        : DateFormat('MMM d, h:mm a').format(updatedAt!.toLocal());
    return Row(
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: updatedAt == null ? t.textFaint : t.gain,
            boxShadow: updatedAt == null
                ? null
                : [
                    BoxShadow(
                        color: t.gain.withValues(alpha: 0.18),
                        spreadRadius: 3),
                  ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'Prices updated $when',
            style: TextStyle(fontSize: 12, color: t.textMuted),
          ),
        ),
      ],
    );
  }
}
