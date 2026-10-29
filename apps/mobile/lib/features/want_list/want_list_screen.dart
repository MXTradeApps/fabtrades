import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/printing_picker.dart';
import '../../core/data/card_repository.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../card_detail/card_detail_screen.dart';
import '../onboarding/onboarding_keys.dart';
import '../onboarding/showcase_theme.dart';
import '../onboarding/tour_copy.dart';
import '../paywall/pro_limits.dart';
import '../search/card_picker.dart';
import '../sync/binder_refresh.dart';

/// Show-mode collage of Want List cards — embedded as the Want List tab inside
/// [BinderScreen], or usable standalone with its own scaffold.
class WantListPane extends ConsumerStatefulWidget {
  const WantListPane({super.key, this.onAdd, this.showFab = false});

  /// Called when the empty-state add button is pressed. Defaults to the
  /// card picker + binder want-list add if null.
  final VoidCallback? onAdd;

  /// When true, shows its own FAB (standalone use). Binder hosts its own FAB.
  final bool showFab;

  @override
  ConsumerState<WantListPane> createState() => _WantListPaneState();
}

class _WantListPaneState extends ConsumerState<WantListPane> {
  bool _editing = false;

  @override
  Widget build(BuildContext context) {
    final wanted =
        ref.watch(binderProvider).where((e) => e.isWanted).toList();

    final body = wanted.isEmpty
        ? ShowcaseTheme.mark(
            key: OnboardingKeys.wantListPane,
            title: TourCopy.wantListTitle,
            description: TourCopy.wantListBody,
            child: RefreshIndicator(
              onRefresh: () => refreshBinderSync(context, ref),
              child: _ScrollableCenter(
                child: _EmptyState(
                  onAdd: widget.onAdd ?? () => _defaultAdd(context),
                ),
              ),
            ),
          )
        : ShowcaseTheme.mark(
            key: OnboardingKeys.wantListPane,
            title: TourCopy.wantListTitle,
            description: TourCopy.wantListBody,
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: ShowcaseTheme.mark(
                    key: OnboardingKeys.wantListEdit,
                    title: TourCopy.wantListEditTitle,
                    description: TourCopy.wantListEditBody,
                    child: IconButton(
                      icon: Icon(_editing ? Icons.done : Icons.edit_outlined),
                      tooltip: _editing ? 'Done' : 'Edit',
                      onPressed: () => setState(() => _editing = !_editing),
                    ),
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => refreshBinderSync(context, ref),
                    child: _WantGrid(
                      entries: wanted,
                      editing: _editing,
                      // Only the Binder host shows the selection action bar.
                      selectable: !widget.showFab,
                    ),
                  ),
                ),
              ],
            ),
          );

    if (!widget.showFab) return body;

    return Scaffold(
      appBar: AppBar(title: const Text('Want List')),
      body: body,
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'wantListFab',
        onPressed: widget.onAdd ?? () => _defaultAdd(context),
        icon: const Icon(Icons.add),
        label: const Text('Add card'),
      ),
    );
  }

  Future<void> _defaultAdd(BuildContext context) async {
    await CardPickerScreen.showMulti(
      context,
      title: 'Add to Want List',
      onPick: (card) => addToBinderOrUpsell(
        context,
        ref,
        card,
        isWanted: true,
        successMessage: 'Added ${card.name} to Want List',
        source: 'search',
      ),
    );
  }
}

class _WantGrid extends ConsumerWidget {
  const _WantGrid({
    required this.entries,
    required this.editing,
    required this.selectable,
  });

  final List<BinderEntry> entries;
  final bool editing;
  final bool selectable;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GridView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        // Standard trading-card aspect ratio (approx. 63mm x 88mm).
        childAspectRatio: 0.716,
      ),
      itemCount: entries.length,
      itemBuilder: (context, i) => _WantCard(
        entry: entries[i],
        editing: editing,
        selectable: selectable,
        onRemove: () => ref
            .read(binderProvider.notifier)
            .remove(entries[i].card.id, true),
      ),
    );
  }
}

/// Always-scrollable wrapper so pull-to-refresh works on the empty want list.
class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _WantCard extends ConsumerWidget {
  const _WantCard({
    required this.entry,
    required this.editing,
    required this.selectable,
    required this.onRemove,
  });

