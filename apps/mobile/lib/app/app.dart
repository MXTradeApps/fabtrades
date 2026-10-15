import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:showcaseview/showcaseview.dart';

import '../core/analytics/analytics.dart';
import '../core/models/app_settings.dart';
import '../core/providers.dart';
import '../features/binder/binder_screen.dart';
import '../features/lend/lend_screen.dart';
import '../features/onboarding/onboarding_keys.dart';
import '../features/onboarding/onboarding_provider.dart';
import '../features/onboarding/onboarding_repository.dart';
import '../features/onboarding/showcase_theme.dart';
import '../features/onboarding/tour_controller.dart';
import '../features/onboarding/welcome_carousel.dart';
import '../features/search/search_screen.dart';
import '../features/sync/sync_host.dart';
import '../features/trade/trade_screen.dart';
import '../features/update/update_prompt.dart';
import 'more_sheet.dart';
import 'theme.dart';

class FabTradesApp extends ConsumerWidget {
  const FabTradesApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    return MaterialApp(
      title: 'FAB Trades',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: settings.themeMode == AppThemeMode.dark
          ? ThemeMode.dark
          : ThemeMode.light,
      navigatorObservers: [PosthogObserver()],
      home: const SyncHost(child: UpdatePromptHost(child: _OnboardingGate())),
    );
  }
}

