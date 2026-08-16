import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'pro_paywall.dart';

/// Ensures the customer has `FABTrades Pro` before an action runs, presenting
/// the paywall if they don't.
///
/// The one-liner for gating any imperative flow:
///
/// ```dart
/// onPressed: () async {
///   if (!await ensurePro(context, ref)) return;
///   exportBinderToCsv();
/// }
/// ```
///
/// Returns true when Pro is active — immediately for existing subscribers, so
/// the paywall never flashes for someone who already paid.
///
/// [trigger] identifies what gated action asked for Pro, for analytics.
Future<bool> ensurePro(
  BuildContext context,
  WidgetRef ref, {
  String trigger = 'unknown',
}) async {
  if (ref.read(isProProvider)) return true;
  return presentProPaywall(context, ref, trigger: trigger);
}

/// Renders [child] for Pro customers and an unlock prompt for everyone else.
///
/// For gating whole widgets rather than actions. Do **not** wrap the card
/// details price-history chart: free players still see the last 30 days, and
/// a [ProGate] would hide that glance (use a quiet text control under the
/// chart that calls [presentProPaywall] instead).
///
/// ```dart
/// ProGate(
///   feature: 'Full price history',
///   description: 'See every recorded Low, not just the last 30 days.',
///   child: PriceHistorySpanControl(),
/// )
/// ```
class ProGate extends ConsumerWidget {
  const ProGate({
    super.key,
    required this.feature,
    required this.child,
    this.description,
    this.locked,
    this.trigger = 'unknown',
  });

  /// Name of the gated feature, shown in the prompt.
  final String feature;

  final Widget child;

  /// One line on why the feature is worth paying for.
  final String? description;

  /// Replaces the default prompt when a feature needs its own locked state
  /// (a blurred preview, for instance).
  final Widget? locked;

  /// What surfaced this gate, for analytics on the resulting paywall.
  final String trigger;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(isProProvider)) return child;
    return locked ??
        ProUnlockCard(
          feature: feature,
          description: description,
          trigger: trigger,
        );
  }
}

/// The default locked state used by [ProGate]: what the feature is, and one
/// button to unlock it.
class ProUnlockCard extends ConsumerWidget {
  const ProUnlockCard({
    super.key,
    required this.feature,
    this.description,
    this.trigger = 'unknown',
  });

  final String feature;
  final String? description;

  /// What surfaced this card, for analytics on the resulting paywall.
  final String trigger;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const ProBadge(),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(feature, style: theme.textTheme.titleMedium),
                ),
              ],
            ),
            if (description != null) ...[
              const SizedBox(height: 10),
              Text(
                description!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () =>
                    presentProPaywall(context, ref, trigger: trigger),
                icon: const Icon(Icons.lock_open, size: 18),
                label: const Text('Unlock with Pro'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small "PRO" chip for marking gated entry points in lists and menus.
class ProBadge extends StatelessWidget {
  const ProBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: scheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        'PRO',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: scheme.onSecondaryContainer,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
      ),
    );
  }
}
