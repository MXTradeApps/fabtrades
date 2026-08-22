import 'binder.dart';
import 'card_model.dart';

/// A card in one of the user's Binders (owned) or Want List.
///
/// Owned identity is `(printing, binderId, condition)`. Want List identity is
/// the printing (`isWanted`); [binderId] is null.
class BinderEntry {
  final CardModel card;
  final int quantity;
  final String condition; // e.g. NM, LP, MP, HP, DMG
  final bool isWanted; // true => want list, false => binder
  final DateTime addedAt;

  /// Owner Binder `clientId` when owned. Null on Want List.
  final String? binderId;

  const BinderEntry({
    required this.card,
    this.quantity = 1,
    this.condition = 'NM',
    this.isWanted = false,
    required this.addedAt,
    this.binderId,
  });

  /// Owned rows always have a Binder id; pre-feature JSON missing `binder_id`
  /// belongs in Trade Binder. Want List stays null.
  String? get resolvedBinderId {
    if (isWanted) return null;
    final id = binderId?.trim();
    if (id == null || id.isEmpty) return BinderIds.trade;
    return id;
  }

  BinderEntry copyWith({
    CardModel? card,
    int? quantity,
    String? condition,
    bool? isWanted,
    String? binderId,
  }) {
    final wanted = isWanted ?? this.isWanted;
    return BinderEntry(
      card: card ?? this.card,
      quantity: quantity ?? this.quantity,
      condition: condition ?? this.condition,
      isWanted: wanted,
      addedAt: addedAt,
      binderId: wanted ? null : (binderId ?? this.binderId ?? BinderIds.trade),
    );
  }

  Map<String, dynamic> toJson() => {
        'card': card.toStub(),
        'quantity': quantity,
        'condition': condition,
        'is_wanted': isWanted,
        'added_at': addedAt.toIso8601String(),
        if (resolvedBinderId != null) 'binder_id': resolvedBinderId,
      };

  factory BinderEntry.fromJson(Map<String, dynamic> json) {
    final isWanted = (json['is_wanted'] as bool?) ?? false;
    final rawBinderId = json['binder_id'] as String?;
    return BinderEntry(
      card: CardModel.fromStub(
          Map<String, dynamic>.from(json['card'] as Map)),
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      condition: (json['condition'] as String?) ?? 'NM',
      isWanted: isWanted,
      addedAt: DateTime.tryParse(json['added_at'] as String? ?? '') ??
          DateTime.now(),
      binderId: isWanted
          ? null
          : ((rawBinderId == null || rawBinderId.trim().isEmpty)
              ? BinderIds.trade
              : rawBinderId),
    );
  }

  static const conditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];
}