/// Shows the welcome carousel once, then the main tab shell.
class _OnboardingGate extends ConsumerWidget {
  const _OnboardingGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seen = ref.watch(onboardingProvider);
    if (!seen.contains(OnboardingTourId.welcome)) {
      return WelcomeCarousel(
        onFinished: () {
          // Provider update rebuilds this gate into HomeShell.
        },
      );
    }
    return const HomeShell();
  }
}

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;
  late final TourController _tours;
  int? _activeTourTab;

  // One navigator per tab so pushed screens (set catalog, card detail, picker,
  // etc.) stay inside the shell and keep the bottom NavigationBar visible.
  final _navKeys = List<GlobalKey<NavigatorState>>.generate(
    4,
    (_) => GlobalKey<NavigatorState>(),
  );
  final _navObservers = List<NavigatorObserver>.generate(
    4,
    (_) => PosthogObserver(),
  );

  // Note: the Scan feature (ScanScreen) is still implemented and can be
  // opened via Browse / Binder add paths — it is not a top-level tab.
  static const _tabRoots = [
    BrowseScreen(),
    TradeScreen(),
    BinderScreen(),
    LendScreen(),
  ];

  static const _tabScreenNames = ['Home', 'Trade', 'Binder', 'Lend'];

  /// The fifth destination is not a tab: it opens the More sheet.
  static const _moreIndex = 4;

  @override
  void initState() {
    super.initState();
    _tours = TourController(ref);
    ShowcaseView.register(
      scope: OnboardingKeys.homeScope,
      disableMovingAnimation: true,
      enableAutoScroll: true,
      skipIfTargetNotPresent: true,
      globalTooltipActionConfig: ShowcaseTheme.actionConfig,
      globalTooltipActions: ShowcaseTheme.homeActions,
      onFinish: _onTourFinished,
      onDismiss: (_) => _onTourFinished(),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _maybeStartTourForTab(_index);
    });
  }

  @override
  void dispose() {
    ShowcaseView.getNamed(OnboardingKeys.homeScope).unregister();
    super.dispose();
  }

  void _onTourFinished() {
    final tab = _activeTourTab;
    _activeTourTab = null;
    if (tab == 1) _tours.cleanupTradeSeed();
    if (tab == null) return;
    final id = switch (tab) {
      1 => OnboardingTourId.trade,
      2 => OnboardingTourId.binder,
      3 => OnboardingTourId.lend,
      _ => null,
    };
    if (id != null) _tours.markSeen(id);
  }

  NavigatorState? get _activeNav => _navKeys[_index].currentState;

  void _selectTab(int i) {
    if (i == _moreIndex) {
      HapticFeedback.selectionClick();
      final ctx = _navKeys[_index].currentContext;
      if (ctx != null) showMoreSheet(ctx);
      return;
    }
    if (i == _index) {
      // Re-tapping the current tab pops back to its root.
      _activeNav?.popUntil((r) => r.isFirst);
      if (i == 2) {
        ref.read(openBinderIdProvider.notifier).close();
      }
      return;
    }
    // Cancel any in-progress tour before leaving the tab — IndexedStack keeps
    // every Showcase mounted, so a mid-tour switch would highlight the wrong
    // screen. dismiss() invokes onDismiss → _onTourFinished synchronously,
    // which marks the tour seen and clears any seeded trade draft.
    if (_activeTourTab != null) {
      _tours.dismissHomeTour();
    }
    HapticFeedback.selectionClick();
    setState(() => _index = i);
    if (i >= 0 && i < _tabScreenNames.length) {
      ref.read(analyticsProvider).screen(_tabScreenNames[i]);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _maybeStartTourForTab(i);
    });
  }

  void _maybeStartTourForTab(int i) {
    // Home has no dedicated tour; Scan teaches itself when opened.
    if (i == 0) return;
    final id = switch (i) {
      1 => OnboardingTourId.trade,
      2 => OnboardingTourId.binder,
      3 => OnboardingTourId.lend,
      _ => null,
    };
    if (id == null || _tours.hasSeen(id)) return;

    final keys = switch (i) {
      1 => _tours.prepareTradeTour(),
      2 => _tours.binderKeys(),
      3 => _tours.lendKeys(),
      _ => <GlobalKey>[],
    };
    if (keys.isEmpty) {
      _tours.markSeen(id);
      return;
    }
    _activeTourTab = i;
    // Force a rebuild so seeded trade cards / Showcase wrappers are laid out
    // before startShowCase measures them.
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _index != i) return;
      _tours.startHomeTour(keys);
    });
  }

  Widget _tabNavigator(int i) {
    return Navigator(
      key: _navKeys[i],
      observers: [_navObservers[i]],
      onGenerateInitialRoutes: (navigator, initialRoute) {
        return [
          MaterialPageRoute<void>(
            builder: (_) => _tabRoots[i],
            settings: RouteSettings(name: _tabScreenNames[i]),
          ),
        ];
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int?>(shellTabProvider, (_, next) {
      if (next == null) return;
      ref.read(shellTabProvider.notifier).clear();
      if (next != _index) _selectTab(next);
    });
    final draft = ref.watch(tradeDraftProvider);
    final tradeCount = draft.haveCount + draft.wantCount;

    // System back pops the active tab stack before leaving the app.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final nav = _activeNav;
        if (nav != null && nav.canPop()) {
          nav.pop();
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: SafeArea(
          bottom: false,
          child: IndexedStack(
            index: _index,
            children: [
              for (var i = 0; i < _tabRoots.length; i++) _tabNavigator(i),
            ],
          ),
        ),
        bottomNavigationBar: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: context.tokens.border)),
          ),
          child: NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: _selectTab,
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: tradeCount > 0,
                  label: Text('$tradeCount'),
                  child: const Icon(Icons.swap_horiz_rounded),
                ),
                selectedIcon: Badge(
                  isLabelVisible: tradeCount > 0,
                  label: Text('$tradeCount'),
                  child: const Icon(Icons.swap_horiz_rounded),
                ),
                label: 'Trade',
              ),
              const NavigationDestination(
                icon: Icon(Icons.collections_bookmark_outlined),
                selectedIcon: Icon(Icons.collections_bookmark),
                label: 'Binder',
              ),
              const NavigationDestination(
                icon: Icon(Icons.sync_alt_rounded),
                selectedIcon: Icon(Icons.sync_alt_rounded),
                label: 'Lend',
              ),
              const NavigationDestination(
                icon: Icon(Icons.more_horiz_rounded),
                label: 'More',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
