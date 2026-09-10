import 'package:supabase_flutter/supabase_flutter.dart';

/// The server half of a synced collection: everything the engine needs from a
/// remote table, and nothing more.
///
/// An interface rather than a direct Postgrest call so reconciliation can be tested
/// against a fake. The merge rules are where the bugs hide, and they are not worth
/// exercising only through a live database.
abstract class RemoteCollection {
  /// Every row this user owns, tombstones included. Deletions have to come back or
  /// the client cannot tell a deleted record from one it has never seen.
  Future<List<Map<String, dynamic>>> fetchAll(String userId);

  Future<void> upsertAll(List<Map<String, Object?>> rows);

  /// Tombstones the row matching [identity], which is scoped to [userId].
  Future<void> markDeleted({
    required String userId,
    required Map<String, Object?> identity,
    required DateTime at,
  });
}

class SupabaseRemoteCollection implements RemoteCollection {
  SupabaseRemoteCollection({
    required this.client,
    required this.table,
    required this.conflictTarget,
  });

  final SupabaseClient client;
  final String table;

  /// Columns forming the unique constraint an upsert conflicts on.
  final String conflictTarget;

  /// PostgREST caps a single response at 1000 rows. Page until drained so a
  /// Fabrary-sized binder is not silently truncated around letter I.
  static const int _pageSize = 1000;

  @override
  Future<List<Map<String, dynamic>>> fetchAll(String userId) async {
    final all = <Map<String, dynamic>>[];
    var from = 0;
    while (true) {
      final rows = await client
          .from(table)
          .select()
          .eq('user_id', userId)
          .order('updated_at')
          .order('client_id')
          .range(from, from + _pageSize - 1);
      final page = (rows as List).cast<Map<String, dynamic>>();
      all.addAll(page);
      if (page.length < _pageSize) break;
      from += _pageSize;
    }
    return all;
  }

  @override
  Future<void> upsertAll(List<Map<String, Object?>> rows) async {
    if (rows.isEmpty) return;
    await client.from(table).upsert(rows, onConflict: conflictTarget);
  }

  @override
  Future<void> markDeleted({
    required String userId,
    required Map<String, Object?> identity,
    required DateTime at,
  }) async {
    final stamp = at.toIso8601String();
    await client.from(table).update({
      'deleted_at': stamp,
      'updated_at': stamp,
    }).match(<String, Object>{
      'user_id': userId,
      for (final e in identity.entries)
        if (e.value != null) e.key: e.value!,
    });
  }
}

/// The single `user_settings` row for one account.
abstract class RemoteSettings {
  Future<Map<String, dynamic>?> fetch(String userId);

  Future<void> upsert({
    required String userId,
    required String priceSource,
    required String themeMode,
    required DateTime updatedAt,
  });
}

class SupabaseRemoteSettings implements RemoteSettings {
  SupabaseRemoteSettings(this.client);

  final SupabaseClient client;

  @override
  Future<Map<String, dynamic>?> fetch(String userId) => client
      .from('user_settings')
      .select()
      .eq('user_id', userId)
      .maybeSingle();

  @override
  Future<void> upsert({
    required String userId,
    required String priceSource,
    required String themeMode,
    required DateTime updatedAt,
  }) async {
    await client.from('user_settings').upsert({
      'user_id': userId,
      'price_source': priceSource,
      'theme_mode': themeMode,
      'updated_at': updatedAt.toIso8601String(),
    }, onConflict: 'user_id');
  }
}
