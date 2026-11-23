import 'package:material_ui/material_ui.dart';

import '../core/models/card_model.dart';
import 'theme.dart';
import 'widgets.dart';

/// One printing the user can pick: art, name, set / number / finish, price.
/// The mobile counterpart of `CandidateOption` in the web card import
/// (`apps/web/src/components/binder/CardImportDialog.jsx`).
class CandidateOptionTile extends StatelessWidget {
  const CandidateOptionTile({
    super.key,
    required this.card,
    required this.priceLabel,
    required this.selected,
    required this.onSelect,
  });

  final CardModel card;
  final String priceLabel;
  final bool selected;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final detail = [
      card.setVersionLabel ?? card.setName,
      card.collectorNumber,
      card.finishLabel,
    ].where((s) => s != null && s.trim().isNotEmpty).join(' · ');
    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onSelect,
        borderRadius: AppRadii.mdAll,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: selected ? t.selected : null,
            borderRadius: AppRadii.mdAll,
            border: Border.all(
              color: selected ? theme.colorScheme.primary : t.border,
              width: 2,
            ),
          ),
          child: Row(
            children: [
              CardThumbnail(
                url: card.imageUrl,
                width: 44,
                height: 62,
                radius: 4,
                foil: card.isFoil,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                    Text(
                      detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: t.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                priceLabel,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One thing the user has to decide in a [CandidateReview].
class CandidateReviewItem {
  const CandidateReviewItem({
    required this.key,
    required this.label,
    required this.reason,
    required this.candidates,
  });

  /// Stable id, used in [CandidateReview.picks] and widget keys.
  final String key;

  /// What is being matched, e.g. "2 × Sink Below" or the name read off a card.
  final String label;

  /// Plain reason it needs a decision, ending in what to do about it
  /// ("… Pick the one you have.").
  final String reason;
  final List<CardModel> candidates;
}

/// "Needs review": steps through uncertain matches one at a time. Each step
/// shows what was matched, why it needs a decision, and the candidate
/// printings as tappable tiles, with Previous / Skip this card / Next.
///
/// Mirrors the review step of the web card import so both read the same. It
/// holds no decisions itself: [picks] maps an item key to the chosen printing
/// id, or to null when the user skipped it; a key that is absent has not been
/// reviewed yet. What happens to skipped and unreviewed items is up to the
/// caller, which should say so on screen.
class CandidateReview extends StatefulWidget {
  const CandidateReview({
    super.key,
    required this.items,
    required this.picks,
    required this.priceLabel,
    required this.onPick,
    required this.onSkip,
    this.onSearch,
    this.maxListHeight = 320,
  });

  final List<CandidateReviewItem> items;
  final Map<String, String?> picks;
  final String Function(CardModel card) priceLabel;
  final void Function(CandidateReviewItem item, CardModel card) onPick;
  final void Function(CandidateReviewItem item) onSkip;

  /// When set, each step offers "None of these", for callers that can look
  /// the card up another way.
  final void Function(CandidateReviewItem item)? onSearch;
  final double maxListHeight;

  @override
  State<CandidateReview> createState() => _CandidateReviewState();
}

class _CandidateReviewState extends State<CandidateReview> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    if (items.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final t = context.tokens;
    final index = _index.clamp(0, items.length - 1);
    final current = items[index];
    final reviewed = items.where((i) => widget.picks.containsKey(i.key)).length;
    final skipped = widget.picks.containsKey(current.key) &&
        widget.picks[current.key] == null;

    return Column(
      key: const Key('candidateReview'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text('Needs review', style: theme.textTheme.titleMedium),
            ),
            Text(
              '$reviewed of ${items.length} reviewed',
              key: const Key('candidateReviewProgress'),
              style: theme.textTheme.bodySmall?.copyWith(color: t.textMuted),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: t.sunken,
            borderRadius: AppRadii.mdAll,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                current.label,
                key: const Key('candidateReviewRow'),
                style: theme.textTheme.titleSmall,
              ),
              Text(
                current.reason,
                style:
                    theme.textTheme.bodySmall?.copyWith(color: t.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: widget.maxListHeight),
          child: ListView.separated(
            // A new list per step, so each one starts scrolled to the top.
            key: Key('candidateReviewList-${current.key}'),
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            itemCount: current.candidates.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
            itemBuilder: (_, i) {
              final card = current.candidates[i];
              return CandidateOptionTile(
                key: Key('candidateOption-${card.id}'),
                card: card,
                priceLabel: widget.priceLabel(card),
                selected: widget.picks[current.key] == card.id,
                onSelect: () => widget.onPick(current, card),
              );
            },
          ),
        ),
        if (widget.onSearch != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              key: const Key('candidateReviewSearch'),
              onPressed: () => widget.onSearch!(current),
              icon: const Icon(Icons.search, size: 18),
              label: const Text('None of these'),
            ),
          ),
        // Wraps on a narrow phone or with large text instead of overflowing.
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          children: [
            TextButton(
              key: const Key('candidateReviewPrev'),
              onPressed:
                  index == 0 ? null : () => setState(() => _index = index - 1),
              child: const Text('Previous'),
            ),
            TextButton(
              key: const Key('candidateReviewSkip'),
              onPressed: () => widget.onSkip(current),
              child: Text(skipped ? 'Skipped' : 'Skip this card'),
            ),
            TextButton(
              key: const Key('candidateReviewNext'),
              onPressed: index >= items.length - 1
                  ? null
                  : () => setState(() => _index = index + 1),
              child: const Text('Next'),
            ),
          ],
        ),
      ],
    );
  }
}
