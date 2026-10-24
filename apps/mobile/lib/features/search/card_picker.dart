import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/card_filter_bar.dart';
import '../../app/widgets.dart';
import '../../core/data/card_repository.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';

/// A search screen that returns the picked [CardModel] via Navigator.pop.
///
/// Pass [onPick] (via [showMulti]) to keep the screen open after each add so
/// several cards can be picked in one visit.
class CardPickerScreen extends ConsumerStatefulWidget {
  const CardPickerScreen({super.key, this.title = 'Add a card', this.onPick});
  final String title;

  /// When set, each tap invokes this instead of popping. Return false to close
  /// the picker (e.g. free-tier cap); true to stay open for another add.
  final Future<bool> Function(CardModel card)? onPick;

  static Future<CardModel?> show(BuildContext context, {String? title}) {
    return Navigator.of(context).push<CardModel>(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Card Picker'),
        builder: (_) => CardPickerScreen(title: title ?? 'Add a card'),
      ),
    );
  }

  /// Opens the picker in multi-add mode: the screen stays open after each
  /// pick so several cards can be added in one visit. [onPick] returns false
  /// when the add was rejected (e.g. a free-tier cap), which closes the picker
  /// so the reason isn't buried behind it.
  static Future<void> showMulti(
    BuildContext context, {
    String? title,
    required Future<bool> Function(CardModel card) onPick,
  }) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Card Picker'),
        builder: (_) =>
            CardPickerScreen(title: title ?? 'Add a card', onPick: onPick),
      ),
    );
  }

  @override
  ConsumerState<CardPickerScreen> createState() => _CardPickerScreenState();
}

class _CardPickerScreenState extends ConsumerState<CardPickerScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  CardSort _sort = CardSort.nameAsc;
  bool _adding = false;
  int _addedCount = 0;
  final Set<String> _recentlyAdded = {};

  bool get _multi => widget.onPick != null;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {}); // refresh clear button
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () {
      setState(() => _query = value);
    });
  }

  void _clear() {
    _debounce?.cancel();
    _controller.clear();
    setState(() => _query = '');
  }

  Future<void> _onCardTap(CardModel card) async {
    final onPick = widget.onPick;
    if (onPick == null) {
      Navigator.of(context).pop(card);
      return;
    }
    if (_adding) return;
    setState(() => _adding = true);
    try {
      final ok = await onPick(card);
      if (!mounted) return;
      if (!ok) {
        Navigator.of(context).pop();
        return;
      }
      setState(() {
        _addedCount++;
        _recentlyAdded.add(card.id);
      });
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pricing = ref.watch(pricingProvider);
    final catalog = ref.watch(catalogProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (_multi) ...[
            if (_addedCount > 0)
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Text(
                    '$_addedCount added',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
              ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Done'),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: CardSearchBar(
              controller: _controller,
              hintText: 'Search cards…',
              autofocus: true,
              onChanged: _onChanged,
              onClear: _clear,
              sort: _sort,
              onSort: (s) => setState(() => _sort = s),
            ),
          ),
          Expanded(
            child: catalog.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator.adaptive()),
              error: (e, _) => Center(child: Text('Could not load cards.\n$e')),
              data: (all) {
                final cards = filterCards(
                  all,
                  CardFilters(query: _query, sort: _sort),
                );
                if (cards.isEmpty) {
                  return const Center(child: Text('No cards found.'));
                }
                return ListView.separated(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  itemCount: cards.length,
                  separatorBuilder: (_, _) =>
                      const Divider(height: 1, indent: 72),
                  itemBuilder: (context, i) {
                    final card = cards[i];
                    final added = _recentlyAdded.contains(card.id);
                    return CardRow(
                      card: card,
                      priceLabel: pricing.priceLabel(card),
                      secondaryLabel: pricing.lowPriceLabel(card),
                      trailing: added
                          ? Icon(Icons.check_circle, color: scheme.primary)
                          : const Icon(Icons.add_circle),
                      onTap: () => _onCardTap(card),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
