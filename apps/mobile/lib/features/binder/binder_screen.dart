import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../app/theme.dart';
import '../../core/logic/binder_names.dart';
import '../../core/logic/binder_text.dart';
import '../../core/logic/free_limits.dart';
import '../../core/models/binder.dart';
import '../../core/models/binder_entry.dart';
import '../../core/models/trade.dart';
import '../../core/providers.dart';
import '../auth/sign_in_sheet.dart';
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
import 'collection_stats_screen.dart';
import 'sale_post_sheet.dart';

class BinderScreen extends ConsumerStatefulWidget {
  const BinderScreen({super.key});

  @override
  ConsumerState<BinderScreen> createState() => _BinderScreenState();
}

class _BinderScreenState extends ConsumerState<BinderScreen> {
  bool _wantTourStarted = false;

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
      if (!mounted || ref.read(openBinderIdProvider) != BinderIds.want) {
        finishTour();
        return;
      }
      tours.startHomeTour(keys);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<String?>(openBinderIdProvider, (_, next) {
      if (next == BinderIds.want) _maybeStartWantListTour();
    });
    final entries = ref.watch(binderProvider);
    final binders = ref.watch(bindersProvider);
    final pricing = ref.watch(pricingProvider);
    final openId = ref.watch(openBinderIdProvider);
    final wanted = entries.where((e) => e.isWanted).toList();
    final viewingWants = openId == BinderIds.want;
    final inBinder = openId != null;
    final inOwnedBinder = inBinder && !viewingWants;
    final openRows = openId == null || viewingWants
        ? const <BinderEntry>[]
        : ownedInBinder(entries, openId);
    final title = _appBarTitle(openId: openId, binders: binders);

    final selection = ref.watch(binderSelectionProvider);
    final selecting = inOwnedBinder && selection.isNotEmpty;
    final selectionBar = selecting
        ? _SelectionActionBar(
            canMove: Binder.gridOrder(binders)
                .any((b) => b.isLive && !b.isWant && b.clientId != openId),
            onMove: () => _moveSelected(context),
            onTrade: () => _tradeSelected(context),
            onSell: () => _sellSelected(context),
            onRemove: () => _removeSelected(context),
          )
        : null;

