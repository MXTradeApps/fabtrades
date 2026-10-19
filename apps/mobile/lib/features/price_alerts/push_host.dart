import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/models/account.dart';
import '../../core/notifications/push_service.dart';
import '../../core/providers.dart';

/// Keeps this device's push token registered to the signed-in account and
/// routes tapped price alert notifications to [pushOpenProvider], which
/// HomeShell turns into a pushed screen.
///
/// Inert when push is not configured, which is also the case under tests.
class PushHost extends ConsumerStatefulWidget {
  const PushHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PushHost> createState() => _PushHostState();
}

class _PushHostState extends ConsumerState<PushHost> {
  final _subscriptions = <StreamSubscription<Object?>>[];

  @override
  void initState() {
    super.initState();
    if (!PushService.isAvailable) return;
    _subscriptions
      ..add(PushService.onMessageOpenedApp.listen(_open))
      ..add(PushService.onMessage.listen((_) {
        ref.read(priceAlertsProvider.notifier).refresh();
      }))
      ..add(PushService.onTokenRefresh.listen((_) => _register(ref)));
    PushService.initialMessage().then((message) {
      if (message != null && mounted) _open(message);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _register(ref);
    });
  }

  @override
  void dispose() {
    for (final s in _subscriptions) {
      s.cancel();
    }
    super.dispose();
  }

  void _open(RemoteMessage message) {
    final type = message.data['type'];
    if (type != 'price_alert' && type != 'price_alerts') return;
    final cardId = message.data['card_id'] as String?;
    ref.read(analyticsProvider).capture('price_alert_push_opened', {
      'type': type!,
      'card_id': ?cardId,
    });
    ref.read(priceAlertsProvider.notifier).refresh();
    ref.read(pushOpenProvider.notifier).open(cardId ?? '');
  }

  @override
  Widget build(BuildContext context) {
    if (PushService.isAvailable) {
      ref.listen<AsyncValue<Account?>>(accountProvider, (previous, next) {
        final before = previous?.value?.id;
        final after = next.value?.id;
        if (before == after) return;
        if (after != null) {
          _register(ref);
        } else if (before != null) {
          // The token row still belongs to the old account, and RLS no longer
          // lets this device delete it. Rotating the token makes FCM reject
          // it, and the server drops it on the next send.
          PushService.deleteToken();
        }
      });
    }
    return widget.child;
  }
}

/// Registers this device for the signed-in account's alerts.
///
/// With [prompt], asks for notification permission first (the system shows
/// its prompt only once); without, registers only if already allowed.
/// Returns whether notifications are on. Never throws.
Future<bool> registerForPush(WidgetRef ref, {bool prompt = false}) =>
    _register(ref, prompt: prompt);

Future<bool> _register(WidgetRef ref, {bool prompt = false}) async {
  if (!PushService.isAvailable) return false;
  if (ref.read(accountProvider).value == null) return false;
  final allowed = prompt
      ? await PushService.requestPermission()
      : await PushService.hasPermission();
  if (prompt) {
    ref
        .read(analyticsProvider)
        .capture('push_permission_result', {'granted': allowed});
  }
  if (!allowed) return false;
  final token = await PushService.token();
  if (token == null) return false;
  try {
    await ref
        .read(priceAlertRepositoryProvider)
        .registerPushToken(token, PushService.platform);
    return true;
  } catch (e) {
    debugPrint('push register: $e');
    return false;
  }
}
