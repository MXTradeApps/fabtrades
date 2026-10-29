import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Swaps a long `fabtrades.net/?trade=…` link for a short `fabtrades.net/t/…`
/// one, using the website's `/api/trade-links` endpoint (web
/// `src/utils/tradeLinks.js`). Any failure returns the long link, which opens
/// the same trade.
class TradeLinkShortener {
  TradeLinkShortener({
    Future<String?> Function(Uri endpoint, String body)? post,
    this.timeout = const Duration(seconds: 4),
  }) : _post = post ?? _httpPost;

  final Future<String?> Function(Uri endpoint, String body) _post;
  final Duration timeout;

  static const endpointPath = '/api/trade-links';
  static const shortPath = '/t/';

  Future<String> shorten(String longLink) async {
    try {
      final uri = Uri.parse(longLink);
      final trade = uri.queryParameters['trade'];
      if (trade == null || trade.isEmpty) return longLink;
      final response = await _post(
        Uri.parse('${uri.origin}$endpointPath'),
        jsonEncode({'trade': trade}),
      ).timeout(timeout);
      if (response == null) return longLink;
      final url = (jsonDecode(response) as Map<String, dynamic>)['url'];
      final expectedPrefix = '${uri.origin}$shortPath';
      return url is String && url.startsWith(expectedPrefix) ? url : longLink;
    } catch (_) {
      return longLink;
    }
  }

  /// POSTs JSON and returns the body of a 2xx response, else null.
  static Future<String?> _httpPost(Uri endpoint, String body) async {
    final client = HttpClient();
    try {
      final request = await client.postUrl(endpoint);
      request.headers.contentType = ContentType.json;
      request.write(body);
      final response = await request.close();
      final text = await response.transform(utf8.decoder).join();
      return response.statusCode >= 200 && response.statusCode < 300
          ? text
          : null;
    } finally {
      client.close(force: true);
    }
  }
}
