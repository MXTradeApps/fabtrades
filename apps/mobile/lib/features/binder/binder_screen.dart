import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../app/app.dart';
import '../../app/theme.dart';
import '../../core/logic/binder_names.dart';
import '../../core/logic/free_limits.dart';
import '../../core/models/binder.dart';
import '../../core/models/binder_entry.dart';
import '../../core/providers.dart';
import '../onboarding/onboarding_keys.dart';
import '../onboarding/onboarding_provider.dart';
import '../onboarding/onboarding_repository.dart';
import '../onboarding/showcase_theme.dart';
import '../onboarding/tour_controller.dart';
import '../onboarding/tour_copy.dart';
import '../paywall/pro_limits.dart';
import '../paywall/pro_paywall.dart';
import '../scan/scan_screen.dart';
import '../search/card_picker.dart';
import '../want_list/want_list_screen.dart';
import 'binder_grid.dart';
import 'binder_list.dart';
import 'binder_settings_screen.dart';
import 'collection_stats_screen.dart';

class BinderScreen extends ConsumerStatefulWidget {
  const BinderScreen({super.key});

  @override
  ConsumerState<BinderScreen> createState() => _BinderScreenState();
}

class _BinderScreenState extends ConsumerState<BinderScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this);
  bool _wantTourStarted = false;

  @override
  void initState() {
    super.initState();
    _tab.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (_tab.indexIsChanging) return;
    setState(() {});
    if (_tab.index == 1) _maybeStartWantListTour();
  }

  void _maybeStartWantListTour() {
    if (_wantTourStarted) return;
    if (ref.read(onboardingProvider).contains(OnboardingTourId.wantList)) {
      return;
    }

    final home = ShowcaseView.getNamed(OnboardingKeys.homeScope);
    if (home.isShowcaseRunning) return;

    _wantTourStarted = true;
    final hasCards =
        ref.read(binderProvider).any((e) => e.isWanted && e.quantity > 0);
    final tours = TourController(ref);
    final keys = tours.wantListKeys(hasCards: hasCards);

    late final void Function(GlobalKey?) onDismiss;
    void finishTour() {
      tours.markSeen(OnboardingTourId.wantList);
      home.removeOnFinishCallback(finishTour);
      home.removeOnDismissCallback(onDismiss);
    }

    onDismiss = (GlobalKey? _) => finishTour();

    home.addOnFinishCallback(finishTour);
    home.addOnDismissCallback(onDismiss);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _tab.index != 1) {
        finishTour();
        return;
      }
      tours.startHomeTour(keys);
    });
  }

  @override
  void dispose() {
    _tab.removeListener(_onTabChanged);
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entries = ref.watch(binderProvider);
    final binders = ref.watch(bindersProvider);
    final pricing = ref.watch(pricingProvider);
    final openId = ref.watch(openBinderIdProvider);
    final wanted = entries.where((e) => e.isWanted).toList();
    final owned = entries.where((e) => !e.isWanted).toList();
    final onBinderTab = _tab.index == 0;
    final inBinder = onBinderTab && openId != null;
    final openRows = openId == null
        ? const <BinderEntry>[]
        : ownedInBinder(owned, openId);
    final title = _appBarTitle(
      onBinderTab: onBinderTab,
      openId: openId,
      binders: binders,
    );

    return Scaffold(
      appBar: AppBar(
        leading: inBinder
            ? IconButton(
                key: const Key('binderBackToGrid'),
                icon: const Icon(Icons.arrow_back),
                tooltip: 'Back to Binders',
                onPressed: () {
                  ref.read(binderFiltersProvider.notifier).clear();
                  ref.read(openBinderIdProvider.notifier).close();
                },
              )
            : null,
        title: Text(title, key: const Key('binderHomeTitle')),
        actions: [
          if (onBinderTab && openId == null)
            TextButton.icon(
              key: const Key('createBinder'),
              onPressed: () => _createBinder(context),
              icon: const Icon(Icons.add_box_outlined),
              label: const Text('New'),
            ),
          if (inBinder)
            IconButton(
              key: const Key('binderSettings'),
              tooltip: 'Settings',
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => _openSettings(context, openId),
            ),
          const AppMenuAction(),
        ],
        bottom: inBinder
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(46),
                child: ShowcaseTheme.mark(
                  key: OnboardingKeys.binderTabs,
                  title: TourCopy.binderTabsTitle,
                  description: TourCopy.binderTabsBody,
                  child: TabBar(
                    controller: _tab,
                    tabs: [
                      Tab(text: 'Binder (${_count(owned)})'),
                      Tab(text: 'Want List (${_count(wanted)})'),
                    ],
                  ),
                ),
              ),
      ),
      body: TabBarView(
        controller: _tab,
        physics: inBinder ? const NeverScrollableScrollPhysics() : null,
        children: [
          openId == null
              ? BinderGrid(
                  onOpen: (id) {
                    ref.read(binderFiltersProvider.notifier).clear();
                    ref.read(openBinderIdProvider.notifier).open(id);
                  },
                  onRename: (id) => _renameBinder(context, id),
                  onDelete: (id) => _deleteBinder(context, id),
                  onSettings: (id) => _openSettings(context, id),
                )
              : BinderList(binderId: openId, pricing: pricing),
          WantListPane(
            onAdd: () => _addBySearch(isWanted: true),
          ),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: SizedBox(
        key: const Key('binderActionRow'),
        width: MediaQuery.sizeOf(context).width - 32,
        height: 56,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (onBinderTab && openId != null && openRows.isNotEmpty) ...[
              Flexible(
                child: Align(
                  alignment: Alignment.centerLeft,
                  heightFactor: 1,
                  widthFactor: 1,
                  child: ShowcaseTheme.mark(
                    key: OnboardingKeys.binderTotal,
                    title: TourCopy.binderTotalTitle,
                    description: TourCopy.binderTotalBody,
                    child: _CollectionStatsButton(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          settings:
                              const RouteSettings(name: 'Collection Stats'),
                          builder: (_) => const CollectionStatsScreen(),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
            ] else
              const SizedBox.shrink(),
            ShowcaseTheme.mark(
              key: OnboardingKeys.binderFab,
              title: TourCopy.binderFabTitle,
              description: TourCopy.binderFabBody,
              child: FloatingActionButton.extended(
                heroTag: 'binderFab',
                onPressed: () => onBinderTab
                    ? _showBinderAddOptions(context)
                    : _addBySearch(isWanted: true),
                icon: const Icon(Icons.add),
                label: Text(onBinderTab ? 'Add card' : 'Add want'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  int _count(List<BinderEntry> e) => e.fold<int>(0, (s, x) => s + x.quantity);

  static String _appBarTitle({
    required bool onBinderTab,
    required String? openId,
    required List<Binder> binders,
  }) {
    if (!onBinderTab) return 'Want List';
    if (openId == null) return 'My Binders';
    for (final binder in binders) {
      if (binder.clientId == openId && binder.isLive) return binder.name;
    }
    return 'Binder';
  }

  Future<void> _openSettings(BuildContext context, String binderId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'Settings'),
        builder: (_) => BinderSettingsScreen(binderId: binderId),
      ),
    );
  }

  Future<void> _createBinder(BuildContext context) async {
    final isPro = ref.read(isProProvider);
    if (!FreeLimits.canCreateBinder(
        ref.read(bindersProvider.notifier).live.length,
        isPro: isPro)) {
      await presentProPaywall(
        context,
        ref,
        trigger: 'binders_limit',
      );
      if (!context.mounted) return;
      if (!ref.read(isProProvider)) return;
    }
    final name = await _promptName(context, title: 'New Binder');
    if (name == null || !context.mounted) return;
    final result = ref
        .read(bindersProvider.notifier)
        .create(name, isPro: ref.read(isProProvider));
    if (!result.ok && context.mounted) {
      if (result.reason == 'paywall') {
        await presentProPaywall(context, ref, trigger: 'binders_limit');
      } else {
        _showNameError(context, result);
      }
    }
  }

  Future<void> _renameBinder(BuildContext context, String clientId) async {
    final current = ref.read(bindersProvider.notifier).byId(clientId);
    final name = await _promptName(
      context,
      title: 'Rename Binder',
      initial: current?.name ?? '',
    );
    if (name == null || !context.mounted) return;
    final result = ref.read(bindersProvider.notifier).rename(clientId, name);
    if (!result.ok && context.mounted) _showNameError(context, result);
  }

  Future<void> _deleteBinder(BuildContext context, String clientId) async {
    final err = ref.read(bindersProvider.notifier).delete(clientId);
    if (err == null || !context.mounted) return;
    final message = switch (err) {
      'trade' => 'Trade Binder cannot be deleted',
      'not-empty' => 'Move or remove cards before deleting this Binder',
      _ => 'Could not delete Binder',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  void _showNameError(BuildContext context, BinderNameResult result) {
    final message = switch (result.reason) {
      'duplicate' => 'A Binder with that name already exists',
      'empty' => 'Name cannot be empty',
      _ => 'Could not save name',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<String?> _promptName(
    BuildContext context, {
    required String title,
    String initial = '',
  }) async {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          key: const Key('binderNameField'),
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Binder name'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _showBinderAddOptions(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.qr_code_scanner),
              title: const Text('Scan cards'),
              subtitle: const Text('Add each match and keep scanning'),
              onTap: () {
                Navigator.pop(ctx);
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (context.mounted) ScanScreen.forBinder(context);
                });
              },
            ),
            ListTile(
              leading: const Icon(Icons.search),
              title: const Text('Add by search'),
              onTap: () {
                Navigator.pop(ctx);
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (context.mounted) _addBySearch(isWanted: false);
                });
              },
            ),
          ],
        ),
      ),
      routeSettings: const RouteSettings(name: 'Add To Binder'),
    );
  }

  Future<void> _addBySearch({required bool isWanted}) async {
    await CardPickerScreen.showMulti(
      context,
      title: isWanted ? 'Add to Want List' : 'Add to Binder',
      onPick: (card) => addToBinderOrUpsell(
        context,
        ref,
        card,
        isWanted: isWanted,
        binderId: isWanted
            ? null
            : (ref.read(openBinderIdProvider) ?? BinderIds.trade),
        successMessage:
            'Added ${card.name} to ${isWanted ? 'Want List' : 'Binder'}',
        source: 'search',
      ),
    );
  }
}

class _CollectionStatsButton extends StatelessWidget {
  const _CollectionStatsButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Material(
      elevation: 6,
      shadowColor: Colors.black54,
      color: scheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        key: const Key('collectionStatsButton'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Semantics(
          button: true,
          label: 'Collection Stats',
          child: SizedBox(
            height: 56,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Center(
                child: Text(
                  'Collection Stats',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppTheme.positive,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
