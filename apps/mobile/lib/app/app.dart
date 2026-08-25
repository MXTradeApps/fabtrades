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
import '../features/life_tracker/life_tracker_screen.dart';
import '../features/onboarding/onboarding_keys.dart';
import '../features/onboarding/onboarding_provider.dart';
import '../features/onboarding/onboarding_repository.dart';
import '../features/onboarding/showcase_theme.dart';
import '../features/onboarding/tour_controller.dart';
import '../features/onboarding/welcome_carousel.dart';
import '../features/search/search_screen.dart';
import '../features/settings/account_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/sync/sync_host.dart';
import '../features/trade/trade_screen.dart';
import '../features/update/update_prompt.dart';
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

  static const _tabScreenNames = ['Browse', 'Trade', 'Binder', 'Lend'];

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
    // Browse has no dedicated tour; Scan teaches itself when opened.
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
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _selectTab,
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.grid_view_outlined),
              selectedIcon: Icon(Icons.grid_view),
              label: 'Browse',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: tradeCount > 0,
                label: Text('$tradeCount'),
                child: const Icon(Icons.swap_horiz_outlined),
              ),
              selectedIcon: Badge(
                isLabelVisible: tradeCount > 0,
                label: Text('$tradeCount'),
                child: const Icon(Icons.swap_horiz),
              ),
              label: 'Trade',
            ),
            const NavigationDestination(
              icon: Icon(Icons.menu_book_outlined),
              selectedIcon: Icon(Icons.menu_book),
              label: 'Binder',
            ),
            const NavigationDestination(
              icon: Icon(Icons.sync_alt_outlined),
              selectedIcon: Icon(Icons.sync_alt),
              label: 'Lend',
            ),
          ],
        ),
      ),
    );
  }
}

/// Shared app bar action that opens the account / settings menu.
class AppMenuAction extends StatelessWidget {
  const AppMenuAction({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.menu),
      tooltip: 'Menu',
      onPressed: () => _showAppMenu(context),
    );
  }
}

Future<void> _showAppMenu(BuildContext context) async {
  // Capture the caller's navigator: the drawer's context is unmounted after pop.
  final parentContext = context;
  await showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (dialogContext, animation, secondaryAnimation) {
      final width = MediaQuery.sizeOf(dialogContext).width;
      return Align(
        alignment: Alignment.centerRight,
        child: Material(
          color: Theme.of(dialogContext).colorScheme.surface,
          elevation: 16,
          child: SizedBox(
            width: width < 360 ? width * 0.85 : 304,
            height: double.infinity,
            child: _AppMenuDrawer(parentContext: parentContext),
          ),
        ),
      );
    },
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(1, 0),
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
        )),
        child: child,
      );
    },
  );
}

class _AppMenuDrawer extends ConsumerWidget {
  const _AppMenuDrawer({required this.parentContext});

  final BuildContext parentContext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(isSignedInProvider);

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            leading: Icon(
              signedIn ? Icons.person_outline : Icons.person_add_outlined,
            ),
            title: Text(signedIn ? 'My Account' : 'Sign up'),
            onTap: () {
              Navigator.of(context).pop();
              Navigator.of(parentContext).push(
                MaterialPageRoute(
                  builder: (_) => const AccountScreen(),
                  settings: const RouteSettings(name: 'Account'),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.favorite_outline),
            title: const Text('Life Tracker'),
            onTap: () {
              Navigator.of(context).pop();
              // Root navigator so the tracker covers the tab bar.
              Navigator.of(parentContext, rootNavigator: true).push(
                MaterialPageRoute(
                  builder: (_) => const LifeTrackerScreen(),
                  settings: const RouteSettings(name: 'Life Tracker'),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.tune),
            title: const Text('Settings'),
            onTap: () {
              Navigator.of(context).pop();
              Navigator.of(parentContext).push(
                MaterialPageRoute(
                  builder: (_) => const SettingsScreen(),
                  settings: const RouteSettings(name: 'Settings'),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
