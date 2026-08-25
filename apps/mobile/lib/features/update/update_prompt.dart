import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/providers.dart';

/// Runs once after the first frame and shows a soft update dialog when the
/// installed release is behind `fab_app_config.latest_version` /
/// `latest_build`.
class UpdatePromptHost extends ConsumerStatefulWidget {
  const UpdatePromptHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<UpdatePromptHost> createState() => _UpdatePromptHostState();
}

class _UpdatePromptHostState extends ConsumerState<UpdatePromptHost> {
  var _checked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePrompt());
  }

  Future<void> _maybePrompt() async {
    if (_checked || !mounted) return;
    _checked = true;

    final prompt = await ref.read(appUpdatePromptProvider.future);
    if (!mounted || prompt == null) return;

    final messenger = ScaffoldMessenger.maybeOf(context);
    final repo = ref.read(appUpdateRepositoryProvider);
    final analytics = ref.read(analyticsProvider);

    analytics.capture('update_prompt_shown', {
      'latest_version': prompt.latestVersion,
      'latest_build': prompt.latestBuild ?? '',
      'current_version': prompt.installedVersion,
      'current_build': prompt.installedBuild,
    });

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog.adaptive(
        title: const Text('Update available'),
        content: Text(prompt.message),
        actions: [
          TextButton(
            onPressed: () async {
              analytics.capture('update_prompt_dismissed');
              await repo.dismiss(prompt.dismissToken);
              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
            },
            child: const Text('Later'),
          ),
          TextButton(
            onPressed: () async {
              analytics.capture('update_prompt_accepted');
              final opened = await repo.openStore(prompt.storeUrl);
              if (!dialogContext.mounted) return;
              Navigator.of(dialogContext).pop();
              if (!opened) {
                messenger?.showSnackBar(
                  const SnackBar(
                    content: Text('Could not open the store listing.'),
                  ),
                );
              }
            },
            child: const Text('Update'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
