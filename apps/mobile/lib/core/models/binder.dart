/// Stable client-minted ids for the two default Binders. Both clients and the
/// SQL backfill must converge on these so first sync does not duplicate them.
abstract final class BinderIds {
  static const trade = 'system:trade';
  static const collection = 'system:collection';
}

/// Whether a Binder is tradeable stock (`trade`) or a keep pile (`standard`).
enum BinderRole {
  trade,
  standard;

  static BinderRole parse(String? raw) =>
      raw == 'trade' ? BinderRole.trade : BinderRole.standard;

  String get wire => this == BinderRole.trade ? 'trade' : 'standard';
}

/// A named pile of owned Printings. Not Want List.
class Binder {
  const Binder({
    required this.clientId,
    required this.name,
    required this.role,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  final String clientId;
  final String name;
  final BinderRole role;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;

  bool get isLive => deletedAt == null;

  bool get isTrade => role == BinderRole.trade;

  bool get isDefaultCollection => clientId == BinderIds.collection;

  Binder copyWith({
    String? name,
    DateTime? updatedAt,
    DateTime? deletedAt,
    bool clearDeletedAt = false,
  }) =>
      Binder(
        clientId: clientId,
        name: name ?? this.name,
        role: role,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        deletedAt: clearDeletedAt ? null : (deletedAt ?? this.deletedAt),
      );

  Map<String, dynamic> toJson() => {
        'client_id': clientId,
        'name': name,
        'role': role.wire,
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt.toIso8601String(),
        if (deletedAt != null) 'deleted_at': deletedAt!.toIso8601String(),
      };

  factory Binder.fromJson(Map<String, dynamic> json) {
    final clientId = (json['client_id'] as String?) ??
        (json['clientId'] as String?) ??
        '';
    return Binder(
      clientId: clientId,
      name: (json['name'] as String?) ?? '',
      role: BinderRole.parse(json['role'] as String?),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ??
          DateTime.now(),
      deletedAt: DateTime.tryParse(json['deleted_at'] as String? ?? ''),
    );
  }

  static Binder tradeDefault({DateTime? now}) {
    final stamp = now ?? DateTime.now();
    return Binder(
      clientId: BinderIds.trade,
      name: 'Trade Binder',
      role: BinderRole.trade,
      createdAt: stamp,
      updatedAt: stamp,
    );
  }

  static Binder collectionDefault({DateTime? now}) {
    final stamp = now ?? DateTime.now();
    return Binder(
      clientId: BinderIds.collection,
      name: 'Collection',
      role: BinderRole.standard,
      createdAt: stamp,
      updatedAt: stamp,
    );
  }

  /// First-run pair: Trade Binder + Collection.
  static List<Binder> seedDefaults({DateTime? now}) {
    final stamp = now ?? DateTime.now();
    return [
      Binder.tradeDefault(now: stamp),
      Binder.collectionDefault(now: stamp),
    ];
  }

  /// Trade Binder is never absent and never left tombstoned. Collection is not
  /// re-created here — deleting it must stick.
  static List<Binder> ensureTrade(List<Binder> existing, {DateTime? now}) {
    final stamp = now ?? DateTime.now();
    final next = [...existing];
    final tradeIndex = next.indexWhere((b) => b.role == BinderRole.trade);
    if (tradeIndex < 0) {
      next.add(Binder.tradeDefault(now: stamp));
    } else if (next[tradeIndex].deletedAt != null) {
      next[tradeIndex] = next[tradeIndex].copyWith(
        updatedAt: stamp,
        clearDeletedAt: true,
      );
    }
    return next;
  }

  /// Grid order: Trade Binder, live Collection, then others by createdAt, clientId.
  static List<Binder> gridOrder(Iterable<Binder> binders) {
    final live = binders.where((b) => b.isLive).toList();
    Binder? trade;
    Binder? collection;
    final rest = <Binder>[];
    for (final binder in live) {
      if (binder.role == BinderRole.trade) {
        trade = binder;
      } else if (binder.clientId == BinderIds.collection) {
        collection = binder;
      } else {
        rest.add(binder);
      }
    }
    rest.sort((a, b) {
      final byCreated = a.createdAt.compareTo(b.createdAt);
      if (byCreated != 0) return byCreated;
      return a.clientId.compareTo(b.clientId);
    });
    return [
      if (trade != null) trade,
      if (collection != null) collection,
      ...rest,
    ];
  }
}
