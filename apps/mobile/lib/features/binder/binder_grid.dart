import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/widgets.dart';
import '../../core/logic/binder_cover.dart';
import '../../core/logic/binder_value_snapshot.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/binder.dart';
import '../../core/models/binder_entry.dart';
import '../../core/providers.dart';

/// Owned rows in one Binder (Want List excluded).
List<BinderEntry> ownedInBinder(
  Iterable<BinderEntry> entries,
  String binderId,
) =>
    entries
        .where((e) =>
            !e.isWanted && e.resolvedBinderId == binderId && e.quantity > 0)
        .toList(growable: false);

int binderCopyCount(Iterable<BinderEntry> entries, String binderId) =>
    ownedInBinder(entries, binderId).fold<int>(0, (s, e) => s + e.quantity);

/// Tile value: empty is a true zero; non-empty unpriced is `—`, never `$0.00`.
String binderTileValueLabel(
  Iterable<BinderEntry> entries,
  String binderId,
  Pricing pricing,
) {
  final rows = ownedInBinder(entries, binderId);
  if (rows.isEmpty) return pricing.formatValue(0);
  double? amount;
  for (final e in rows) {
    final v = pricing.value(e.card);
    if (isPricedField(v)) {
      amount = (amount ?? 0) + v! * e.quantity;
    }
  }
  if (amount == null) return '—';
  return pricing.formatValue(amount);
}

/// Grid of live Binders. Want List is not a tile.
class BinderGrid extends ConsumerWidget {
  const BinderGrid({
    super.key,
    this.onOpen,
    this.onCreate,
    this.onRename,
    this.onDelete,
  });

  final ValueChanged<String>? onOpen;
  final VoidCallback? onCreate;
  final ValueChanged<String>? onRename;
  final ValueChanged<String>? onDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final binders = Binder.gridOrder(ref.watch(bindersProvider));
    final entries = ref.watch(binderProvider);
    final pricing = ref.watch(pricingProvider);

    return CustomScrollView(
      key: const Key('binderGrid'),
      cacheExtent: 1200,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.92,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final binder = binders[i];
                return BinderTile(
                  binder: binder,
                  entries: entries,
                  pricing: pricing,
                  onOpen: () => onOpen?.call(binder.clientId),
                  onRename: onRename == null
                      ? null
                      : () => onRename!(binder.clientId),
                  onDelete: binder.isTrade || onDelete == null
                      ? null
                      : () => onDelete!(binder.clientId),
                );
              },
              childCount: binders.length,
            ),
          ),
        ),
      ],
    );
  }
}

class BinderTile extends StatelessWidget {
  const BinderTile({
    super.key,
    required this.binder,
    required this.entries,
    required this.pricing,
    this.onOpen,
    this.onRename,
    this.onDelete,
  });

  final Binder binder;
  final List<BinderEntry> entries;
  final Pricing pricing;
  final VoidCallback? onOpen;
  final VoidCallback? onRename;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final id = binder.clientId;
    final rows = ownedInBinder(entries, id);
    final copies = binderCopyCount(entries, id);
    final value = binderTileValueLabel(entries, id, pricing);
    final cover = pickBinderCover([
      for (final e in rows) BinderValueRow.fromBinderEntry(e),
    ]);
    String? imageUrl;
    if (cover.printingId != null) {
      for (final e in rows) {
        if (e.card.id == cover.printingId) {
          imageUrl = e.card.imageUrl;
          break;
        }
      }
    }

    return Card(
      key: Key('binderTile-$id'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        onLongPress: onRename,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: cover.printingId == null
                    ? const SizedBox.expand()
                    : Center(
                        child: CardThumbnail(
                          key: Key('binderTileCover-$id'),
                          url: imageUrl,
                          width: 72,
                          height: 100,
                        ),
                      ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      binder.name,
                      key: Key('binderTileName-$id'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  if (onRename != null || onDelete != null)
                    PopupMenuButton<String>(
                      key: Key('binderTileMenu-$id'),
                      onSelected: (action) {
                        if (action == 'rename') onRename?.call();
                        if (action == 'delete') onDelete?.call();
                      },
                      itemBuilder: (_) => [
                        if (onRename != null)
                          const PopupMenuItem(
                            value: 'rename',
                            child: Text('Rename'),
                          ),
                        if (onDelete != null)
                          PopupMenuItem(
                            value: 'delete',
                            child: Text(
                              'Delete',
                              key: Key('deleteBinder-$id'),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                '$copies',
                key: Key('binderTileCount-$id'),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: scheme.onSurfaceVariant),
              ),
              Text(
                value,
                key: Key('binderTileValue-$id'),
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
