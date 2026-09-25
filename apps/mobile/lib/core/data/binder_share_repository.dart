import 'dart:math';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Public `/b/:token` share for the signed-in user's Trade Binder.
class BinderShare {
  const BinderShare({
    required this.token,
    required this.isEnabled,
    required this.url,
  });

  final String token;
  final bool isEnabled;
  final String url;
}

/// Absolute URL for a binder share token. Matches web `binderShareUrl`.
String binderShareUrl(
  String token, {
  String origin = 'https://fabtrades.net',
}) {
  if (token.isEmpty) return '';
  final base = origin.replaceAll(RegExp(r'/$'), '');
  return '$base/b/$token';
}

/// Opaque 32-char hex token for `/b/:token` share links.
String newBinderShareToken([Random? random]) {
  final rng = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

/// Creates or re-enables the owner's public binder share so a copied link works.
class BinderShareRepository {
  BinderShareRepository(this._client);

  final SupabaseClient _client;

  Future<BinderShare> ensureEnabledShare() async {
    final user = _client.auth.currentUser;
    if (user == null) {
      throw const BinderShareException('Sign in to copy a binder link');
    }

    final existing = await _client
        .from('binder_shares')
        .select('token, is_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

    if (existing == null) {
      final now = DateTime.now().toUtc().toIso8601String();
      final token = newBinderShareToken();
      final row = await _client
          .from('binder_shares')
          .insert({
            'user_id': user.id,
            'token': token,
            'is_enabled': true,
            'created_at': now,
            'updated_at': now,
          })
          .select('token, is_enabled')
          .single();
      return _map(row);
    }

    if (existing['is_enabled'] == true) {
      return _map(existing);
    }

    final now = DateTime.now().toUtc().toIso8601String();
    final row = await _client
        .from('binder_shares')
        .update({'is_enabled': true, 'updated_at': now})
        .eq('user_id', user.id)
        .select('token, is_enabled')
        .single();
    return _map(row);
  }

  BinderShare _map(Map<String, dynamic> row) {
    final token = row['token'] as String? ?? '';
    return BinderShare(
      token: token,
      isEnabled: row['is_enabled'] == true,
      url: binderShareUrl(token),
    );
  }
}

class BinderShareException implements Exception {
  const BinderShareException(this.message);
  final String message;

  @override
  String toString() => message;
}
