import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/models/account.dart';
import '../../core/providers.dart';
import 'auth_provider_icons.dart';

/// Shows the sign-in sheet and resolves to true once an account is signed in.
///
/// Redirect-based providers finish in a browser, so this does not wait for the
/// session: it closes when the browser opens and the customer comes back to an
/// app that has already updated via [accountProvider].
///
/// [source] identifies where the sheet was opened from, for analytics (e.g.
/// `account`, `welcome_carousel`, `post_purchase`).
Future<bool> presentSignIn(
  BuildContext context, {
  String source = 'unknown',
  SignInCopy copy = SignInCopy.syncCollection,
}) async {
  // No WidgetRef here — this is a bare function, not a widget — so reach the
  // provider container directly rather than threading a ref through callers.
  ProviderScope.containerOf(context)
      .read(analyticsProvider)
      .capture('sign_in_sheet_shown', {'source': source});
  final signedIn = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    routeSettings: const RouteSettings(name: 'Sign In'),
    builder: (_) => SignInSheet(copy: copy),
  );
  return signedIn ?? false;
}

/// Headline and body for [SignInSheet], so the same providers can be offered
/// for sync and for the optional post-purchase "keep Pro on other devices"
/// prompt App Review 5.1.1 asks for.
class SignInCopy {
  const SignInCopy({
    required this.title,
    required this.body,
    this.dismissLabel,
  });

  final String title;
  final String body;

  /// When set, a dismiss control with this label is shown. The sheet is always
  /// skippable via the drag handle; this just makes that obvious.
  final String? dismissLabel;

  static const syncCollection = SignInCopy(
    title: 'Sync your collection',
    body:
        'Sign in to keep your binder, want list, and trade history on '
        'every device you use. Everything already on this device is kept.',
  );

  static const keepProOnOtherDevices = SignInCopy(
    title: 'Use Pro on other devices',
    body:
        'Sign in to keep FABTrades Pro on every device you use, along with '
        'your binder and trade history. You can do this later in My Account.',
    dismissLabel: 'Not now',
  );
}

/// Why an account is worth having, then one button per provider.
///
/// Signing in is never required to use FAB Trades — it exists to sync a binder
/// across devices, and optionally to carry Pro to other devices — so this is
/// always a sheet the customer can dismiss, never a wall in front of the app.
class SignInSheet extends ConsumerStatefulWidget {
  const SignInSheet({
    super.key,
    this.copy = SignInCopy.syncCollection,
  });

  final SignInCopy copy;

  @override
  ConsumerState<SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends ConsumerState<SignInSheet> {
  AuthProviderKind? _busy;
  String? _error;
  bool _showEmailForm = false;
  bool _obscurePassword = true;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn(AuthProviderKind provider) async {
    setState(() {
      _busy = provider;
      _error = null;
    });
    ref
        .read(analyticsProvider)
        .capture('sign_in_started', {'provider': provider.id});

    final outcome = await ref.read(authRepositoryProvider).signIn(provider);
    if (!mounted) return;

    switch (outcome) {
      // Both count as done here. Pending means a browser is open, and leaving
      // the sheet up behind it would greet the customer with a stale spinner.
      case SignInSucceeded():
      case SignInPending():
        Navigator.of(context).pop(true);
      case SignInCancelled():
        setState(() => _busy = null);
      case SignInFailed(:final message):
        ref.read(analyticsProvider).capture('sign_in_failed', {
          'provider': provider.id,
          'error_type': 'failed',
        });
        setState(() {
          _busy = null;
          _error = message;
        });
    }
  }

  Future<void> _signInWithEmail() async {
    setState(() {
      _busy = AuthProviderKind.email;
      _error = null;
    });
    ref.read(analyticsProvider).capture(
        'sign_in_started', {'provider': AuthProviderKind.email.id});

    final outcome = await ref.read(authRepositoryProvider).signInWithEmail(
          email: _emailController.text,
          password: _passwordController.text,
        );
    if (!mounted) return;

    switch (outcome) {
      case SignInSucceeded():
        Navigator.of(context).pop(true);
      case SignInPending():
      case SignInCancelled():
        setState(() => _busy = null);
      case SignInFailed(:final message):
        ref.read(analyticsProvider).capture('sign_in_failed', {
          'provider': AuthProviderKind.email.id,
          'error_type': 'failed',
        });
        setState(() {
          _busy = null;
          _error = message;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final providers = ref.watch(authProvidersProvider);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(24, 4, 24, 24 + bottomInset),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(widget.copy.title, style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                widget.copy.body,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 24),
              ...switch (providers) {
                AsyncData(:final value) => [
                    for (final provider in value) ...[
                      _ProviderButton(
                        provider: provider,
                        busy: _busy == provider,
                        // One sign-in at a time: two open browser handoffs would
                        // race to write the session.
                        onPressed: _busy == null
                            ? () => _signIn(provider)
                            : null,
                      ),
                      const SizedBox(height: 10),
                    ],
                  ],
                AsyncError() => [
                    Text(
                      "Couldn't load sign-in options.",
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: theme.colorScheme.error),
                    ),
                  ],
                _ => [
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                  ],
              },
              const SizedBox(height: 4),
              TextButton(
                onPressed: _busy == null
                    ? () => setState(() => _showEmailForm = !_showEmailForm)
                    : null,
                child: Text(
                  _showEmailForm
                      ? 'Hide email sign-in'
                      : 'Sign in with email',
                ),
              ),
              if (_showEmailForm) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _emailController,
                  enabled: _busy == null,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _passwordController,
                  enabled: _busy == null,
                  obscureText: _obscurePassword,
                  autofillHints: const [AutofillHints.password],
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) {
                    if (_busy == null) _signInWithEmail();
                  },
                  decoration: InputDecoration(
                    labelText: 'Password',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      onPressed: () => setState(
                        () => _obscurePassword = !_obscurePassword,
                      ),
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: _busy == null ? _signInWithEmail : null,
                    child: _busy == AuthProviderKind.email
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Sign in'),
                  ),
                ),
              ],
              ?_errorText(theme),
              const SizedBox(height: 8),
              Text(
                'We only ever read your name, email, and avatar.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              if (widget.copy.dismissLabel != null) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _busy == null
                      ? () => Navigator.of(context).pop(false)
                      : null,
                  child: Text(widget.copy.dismissLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget? _errorText(ThemeData theme) {
    final error = _error;
    if (error == null) return null;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline, size: 16, color: theme.colorScheme.error),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              error,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.error),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({
    required this.provider,
    required this.busy,
    required this.onPressed,
  });

  final AuthProviderKind provider;
  final bool busy;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : authProviderIcon(provider, size: 20),
        label: Text('Continue with ${provider.label}'),
      ),
    );
  }
}