  final BinderEntry entry;
  final bool editing;
  final bool selectable;
  final VoidCallback onRemove;

  void _toggle(WidgetRef ref) =>
      ref.read(binderSelectionProvider.notifier).toggle(binderRowKey(entry));

  Future<void> _pickVersion(BuildContext context, WidgetRef ref) async {
    final card = entry.card;
    final catalog = ref.read(catalogProvider).asData?.value ?? const [];
    final printings = printingsForCard(catalog, card);
    final picked = await showPrintingPicker(
      context: context,
      current: card,
      printings: printings,
    );
    if (picked == null) return;
    ref.read(binderProvider.notifier).replaceCard(card.id, true, picked);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final card = entry.card;
    final version = card.setVersionLabel;
    final selection =
        selectable ? ref.watch(binderSelectionProvider) : const <String>{};
    // Same as the Binder list: long-press starts selecting, then taps toggle.
    final selecting = selection.isNotEmpty;
    final selected = selection.contains(binderRowKey(entry));

    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            key: Key('wantCard-${card.id}'),
            onTap: selecting
                ? () => _toggle(ref)
                : editing
                    ? () => _pickVersion(context, ref)
                    : () => Navigator.of(context).push(MaterialPageRoute(
                          settings: const RouteSettings(name: 'Card Detail'),
                          builder: (_) => CardDetailScreen(
                              card: card, source: 'want_list'),
                        )),
            onLongPress:
                selectable && !selecting && !editing ? () => _toggle(ref) : null,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: selected
                    ? Border.all(color: scheme.primary, width: 3)
                    : card.isFoil
                        ? Border.all(color: const Color(0xFFB794F6), width: 2)
                        : Border.all(color: scheme.outlineVariant, width: 0.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.16),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: _CardImage(card: card),
              ),
            ),
          ),
        ),
        if (entry.quantity > 1)
          Positioned(
            left: 8,
            top: 8,
            child: _Badge(
              color: scheme.primary,
              child: Text('x${entry.quantity}',
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 13)),
            ),
          ),
        if (version != null)
          Positioned(
            left: 6,
            right: 6,
            bottom: 6,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.62),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Text(
                  version,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
                ),
              ),
            ),
          ),
        if (selecting)
          Positioned(
            right: 6,
            top: 6,
            child: IgnorePointer(
              child: _Badge(
                color: selected ? scheme.primary : Colors.black54,
                padding: const EdgeInsets.all(5),
                child: Icon(
                  selected ? Icons.check : Icons.circle_outlined,
                  color: Colors.white,
                  size: 18,
                ),
              ),
            ),
          )
        else if (editing)
          Positioned(
            right: 6,
            top: 6,
            child: GestureDetector(
              onTap: onRemove,
              child: const _Badge(
                color: Color(0xFFD0554E),
                padding: EdgeInsets.all(5),
                child: Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ),
      ],
    );
  }
}

class _CardImage extends StatelessWidget {
  const _CardImage({required this.card});
  final CardModel card;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final url = card.imageUrl;
    if (url == null || url.isEmpty) {
      return Container(
        color: scheme.surfaceContainerHighest,
        alignment: Alignment.center,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.image_not_supported_outlined,
                  size: 40, color: scheme.outline),
              const SizedBox(height: 8),
              Text(card.name,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, _) => Container(color: scheme.surfaceContainerHighest),
      errorWidget: (_, _, _) => Container(
        color: scheme.surfaceContainerHighest,
        child: Icon(Icons.broken_image_outlined, color: scheme.outline),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.color,
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
  });
  final Color color;
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        shape: padding.horizontal == padding.vertical
            ? BoxShape.circle
            : BoxShape.rectangle,
        borderRadius:
            padding.horizontal == padding.vertical ? null : BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.favorite_border, size: 56, color: scheme.outline),
            const SizedBox(height: 16),
            Text('Your want list is empty',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Add the cards you\'re hunting for, then hand your phone to '
              'another player so they can scroll through and check their binder.',
              textAlign: TextAlign.center,
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add),
              label: const Text('Add a card'),
            ),
          ],
        ),
      ),
    );
  }
}
