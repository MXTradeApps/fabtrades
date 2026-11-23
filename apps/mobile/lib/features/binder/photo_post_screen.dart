import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/candidate_review.dart';
import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/analytics/analytics.dart';
import '../../core/data/card_repository.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/card_model.dart';
import '../../core/providers.dart';
import '../../core/scan/ocr_guide_filter.dart';
import '../../core/scan/photo_cards.dart';
import '../../core/scan/photo_text_reader.dart';
import '../search/card_picker.dart';
import 'sale_post_sheet.dart';

/// "Post from photo": asks for a photo of several cards, then opens the review
/// screen that turns the cards found in it into a sale post.
Future<void> startPhotoPost(BuildContext context, WidgetRef ref) async {
  final source = await showModalBottomSheet<PhotoSource>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    routeSettings: const RouteSettings(name: 'Post From Photo Source'),
    builder: (sheet) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(
          key: const Key('photoPostCamera'),
          leading: const Icon(Icons.photo_camera_outlined),
          title: const Text('Take a photo'),
          subtitle: const Text('Lay the cards flat with their names showing'),
          onTap: () => Navigator.of(sheet).pop(PhotoSource.camera),
        ),
        ListTile(
          key: const Key('photoPostGallery'),
          leading: const Icon(Icons.photo_library_outlined),
          title: const Text('Choose a photo'),
          onTap: () => Navigator.of(sheet).pop(PhotoSource.gallery),
        ),
        const SizedBox(height: AppSpacing.sm),
      ],
    ),
  );
  if (source == null || !context.mounted) return;
  ref
      .read(analyticsProvider)
      .capture('photo_post_started', {'source': source.name});

  String? path;
  try {
    path = await ref.read(photoPickerProvider)(source);
  } catch (e, stack) {
    ref.read(analyticsProvider).captureException(e, stack);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(source == PhotoSource.camera
          ? 'Could not open the camera.'
          : 'Could not open your photos.'),
    ));
    return;
  }
  if (path == null || !context.mounted) return;
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      settings: const RouteSettings(name: 'Post From Photo'),
      builder: (_) => PhotoPostScreen(imagePath: path!, source: source),
    ),
  );
}

/// One card found in the photo (or added by hand).
///
/// [card] is the printing that goes into the post; while it is null the row is
/// left out. A row with a [reason] goes through the "Needs review" step and
/// starts with no card. A row with neither is text that matched nothing.
class _Row {
  _Row({
    required this.id,
    required this.card,
    required this.candidates,
    this.reason,
    this.label = '',
    this.readText = '',
  }) : printings = candidates;

  final int id;
  CardModel? card;

  /// What the "Needs review" step offers for this row.
  final List<CardModel> candidates;

  /// Printings of the current [card], for the printing and finish pickers.
  List<CardModel> printings;
  final String? reason;
  final String label;

  /// What was read off the photo, shown on unrecognized rows.
  final String readText;
  String condition = 'NM';
  int quantity = 1;

  String get key => '$id';
  bool get needsReview => reason != null;
}

/// Wording follows the web card import's review step.
String? _reasonFor(PhotoCardNote note) => switch (note) {
      PhotoCardNote.none || PhotoCardNote.noMatch => null,
      PhotoCardNote.pickVersion =>
        'This card comes in more than one colour. Pick the one you have.',
      PhotoCardNote.ambiguousName =>
        'More than one card has a name like this. Pick the one you have.',
      PhotoCardNote.nameOutsideTitle =>
        'The name was hard to read. Pick the one you have.',
      PhotoCardNote.setCodeOnly =>
        'Only the card code could be read. Pick the one you have.',
    };

String _labelFor(PhotoCardDetection d) {
  final title = d.titleText.trim();
  if (title.isNotEmpty) return title;
  final name = d.suggested?.name;
  return name == null ? 'Card' : baseCardName(name);
}

/// Reads the cards in the photo at [imagePath] and lets the user correct every
/// one of them before the sale post is built.
class PhotoPostScreen extends ConsumerStatefulWidget {
  const PhotoPostScreen({
    super.key,
    required this.imagePath,
    this.source = PhotoSource.gallery,
  });

