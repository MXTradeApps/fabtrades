import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/analytics/analytics.dart';
import '../core/models/card_model.dart';
import 'widgets.dart';

typedef PricingLabel = String Function(CardModel card);

/// Concise label for a printing in a version picker: set/edition plus foil
/// finish when present (e.g. "Monarch First Edition · Rainbow Foil").
String printingPickerLabel(CardModel card) {
  final version = card.setVersionLabel;
  final foil = card.finishBadgeLabel;
  if (version != null && foil != null) return '$version · $foil';
  if (version != null) return version;
  if (foil != null) return foil;
  return card.finishLabel;
}

/// Bottom sheet to pick among available printings/versions of a card
/// (set editions, finishes, alt arts, …). Returns the chosen printing, or
/// null if dismissed without a change.
Future<CardModel?> showPrintingPicker({
  required BuildContext context,
  required CardModel current,
  required List<CardModel> printings,
  String title = 'Version',
  PricingLabel? priceLabel,
}) {
  return showModalBottomSheet<CardModel>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    routeSettings: const RouteSettings(name: 'Printing Picker'),
    builder: (ctx) {
      final theme = Theme.of(ctx);
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CardThumbnail(
                      url: current.imageUrl,
                      foil: current.isFoil,
                      width: 40,
                      height: 56),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(current.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        CardMetaLine(card: current),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(title, style: theme.textTheme.titleSmall),
              if (printings.length < 2)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No alternate versions for this card',
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant),
                  ),
                )
              else
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(ctx).height * 0.5,
                  ),
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final printing in printings)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: printing.finishBadgeLabel == null
                              ? Icon(Icons.style_outlined,
                                  color: theme.colorScheme.onSurfaceVariant)
                              : Icon(Icons.auto_awesome,
                                  color: FinishBadge.colorFor(printing)),
                          title: Text(printingPickerLabel(printing)),
                          subtitle: priceLabel == null
                              ? null
                              : Text(priceLabel(printing),
                                  style: theme.textTheme.bodySmall),
                          trailing: printing.id == current.id
                              ? Icon(Icons.check_circle,
                                  color: theme.colorScheme.primary)
                              : null,
                          onTap: printing.id == current.id
                              ? null
                              : () {
                                  ProviderScope.containerOf(ctx)
                                      .read(analyticsProvider)
                                      .capture('card_printing_switched',
                                          {'card_id': printing.id});
                                  Navigator.pop(ctx, printing);
                                },
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}
