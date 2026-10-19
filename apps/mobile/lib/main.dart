import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/app.dart';
import 'core/config/posthog_config.dart';
import 'core/config/supabase_config.dart';
import 'core/data/purchases_repository.dart';
import 'core/notifications/push_service.dart';
import 'core/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    SupabaseConfig.assertConfigured();
    await Supabase.initialize(
      url: SupabaseConfig.url,
      publishableKey: SupabaseConfig.publishableKey,
    );
    final prefs = await SharedPreferences.getInstance();

    // RevenueCat must be configured before any entitlement is read. This never
    // throws: a build without a usable API key just runs without subscriptions.
    final purchases = PurchasesRepository();
    await purchases.configure();

    await _setupPostHog();

    // Push for price alerts. Never throws; without Firebase keys push is off.
    await PushService.initialize();

    runApp(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          purchasesRepositoryProvider.overrideWithValue(purchases),
        ],
        child: const FabTradesApp(),
      ),
    );
  } catch (error, stack) {
    // Errors thrown before runApp leave a blank FlutterView (white screen) when
    // launched from Xcode. Surface them so a missing --dart-define is obvious.
    // PostHog may not be initialized here — skip exception capture.
    runApp(_BootstrapErrorApp(error: error, stack: stack));
  }
}

/// Initializes PostHog when configured. Never throws — a missing key or SDK
/// failure leaves analytics off without blocking app start.
Future<void> _setupPostHog() async {
  if (!PostHogEnv.isConfigured) return;
  try {
    final config = PostHogConfig(PostHogEnv.apiKey);
    config.host = PostHogEnv.host;
    config.debug = kDebugMode;
    config.personProfiles = PostHogPersonProfiles.identifiedOnly;
    await Posthog().setup(config);
    await Posthog().register('app_env', SupabaseConfig.environment);
    try {
      final info = await PackageInfo.fromPlatform();
      await Posthog().register('app_version', info.version);
    } catch (e) {
      debugPrint('PostHog app_version register failed: $e');
    }
  } catch (e, s) {
    debugPrint('PostHog setup failed: $e\n$s');
  }
}

class _BootstrapErrorApp extends StatelessWidget {
  const _BootstrapErrorApp({required this.error, required this.stack});

  final Object error;
  final StackTrace stack;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: SelectableText(
              'FAB Trades failed to start.\n\n$error\n\n$stack',
              style: const TextStyle(
                fontFamily: 'Courier',
                fontSize: 13,
                color: Color(0xFFB71C1C),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
