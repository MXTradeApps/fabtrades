import 'package:material_ui/material_ui.dart';

/// Prompts for an optional person name. Returns the entered string (possibly
/// empty for "no name"), or null if the dialog was cancelled/dismissed.
///
/// Uses a Material [AlertDialog] (not adaptive) because [TextField] requires a
/// Material ancestor — CupertinoAlertDialog leaves a red error box on iOS.
Future<String?> askPersonName(
  BuildContext context, {
  required bool isBorrowing,
  String? initial,
}) {
  return showDialog<String>(
    context: context,
    builder: (context) => _PersonNameDialog(
      isBorrowing: isBorrowing,
      initial: initial,
    ),
  );
}

class _PersonNameDialog extends StatefulWidget {
  const _PersonNameDialog({required this.isBorrowing, this.initial});

  final bool isBorrowing;
  final String? initial;

  @override
  State<_PersonNameDialog> createState() => _PersonNameDialogState();
}

class _PersonNameDialogState extends State<_PersonNameDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initial ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.isBorrowing ? 'Borrowing from' : 'Lent to'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        textCapitalization: TextCapitalization.words,
        decoration: const InputDecoration(
          labelText: 'Name (optional)',
          hintText: 'e.g. Alex',
        ),
        onSubmitted: (v) => Navigator.of(context).pop(v.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
