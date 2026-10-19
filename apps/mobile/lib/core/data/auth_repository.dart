import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
// Only the dismissal. `LaunchMode` would clash with the one supabase_flutter
// re-exports, and nothing here needs it.
import 'package:url_launcher/url_launcher.dart' show closeInAppWebView;

import '../analytics/analytics.dart';
import '../config/auth_config.dart';
import '../models/account.dart';

/// The app's only entry point to Supabase Auth.
///
/// Two different sign-in shapes hide behind one interface:
///
/// * **Apple** uses the native system sheet and exchanges an identity token, so
///   it completes in-process and returns [SignInSucceeded].
/// * **Google and Discord** hand off to a browser and come back via a deep
///   link, so they return [SignInPending] and the session shows up later on
///   [authStateChanges].
///
/// Callers should not care which is which — they react to the auth state stream
/// either way. The distinction only exists so the UI can stop showing a spinner
/// when control has left the app.
///
/// The browser flows leave this object holding a listener until the deep link
/// comes back, because whoever opened the browser is the only one who can close
/// it again. Call [dispose] to give that up early.
class AuthRepository {
  AuthRepository(this._client);

  final SupabaseClient _client;

  GoTrueClient get _auth => _client.auth;

  /// Long enough for someone to make a Discord account or fetch a 2FA code
  /// part-way through, short enough that an abandoned attempt does not leave a
  /// listener running for the rest of the session.
  static const _browserRoundTrip = Duration(minutes: 10);

  /// How long a failed launch waits to see whether the deep link beat it back.
  /// The redirect lands within a second of the failure, so this only needs to
  /// cover a slow token exchange.
  static const _quickReturnGrace = Duration(seconds: 3);

  StreamSubscription<AuthState>? _returnFromBrowser;
  Timer? _returnFromBrowserTimeout;

  /// Completes when the current browser handoff brings a session back.
  Completer<void>? _sessionReturned;

  /// Session restored from disk at startup, or null when signed out. Reading
  /// this synchronously means the first frame already knows.
  Session? get currentSession => _auth.currentSession;

  Account? get currentAccount {
    final user = _auth.currentUser;
    return user == null ? null : Account.fromUser(user);
  }

  /// Emits on sign-in, sign-out, and token refresh.
  Stream<AuthState> get authStateChanges => _auth.onAuthStateChange;

  /// Providers worth showing on this platform.
  ///
  /// Apple's sheet only exists on Apple platforms, so offering it on Android
  /// would be a button that cannot work. Apple does not object to Android
  /// builds omitting it — guideline 4.8 is about the iOS app.
  Future<List<AuthProviderKind>> availableProviders() async {
    final providers = <AuthProviderKind>[];
    if (await _appleIsAvailable()) providers.add(AuthProviderKind.apple);
    providers.add(AuthProviderKind.google);
    providers.add(AuthProviderKind.discord);
    return providers;
  }

  Future<bool> _appleIsAvailable() async {
    if (kIsWeb) return false;
    final isApplePlatform = defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;
    if (!isApplePlatform) return false;
    try {
      return await SignInWithApple.isAvailable();
    } catch (_) {
      // Plugin channel missing (widget tests) or an older OS. Either way there
      // is no sheet to show.
      return false;
    }
  }

  Future<SignInOutcome> signIn(AuthProviderKind provider) {
    return switch (provider) {
      AuthProviderKind.apple => _signInWithApple(),
      AuthProviderKind.google => _signInWithRedirect(OAuthProvider.google),
      AuthProviderKind.discord => _signInWithRedirect(OAuthProvider.discord),
      // Email needs a password; callers use [signInWithEmail] instead.
      AuthProviderKind.email => Future.value(
          const SignInFailed('Use email and password to sign in.'),
        ),
    };
  }

