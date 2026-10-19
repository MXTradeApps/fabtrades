import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/app_settings.dart';
import '../models/price_alert.dart';

/// Reads and writes the signed-in user's `fab_price_alerts`, and registers the
/// device for push. RLS limits every query to the caller's own rows.
class PriceAlertRepository {
  PriceAlertRepository(this._client);

  final SupabaseClient _client;

  static const _columns = 'id, card_id, direction, source, target_price, '
      'price_at_creation, created_at, triggered_at, triggered_price';

  String get _userId {
    final user = _client.auth.currentUser;
    if (user == null) {
      throw const PriceAlertException('Sign in to set price alerts');
    }
    return user.id;
  }

  Future<List<PriceAlert>> list() async {
    _userId;
    final rows = await _client
        .from('fab_price_alerts')
        .select(_columns)
        .order('created_at', ascending: false);
    return [
      for (final row in rows) PriceAlert.fromRow(row),
    ];
  }

  Future<PriceAlert> create({
    required String cardId,
    required PriceAlertDirection direction,
    required PriceSource source,
    required double targetPrice,
    double? currentPrice,
  }) async {
    final row = await _client
        .from('fab_price_alerts')
        .insert({
          'user_id': _userId,
          'card_id': cardId,
          'direction': direction.id,
          'source': source.name,
          'target_price': targetPrice,
          'price_at_creation': ?currentPrice,
        })
        .select(_columns)
        .single();
    return PriceAlert.fromRow(row);
  }

  Future<void> delete(String id) async {
    await _client.from('fab_price_alerts').delete().eq('id', id);
  }

  /// Clears the fired state so the alert watches again.
  Future<void> rearm(String id) async {
    await _client.from('fab_price_alerts').update({
      'triggered_at': null,
      'triggered_price': null,
      'notified_at': null,
    }).eq('id', id);
  }

  Future<void> registerPushToken(String token, String platform) async {
    await _client.rpc('fab_register_push_token', params: {
      'p_token': token,
      'p_platform': platform,
    });
  }

  Future<void> unregisterPushToken(String token) async {
    await _client.from('fab_push_tokens').delete().eq('token', token);
  }
}

class PriceAlertException implements Exception {
  const PriceAlertException(this.message);
  final String message;

  @override
  String toString() => message;
}