  final String imagePath;
  final PhotoSource source;

  @override
  ConsumerState<PhotoPostScreen> createState() => _PhotoPostScreenState();
}

class _PhotoPostScreenState extends ConsumerState<PhotoPostScreen> {
  bool _loading = true;
  bool _failed = false;
  final List<_Row> _rows = [];
  int _nextId = 0;

  /// "Needs review" decisions by row key: a printing id, or null when the row
  /// was skipped. A row that is not in here has not been reviewed.
  final Map<String, String?> _picks = {};
  int _found = 0;
  int _confident = 0;

  // What the user had to fix, reported with `photo_post_created` so the real
  // hit rate of recognition can be measured.
  int _replaced = 0;
  int _removed = 0;
  int _added = 0;
  int _printingChanged = 0;
  int _recognized = 0;

  @override
  void initState() {
    super.initState();
    _recognize();
  }

  Future<void> _recognize() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      await ref.read(catalogProvider.future);
      final lines =
          await ref.read(photoTextReaderProvider).read(widget.imagePath);
      if (!mounted) return;
      final result =
          recognizePhotoCards(lines, ref.read(photoCatalogIndexProvider));
      _debugDump(lines, result);
      final confident = result.count(PhotoCardConfidence.confident);
      final unsure = result.count(PhotoCardConfidence.unsure);
      final unrecognized = result.count(PhotoCardConfidence.unrecognized);
      ref.read(analyticsProvider).capture('photo_post_recognized', {
        'source': widget.source.name,
        'lines': result.lineCount,
        'cards': result.detections.length,
        'confident': confident,
        'unsure': unsure,
        'unrecognized': unrecognized,
      });
      setState(() {
        _recognized = confident + unsure;
        _found = result.detections.length;
        _confident = confident;
        _picks.clear();
        _rows
          ..clear()
          ..addAll([
            for (final d in result.detections)
              _Row(
                id: _nextId++,
                // Unsure cards start empty: the user picks, we do not guess.
                card: d.confidence == PhotoCardConfidence.confident
                    ? d.suggested
                    : null,
                candidates: d.candidates,
                reason: _reasonFor(d.note),
                label: _labelFor(d),
                readText: d.text,
              ),
          ]);
        _loading = false;
      });
    } catch (e, stack) {
      ref.read(analyticsProvider).captureException(e, stack);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  /// Debug builds log what was read and what it matched, in the style of the
  /// live scanner's `[DEBUG-scan]` lines. The `lines=` JSON can be saved under
  /// test/fixtures/photo_ocr/ and replayed by photo_cards_replay_test.dart.
  void _debugDump(List<OcrLine> lines, PhotoCardsResult result) {
    if (!kDebugMode) return;
    debugPrint('[DEBUG-photo] lines=${lines.length} '
        'cards=${result.detections.length} '
        'confident=${result.count(PhotoCardConfidence.confident)} '
        'unsure=${result.count(PhotoCardConfidence.unsure)} '
        'unrecognized=${result.count(PhotoCardConfidence.unrecognized)}');
    for (final d in result.detections) {
      debugPrint('[DEBUG-photo] card ${d.confidence.name}/${d.note.name} '
          'title="${d.titleText}" -> ${d.suggested?.name ?? '-'} '
          '(${d.candidates.length} printings)');
    }
    for (final l in lines) {
      debugPrint('[DEBUG-photo] line=${jsonEncode({
            'left': l.left.round(),
            'top': l.top.round(),
            'right': l.right.round(),
            'bottom': l.bottom.round(),
            'text': l.text,
          })}');
    }
  }

  List<CardModel> get _catalog =>
      ref.read(catalogProvider).asData?.value ?? const [];

  Future<void> _replace(_Row row) async {
    final picked = await CardPickerScreen.show(
      context,
      title: row.card == null ? 'Which card is this?' : 'Replace card',
    );
    if (picked == null || !mounted) return;
    setState(() {
      row.card = picked;
      row.printings = printingsForCard(_catalog, picked);
      if (row.needsReview) _picks[row.key] = picked.id;
      _replaced++;
    });
  }

  Future<void> _add() async {
    final picked =
        await CardPickerScreen.show(context, title: 'Add a missed card');
    if (picked == null || !mounted) return;
    setState(() {
      _rows.add(_Row(
        id: _nextId++,
        card: picked,
        candidates: printingsForCard(_catalog, picked),
      ));
      _added++;
    });
  }

  void _remove(_Row row) => setState(() {
        _rows.remove(row);
        _picks.remove(row.key);
        _removed++;
      });

  Future<void> _pickPrinting(_Row row) async {
    final pricing = ref.read(pricingProvider);
    final picked = await showModalBottomSheet<CardModel>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      routeSettings: const RouteSettings(name: 'Post From Photo Printing'),
      builder: (sheet) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (_, controller) => ListView.separated(
          key: const Key('photoPrintingList'),
          controller: controller,
          itemCount: row.printings.length,
          separatorBuilder: (_, _) => const Divider(height: 1, indent: 72),
          itemBuilder: (_, i) {
            final c = row.printings[i];
            return CardRow(
              key: Key('photoCandidate-${c.id}'),
              card: c,
              priceLabel: pricing.priceLabel(c),
              showOwnership: false,
              trailing: c.id == row.card?.id
                  ? Icon(Icons.check_circle,
                      color: Theme.of(sheet).colorScheme.primary)
                  : null,
              onTap: () => Navigator.of(sheet).pop(c),
            );
          },
        ),
      ),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (picked.id != row.card?.id) _printingChanged++;
      row.card = picked;
      if (row.needsReview) _picks[row.key] = picked.id;
    });
  }

  /// One entry per printing and condition, so two copies found in the photo
  /// make one "2x" line. Rows still waiting for a card are left out.
  List<BinderEntry> _entries() {
    final merged = <String, BinderEntry>{};
    final now = DateTime.now();
    for (final row in _rows) {
      final card = row.card;
      if (card == null) continue;
      final key = '${card.id}|${row.condition}';
      final existing = merged[key];
      merged[key] = existing == null
          ? BinderEntry(
              card: card,
              quantity: row.quantity,
              condition: row.condition,
              addedAt: now,
            )
          : existing.copyWith(quantity: existing.quantity + row.quantity);
    }
    return merged.values.toList();
  }

  Future<void> _createPost() async {
    final entries = _entries();
    if (entries.isEmpty) return;
    final review = _rows.where((r) => r.needsReview).toList();
    ref.read(analyticsProvider).capture('photo_post_created', {
      'source': widget.source.name,
      'cards': entries.fold<int>(0, (sum, e) => sum + e.quantity),
      'rows': entries.length,
      'recognized': _recognized,
      'review_picked': review.where((r) => r.card != null).length,
      'review_skipped':
          review.where((r) => r.card == null && _picks.containsKey(r.key)).length,
      'review_unreviewed':
          review.where((r) => !_picks.containsKey(r.key)).length,
      'left_unrecognized':
          _rows.where((r) => r.card == null && !r.needsReview).length,
      'replaced': _replaced,
      'removed': _removed,
      'added': _added,
      'printing_changed': _printingChanged,
    });
    // Not in a Binder, so there is no shared Binder page to link to.
    await showSalePostSheet(
      context,
      ref,
      entries: entries,
      canLink: false,
      source: 'photo',
    );
  }

  /// Says what "Create post" will not include, so nothing is dropped quietly.
  String _leftOutLabel(int unreviewed, int other) {
    String rows(int n, String kind) =>
        '$n $kind ${n == 1 ? 'row' : 'rows'}';
    final parts = [
      if (unreviewed > 0) rows(unreviewed, 'unreviewed'),
      if (other > 0) rows(other, 'skipped or unmatched'),
    ];
    return '${parts.join(' and ')} will be left out';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final t = context.tokens;
    final pricing = ref.watch(pricingProvider);
    final ready = _rows.where((r) => r.card != null).toList();
    final review = _rows.where((r) => r.needsReview).toList();
    final unmatched =
        _rows.where((r) => r.card == null && !r.needsReview).toList();
    final unreviewed =
        review.where((r) => !_picks.containsKey(r.key)).length;
    final leftOut = _rows.length - ready.length;

    Widget body;
    if (_loading) {
      body = const Center(
        key: Key('photoPostLoading'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator.adaptive(),
            SizedBox(height: AppSpacing.md),
            Text('Reading the cards in your photo…'),
          ],
        ),
      );
    } else if (_failed) {
      body = Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Could not read that photo.'),
            const SizedBox(height: AppSpacing.sm),
            FilledButton(onPressed: _recognize, child: const Text('Try again')),
          ],
        ),
      );
    } else {
      Widget heading(String text) => Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xs),
            child: Text(text, style: theme.textTheme.titleMedium),
          );
      final muted = theme.textTheme.bodyMedium?.copyWith(color: t.textMuted);
      body = ListView(
        key: const Key('photoPostList'),
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        children: [
          Padding(
            key: const Key('photoPostSummary'),
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_found == 0)
                  Text(
                    'No cards were found in that photo. Card names need to '
                    'be readable. You can still add cards by search.',
                    style: muted,
                  )
                else ...[
                  Text('Cards found: $_found'),
                  Text('Matched automatically: $_confident'),
                  Text('Needs review: ${_recognized - _confident}'),
                  Text("Couldn't match: ${_found - _recognized}"),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    'Cards are listed as Near Mint, non-foil. Finish cannot '
                    'be read from a photo, so change it where needed.',
                    style: muted,
                  ),
                ],
              ],
            ),
          ),
          if (review.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 0),
              child: CandidateReview(
                items: [
                  for (final row in review)
                    CandidateReviewItem(
                      key: row.key,
                      label: row.label,
                      reason: row.reason!,
                      candidates: row.candidates,
                    ),
                ],
                picks: _picks,
                priceLabel: pricing.priceLabel,
                onPick: (item, card) => setState(() {
                  final row = review.firstWhere((r) => r.key == item.key);
                  row.card = card;
                  row.printings = row.candidates;
                  _picks[row.key] = card.id;
                }),
                onSkip: (item) => setState(() {
                  final row = review.firstWhere((r) => r.key == item.key);
                  row.card = null;
                  _picks[row.key] = null;
                }),
                onSearch: (item) =>
                    _replace(review.firstWhere((r) => r.key == item.key)),
              ),
            ),
          if (ready.isNotEmpty) heading('In this post'),
          for (final row in ready) ...[
            _CardTile(
              row: row,
              priceLabel: pricing.priceLabel(row.card!),
              onPrinting: () => _pickPrinting(row),
              onReplace: () => _replace(row),
              onRemove: () => _remove(row),
              onFinish: (c) => setState(() {
                row.card = c;
                if (row.needsReview) _picks[row.key] = c.id;
              }),
              onCondition: (c) => setState(() => row.condition = c),
              onQuantity: (q) => setState(() => row.quantity = q),
            ),
            const Divider(height: 1),
          ],
          if (unmatched.isNotEmpty) ...[
            heading("Cards we couldn't match"),
            for (final row in unmatched) ...[
              _UnrecognizedTile(
                row: row,
                onPick: () => _replace(row),
                onRemove: () => _remove(row),
              ),
              const Divider(height: 1),
            ],
          ],
          AddListRow(
            key: const Key('photoAddCard'),
            label: 'Add a card the photo missed',
            onTap: _add,
          ),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Post from photo')),
      body: body,
      bottomNavigationBar: _loading || _failed
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.sm),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (leftOut > 0)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: Text(
                          _leftOutLabel(unreviewed, leftOut - unreviewed),
                          key: const Key('photoPostLeftOut'),
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: t.textMuted),
                        ),
                      ),
                    FilledButton(
                      key: const Key('photoCreatePost'),
                      onPressed: ready.isEmpty ? null : _createPost,
                      child: Text(switch (ready.length) {
                        0 => 'Create post',
                        1 => 'Create post (1 card)',
                        final n => 'Create post ($n cards)',
                      }),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _UnrecognizedTile extends StatelessWidget {
  const _UnrecognizedTile({
    required this.row,
    required this.onPick,
    required this.onRemove,
  });

  final _Row row;
  final VoidCallback onPick;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final read = row.readText.replaceAll(RegExp(r'\s+'), ' ').trim();
    return ListTile(
      key: Key('photoRow-${row.id}'),
      leading: Icon(Icons.help_outline, color: t.warn),
      title: const Text('Unrecognized, tap to pick'),
      subtitle: read.isEmpty
          ? null
          : Text('Read: $read', maxLines: 2, overflow: TextOverflow.ellipsis),
      onTap: onPick,
      trailing: IconButton(
        key: Key('photoRowRemove-${row.id}'),
        icon: const Icon(Icons.close),
        tooltip: 'Remove',
        onPressed: onRemove,
      ),
    );
  }
}

