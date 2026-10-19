import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/analytics/analytics.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/card_model.dart';
import '../../core/models/price_alert.dart';
import '../../core/notifications/push_service.dart';
import '../../core/providers.dart';
import '../auth/sign_in_sheet.dart';
import 'push_host.dart';

/// Opens the "Price alert" sheet for [card], asking a signed-out user to sign
/// in first. [source] says where it was opened from, for analytics.
Future<void> showPriceAlertSheet(
  BuildContext context,
  WidgetRef ref, {
  required CardModel card,
  required String source,
}) async {
  ref.read(analyticsProvider).capture('price_alert_sheet_opened', {
    'card_id': card.id,
    'source': source,
    'signed_in': ref.read(accountProvider).value != null,
  });
  if (ref.read(accountProvider).value == null) {
    final signedIn = await presentSignIn(
      context,
      source: 'price_alert',
      copy: SignInCopy.priceAlerts,
    );
    if (!signedIn || !context.mounted) return;
  }
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    routeSettings: const RouteSettings(name: 'Price Alert'),
    builder: (_) => PriceAlertSheet(card: card),
  );
}

/// Suggested starting target: 20% away from [current] in [direction],
/// rounded to the cent.
double suggestedTarget(double current, PriceAlertDirection direction) {
  final factor = direction == PriceAlertDirection.above ? 1.2 : 0.8;
  return (current * factor * 100).roundToDouble() / 100;
}

/// Parses what the user typed as a price: `12`, `12.5`, `$12.50`, `12,50`.
double? parsePriceInput(String text) {
  final cleaned = text.trim().replaceAll(RegExp(r'[^\d.,]'), '');
  if (cleaned.isEmpty) return null;
  // A lone comma is a decimal comma (European keyboards); otherwise commas
  // are thousands separators.
  final normalized = cleaned.contains('.') || ','.allMatches(cleaned).length > 1
      ? cleaned.replaceAll(',', '')
      : cleaned.replaceAll(',', '.');
  final value = double.tryParse(normalized);
  if (value == null || value <= 0) return null;
  return (value * 100).roundToDouble() / 100;
}

class PriceAlertSheet extends ConsumerStatefulWidget {
  const PriceAlertSheet({super.key, required this.card});

  final CardModel card;

  @override
  ConsumerState<PriceAlertSheet> createState() => _PriceAlertSheetState();
}

class _PriceAlertSheetState extends ConsumerState<PriceAlertSheet> {
  var _direction = PriceAlertDirection.above;
  final _controller = TextEditingController();
  bool _edited = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prefill();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double? get _current => ref.read(pricingProvider).value(widget.card);

  void _prefill() {
    final current = _current;
    _controller.text = current == null
        ? ''
        : suggestedTarget(current, _direction).toStringAsFixed(2);
  }

  void _setDirection(PriceAlertDirection d) {
    setState(() {
      _direction = d;
      _error = null;
      if (!_edited) _prefill();
    });
  }

  String? _validate(double? target) {
    if (target == null) return 'Enter a price';
    final current = _current;
    if (current == null) return null;
    final pricing = ref.read(pricingProvider);
    if (_direction == PriceAlertDirection.above && target <= current) {
      return 'Pick a price above ${pricing.format(current)}';
    }
    if (_direction == PriceAlertDirection.below && target >= current) {
      return 'Pick a price below ${pricing.format(current)}';
    }
    return null;
  }

  Future<void> _save() async {
    final target = parsePriceInput(_controller.text);
    final error = _validate(target);
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    final pricing = ref.read(pricingProvider);
    try {
      await ref.read(priceAlertsProvider.notifier).create(
            card: widget.card,
            direction: _direction,
            source: ref.read(settingsProvider).source,
            targetPrice: target!,
            currentPrice: _current,
          );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString().contains('limit')
            ? 'You have too many alerts. Delete some under More first.'
            : 'Could not save the alert. Check your connection and try again.';
      });
      return;
    }
    // Asked here, right after the user said what they want to hear about,
    // rather than at launch when the prompt has no context.
    final pushOn = await registerForPush(ref, prompt: true);
    if (!mounted) return;
    Navigator.of(context).pop();
    final verb = _direction == PriceAlertDirection.above ? 'rises' : 'drops';
    messenger
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(
          pushOn || !PushService.isAvailable
              ? "We'll let you know when it $verb to ${pricing.format(target)}."
              : 'Alert saved. Turn on notifications in Settings to be told '
                  'when it hits; you can always check under More.',
        ),
        duration: const Duration(seconds: 4),
      ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final Pricing pricing = ref.watch(pricingProvider);
    final current = pricing.value(widget.card);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Price alert', style: theme.textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            widget.card.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(color: t.textMuted),
          ),
          const SizedBox(height: 4),
          Text(
            current == null
                ? 'No ${pricing.sourceLabel} price yet'
                : 'Now ${pricing.format(current)} on ${pricing.sourceLabel}',
            style: theme.textTheme.bodySmall?.copyWith(color: t.textFaint),
          ),
          const SizedBox(height: 16),
          SegmentedButton<PriceAlertDirection>(
            segments: const [
              ButtonSegment(
                value: PriceAlertDirection.above,
                icon: Icon(Icons.trending_up_rounded),
                label: Text('Rises to'),
              ),
              ButtonSegment(
                value: PriceAlertDirection.below,
                icon: Icon(Icons.trending_down_rounded),
                label: Text('Drops to'),
              ),
            ],
            selected: {_direction},
            onSelectionChanged: (s) => _setDirection(s.first),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: current == null,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[\d.,]')),
            ],
            decoration: InputDecoration(
              labelText: 'Target price',
              prefixText: '${pricing.symbol} ',
              errorText: _error,
            ),
            onChanged: (_) {
              _edited = true;
              if (_error != null) setState(() => _error = null);
            },
            onSubmitted: (_) => _save(),
          ),
          const SizedBox(height: 8),
          Text(
            'Prices update once a day. You get a notification when the '
            '${pricing.sourceLabel} price reaches your target.',
            style: theme.textTheme.bodySmall?.copyWith(color: t.textFaint),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.notifications_active_outlined),
            label: const Text('Set alert'),
          ),
        ],
      ),
    );
  }
}
