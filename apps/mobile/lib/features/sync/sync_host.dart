import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/config/supabase_config.dart';
import '../../core/models/account.dart';
import '../../core/models/entitlement.dart';
import '../../core/providers.dart';
import '../onboarding/onboarding_provider.dart';

/// Keeps the account's background work running for as long as the app is on
/// screen: cloud sync, binding RevenueCat's identity to the Supabase user, and
/// PostHog identify / reset on account transitions.
///
/// Both start themselves when an account appears, but a provider nobody watches
/// is never built. This host is that watcher, mounted above the tabs so neither
/// depends on the customer visiting a particular screen.
///
/// It also surfaces sync failures, once each, as a snack bar. A sync failure is
/// not an error state: every screen still renders from the local cache, so this is
/// a note beside the data rather than in place of it.
class SyncHost extends ConsumerStatefulWidget {
  const SyncHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SyncHost> createState() => _SyncHostState();
}

class _SyncHostState extends ConsumerState<SyncHost> {
  String? _reported;
  DateTime? _lastSuppressedAt;
  String? _identifiedUserId;
  bool? _lastIsPro;
  bool _bootstrappedIdentity = false;

  @override
  Widget build(BuildContext context) {
    // Watched for its side effect only. Purchases made before this binding lands
    // are attributed to an anonymous id the server cannot key a row on.
    ref.watch(purchasesIdentityProvider);

    _listenAnalyticsIdentity();
    _listenEntitlementSuperProps();
    if (!_bootstrappedIdentity) {
      _bootstrappedIdentity = true;
      final account = ref.read(accountProvider).asData?.value;
      if (account != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _identify(account);
        });
      }
      final entitlement = ref.read(entitlementProvider);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _applyEntitlement(entitlement);
      });
    }

    final status = ref.watch(syncProvider);
    final error = status.error;

    if (error != null && error != _reported) {
      _reported = error;
      // Deferred because build must not push UI, and the messenger belongs to a
      // Scaffold that is mounted below this host.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(content: Text(error), duration: const Duration(seconds: 6)),
        );
      });
    } else if (error == null) {
      // Cleared so a later failure is reported again rather than swallowed as a
      // repeat of this one.
      _reported = null;
    }

    // An account that just pulled down a stocked binder is not a new user —
    // suppress every tour so we don't coach them through empty-state tips.
    final syncedAt = status.lastSyncedAt;
    if (syncedAt != null &&
        syncedAt != _lastSuppressedAt &&
        !status.isSyncing &&
        error == null) {
      _lastSuppressedAt = syncedAt;
      // Deferred: binderProvider needs SharedPreferences, and reading providers
      // that rebuild during build is a Riverpod footgun.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final hasBinderCards =
            ref.read(binderProvider).any((e) => !e.isWanted && e.quantity > 0);
        if (hasBinderCards) {
          ref.read(onboardingProvider.notifier).markAllSeen();
        }
      });
    }

    return widget.child;
  }

  void _listenAnalyticsIdentity() {
    ref.listen<AsyncValue<Account?>>(accountProvider, (previous, next) {
      final prev = previous?.asData?.value;
      final account = next.asData?.value;
      if (prev?.id == account?.id) return;

      if (account != null) {
        _identify(account, captureSignedIn: true);
      } else if (prev != null) {
        _identifiedUserId = null;
        final analytics = ref.read(analyticsProvider);
        analytics.capture('signed_out');
        analytics.reset().then((_) => _reregisterSurvivingSuperProps());
      }
    });
  }

  void _identify(Account account, {bool captureSignedIn = false}) {
    if (_identifiedUserId == account.id) return;
    _identifiedUserId = account.id;
    final analytics = ref.read(analyticsProvider);
    final props = <String, Object>{
      if (account.email != null) 'email': account.email!,
      if (account.displayName != null) 'name': account.displayName!,
      if (account.provider != null) 'auth_provider': account.provider!.id,
    };
    analytics.identify(userId: account.id, userProperties: props);
    if (captureSignedIn) {
      analytics.capture('signed_in', {
        if (account.provider != null) 'provider': account.provider!.id,
      });
    }
  }

  void _listenEntitlementSuperProps() {
    ref.listen<Entitlement>(entitlementProvider, (previous, next) {
      if (_lastIsPro == next.isPro &&
          previous?.productIdentifier == next.productIdentifier &&
          previous?.isInTrial == next.isInTrial &&
          previous?.expiresAt == next.expiresAt) {
        return;
      }
      _applyEntitlement(next);
    });
  }

  void _applyEntitlement(Entitlement next) {
    _lastIsPro = next.isPro;
    final analytics = ref.read(analyticsProvider);
    analytics.register('is_pro', next.isPro);
    if (_identifiedUserId != null) {
      final person = <String, Object>{
        'is_pro': next.isPro,
        'is_trial': next.isInTrial,
        if (next.productIdentifier != null)
          'subscription_product': next.productIdentifier!,
        if (next.purchasedFrom != null)
          'subscription_store': next.purchasedFrom!,
        if (next.expiresAt != null)
          'expires_at': next.expiresAt!.toUtc().toIso8601String(),
      };
      analytics.identify(userId: _identifiedUserId!, userProperties: person);
    }
  }

  Future<void> _reregisterSurvivingSuperProps() async {
    final analytics = ref.read(analyticsProvider);
    await analytics.register('app_env', SupabaseConfig.environment);
    await analytics.register('is_pro', ref.read(isProProvider));
    // app_version was registered at setup; re-read from super props is harder —
    // leave it unset until next cold start if reset cleared it. Prefer re-register
    // from PackageInfo when cheap.
    try {
      final info = await ref.read(appUpdateRepositoryProvider).packageInfo();
      await analytics.register('app_version', info.version);
    } catch (_) {
      // Best-effort; not worth failing the sign-out path.
    }
  }
}
