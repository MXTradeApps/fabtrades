import 'package:material_ui/material_ui.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../app/theme.dart';
import 'onboarding_keys.dart';

/// Shared showcaseview styling so every coach mark matches [AppTheme].
abstract final class ShowcaseTheme {
  static const tooltipBackground = AppTheme.brown;
  static const textColor = Colors.white;

  static TextStyle get titleStyle => const TextStyle(
        color: textColor,
        fontWeight: FontWeight.w800,
        fontSize: 16,
      );

  static TextStyle get descStyle => const TextStyle(
        color: textColor,
        fontWeight: FontWeight.w400,
        fontSize: 14,
        height: 1.35,
      );

  static const tooltipPadding =
      EdgeInsets.symmetric(horizontal: 14, vertical: 10);

  static const targetBorderRadius = BorderRadius.all(Radius.circular(12));

  static TooltipActionConfig get actionConfig => const TooltipActionConfig(
        position: TooltipActionPosition.outside,
        alignment: MainAxisAlignment.spaceBetween,
        actionGap: 12,
        gapBetweenContentAndAction: 10,
      );

  /// Skip / Next actions applied to every home-shell showcase.
  ///
  /// On the last step, Next finishes the tour (showcaseview's default).
  static List<TooltipActionButton> get homeActions => [
        TooltipActionButton(
          type: TooltipDefaultActionType.skip,
          name: 'Skip',
          backgroundColor: Colors.transparent,
          border: Border.all(color: Colors.white70),
          textStyle: const TextStyle(color: Colors.white),
        ),
        TooltipActionButton(
          type: TooltipDefaultActionType.next,
          name: 'Next',
          backgroundColor: AppTheme.tan,
          textStyle: const TextStyle(
            color: AppTheme.espresso,
            fontWeight: FontWeight.w700,
          ),
        ),
      ];

  /// Wraps [child] in a themed [Showcase].
  static Widget mark({
    required GlobalKey key,
    required String title,
    required String description,
    required Widget child,
    String scope = OnboardingKeys.homeScope,
    TooltipPosition? tooltipPosition,
    List<TooltipActionButton>? tooltipActions,
    EdgeInsets targetPadding = EdgeInsets.zero,
  }) {
    return Showcase(
      key: key,
      scope: scope,
      title: title,
      description: description,
      titleTextStyle: titleStyle,
      descTextStyle: descStyle,
      tooltipBackgroundColor: tooltipBackground,
      textColor: textColor,
      tooltipPadding: tooltipPadding,
      targetBorderRadius: targetBorderRadius,
      targetPadding: targetPadding,
      tooltipPosition: tooltipPosition,
      tooltipActionConfig: actionConfig,
      tooltipActions: tooltipActions,
      disableMovingAnimation: true,
      child: child,
    );
  }
}
