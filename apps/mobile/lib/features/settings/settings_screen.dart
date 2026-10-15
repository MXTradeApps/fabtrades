import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/theme.dart';
import '../../core/analytics/analytics.dart';
import '../../core/config/legal_urls.dart';
import '../../core/config/supabase_config.dart';
import '../../core/models/app_settings.dart';
import '../../core/providers.dart';
import '../onboarding/onboarding_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static Future<void> _openUrl(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't open that link.")),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SettingsSectionLabel('Price source'),
          const SizedBox(height: 8),
          SegmentedButton<PriceSource>(
            segments: const [
              ButtonSegment(
                value: PriceSource.tcgplayer,
                label: Text('TCGplayer'),
                icon: Icon(Icons.attach_money),
              ),
              ButtonSegment(
                value: PriceSource.cardmarket,
                label: Text('CardMarket'),
                icon: Icon(Icons.euro),
              ),
            ],
            selected: {settings.source},
            onSelectionChanged: (s) => notifier.setSource(s.first),
          ),
          const SizedBox(height: 8),
          Text(
            settings.source == PriceSource.tcgplayer
                ? 'Shows market as the main price and low as a smaller sub-price (USD).'
                : 'Shows trend as the main price and low as a smaller sub-price (EUR).',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 28),
          const SettingsSectionLabel('Appearance'),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: Icon(
              settings.themeMode == AppThemeMode.dark
                  ? Icons.dark_mode
                  : Icons.light_mode,
            ),
            title: const Text('Dark mode'),
            subtitle: Text(
              settings.themeMode == AppThemeMode.dark
                  ? 'Using the dark theme.'
                  : 'Using the light theme.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            value: settings.themeMode == AppThemeMode.dark,
            onChanged: (on) => notifier.setThemeMode(
              on ? AppThemeMode.dark : AppThemeMode.light,
            ),
          ),
          const SizedBox(height: 32),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: theme.colorScheme.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Prices refresh daily from the shared FAB Trades database. '
                      'Trade values use the market/trend price from the source selected here.',
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          const SettingsSectionLabel('Help'),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.school_outlined),
            title: const Text('Replay tutorial'),
            subtitle: Text(
              'Show the welcome tips and feature walkthroughs again.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            onTap: () async {
              ref.read(analyticsProvider).capture('tutorial_replayed');
              // Pop first so MaterialApp.home can swap to the carousel without
              // leaving Settings stranded on a disposed HomeShell.
              Navigator.of(context).popUntil((r) => r.isFirst);
              await ref.read(onboardingProvider.notifier).resetAll();
            },
          ),
          const SizedBox(height: 24),
          const SettingsSectionLabel('Legal'),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Privacy Policy'),
            trailing: const Icon(Icons.open_in_new, size: 18),
            onTap: () => _openUrl(context, LegalUrls.privacyPolicy),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.description_outlined),
            title: const Text('Terms of Use'),
            trailing: const Icon(Icons.open_in_new, size: 18),
            onTap: () => _openUrl(context, LegalUrls.termsOfUse),
          ),
          const SizedBox(height: 24),
          const SettingsSectionLabel('About'),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.phone_android_outlined),
            title: const Text('App version'),
            subtitle: Text(
              ref.watch(packageVersionLabelProvider).when(
                    data: (label) => label,
                    loading: () => '…',
                    error: (_, _) => 'Unknown',
                  ),
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
          // Only outside production. A tester who cannot tell which project a build
          // is pointed at will eventually report staging data as a production bug.
          if (!SupabaseConfig.isProduction)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.science_outlined,
                  color: theme.colorScheme.tertiary),
              title: const Text('Test build'),
              subtitle: Text(
                'Signed in to the ${SupabaseConfig.environment} database. '
                'Nothing here affects your real account.',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class SettingsSectionLabel extends StatelessWidget {
  const SettingsSectionLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
            letterSpacing: 0.8,
            fontWeight: FontWeight.w700,
            color: context.tokens.textMuted,
          ),
    );
  }
}
