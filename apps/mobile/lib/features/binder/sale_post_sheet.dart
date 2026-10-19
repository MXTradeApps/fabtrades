import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/analytics/analytics.dart';
import '../../core/logic/sale_post.dart';
import '../../core/models/binder_entry.dart';
import '../../core/providers.dart';
import '../auth/sign_in_sheet.dart';

/// Opens the "Post for sale" sheet for [entries].
///
/// [canLink] offers a link to the shared Binder page, which only ever shows the
/// Trade Binder. [source] says where it was opened from, for analytics.
Future<void> showSalePostSheet(
  BuildContext context,
  WidgetRef ref, {
  required List<BinderEntry> entries,
  required bool canLink,
  required String source,
}) {
  final cards = entries.fold<int>(0, (sum, e) => sum + e.quantity);
  ref
      .read(analyticsProvider)
      .capture('sale_post_opened', {'source': source, 'cards': cards});
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    routeSettings: const RouteSettings(name: 'Post For Sale'),
    builder: (_) => SalePostSheet(
      entries: entries,
      canLink: canLink,
      source: source,
    ),
  );
}

class SalePostSheet extends ConsumerStatefulWidget {
  const SalePostSheet({
    super.key,
    required this.entries,
    required this.canLink,
    required this.source,
  });

  final List<BinderEntry> entries;
  final bool canLink;
  final String source;

  @override
  ConsumerState<SalePostSheet> createState() => _SalePostSheetState();
}

class _SalePostSheetState extends ConsumerState<SalePostSheet> {
  SalePlatform _platform = SalePlatform.discord;
  int _percent = 100;
  String _link = '';
  bool _linkLoading = false;
  String? _linkError;
  final Set<int> _copied = {};

  int get _cards => widget.entries.fold<int>(0, (sum, e) => sum + e.quantity);

  List<String> _messages() {
    final pricing = ref.read(pricingProvider);
    return buildSalePost(
      platform: _platform,
      items: [
        for (final e in widget.entries)
          SaleItem(
            name: e.card.name,
            finish: e.card.subTypeName ?? (e.card.isFoil ? 'Foil' : null),
            condition: e.condition,
            quantity: e.quantity,
            price: pricing.value(e.card),
          ),
      ],
      percent: _percent,
      symbol: pricing.symbol,
      sourceLabel: pricing.sourceLabel,
      pricedOn: DateFormat('MMM d, yyyy', 'en_US').format(DateTime.now()),
      link: _link,
    );
  }

  void _update(VoidCallback change) => setState(() {
        change();
        _copied.clear();
      });

  Future<void> _toggleLink(bool on) async {
    if (!on) {
      _update(() => _link = '');
      return;
    }
    if (!ref.read(isSignedInProvider)) {
      final signedIn = await presentSignIn(
        context,
        source: 'sale_post',
        copy: SignInCopy.shareBinder,
      );
      if (!signedIn || !mounted) return;
    }
    setState(() {
      _linkLoading = true;
      _linkError = null;
    });
    try {
      final share =
          await ref.read(binderShareRepositoryProvider).ensureEnabledShare();
      if (!mounted) return;
      _update(() => _link = share.url);
    } catch (_) {
      if (!mounted) return;
      setState(() => _linkError = 'Could not get a link. Try again.');
    } finally {
      if (mounted) setState(() => _linkLoading = false);
    }
  }

  Future<void> _copy(List<String> messages, int index) async {
    await Clipboard.setData(ClipboardData(text: messages[index]));
    ref.read(analyticsProvider).capture('sale_post_copied', {
      'platform': _platform.name,
      'percent': _percent,
      'cards': _cards,
      'part': index + 1,
      'parts': messages.length,
      'with_link': _link.isNotEmpty,
      'source': widget.source,
    });
    if (mounted) setState(() => _copied.add(index));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final messages = _messages();
    final split = messages.length > 1;

    return SingleChildScrollView(
      key: const Key('salePostSheet'),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Post for sale', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            '${_cards == 1 ? '1 card' : '$_cards cards'}, priced and '
            'formatted to paste into a selling channel or group.',
            style: theme.textTheme.bodyMedium?.copyWith(color: t.textMuted),
          ),
          const SizedBox(height: AppSpacing.md),
          SegmentedButton<SalePlatform>(
            key: const Key('salePostPlatform'),
            segments: const [
              ButtonSegment(
                value: SalePlatform.discord,
                label: Text('Discord'),
              ),
              ButtonSegment(
                value: SalePlatform.facebook,
                label: Text('Facebook'),
              ),
            ],
            selected: {_platform},
            onSelectionChanged: (s) => _update(() => _platform = s.first),
          ),
          const SizedBox(height: AppSpacing.md),
          Text('Asking price', style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final p in salePostPercents)
                ChoiceChip(
                  key: Key('salePostPercent-$p'),
                  label: Text(p == 100 ? 'Market' : '$p%'),
                  selected: _percent == p,
                  onSelected: (_) => _update(() => _percent = p),
                ),
            ],
          ),
          if (widget.canLink) ...[
            const SizedBox(height: AppSpacing.xs),
            SwitchListTile(
              key: const Key('salePostLink'),
              contentPadding: EdgeInsets.zero,
              title: const Text('Add a link to my Binder'),
              subtitle: Text(
                _linkError ??
                    'Buyers can see every card and price on fabtrades.net',
              ),
              value: _link.isNotEmpty,
              onChanged: _linkLoading ? null : _toggleLink,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          if (split)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Text(
                'Discord allows 2,000 characters per message, so this post '
                'is split into ${messages.length} parts. Paste them in order.',
                style:
                    theme.textTheme.bodySmall?.copyWith(color: t.textMuted),
              ),
            ),
          for (var i = 0; i < messages.length; i++) ...[
            Container(
              key: Key('salePostPreview-$i'),
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: t.sunken,
                borderRadius: AppRadii.mdAll,
                border: Border.all(color: t.border),
              ),
              child: SelectableText(
                messages[i],
                style: theme.textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            FilledButton.icon(
              key: Key('salePostCopy-$i'),
              onPressed: () => _copy(messages, i),
              icon: Icon(_copied.contains(i) ? Icons.check : Icons.copy),
              label: Text(_copyLabel(i, messages.length)),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }

  String _copyLabel(int i, int parts) {
    final done = _copied.contains(i);
    if (parts == 1) return done ? 'Copied' : 'Copy post';
    return done ? 'Copied part ${i + 1}' : 'Copy part ${i + 1} of $parts';
  }
}