class _CardTile extends StatelessWidget {
  const _CardTile({
    required this.row,
    required this.priceLabel,
    required this.onPrinting,
    required this.onReplace,
    required this.onRemove,
    required this.onFinish,
    required this.onCondition,
    required this.onQuantity,
  });

  final _Row row;
  final String priceLabel;
  final VoidCallback onPrinting;
  final VoidCallback onReplace;
  final VoidCallback onRemove;
  final ValueChanged<CardModel> onFinish;
  final ValueChanged<String> onCondition;
  final ValueChanged<int> onQuantity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final card = row.card!;
    // The candidates hold every printing of this name, so the other finishes
    // of the chosen printing are among them.
    final finishes = finishesForCard(row.printings, card);

    return Container(
      key: Key('photoRow-${row.id}'),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.sm, AppSpacing.xs, AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CardThumbnail(url: card.imageUrl, foil: card.isFoil),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.name,
                      key: Key('photoRowName-${row.id}'),
                      style: theme.textTheme.titleSmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    CardMetaLine(card: card),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '${card.finishLabel} · $priceLabel',
                      key: Key('photoRowPrice-${row.id}'),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
              IconButton(
                key: Key('photoRowReplace-${row.id}'),
                icon: const Icon(Icons.search),
                tooltip: 'Replace with another card',
                onPressed: onReplace,
              ),
              IconButton(
                key: Key('photoRowRemove-${row.id}'),
                icon: const Icon(Icons.close),
                tooltip: 'Remove',
                onPressed: onRemove,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton(
                key: Key('photoRowPrinting-${row.id}'),
                onPressed: row.printings.length > 1 ? onPrinting : null,
                child: Text(row.printings.length > 1
                    ? 'Printing (${row.printings.length})'
                    : 'Only printing'),
              ),
              if (finishes.length > 1)
                DropdownButton<String>(
                  key: Key('photoRowFinish-${row.id}'),
                  value: card.id,
                  isDense: true,
                  underline: const SizedBox.shrink(),
                  items: [
                    for (final f in finishes)
                      DropdownMenuItem(value: f.id, child: Text(f.finishLabel)),
                  ],
                  onChanged: (id) {
                    if (id == null) return;
                    onFinish(finishes.firstWhere((f) => f.id == id));
                  },
                ),
              DropdownButton<String>(
                key: Key('photoRowCondition-${row.id}'),
                value: row.condition,
                isDense: true,
                underline: const SizedBox.shrink(),
                items: [
                  for (final c in BinderEntry.conditions)
                    DropdownMenuItem(value: c, child: Text(c)),
                ],
                onChanged: (c) {
                  if (c != null) onCondition(c);
                },
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    key: Key('photoRowQtyMinus-${row.id}'),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.remove_circle_outline),
                    tooltip: 'One fewer',
                    onPressed: row.quantity > 1
                        ? () => onQuantity(row.quantity - 1)
                        : null,
                  ),
                  Text('${row.quantity}',
                      key: Key('photoRowQty-${row.id}'),
                      style: theme.textTheme.titleSmall),
                  IconButton(
                    key: Key('photoRowQtyPlus-${row.id}'),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.add_circle_outline),
                    tooltip: 'One more',
                    onPressed: () => onQuantity(row.quantity + 1),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
