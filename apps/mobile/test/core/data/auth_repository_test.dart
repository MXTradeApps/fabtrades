import 'dart:async';

import 'package:fabtrades/core/data/auth_repository.dart';
import 'package:fabtrades/core/models/account.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _MockGoTrueClient extends Mock implements GoTrueClient {}

class _MockSupabaseClient extends Mock implements SupabaseClient {}

/// Stands in for the browser the OAuth handoff opens, and records whether
/// anyone asked for it back.
class _FakeBrowser extends UrlLauncherPlatform {
  bool opens = true;
  int openCount = 0;
  int closeCount = 0;

  /// Runs before the launch reports back, for redirects that finish first.
  void Function()? onLaunch;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    openCount++;
    onLaunch?.call();
    return opens;
  }

  @override
  Future<void> closeWebView() async => closeCount++;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MockGoTrueClient auth;
  late _MockSupabaseClient client;
  late _FakeBrowser browser;
  late StreamController<AuthState> authStates;
  late AuthRepository repository;

  setUpAll(() => registerFallbackValue(OAuthProvider.discord));

  setUp(() {
    auth = _MockGoTrueClient();
    client = _MockSupabaseClient();
    browser = _FakeBrowser();
    UrlLauncherPlatform.instance = browser;
    authStates = StreamController<AuthState>.broadcast();

    when(() => client.auth).thenReturn(auth);
    when(
      () => auth.getOAuthSignInUrl(
        provider: any(named: 'provider'),
        redirectTo: any(named: 'redirectTo'),
        scopes: any(named: 'scopes'),
        queryParams: any(named: 'queryParams'),
      ),
    ).thenAnswer(
      (invocation) async => OAuthResponse(
        provider: invocation.namedArguments[#provider] as OAuthProvider,
        url: 'https://project.supabase.co/auth/v1/authorize',
      ),
    );
    when(() => auth.onAuthStateChange).thenAnswer((_) => authStates.stream);

    repository = AuthRepository(client);
    addTearDown(repository.dispose);
    addTearDown(authStates.close);
  });

  /// The deep link is delivered by supabase_flutter, which turns it into either
  /// a session on the auth stream or an error on it. Both are stand-ins here for
  /// the customer having finished with the provider's page.
  Future<void> deepLinkReturns(AuthChangeEvent event) async {
    authStates.add(AuthState(event, null));
    await pumpEventQueue();
  }

  Future<void> deepLinkFails() async {
    authStates.addError(const AuthException('invalid grant'));
    await pumpEventQueue();
  }

  test('hands off to the browser and waits for the deep link', () async {
    final outcome = await repository.signIn(AuthProviderKind.discord);

    expect(outcome, isA<SignInPending>());
    expect(browser.openCount, 1);
    // Nothing to close yet — the customer is still on the provider's page.
    expect(browser.closeCount, 0);
  });

  test('closes the browser once the deep link brings a session back', () async {
    await repository.signIn(AuthProviderKind.discord);

    await deepLinkReturns(AuthChangeEvent.signedIn);

    expect(browser.closeCount, 1);
  });

  test('closes the browser when the deep link carries a refusal', () async {
    await repository.signIn(AuthProviderKind.discord);

    await deepLinkFails();

    expect(browser.closeCount, 1);
  });

  test('leaves the browser alone for unrelated auth activity', () async {
    await repository.signIn(AuthProviderKind.google);

    // A refresh landing mid-flow says nothing about the browser round trip.
    await deepLinkReturns(AuthChangeEvent.tokenRefreshed);

    expect(browser.closeCount, 0);
  });

  test('stops waiting when the browser never opened', () async {
    browser.opens = false;

    final outcome = await repository.signIn(AuthProviderKind.discord);
    await deepLinkReturns(AuthChangeEvent.signedIn);

    expect(outcome, isA<SignInFailed>());
    expect(browser.closeCount, 0);
  });

  test('counts a failed launch as success when the session comes straight back',
      () async {
    // iOS reports the launch as failed when the provider remembers the
    // customer and redirects to the app before the first page finishes.
    browser.opens = false;
    browser.onLaunch = () => authStates.add(
          AuthState(AuthChangeEvent.signedIn, null),
        );

    final outcome = await repository.signIn(AuthProviderKind.google);
    await pumpEventQueue();

    expect(outcome, isA<SignInSucceeded>());
    expect(browser.closeCount, 1);
  });

  test('closes the browser only once per handoff', () async {
    await repository.signIn(AuthProviderKind.discord);

    await deepLinkReturns(AuthChangeEvent.signedIn);
    await deepLinkReturns(AuthChangeEvent.signedIn);

    expect(browser.closeCount, 1);
  });

  test('gives up the wait on dispose', () async {
    await repository.signIn(AuthProviderKind.discord);

    repository.dispose();
    await deepLinkReturns(AuthChangeEvent.signedIn);

    expect(browser.closeCount, 0);
  });

  test('signs in with email and password', () async {
    when(
      () => auth.signInWithPassword(
        email: any(named: 'email'),
        password: any(named: 'password'),
      ),
    ).thenAnswer((_) async => AuthResponse());

    final outcome = await repository.signInWithEmail(
      email: ' appreview@fabtrades.net ',
      password: 'secret',
    );

    expect(outcome, isA<SignInSucceeded>());
    verify(
      () => auth.signInWithPassword(
        email: 'appreview@fabtrades.net',
        password: 'secret',
      ),
    ).called(1);
  });

  test('rejects empty email credentials', () async {
    final outcome = await repository.signInWithEmail(
      email: '  ',
      password: 'secret',
    );

    expect(outcome, isA<SignInFailed>());
    verifyNever(
      () => auth.signInWithPassword(
        email: any(named: 'email'),
        password: any(named: 'password'),
      ),
    );
  });
}
