import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/analytics/analytics.dart';
import '../auth/sign_in_sheet.dart';
import 'onboarding_provider.dart';
import 'onboarding_repository.dart';
import 'tour_copy.dart';

/// First-launch welcome flow: three cards ending in a soft sign-in CTA.
class WelcomeCarousel extends ConsumerStatefulWidget {
  const WelcomeCarousel({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  ConsumerState<WelcomeCarousel> createState() => _WelcomeCarouselState();
}

class _WelcomeCarouselState extends ConsumerState<WelcomeCarousel> {
  final _page = PageController();
  int _index = 0;

  static const _pages = [
    _CarouselPage(
      icon: Icons.swap_horiz,
      title: TourCopy.carousel1Title,
      body: TourCopy.carousel1Body,
    ),
    _CarouselPage(
      icon: Icons.menu_book_outlined,
      title: TourCopy.carousel2Title,
      body: TourCopy.carousel2Body,
    ),
    _CarouselPage(
      icon: Icons.cloud_sync_outlined,
      title: TourCopy.carousel3Title,
      body: TourCopy.carousel3Body,
      isSignIn: true,
    ),
  ];

  Future<void> _finish({bool signedIn = false}) async {
    ref
        .read(analyticsProvider)
        .capture('onboarding_completed', {'signed_in': signedIn});
    await ref
        .read(onboardingProvider.notifier)
        .markSeen(OnboardingTourId.welcome);
    if (!mounted) return;
    widget.onFinished();
  }

  Future<void> _skip() async {
    ref
        .read(analyticsProvider)
        .capture('onboarding_skipped', {'page_index': _index});
    // Skip is its own event — do not also fire onboarding_completed.
    await ref
        .read(onboardingProvider.notifier)
        .markSeen(OnboardingTourId.welcome);
    if (!mounted) return;
    widget.onFinished();
  }

  Future<void> _signIn() async {
    final signedIn = await presentSignIn(context, source: 'welcome_carousel');
    if (!mounted) return;
    await _finish(signedIn: signedIn);
  }

  void _next() {
    if (_index >= _pages.length - 1) {
      _finish();
      return;
    }
    _page.nextPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void initState() {
    super.initState();
    ref.read(analyticsProvider).screen('Welcome');
    ref.read(analyticsProvider).capture('onboarding_started');
  }

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isLast = _index == _pages.length - 1;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _skip,
                child: const Text(TourCopy.carouselSkip),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _page,
                itemCount: _pages.length,
                onPageChanged: (i) {
                  setState(() => _index = i);
                  ref
                      .read(analyticsProvider)
                      .capture('onboarding_page_viewed', {'page_index': i});
                },
                itemBuilder: (context, i) {
                  final page = _pages[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 88,
                          height: 88,
                          decoration: BoxDecoration(
                            color: scheme.primaryContainer,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            page.icon,
                            size: 44,
                            color: scheme.onPrimaryContainer,
                          ),
                        ),
                        const SizedBox(height: 28),
                        Text(
                          page.title,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          page.body,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: scheme.onSurfaceVariant,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _pages.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _index ? 20 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _index
                          ? scheme.primary
                          : scheme.outlineVariant,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: isLast
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FilledButton(
                          onPressed: _signIn,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(48),
                          ),
                          child: const Text(TourCopy.carouselSignIn),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => _finish(),
                          child: const Text(TourCopy.carouselMaybeLater),
                        ),
                      ],
                    )
                  : SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _next,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          backgroundColor: AppTheme.brown,
                        ),
                        child: const Text('Next'),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CarouselPage {
  const _CarouselPage({
    required this.icon,
    required this.title,
    required this.body,
    this.isSignIn = false,
  });

  final IconData icon;
  final String title;
  final String body;
  final bool isSignIn;
}
