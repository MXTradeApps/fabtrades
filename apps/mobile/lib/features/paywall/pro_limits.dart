import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/logic/free_limits.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import 'pro_paywall.dart';

/// Adds [card] to the binder or want list, turning a free-tier cap into an
/// upgrade offer instead of a tap that appears to do nothing.
///
/// This is the single place binder additions should go through, so every entry
/// point — Browse, card detail, the scanner, the want list — behaves the same
/// when a limit is reached.
///
/// The cap is surfaced as a snackbar with an Upgrade action rather than by
/// launching the paywall outright: someone who tapped "Add to Binder" didn't
/// ask to be sold to, and a modal in their face would read as a bait-and-switch.
/// If they do upgrade, the add they originally wanted is retried for them.
///
/// [source] identifies where the add came from (e.g. `search`, `scan`,
/// `card_detail`), for analytics.
Future<bool> addToBinderOrUpsell(
  BuildContext context,
  WidgetRef ref,
  CardModel card, {
  bool isWanted = false,
  int quantity = 1,
  String? successMessage,
  String source = 'unknown',
}) async {
  final binder = ref.read(binderProvider.notifier);

  if (binder.add(card, quantity: quantity, isWanted: isWanted)) {
    _captureAdded(ref, card, isWanted: isWanted, source: source);
    _syncBinderSoon(ref);
    if (successMessage != null) _showMessage(context, successMessage);
    return true;
  }

  final limit = FreeLimits.cardsFor(isWanted: isWanted);
  final listName = isWanted ? 'Want lists' : 'Binders';
  ref.read(analyticsProvider).capture('free_limit_hit', {
    'limit_type': isWanted ? 'want_list' : 'binder',
    'current_count': ref
        .read(binderProvider)
        .where((e) => e.isWanted == isWanted)
        .length,
    'limit': limit,
  });
  return _offerUpgrade(
    context,
    ref,
    trigger: isWanted ? 'want_limit' : 'binder_limit',
    message: '$listName hold $limit cards on the free plan.',
    onUpgraded: () {
      binder.add(card, quantity: quantity, isWanted: isWanted);
      _captureAdded(ref, card, isWanted: isWanted, source: source);
      _syncBinderSoon(ref);
      if (context.mounted) {
        _showMessage(
          context,
          successMessage ??
              'Added ${card.name} to ${isWanted ? 'Want List' : 'Binder'}',
        );
      }
    },
  );
}

/// Push the journaled binder write when signed in. Rate-limited + coalesced
/// inside [SyncNotifier] so multi-add / scan bursts share one reconcile.
void _syncBinderSoon(WidgetRef ref) {
  final account = ref.read(accountProvider).value;
  if (account == null) return;
  unawaited(
    ref.read(syncProvider.notifier).syncAfterBinderMutation(account.id),
  );
}

void _captureAdded(
  WidgetRef ref,
  CardModel card, {
  required bool isWanted,
  required String source,
}) {
  final sizeAfter =
      ref.read(binderProvider).where((e) => e.isWanted == isWanted).length;
  ref.read(analyticsProvider).capture(
    isWanted ? 'want_list_card_added' : 'binder_card_added',
    {
      'card_id': card.id,
      'source': source,
      if (isWanted) 'want_list_size_after': sizeAfter,
      if (!isWanted) 'binder_size_after': sizeAfter,
    },
  );
}

/// Adds [card] to a lend group, or offers an upgrade when the free loaned-card
/// cap is hit. Borrowing groups are uncapped and never reach this path's limit.
Future<bool> addToLendOrUpsell(
  BuildContext context,
  WidgetRef ref, {
  required String groupId,
  required CardModel card,
  int quantity = 1,
}) async {
  final lend = ref.read(lendProvider.notifier);
  if (lend.addCard(groupId, card, quantity: quantity)) return true;

  ref.read(analyticsProvider).capture('free_limit_hit', {
    'limit_type': 'lend',
    'current_count': ref
        .read(lendProvider)
        .where((g) => !g.isBorrowing)
        .fold<int>(0, (sum, g) => sum + g.cardCount),
    'limit': FreeLimits.loanedCards,
  });
  return _offerUpgrade(
    context,
    ref,
    trigger: 'lend_limit',
    message:
        'The free plan tracks ${FreeLimits.loanedCards} loaned cards. Upgrade to lend more.',
    onUpgraded: () {
      lend.addCard(groupId, card, quantity: quantity);
    },
  );
}

/// Bumps a lent card's quantity, or offers an upgrade when that would exceed
/// the free loaned-card cap.
Future<bool> setLendQuantityOrUpsell(
  BuildContext context,
  WidgetRef ref, {
  required String groupId,
  required String cardId,
  required int quantity,
}) async {
  final lend = ref.read(lendProvider.notifier);
  if (lend.setCardQuantity(groupId, cardId, quantity)) return true;

  ref.read(analyticsProvider).capture('free_limit_hit', {
    'limit_type': 'lend',
    'current_count': ref
        .read(lendProvider)
        .where((g) => !g.isBorrowing)
        .fold<int>(0, (sum, g) => sum + g.cardCount),
    'limit': FreeLimits.loanedCards,
  });
  return _offerUpgrade(
    context,
    ref,
    trigger: 'lend_limit',
    message:
        'The free plan tracks ${FreeLimits.loanedCards} loaned cards. Upgrade to lend more.',
    onUpgraded: () {
      lend.setCardQuantity(groupId, cardId, quantity);
    },
  );
}

Future<bool> _offerUpgrade(
  BuildContext context,
  WidgetRef ref, {
  required String message,
  required VoidCallback onUpgraded,
  required String trigger,
}) async {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 6),
        action: SnackBarAction(
          label: 'Upgrade',
          onPressed: () async {
            if (!await presentProPaywall(context, ref, trigger: trigger)) {
              return;
            }
            onUpgraded();
          },
        ),
      ),
    );
  return false;
}

void _showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
}