  /// Email/password sign-in via Supabase Auth.
  ///
  /// Exists so App Review (and anyone without Apple/Google/Discord) has a
  /// username/password path. Enable Email under Supabase → Authentication →
  /// Providers before relying on it in production.
  Future<SignInOutcome> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final trimmed = email.trim();
    if (trimmed.isEmpty || password.isEmpty) {
      return const SignInFailed('Enter your email and password.');
    }
    try {
      await _auth.signInWithPassword(email: trimmed, password: password);
      return const SignInSucceeded();
    } on AuthException catch (e) {
      return SignInFailed(_authErrorMessage(e));
    } catch (e, s) {
      debugPrint('Auth: unexpected email sign-in error — $e');
      Analytics().captureException(e, s, {'source': 'auth_email'});
      return const SignInFailed("Couldn't sign in. Please try again.");
    }
  }

  /// Native Sign in with Apple.
  ///
  /// The nonce is the security-relevant part. Apple receives the SHA-256 hash
  /// and embeds it in the identity token; Supabase receives the raw value and
  /// checks that it hashes to what the token claims. Without that, a token
  /// captured from one sign-in could be replayed into another.
  Future<SignInOutcome> _signInWithApple() async {
    try {
      final rawNonce = _auth.generateRawNonce();
      final hashedNonce =
          sha256.convert(utf8.encode(rawNonce)).toString();

      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashedNonce,
      );

      final idToken = credential.identityToken;
      if (idToken == null) {
        return const SignInFailed(
          'Apple did not return a sign-in token. Please try again.',
        );
      }

      await _auth.signInWithIdToken(
        provider: OAuthProvider.apple,
        idToken: idToken,
        nonce: rawNonce,
      );
      return const SignInSucceeded();
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        return const SignInCancelled();
      }
      return SignInFailed(_appleErrorMessage(e.code));
    } on AuthException catch (e) {
      return SignInFailed(_authErrorMessage(e));
    } catch (e, s) {
      debugPrint('Auth: unexpected Apple sign-in error — $e');
      Analytics().captureException(e, s, {'source': 'auth_apple'});
      return const SignInFailed(
        "Couldn't sign in with Apple. Please try again.",
      );
    }
  }

  /// Browser-based OAuth. Returns as soon as the browser is open; the session
  /// arrives via the deep link configured in [AuthConfig.redirectUrl].
  Future<SignInOutcome> _signInWithRedirect(OAuthProvider provider) async {
    // Armed before the page opens rather than after. Opening the browser does
    // not report back until the provider's page has finished loading, and on a
    // slow connection that can be later than we want to start listening.
    _closeBrowserOnReturn();
    final returned = _sessionReturned!.future;
    final outcome = await _openProviderPage(provider);
    if (outcome is SignInFailed && await _arrivesSoon(returned)) {
      // On iOS the Safari view reports a failed launch when its very first
      // page never finishes loading. That is exactly what happens when the
      // provider remembers the customer and redirects straight back to the
      // app: the page "fails" because it became a deep link, and the session
      // shows up a moment later. Reporting that as a failure would leave the
      // sheet showing an error over a sign-in that worked.
      return const SignInSucceeded();
    }
    if (outcome is! SignInPending) _stopWaitingForReturn();
    return outcome;
  }

  Future<bool> _arrivesSoon(Future<void> returned) => returned
      .then((_) => true)
      .timeout(_quickReturnGrace, onTimeout: () => false);

  Future<SignInOutcome> _openProviderPage(OAuthProvider provider) async {
    try {
      final launched = await _auth.signInWithOAuth(
        provider,
        redirectTo: AuthConfig.redirectUrl,
      );
      return launched
          ? const SignInPending()
          : const SignInFailed(
              "Couldn't open the sign-in page. Check that you have a browser "
              'installed and try again.',
            );
    } on AuthException catch (e) {
      return SignInFailed(_authErrorMessage(e));
    } catch (e, s) {
      debugPrint('Auth: unexpected OAuth sign-in error — $e');
      Analytics().captureException(e, s, {'source': 'auth_oauth'});
      return const SignInFailed("Couldn't sign in. Please try again.");
    }
  }

  /// Dismisses the sign-in browser once the deep link has been dealt with.
  ///
  /// iOS shows the provider's page in a Safari view controller that belongs to
  /// this app, and the custom-scheme redirect does not take it down: the
  /// session lands, the app behind it updates, and the customer is still
  /// looking at a finished-looking web page with no sign anything worked.
  /// Whoever opened that browser is the only one who can close it, and neither
  /// `supabase_flutter` nor `url_launcher` does so on our behalf.
  ///
  /// Either ending counts. A session means the exchange worked; a stream error
  /// means the deep link carried a refusal or a bad code, which is just as much
  /// a reason to get out of the browser and let the app show what happened.
  void _closeBrowserOnReturn() {
    _stopWaitingForReturn();
    final returned = _sessionReturned = Completer<void>();
    _returnFromBrowser = authStateChanges.listen(
      (state) {
        if (state.event == AuthChangeEvent.signedIn) {
          if (!returned.isCompleted) returned.complete();
          unawaited(_dismissBrowser());
        }
      },
      onError: (Object _) => unawaited(_dismissBrowser()),
    );
    _returnFromBrowserTimeout = Timer(
      _browserRoundTrip,
      _stopWaitingForReturn,
    );
  }

  Future<void> _dismissBrowser() async {
    _stopWaitingForReturn();
    try {
      await closeInAppWebView();
    } catch (e) {
      // An Android custom tab has nothing to close this way, and under
      // `flutter test` the platform channel is absent altogether. Neither is
      // worth surfacing: the sign-in itself has already succeeded.
      debugPrint('Auth: could not close the sign-in browser — $e');
    }
  }

  void _stopWaitingForReturn() {
    _returnFromBrowserTimeout?.cancel();
    _returnFromBrowserTimeout = null;
    unawaited(_returnFromBrowser?.cancel());
    _returnFromBrowser = null;
  }

  /// Releases the listener left behind by an unfinished browser sign-in.
  void dispose() => _stopWaitingForReturn();

  /// Signs out on this device only.
  ///
  /// Deliberately local scope: signing out of the phone should not kill a
  /// session on the website, which is what `SignOutScope.global` would do.
  Future<void> signOut() async {
    try {
      await _auth.signOut(scope: SignOutScope.local);
    } on AuthException catch (e) {
      // A rejected token is the usual cause, and the local session is cleared
      // regardless, so the customer is signed out either way.
      debugPrint('Auth: sign-out reported ${e.message}');
    }
  }

  /// Permanently deletes the signed-in account and its server-side data.
  ///
  /// Calls the `delete-account` edge function, which verifies the session JWT
  /// and removes the auth user. Cascading FKs clear synced binder, trades,
  /// settings, and entitlements. The local session is cleared afterwards so a
  /// deleted account cannot keep acting as if it still exists.
  ///
  /// Does not cancel an App Store / Play subscription — those must be managed
  /// through the store, and the confirmation UI says so.
  Future<DeleteAccountOutcome> deleteAccount() async {
    final session = _auth.currentSession;
    if (session == null) {
      return const DeleteAccountFailed('Sign in before deleting your account.');
    }

    try {
      final response = await _client.functions.invoke('delete-account');
      if (response.status >= 200 && response.status < 300) {
        // The server already revoked the user; local sign-out just clears the
        // cached session so the UI flips to signed-out without a 401 loop.
        try {
          await _auth.signOut(scope: SignOutScope.local);
        } catch (_) {}
        return const DeleteAccountSucceeded();
      }

      final error = _functionErrorMessage(response.data);
      debugPrint('Auth: delete-account returned ${response.status}: $error');
      return DeleteAccountFailed(error);
    } on FunctionException catch (e) {
      debugPrint('Auth: delete-account FunctionException — ${e.status}');
      return DeleteAccountFailed(_functionErrorMessage(e.details));
    } catch (e, s) {
      debugPrint('Auth: unexpected delete-account error — $e');
      Analytics().captureException(e, s, {'source': 'auth_delete_account'});
      return const DeleteAccountFailed(
        "Couldn't delete your account. Please try again.",
      );
    }
  }

  static String _functionErrorMessage(Object? data) {
    if (data is Map && data['error'] is String) {
      final error = data['error'] as String;
      return switch (error) {
        'unauthorized' => 'Sign in again, then try deleting your account.',
        'not configured' =>
          'Account deletion is temporarily unavailable. Please try again later.',
        'deletion failed' =>
          "Couldn't delete your account. Please try again, or email support.",
        _ => "Couldn't delete your account. Please try again.",
      };
    }
    return "Couldn't delete your account. Please try again.";
  }

  static String _appleErrorMessage(AuthorizationErrorCode code) =>
      switch (code) {
        AuthorizationErrorCode.notHandled ||
        AuthorizationErrorCode.notInteractive =>
          'Apple sign-in is unavailable right now. Please try again.',
        AuthorizationErrorCode.invalidResponse =>
          'Apple returned an unexpected response. Please try again.',
        AuthorizationErrorCode.failed =>
          "Apple sign-in didn't complete. Check that you are signed in to "
              'iCloud and try again.',
        _ => "Couldn't sign in with Apple. Please try again.",
      };

  /// Supabase's messages are written for developers, so only a few are worth
  /// passing through verbatim.
  static String _authErrorMessage(AuthException e) {
    final message = e.message.toLowerCase();
    if (message.contains('provider is not enabled')) {
      return 'That sign-in option is not enabled for FAB Trades yet.';
    }
    if (message.contains('invalid login credentials') ||
        message.contains('invalid email or password')) {
      return 'Incorrect email or password.';
    }
    if (message.contains('email not confirmed')) {
      return 'Confirm your email before signing in.';
    }
    if (message.contains('network') || message.contains('failed host')) {
      return 'Network problem while signing in. Check your connection and try '
          'again.';
    }
    return "Couldn't sign in. Please try again.";
  }
}

/// Result of a self-service account deletion attempt.
sealed class DeleteAccountOutcome {
  const DeleteAccountOutcome();
}

final class DeleteAccountSucceeded extends DeleteAccountOutcome {
  const DeleteAccountSucceeded();
}

final class DeleteAccountFailed extends DeleteAccountOutcome {
  const DeleteAccountFailed(this.message);

  final String message;
}
