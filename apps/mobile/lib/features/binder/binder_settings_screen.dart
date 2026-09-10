import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/logic/fabrary_import_apply.dart';
import '../../core/logic/fabrary_match.dart';
import '../../core/providers.dart';

const fabraryRefuseCopy = {
  'not_fabrary': 'This is not a Fabrary collection export',
  'no_owned': 'No Have, Want, or Extra quantities were found',
  'no_matched': 'None of those cards were found in the catalog',
};

const fabraryUnmatchedExplain =
    "These printings from your Fabrary export aren't in the FAB Trades catalog. Confirming still adds everything we could match; these copies will be skipped.";

/// App-wide Fabrary import. Have → Collection, wants → Want List, extras → Trade.
class BinderSettingsScreen extends ConsumerStatefulWidget {
  const BinderSettingsScreen({
    super.key,
    this.pickCsv,
  });

  /// Test hook. Production uses the device file picker.
  final Future<String?> Function()? pickCsv;

  @override
  ConsumerState<BinderSettingsScreen> createState() =>
      _BinderSettingsScreenState();
}

class _BinderSettingsScreenState extends ConsumerState<BinderSettingsScreen> {
  bool _working = false;
  bool _applying = false;
  FabraryImportPlan? _plan;
  String? _success;

  Future<String?> _pickCsvText() async {
    if (widget.pickCsv != null) return widget.pickCsv!();
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['csv', 'txt'],
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    return utf8.decode(bytes);
  }

  Future<void> _import() async {
    setState(() {
      _working = true;
      _plan = null;
      _success = null;
    });
    try {
      final csv = await _pickCsvText();
      if (!mounted) return;
      if (csv == null) {
        setState(() => _working = false);
        return;
      }
      final catalog = await ref.read(catalogProvider.future);
      if (!mounted) return;
      final plan = planFabraryImport(
        csv: csv,
        catalog: catalog,
        existingEntries: ref.read(binderProvider),
      );
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _working = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _working = false;
        _plan = const FabraryImportPlan(
          ok: false,
          refuseReason: 'not_fabrary',
          ownedCount: 0,
          matchedCount: 0,
          copiesToAdd: 0,
          unmatched: [],
          adds: [],
        );
      });
    }
  }

  Future<void> _confirm() async {
    final plan = _plan;
    if (plan == null || !plan.ok || _applying) return;
    setState(() => _applying = true);
    final ok =
        await ref.read(binderProvider.notifier).applyImportAdds(plan.adds);
    if (!mounted) return;
    setState(() {
      _applying = false;
      if (ok) {
        _success = 'Added ${plan.copiesToAdd} Near Mint copies';
      }
    });
  }

  void _close() {
    if (_applying) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _plan = null;
      _success = null;
      _working = false;
    });
  }

  String _unmatchedLabel(FabraryUnmatched row) {
    return [
      row.name,
      if (row.setNumber.isNotEmpty) row.setNumber,
      if (row.foiling.isNotEmpty) row.foiling,
      if (row.treatment.isNotEmpty) row.treatment,
      if (row.edition.isNotEmpty) row.edition,
    ].join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    final theme = Theme.of(context);
    final maxHeight = MediaQuery.sizeOf(context).height * 0.85;
    final showingPreview = plan != null && plan.ok;

    return PopScope(
      canPop: !_applying,
        child: Dialog(
        clipBehavior: Clip.hardEdge,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 480, maxHeight: maxHeight),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 12),
            child: Column(
              mainAxisSize:
                  showingPreview ? MainAxisSize.max : MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Import from Fabrary',
                        style: theme.textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed: _applying ? null : _close,
                      icon: const Icon(Icons.close),
                      tooltip: 'Close',
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: FilledButton.icon(
                    key: const Key('importFabrary'),
                    onPressed: _working || _applying ? null : _import,
                    icon: const Icon(Icons.upload_file),
                    label: const Text('Choose CSV'),
                  ),
                ),
                if (_working)
                  const Padding(
                    padding: EdgeInsets.only(top: 20, right: 12),
                    child: Center(
                      child: CircularProgressIndicator(key: Key('fabraryWorking')),
                    ),
                  ),
                if (plan != null && !plan.ok) ...[
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Text(
                      fabraryRefuseCopy[plan.refuseReason] ??
                          'This file cannot be imported',
                      key: const Key('fabraryRefuse'),
                    ),
                  ),
                ],
                if (showingPreview)
                  Expanded(
                    child: _FabraryPreview(
                      plan: plan,
                      applying: _applying,
                      success: _success,
                      unmatchedLabel: _unmatchedLabel,
                      onConfirm: _confirm,
                      onCancel: _close,
                    ),
                  ),
                if (!showingPreview)
                  Padding(
                    padding: const EdgeInsets.only(top: 16, right: 12),
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        key: const Key('fabraryCancel'),
                        onPressed: _applying ? null : _close,
                        child: const Text('Cancel'),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FabraryPreview extends StatelessWidget {
  const _FabraryPreview({
    required this.plan,
    required this.applying,
    required this.success,
    required this.unmatchedLabel,
    required this.onConfirm,
    required this.onCancel,
  });

  final FabraryImportPlan plan;
  final bool applying;
  final String? success;
  final String Function(FabraryUnmatched) unmatchedLabel;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      key: const Key('fabraryPreview'),
      padding: const EdgeInsets.only(top: 16, right: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (success != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(success!, key: const Key('fabrarySuccess')),
            ),
          Text('Rows with quantities: ${plan.ownedCount}'),
          Text(
            'Collection: ${plan.copiesFor(fabraryDestinationCollection)}  ·  Want List: ${plan.copiesFor(fabraryDestinationWant)}  ·  Trade Binder: ${plan.copiesFor(fabraryDestinationTrade)}',
          ),
          Text(
            'Matched: ${plan.matchedCount}  ·  Won\'t be imported: ${plan.unmatched.length}  ·  Copies to add: ${plan.copiesToAdd}',
          ),
          const SizedBox(height: 8),
          Text(
            'Have copies go to Collection, Want in trade / Want to buy to Want List, and Extra for trade / Extra to sell to Trade Binder. Existing cards stay. Importing the same file again will add those copies again.',
            style: theme.textTheme.bodySmall,
          ),
          if (plan.unmatched.isNotEmpty)
            Expanded(
              child: SingleChildScrollView(
                key: const Key('fabraryUnmatched'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Cards we couldn't match",
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      fabraryUnmatchedExplain,
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    for (final row in plan.unmatched)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(unmatchedLabel(row)),
                      ),
                  ],
                ),
              ),
            )
          else
            const Spacer(),
          const SizedBox(height: 16),
          Row(
            children: [
              FilledButton(
                key: const Key('fabraryConfirm'),
                onPressed: applying ? null : onConfirm,
                child: applying
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          key: Key('fabraryConfirmSpinner'),
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Confirm'),
              ),
              const SizedBox(width: 12),
              TextButton(
                key: const Key('fabraryCancel'),
                onPressed: applying ? null : onCancel,
                child: const Text('Cancel'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
