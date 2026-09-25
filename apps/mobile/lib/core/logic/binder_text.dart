import '../models/binder_entry.dart';

/// Paste-friendly list of a Binder's cards, one line per printing.
///
/// `{qty}x {name} · {collector #} · {finish} · {condition} · {set}`
/// Finish is omitted when it is missing or Normal.
String formatBinderAsText({
  required String name,
  required Iterable<BinderEntry> entries,
}) {
  final title = name.trim().isEmpty ? 'Binder' : name.trim();
  final lines = [
    for (final entry in entries)
      if (entry.quantity > 0) _formatBinderTextLine(entry),
  ]..sort((a, b) => a.sort.compareTo(b.sort));
  if (lines.isEmpty) return title;
  return '$title\n\n${lines.map((e) => e.line).join('\n')}';
}

({String line, String sort}) _formatBinderTextLine(BinderEntry entry) {
  final card = entry.card;
  final finish = _finishLabel(entry);
  final collector = card.collectorNumber?.trim();
  final setName = card.setName?.trim();
  final condition = entry.condition.trim();
  final parts = <String>[
    if (collector != null && collector.isNotEmpty) collector,
    ?finish,
    if (condition.isNotEmpty) condition,
    if (setName != null && setName.isNotEmpty) setName,
  ];
  final suffix = parts.isEmpty ? '' : ' · ${parts.join(' · ')}';
  final name = card.name.trim().isEmpty ? 'Unknown card' : card.name.trim();
  return (
    line: '${entry.quantity}x $name$suffix',
    sort:
        '$name\t${card.collectorNumber ?? ''}\t${finish ?? ''}\t${entry.condition}',
  );
}

String? _finishLabel(BinderEntry entry) {
  final raw = entry.card.subTypeName?.trim();
  if (raw != null && raw.isNotEmpty) {
    if (raw.toLowerCase() == 'normal') return null;
    return raw;
  }
  if (entry.card.isFoil) return 'Foil';
  return null;
}
