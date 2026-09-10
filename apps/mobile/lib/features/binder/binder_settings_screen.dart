import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/logic/fabrary_import_apply.dart';
import '../../core/providers.dart';

const fabraryRefuseCopy = {
  'not_fabrary': 'This is not a Fabrary collection export',
  'no_owned': 'No Have, Want, or Extra quantities were found',
  'no_matched': 'None of those cards were found in the catalog',
};

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

  void _cancel() {
    setState(() {
      _plan = null;
      _success = null;
      _working = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    return Scaffold(
      appBar: AppBar(title: const Text('Import from Fabrary')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilledButton.icon(
            key: const Key('importFabrary'),
            onPressed: _working || _applying ? null : _import,
            icon: const Icon(Icons.upload_file),
            label: const Text('Choose CSV'),
          ),
          if (_working)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(
                child: CircularProgressIndicator(key: Key('fabraryWorking')),
              ),
            ),
          if (plan != null && !plan.ok) ...[
            const SizedBox(height: 16),
            Text(
              fabraryRefuseCopy[plan.refuseReason] ??
                  'This file cannot be imported',
              key: const Key('fabraryRefuse'),
            ),
          ],
          if (plan != null && plan.ok)
            _FabraryPreview(
              plan: plan,
              applying: _applying,
              success: _success,
              onConfirm: _confirm,
              onCancel: _cancel,
            ),
        ],
      ),
    );
  }
}

class _FabraryPreview extends StatelessWidget {
  const _FabraryPreview({
    required this.plan,
    required this.applying,
    required this.success,
    required this.onConfirm,
    required this.onCancel,
  });

  final FabraryImportPlan plan;
  final bool applying;
  final String? success;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: const Key('fabraryPreview'),
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (success != null)
            Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(success!, key: const Key('fabrarySuccess')),
            ),
          Text('Rows with quantities: ${plan.ownedCount}'),
          Text(
            'Collection: ${plan.copiesFor(fabraryDestinationCollection)}',
          ),
          Text('Want List: ${plan.copiesFor(fabraryDestinationWant)}'),
          Text('Trade Binder: ${plan.copiesFor(fabraryDestinationTrade)}'),
          Text('Matched: ${plan.matchedCount}'),
          Text('Unmatched: ${plan.unmatched.length}'),
          Text('Copies to add: ${plan.copiesToAdd}'),
          const SizedBox(height: 12),
          const Text(
            'Confirming adds Have copies to Collection, Want in trade / Want to buy to Want List, and Extra for trade / Extra to sell to Trade Binder. Existing cards stay. A second import of the same file will add again.',
          ),
          if (plan.unmatched.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Unmatched cards'),
            const SizedBox(height: 8),
            for (final row in plan.unmatched)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  [
                    row.name,
                    if (row.setNumber.isNotEmpty) row.setNumber,
                    if (row.foiling.isNotEmpty) row.foiling,
                    if (row.treatment.isNotEmpty) row.treatment,
                    if (row.edition.isNotEmpty) row.edition,
                  ].join(' · '),
                ),
              ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              FilledButton(
                key: const Key('fabraryConfirm'),
                onPressed: applying ? null : onConfirm,
                child: const Text('Confirm'),
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
