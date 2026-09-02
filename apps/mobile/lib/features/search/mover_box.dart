import 'package:flutter/material.dart';

import '../../app/theme.dart';
import '../../core/logic/pricing.dart';

/// Shared trend box for ranked movers and Home global search.
/// Omit [percentChange] / [amountChange] to leave the change line off.
/// Unpriced current Low is an em dash, never `$0.00` / `€0.00`.
class MoverBox extends StatelessWidget {
  const MoverBox({
    super.key,
    required this.name,
    required this.setName,
    required this.finish,
    required this.currentLow,
    this.percentChange,
    this.amountChange,
    this.copies,
    required this.pricing,
    required this.onSelect,
  });

  final String name;
  final String setName;
  final String finish;
  final double? currentLow;
  final double? percentChange;
  final double? amountChange;
  final int? copies;
  final Pricing pricing;
  final VoidCallback onSelect;

  bool get _showChange =>
      percentChange != null && amountChange != null && percentChange != 0;

  @override
  Widget build(BuildContext context) {
    final color = (percentChange ?? 0) > 0 ? AppTheme.positive : AppTheme.negative;
    final pct = (percentChange ?? 0) * 100;
    final pctLabel =
        '${pct >= 0 ? '+' : ''}${pct.abs() >= 10 ? pct.toStringAsFixed(0) : pct.toStringAsFixed(1)}%';
    final amountLabel = _showChange
        ? '${amountChange! >= 0 ? '+' : '−'}${pricing.formatValue(amountChange!.abs())}'
        : null;
    final priced = currentLow != null && currentLow != 0;
    final finishTrim = finish.trim();
    final subtitle = [
      setName,
      if (finishTrim.isNotEmpty) finishTrim,
      if (copies != null) '$copies copies',
    ].join(' · ');

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      title: Text(name),
      subtitle: Text(subtitle),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            priced ? pricing.format(currentLow) : '—',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          if (_showChange)
            Text(
              '$pctLabel · $amountLabel',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
            ),
        ],
      ),
      onTap: onSelect,
    );
  }
}