    return PopScope(
      // Back leaves selection mode before it leaves the screen.
      canPop: !selecting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) ref.read(binderSelectionProvider.notifier).clear();
      },
      child: Scaffold(
        appBar: selecting
            ? _selectionAppBar(selection)
            : AppBar(
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
                title: ShowcaseTheme.mark(
                  key: OnboardingKeys.binderTabs,
                  title: TourCopy.binderTabsTitle,
                  description: TourCopy.binderTabsBody,
                  child: Text(title, key: const Key('binderHomeTitle')),
                ),
                actions: [
                  if (openId == null)
                    TextButton.icon(
                      key: const Key('createBinder'),
                      onPressed: () => _createBinder(context),
                      icon: const Icon(Icons.add_box_outlined),
                      label: const Text('New'),
                    ),
                  if (viewingWants && _count(wanted) > 0)
                    TextButton(
                      key: const Key('clearBinder'),
                      onPressed: () => _clearBinder(context),
                      child: const Text('Clear Want List'),
                    ),
                  if (inOwnedBinder)
                    PopupMenuButton<String>(
                      key: const Key('binderOverflow'),
                      tooltip: 'Binder actions',
                      icon: const Icon(Icons.more_vert),
                      onSelected: (action) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (!context.mounted) return;
                          if (action == 'clear') _clearBinder(context);
                          if (action == 'share') _shareBinder(context);
                          if (action == 'sell') _sellBinder(context);
                        });
                      },
                      itemBuilder: (_) => [
                        if (openRows.isNotEmpty)
                          const PopupMenuItem(
                            key: Key('sellBinder'),
                            value: 'sell',
                            child: Text('Post for sale'),
                          ),
                        if (openRows.isNotEmpty)
                          const PopupMenuItem(
                            key: Key('clearBinder'),
                            value: 'clear',
                            child: Text('Clear Binder'),
                          ),
                        const PopupMenuItem(
                          key: Key('shareBinder'),
                          value: 'share',
                          child: Text('Share Binder'),
                        ),
                      ],
                    ),
                ],
              ),
        body: openId == null
            ? BinderGrid(
                onOpen: (id) {
                  ref.read(binderFiltersProvider.notifier).clear();
                  ref.read(openBinderIdProvider.notifier).open(id);
                },
                onRename: (id) => _renameBinder(context, id),
                onDelete: (id) => _deleteBinder(context, id),
                onClear: (id) => _clearBinder(context, clientId: id),
              )
            : viewingWants
                ? WantListPane(
                    onAdd: () => _addBySearch(isWanted: true),
                  )
                : BinderList(binderId: openId, pricing: pricing),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: selectionBar ?? SizedBox(
          key: const Key('binderActionRow'),
          width: MediaQuery.sizeOf(context).width - 32,
          height: 56,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (inOwnedBinder && openRows.isNotEmpty) ...[
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
                  onPressed: () => viewingWants
                      ? _addBySearch(isWanted: true)
                      : _showBinderAddOptions(context),
                  icon: const Icon(Icons.add),
                  label: Text(viewingWants ? 'Add want' : 'Add card'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _selectionAppBar(Set<String> selection) {
    final visibleKeys =
        ref.read(filteredBinderProvider).map(binderRowKey).toList();
    final allSelected = visibleKeys.every(selection.contains);
    final notifier = ref.read(binderSelectionProvider.notifier);
    return AppBar(
      leading: IconButton(
        key: const Key('binderSelectionClose'),
        icon: const Icon(Icons.close),
        tooltip: 'Cancel selection',
        onPressed: notifier.clear,
      ),
      title: Text(
        '${selection.length} selected',
        key: const Key('binderSelectionCount'),
      ),
      actions: [
        TextButton(
          key: const Key('binderSelectAll'),
          onPressed: allSelected ? null : () => notifier.selectAll(visibleKeys),
          child: const Text('Select all'),
        ),
      ],
    );
  }

  /// Selected rows as they are now, so actions see current quantities.
  List<BinderEntry> _selectedRows() {
    final openId = ref.read(openBinderIdProvider);
    if (openId == null) return const [];
    final keys = ref.read(binderSelectionProvider);
    return ownedInBinder(ref.read(binderProvider), openId)
        .where((e) => keys.contains(binderRowKey(e)))
        .toList();
  }

  static String _cards(int n) => '$n ${n == 1 ? 'card' : 'cards'}';

  Future<void> _moveSelected(BuildContext context) async {
    final openId = ref.read(openBinderIdProvider);
    final rows = _selectedRows();
    if (openId == null || rows.isEmpty) return;
    final dests = Binder.gridOrder(ref.read(bindersProvider))
        .where((b) => b.isLive && !b.isWant && b.clientId != openId)
        .toList();
    final dest = await showModalBottomSheet<Binder>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(title: Text('Move ${_cards(rows.length)} to…')),
              for (final binder in dests)
                ListTile(
                  key: Key('bulkMoveDest-${binder.clientId}'),
                  leading: const Icon(Icons.collections_bookmark_outlined),
                  title: Text(binder.name),
                  onTap: () => Navigator.pop(ctx, binder),
                ),
            ],
          ),
        ),
      ),
      routeSettings: const RouteSettings(name: 'Bulk Move'),
    );
    if (dest == null || !context.mounted) return;
    final moved =
        ref.read(binderProvider.notifier).moveEntries(rows, dest.clientId);
    ref.read(binderSelectionProvider.notifier).clear();
    _toast(
      context,
      moved == rows.length
          ? 'Moved ${_cards(moved)} to ${dest.name}'
          : 'Moved $moved of ${_cards(rows.length)} to ${dest.name}',
    );
  }

  /// Puts one copy of each selected card on my side of the trade. The cards
  /// stay in the Binder until the trade is confirmed.
  void _tradeSelected(BuildContext context) {
    final rows = _selectedRows();
    if (rows.isEmpty) return;
    final trade = ref.read(tradeDraftProvider.notifier);
    for (final row in rows) {
      trade.addCard(TradeSide.have, row.card, source: 'binder_bulk');
    }
    ref.read(binderSelectionProvider.notifier).clear();
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        key: const Key('binderBulkTradeSnack'),
        content: Text('Added ${_cards(rows.length)} to your side of the trade'),
        action: SnackBarAction(
          label: 'View',
          onPressed: () =>
              ref.read(shellTabProvider.notifier).go(tradeTabIndex),
        ),
      ));
  }

  bool _openIsTradeBinder() {
    final openId = ref.read(openBinderIdProvider);
    return openId != null &&
        ref.read(bindersProvider.notifier).byId(openId)?.isTrade == true;
  }

  Future<void> _sellBinder(BuildContext context) async {
    final openId = ref.read(openBinderIdProvider);
    if (openId == null) return;
    final rows = ownedInBinder(ref.read(binderProvider), openId)
        .where((e) => e.quantity > 0)
        .toList();
    if (rows.isEmpty) return;
    await showSalePostSheet(
      context,
      ref,
      entries: rows,
      canLink: _openIsTradeBinder(),
      source: 'binder_menu',
    );
  }

  /// Lists only the selected cards. Selection stays so the seller can go
  /// straight on to Remove once they have sold.
  Future<void> _sellSelected(BuildContext context) async {
    final rows = _selectedRows();
    if (rows.isEmpty) return;
    await showSalePostSheet(
      context,
      ref,
      entries: rows,
      canLink: _openIsTradeBinder(),
      source: 'binder_selection',
    );
  }

  void _removeSelected(BuildContext context) {
    final rows = _selectedRows();
    if (rows.isEmpty) return;
    final notifier = ref.read(binderProvider.notifier);
    final removed = notifier.removeEntries(rows);
    ref.read(binderSelectionProvider.notifier).clear();
    if (removed.isEmpty) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        key: const Key('binderBulkRemovedSnack'),
        content: Text('Removed ${_cards(removed.length)}'),
        action: SnackBarAction(
          key: const Key('binderBulkRemovedUndo'),
          label: 'Undo',
          onPressed: () => notifier.restore(removed),
        ),
      ));
  }

  int _count(List<BinderEntry> e) => e.fold<int>(0, (s, x) => s + x.quantity);

  static String _appBarTitle({
    required String? openId,
    required List<Binder> binders,
  }) {
    if (openId == null) return 'My Binders';
    for (final binder in Binder.gridOrder(binders)) {
      if (binder.clientId == openId) return binder.name;
    }
    return 'Binder';
  }

  Future<void> _createBinder(BuildContext context) async {
    final isPro = ref.read(isProProvider);
    if (!FreeLimits.canCreateBinder(
        Binder.countableLiveCount(ref.read(bindersProvider)),
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
    final binder = ref.read(bindersProvider.notifier).byId(clientId);
    if (binder == null) return;
    final copies = ref.read(binderProvider).fold<int>(0, (sum, e) {
      if (e.isWanted || e.resolvedBinderId != clientId || e.quantity < 1) {
        return sum;
      }
      return sum + e.quantity;
    });
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('binderDeleteConfirm'),
        title: Text('Delete ${binder.name}?'),
        content: Text(
          copies > 0
              ? 'This will also remove $copies ${copies == 1 ? 'card' : 'cards'} from your collection. This cannot be undone.'
              : 'This cannot be undone.',
        ),
        actions: [
          TextButton(
            key: const Key('binderDeleteCancel'),
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('binderDeleteConfirmButton'),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final err = ref.read(bindersProvider.notifier).delete(clientId);
    if (err == null || !context.mounted) return;
    final message = switch (err) {
      'trade' => 'Trade Binder cannot be deleted',
      'want' => 'Want List cannot be deleted',
      _ => 'Could not delete Binder',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _clearBinder(BuildContext context, {String? clientId}) async {
    final openId = ref.read(openBinderIdProvider);
    final targetId = clientId ?? openId;
    if (targetId == null) return;
    final isWant = targetId == BinderIds.want;
    final binder = ref.read(bindersProvider.notifier).byId(targetId);
    final name = isWant ? (binder?.name ?? 'Want List') : (binder?.name ?? 'Binder');
    final copies = ref.read(binderProvider).fold<int>(0, (sum, e) {
      if (e.quantity < 1) return sum;
      if (isWant) return e.isWanted ? sum + e.quantity : sum;
      if (e.isWanted || e.resolvedBinderId != targetId) return sum;
      return sum + e.quantity;
    });
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('binderClearConfirm'),
        title: Text('Clear $name?'),
        content: Text(
          copies > 0
              ? 'This will remove $copies ${copies == 1 ? 'card' : 'cards'} from $name. The binder stays. This cannot be undone.'
              : 'This cannot be undone.',
        ),
        actions: [
          TextButton(
            key: const Key('binderClearCancel'),
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('binderClearConfirmButton'),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    ref.read(binderProvider.notifier).clearInBinder(targetId);
  }

  Future<void> _shareBinder(BuildContext context) async {
    // Share links only ever show the Trade Binder (see
    // get_public_binder_by_token), so other Binders share as text only.
    final canLink = _openIsTradeBinder();
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const Key('shareBinderDialog'),
        title: const Text('Share Binder'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (canLink) ...[
              FilledButton.icon(
                key: const Key('copyBinderLink'),
                onPressed: () => Navigator.pop(ctx, 'link'),
                icon: const Icon(Icons.link),
                label: const Text('Copy Link to Binder'),
              ),
              const SizedBox(height: 8),
            ],
            OutlinedButton.icon(
              key: const Key('copyBinderText'),
              onPressed: () => Navigator.pop(ctx, 'text'),
              icon: const Icon(Icons.text_snippet_outlined),
              label: const Text('Copy Binder as Text'),
            ),
          ],
        ),
      ),
    );
    if (choice == null || !context.mounted) return;
    if (choice == 'link') {
      await _copyBinderLink(context);
    } else if (choice == 'text') {
      await _copyBinderText(context);
    }
  }

  Future<void> _copyBinderLink(BuildContext context) async {
    if (!ref.read(isSignedInProvider)) {
      final signedIn = await presentSignIn(
        context,
        source: 'share_binder',
        copy: SignInCopy.shareBinder,
      );
      if (!signedIn || !context.mounted) return;
    }
    try {
      final share =
          await ref.read(binderShareRepositoryProvider).ensureEnabledShare();
      await Clipboard.setData(ClipboardData(text: share.url));
      if (!context.mounted) return;
      _toast(context, 'Link copied');
    } catch (_) {
      if (!context.mounted) return;
      _toast(context, 'Could not copy link');
    }
  }

  Future<void> _copyBinderText(BuildContext context) async {
    final openId = ref.read(openBinderIdProvider);
    if (openId == null) return;
    final binder = ref.read(bindersProvider.notifier).byId(openId);
    final text = formatBinderAsText(
      name: binder?.name ?? 'Binder',
      entries: ownedInBinder(ref.read(binderProvider), openId),
    );
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    _toast(context, 'Binder copied as text');
  }

  void _toast(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
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
    if (ref.read(openBinderIdProvider) == null) {
      // On the grid nothing is open, so ask where the cards should go rather
      // than silently filing them in the Trade Binder.
      final target = await _pickTargetBinder(context);
      if (target == null || !context.mounted) return;
      ref.read(binderFiltersProvider.notifier).clear();
      ref.read(openBinderIdProvider.notifier).open(target);
      if (target == BinderIds.want) {
        await _addBySearch(isWanted: true);
        return;
      }
    }
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

  Future<String?> _pickTargetBinder(BuildContext context) {
    final binders = Binder.gridOrder(ref.read(bindersProvider));
    return showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            key: const Key('addTargetBinderSheet'),
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(title: Text('Add cards to…')),
              for (final binder in binders)
                ListTile(
                  key: Key('addTarget-${binder.clientId}'),
                  leading: Icon(
                    binder.isWant
                        ? Icons.bookmark_border_rounded
                        : Icons.collections_bookmark_outlined,
                  ),
                  title: Text(binder.name),
                  onTap: () => Navigator.pop(ctx, binder.clientId),
                ),
            ],
          ),
        ),
      ),
      routeSettings: const RouteSettings(name: 'Add To Which Binder'),
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
                    color: context.tokens.gain,
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

/// Stands in for the Add card row while rows are selected.
class _SelectionActionBar extends StatelessWidget {
  const _SelectionActionBar({
    required this.canMove,
    required this.onMove,
    required this.onTrade,
    required this.onSell,
    required this.onRemove,
  });

  final bool canMove;
  final VoidCallback onMove;
  final VoidCallback onTrade;
  final VoidCallback onSell;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      key: const Key('binderSelectionBar'),
      width: MediaQuery.sizeOf(context).width - 32,
      padding: const EdgeInsets.all(AppSpacing.xs),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: AppRadii.xlAll,
        border: Border.all(color: t.border),
        boxShadow: t.shadowLg,
      ),
      child: Row(
        children: [
          _SelectionAction(
            key: const Key('binderBulkMove'),
            icon: Icons.drive_file_move_outline,
            label: 'Move',
            color: t.text,
            onTap: canMove ? onMove : null,
          ),
          _SelectionAction(
            key: const Key('binderBulkTrade'),
            icon: Icons.swap_horiz_rounded,
            label: 'Add to trade',
            color: t.text,
            onTap: onTrade,
          ),
          _SelectionAction(
            key: const Key('binderBulkSell'),
            icon: Icons.sell_outlined,
            label: 'Sell',
            color: t.text,
            onTap: onSell,
          ),
          _SelectionAction(
            key: const Key('binderBulkRemove'),
            icon: Icons.delete_outline_rounded,
            label: 'Remove',
            color: t.loss,
            onTap: onRemove,
          ),
        ],
      ),
    );
  }
}

class _SelectionAction extends StatelessWidget {
  const _SelectionAction({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = onTap == null ? context.tokens.textFaint : color;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.mdAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 22, color: c),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: c,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
