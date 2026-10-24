import 'package:flutter/material.dart';

import '../core/data/card_repository.dart';

/// Search field with an in-bar clear (X) and a sort dropdown beside it.
/// Shared by Browse, set catalog, card picker, and Binder.
class CardSearchBar extends StatelessWidget {
  const CardSearchBar({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onChanged,
    required this.onClear,
    required this.sort,
    required this.onSort,
    this.autofocus = false,
    this.dense = false,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final CardSort sort;
  final ValueChanged<CardSort> onSort;
  final bool autofocus;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasText = controller.text.isNotEmpty;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            autofocus: autofocus,
            onChanged: onChanged,
            textInputAction: TextInputAction.search,
            // Mobile TextFields keep focus on outside taps by default, which
            // leaves the keyboard stuck open. Close it on an outside tap or
            // the keyboard's search key.
            onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
            onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
            style: dense ? theme.textTheme.bodyMedium : null,
            decoration: InputDecoration(
              isDense: dense,
              hintText: hintText,
              prefixIcon: Icon(Icons.search, size: dense ? 20 : 24),
              prefixIconConstraints: dense
                  ? const BoxConstraints(minWidth: 40, minHeight: 36)
                  : null,
              suffixIcon: hasText
                  ? IconButton(
                      icon: Icon(Icons.clear, size: dense ? 18 : 24),
                      tooltip: 'Clear search',
                      onPressed: onClear,
                      visualDensity:
                          dense ? VisualDensity.compact : VisualDensity.standard,
                    )
                  : null,
              contentPadding: dense
                  ? const EdgeInsets.symmetric(horizontal: 12, vertical: 8)
                  : null,
            ),
          ),
        ),
        const SizedBox(width: 8),
        _SortDropdown(sort: sort, onSort: onSort, dense: dense),
      ],
    );
  }
}

class _SortDropdown extends StatelessWidget {
  const _SortDropdown({
    required this.sort,
    required this.onSort,
    this.dense = false,
  });

  final CardSort sort;
  final ValueChanged<CardSort> onSort;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final nonDefault = sort != CardSort.nameAsc;

    return PopupMenuButton<CardSort>(
      tooltip: 'Sort',
      initialValue: sort,
      onSelected: onSort,
      itemBuilder: (_) => CardSort.values
          .map((s) => PopupMenuItem(value: s, child: Text(s.label)))
          .toList(),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: dense ? 6 : 8,
          vertical: dense ? 8 : 10,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.sort,
              size: dense ? 20 : 22,
              color: nonDefault ? scheme.primary : scheme.onSurfaceVariant,
            ),
            const SizedBox(width: 2),
            Icon(
              Icons.arrow_drop_down,
              size: dense ? 18 : 20,
              color: nonDefault ? scheme.primary : scheme.onSurfaceVariant,
            ),
          ],
        ),
      ),
    );
  }
}
