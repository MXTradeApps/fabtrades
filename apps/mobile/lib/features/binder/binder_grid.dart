import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/logic/binder_cover.dart';
import '../../core/logic/binder_value_snapshot.dart';
import '../../core/logic/pricing.dart';
import '../../core/models/binder.dart';
import '../../core/models/binder_entry.dart';
import '../../core/providers.dart';

/// Owned rows in one Binder, or Want List rows for the Want List tile.
List<BinderEntry> ownedInBinder(
  Iterable<BinderEntry> entries,
  String binderId,
) {
  if (binderId == BinderIds.want) {
    return entries
        .where((e) => e.isWanted && e.quantity > 0)
        .toList(growable: false);
  }
  return entries
      .where(
        (e) => !e.isWanted && e.resolvedBinderId == binderId && e.quantity > 0,
      )
      .toList(growable: false);
}

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

/// Grid of live Binders, including the undeletable Want List tile.
class BinderGrid extends ConsumerWidget {
  const BinderGrid({
    super.key,
    this.onOpen,
    this.onCreate,
    this.onRename,
    this.onDelete,
    this.onClear,
    this.onSettings,
  });

  final ValueChanged<String>? onOpen;
  final VoidCallback? onCreate;
  final ValueChanged<String>? onRename;
  final ValueChanged<String>? onDelete;
  final ValueChanged<String>? onClear;
  final ValueChanged<String>? onSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final binders = Binder.gridOrder(ref.watch(bindersProvider));
    final entries = ref.watch(binderProvider);
    final pricing = ref.watch(pricingProvider);

    return CustomScrollView(
      key: const Key('binderGrid'),
      scrollCacheExtent: const ScrollCacheExtent.pixels(1200),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.86,
            ),
            delegate: SliverChildBuilderDelegate((context, i) {
              final binder = binders[i];
              return BinderTile(
                binder: binder,
                entries: entries,
                pricing: pricing,
                onOpen: () => onOpen?.call(binder.clientId),
                onRename: onRename == null
                    ? null
                    : () => onRename!(binder.clientId),
                onDelete: binder.isProtected || onDelete == null
                    ? null
                    : () => onDelete!(binder.clientId),
                onClear: onClear == null
                    ? null
                    : () => onClear!(binder.clientId),
                onSettings: onSettings == null
                    ? null
                    : () => onSettings!(binder.clientId),
              );
            }, childCount: binders.length),
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
    this.onClear,
    this.onSettings,
  });

  final Binder binder;
  final List<BinderEntry> entries;
  final Pricing pricing;
  final VoidCallback? onOpen;
  final VoidCallback? onRename;
  final VoidCallback? onDelete;
  final VoidCallback? onClear;
  final VoidCallback? onSettings;

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
    String? fallbackUrl;
    if (cover.printingId != null) {
      for (final e in rows) {
        if (e.card.id == cover.printingId) {
          imageUrl = e.card.largeImageUrl ?? e.card.imageUrl;
          fallbackUrl = e.card.artViewerFallbackUrl;
          break;
        }
      }
    }

    final t = context.tokens;
    final isWant = id == BinderIds.want;
    return Card(
      key: Key('binderTile-$id'),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        onLongPress: onRename,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: t.sunken,
                  border: Border(bottom: BorderSide(color: t.border)),
                ),
                child: cover.printingId == null
                    ? Center(
                        child: Icon(
                          isWant
                              ? Icons.bookmark_border_rounded
                              : Icons.collections_bookmark_outlined,
                          size: 30,
                          color: t.textFaint,
                        ),
                      )
                    : Center(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: CardThumbnail(
                            key: Key('binderTileCover-$id'),
                            url: imageUrl,
                            fallbackUrl: fallbackUrl,
                            width: 76,
                            height: 106,
                          ),
                        ),
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 4, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          binder.name,
                          key: Key('binderTileName-$id'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall,
                        ),
                      ),
                      if (onRename != null ||
                          onDelete != null ||
                          onClear != null ||
                          onSettings != null)
                        PopupMenuButton<String>(
                          key: Key('binderTileMenu-$id'),
                          onSelected: (action) {
                            if (action == 'settings') onSettings?.call();
                            if (action == 'rename') onRename?.call();
                            if (action == 'clear') onClear?.call();
                            if (action == 'delete') onDelete?.call();
                          },
                          itemBuilder: (_) => [
                            if (onSettings != null)
                              PopupMenuItem(
                                value: 'settings',
                                child: Text(
                                  'Settings',
                                  key: Key('binderTileSettings-$id'),
                                ),
                              ),
                            if (onRename != null)
                              const PopupMenuItem(
                                value: 'rename',
                                child: Text('Rename'),
                              ),
                            if (onClear != null && copies > 0)
                              PopupMenuItem(
                                value: 'clear',
                                child: Text(
                                  'Clear',
                                  key: Key('clearBinder-$id'),
                                ),
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
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '$copies',
                          key: Key('binderTileCount-$id'),
                          style: AppType.tabular(
                            theme.textTheme.bodySmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        Text(
                          copies == 1 ? ' card' : ' cards',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Text(
                              value,
                              key: Key('binderTileValue-$id'),
                              style: AppType.tabular(theme.textTheme.titleSmall),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
