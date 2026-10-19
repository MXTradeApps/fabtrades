import 'dart:convert';

import '../models/trade.dart';

/// Discord trade-offer text and share links for a trade.
///
/// A port of the web's `tradeOffer.js` and `encodeTradeToURL`, so an offer
/// written on the phone reads the same as one written on fabtrades.net, and a
/// link opens the same trade there. Keep the two in step.
class TradeOffer {
  const TradeOffer._();

  static const siteUrl = 'https://fabtrades.net';

  static const _artVariants = <(String, String)>[
    (r'extended\s*art', 'EA'),
    (r'alternate\s*art|alt\s*art', 'AA'),
    (r'full\s*art', 'FA'),
    (r'marvel', 'Marvel'),
    (r'fabled', 'Fabled'),
    (r'promo', 'Promo'),
    (r'nexus\s*night', 'NN'),
    (r'jpn\s*exclusive', 'JPN'),
    (r'cc\s*tag', 'CC'),
  ];

  /// Set codes like MST001 or 1HP360, as opposed to pitch colors or art tags.
  static final _setCode = RegExp(r'^\d?[A-Z]{1,5}\d{1,4}[A-Za-z]?$');
  static final _trailingTag = RegExp(r'^(.*?)\s*\(([^)]+)\)\s*$');

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /// Discord shorthand for a foil subtype: NF, CF, RF, GF or Foil.
  static String? foilAbbrev(String? subTypeName) {
    final type = (subTypeName ?? '').toLowerCase().trim();
    if (type.isEmpty || type.contains('normal')) return 'NF';
    if (type.contains('cold foil')) return 'CF';
    if (type.contains('rainbow foil')) return 'RF';
    if (type.contains('gold foil')) return 'GF';
    if (type.contains('foil') || type.contains('holo')) return 'Foil';
    return null;
  }

  /// Splits a catalog name into its base name and art-variant shorthand,
  /// dropping trailing set codes and keeping pitch colors like "(Red)".
  static ({String baseName, String? artAbbrev}) parseCardName(String raw) {
    var name = raw.trim();
    String? art;
    while (true) {
      final match = _trailingTag.firstMatch(name);
      if (match == null) break;
      final inner = match.group(2)!.trim();
      final base = match.group(1)!.trim();
      if (_setCode.hasMatch(inner)) {
        name = base;
        continue;
      }
      final variant = _artVariants
          .where((v) => RegExp(v.$1, caseSensitive: false).hasMatch(inner))
          .firstOrNull;
      if (variant != null) {
        art ??= variant.$2;
        name = base;
        continue;
      }
      break;
    }
    return (baseName: name, artAbbrev: art);
  }

  /// One card line, e.g. "2x CF EA Fleeing Starbreeze 40".
  static String cardLine(TradeItem item) {
    final parsed = parseCardName(item.card.name);
    final foil = foilAbbrev(item.card.subTypeName);
    final price = item.priceEach.round();
    return [
      if (item.quantity > 1) '${item.quantity}x',
      ?foil,
      ?parsed.artAbbrev,
      parsed.baseName,
      if (price > 0) '$price',
    ].join(' ');
  }

  /// A message to paste to a Discord poster. "My cards" are what I offer;
  /// "Their cards" are what I'd take from their post. Empty for an empty trade.
  static String message(Trade trade, {DateTime? pricedAsOf}) {
    final have = trade.haveItems;
    final want = trade.wantItems;
    if (have.isEmpty && want.isEmpty) return '';

    final diff = trade.haveTotal - trade.wantTotal;
    final cash = '\$${diff.abs().round()}';
    final lines = <String>['Hey — I can do this trade:', ''];

    if (have.isNotEmpty) {
      lines.add('**I can offer**');
      lines.addAll(have.map(cardLine));
      if (diff < -0.5) lines.add('+ $cash cash from me');
      lines.add('');
    }

    if (want.isNotEmpty) {
      lines.add('**For your**');
      lines.addAll(want.map(cardLine));
      if (diff > 0.5) lines.add('+ $cash cash from you');
    } else {
      lines.add('**For**');
      lines.add('whatever you want to send back / cash');
    }

    final date = pricedAsOf ?? DateTime.now();
    lines
      ..add('')
      ..add('Priced via TCGPlayer, '
          '${_months[date.month - 1]} ${date.day}, ${date.year}')
      ..add('Balanced on ${siteUrl.replaceFirst(RegExp(r'^https?://'), '')}');

    return '${lines.join('\n').trim()}\n';
  }

  /// A fabtrades.net link that opens this trade on the website, in the
  /// `{v, t, h, w}` payload the web's `decodeTradeFromURL` reads. Null for an
  /// empty trade.
  static String? link(Trade trade, {DateTime? now}) {
    List<List<Object>> minimal(List<TradeItem> items) => [
          for (final item in items)
            [item.card.id, item.priceEach, item.quantity],
        ];

    if (trade.haveItems.isEmpty && trade.wantItems.isEmpty) return null;
    final minutes =
        ((now ?? DateTime.now()).millisecondsSinceEpoch / 60000).round();
    final payload = jsonEncode({
      'v': 1,
      't': minutes,
      'h': minimal(trade.haveItems),
      'w': minimal(trade.wantItems),
    });
    final encoded = base64Encode(utf8.encode(payload));
    return Uri.parse(siteUrl)
        .replace(path: '/', queryParameters: {'trade': encoded})
        .toString();
  }
}
