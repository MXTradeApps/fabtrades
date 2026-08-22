import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/models/binder.dart';
import '../core/models/card_model.dart';
import '../core/models/trade.dart';
import '../core/providers.dart';
import '../features/paywall/pro_limits.dart';
import 'widgets.dart';

/// Bottom sheet offering the common "add this card to…" actions.
Future<void> showCardActions(
  BuildContext context,
  WidgetRef ref,
  CardModel card,
) async {
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    routeSettings: const RouteSettings(name: 'Card Actions'),
    builder: (ctx) {
      void done(String msg) {
        Navigator.of(ctx).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), duration: const Duration(seconds: 2)),
        );
      }

      void addToList({required bool isWanted}) {
        Navigator.of(ctx).pop();
        addToBinderOrUpsell(
          context,
          ref,
          card,
          isWanted: isWanted,
          binderId: isWanted
              ? null
              : (ref.read(openBinderIdProvider) ?? BinderIds.trade),
          successMessage: isWanted ? 'Added to Want List' : 'Added to Binder',
          source: 'card_detail',
        );
      }

      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  CardThumbnail(
                      url: card.imageUrl, foil: card.isFoil, width: 40, height: 56),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(card.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 16)),
                        CardMetaLine(card: card),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.add_circle_outline,
                  color: Color(0xFF2E9E6B)),
              title: const Text('Add to Have (trade)'),
              onTap: () {
                ref
                    .read(tradeDraftProvider.notifier)
                    .addCard(TradeSide.have, card, source: 'card_detail');
                done('Added to Have');
              },
            ),
            ListTile(
              leading: const Icon(Icons.add_circle_outline,
                  color: Color(0xFFB8863B)),
              title: const Text('Add to Want (trade)'),
              onTap: () {
                ref
                    .read(tradeDraftProvider.notifier)
                    .addCard(TradeSide.want, card, source: 'card_detail');
                done('Added to Want');
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.menu_book_outlined),
              title: const Text('Add to Binder'),
              // Close the sheet first: hitting a free-tier cap surfaces an
              // upgrade prompt, which shouldn't appear behind this sheet.
              onTap: () => addToList(isWanted: false),
            ),
            ListTile(
              leading: const Icon(Icons.favorite_border),
              title: const Text('Add to Want List'),
              onTap: () => addToList(isWanted: true),
            ),
          ],
        ),
      );
    },
  );
}
