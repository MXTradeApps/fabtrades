import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// Design system for FAB Trades, matching the redesigned web app
// (apps/web/src/theme/tokens.js and contexts/ThemeContext.jsx).
//
// Layout concept, shared with web: a quiet trading desk. Warm neutral
// surfaces, one copper accent, Archivo headings over Onest body text, and
// tabular figures so prices line up down every list.
//
// Screens should read colors from [AppTokens] (`context.tokens`) or the
// [ColorScheme], spacing from [AppSpacing] and corner radii from [AppRadii],
// rather than hard-coding values.

/// Semantic color tokens for the active brightness. Values mirror the web
/// `tokens.light` / `tokens.dark` sets one for one, so a color named here
/// means the same thing on both clients.
@immutable
class AppTokens extends ThemeExtension<AppTokens> {
  const AppTokens({
    required this.bg,
    required this.surface,
    required this.sunken,
    required this.hover,
    required this.selected,
    required this.border,
    required this.borderStrong,
    required this.text,
    required this.textMuted,
    required this.textFaint,
    required this.accent,
    required this.accentHover,
    required this.accentSoft,
    required this.accentText,
    required this.onAccent,
    required this.tan,
    required this.gain,
    required this.loss,
    required this.warn,
    required this.info,
    required this.overlay,
    required this.shadowSm,
    required this.shadowMd,
    required this.shadowLg,
  });

  /// Page canvas behind everything.
  final Color bg;

  /// Cards, sheets, dialogs, the bottom bar.
  final Color surface;

  /// Recessed wells: inputs, segmented controls, image placeholders.
  final Color sunken;

  /// Translucent wash for hovered / pressed rows.
  final Color hover;

  /// Translucent accent wash for the selected row, tab or nav item.
  final Color selected;

  /// Hairline dividers and card outlines.
  final Color border;

  /// Outlines that need to read as controls (outlined buttons, chips).
  final Color borderStrong;

  final Color text;
  final Color textMuted;
  final Color textFaint;

  /// The single brand accent: FAB brown in light, copper in dark.
  final Color accent;
  final Color accentHover;

  /// Accent tint for selected chips, badges and the nav indicator.
  final Color accentSoft;

  /// Accent used as a text color (readable on [surface]).
  final Color accentText;
  final Color onAccent;

  /// Secondary brand tan.
  final Color tan;

  /// Price up / in your favor / owned.
  final Color gain;

  /// Price down / against you / destructive.
  final Color loss;
  final Color warn;
  final Color info;

  /// Modal barrier color.
  final Color overlay;

  final List<BoxShadow> shadowSm;
  final List<BoxShadow> shadowMd;
  final List<BoxShadow> shadowLg;

  static const light = AppTokens(
    bg: Color(0xFFF6F3EF),
    surface: Color(0xFFFFFFFF),
    sunken: Color(0xFFF0EBE5),
    hover: Color(0x0D2C1810), // espresso @ 5%
    selected: Color(0x178B4513), // brown @ 9%
    border: Color(0x1A2C1810), // espresso @ 10%
    borderStrong: Color(0x2E2C1810), // espresso @ 18%
    text: Color(0xFF1E1612),
    textMuted: Color(0xFF6A5A4E),
    textFaint: Color(0xFF9A8C80),
    accent: AppTheme.brown,
    accentHover: AppTheme.brownDeep,
    accentSoft: Color(0x1A8B4513), // brown @ 10%
    accentText: AppTheme.brown,
    onAccent: Color(0xFFFFFFFF),
    tan: AppTheme.tanDeep,
    gain: Color(0xFF1D8A55),
    loss: Color(0xFFC9372C),
    warn: Color(0xFFB86E00),
    info: Color(0xFF1F6FB2),
    overlay: Color(0x731E1612), // 45%
    shadowSm: [
      BoxShadow(color: Color(0x0F1E1612), offset: Offset(0, 1), blurRadius: 2),
      BoxShadow(color: Color(0x081E1612), offset: Offset(0, 1), blurRadius: 1),
    ],
    shadowMd: [
      BoxShadow(
          color: Color(0x1F1E1612),
          offset: Offset(0, 4),
          blurRadius: 16,
          spreadRadius: -4),
      BoxShadow(color: Color(0x0A1E1612), offset: Offset(0, 2), blurRadius: 4),
    ],
    shadowLg: [
      BoxShadow(
          color: Color(0x401E1612),
          offset: Offset(0, 24),
          blurRadius: 48,
          spreadRadius: -12),
      BoxShadow(color: Color(0x0F1E1612), offset: Offset(0, 4), blurRadius: 12),
    ],
  );

  static const dark = AppTokens(
    bg: Color(0xFF131110),
    surface: Color(0xFF1B1816),
    sunken: Color(0xFF24201C),
    hover: Color(0x0FF3EDE7), // 6%
    selected: Color(0x24D8834A), // copper @ 14%
    border: Color(0x17F3EDE7), // 9%
    borderStrong: Color(0x2BF3EDE7), // 17%
    text: Color(0xFFF3EDE7),
    textMuted: Color(0xFFB5A99E),
    textFaint: Color(0xFF7F746B),
    accent: Color(0xFFD8834A),
    accentHover: Color(0xFFE7A174),
    accentSoft: Color(0x26D8834A), // 15%
    accentText: Color(0xFFE7A174),
    onAccent: AppTheme.espressoDeep,
    tan: AppTheme.tanBright,
    gain: Color(0xFF46C285),
    loss: Color(0xFFF06A62),
    warn: Color(0xFFE8A23B),
    info: Color(0xFF62AEEA),
    overlay: Color(0x99000000), // 60%
    shadowSm: [
      BoxShadow(color: Color(0x59000000), offset: Offset(0, 1), blurRadius: 2),
    ],
    shadowMd: [
      BoxShadow(
          color: Color(0x8C000000),
          offset: Offset(0, 8),
          blurRadius: 24,
          spreadRadius: -8),
      BoxShadow(color: Color(0x4D000000), offset: Offset(0, 2), blurRadius: 4),
    ],
    shadowLg: [
      BoxShadow(
          color: Color(0xB3000000),
          offset: Offset(0, 28),
          blurRadius: 56,
          spreadRadius: -12),
      BoxShadow(color: Color(0x59000000), offset: Offset(0, 4), blurRadius: 12),
    ],
  );

  /// Tokens for the theme above [context]. Falls back by brightness so
  /// widgets still render under a bare `ThemeData` (as in widget tests).
  static AppTokens of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<AppTokens>() ??
        (theme.brightness == Brightness.dark ? dark : light);
  }

  @override
  AppTokens copyWith({
    Color? bg,
    Color? surface,
    Color? sunken,
    Color? hover,
    Color? selected,
    Color? border,
    Color? borderStrong,
    Color? text,
    Color? textMuted,
    Color? textFaint,
    Color? accent,
    Color? accentHover,
    Color? accentSoft,
    Color? accentText,
    Color? onAccent,
    Color? tan,
    Color? gain,
    Color? loss,
    Color? warn,
    Color? info,
    Color? overlay,
    List<BoxShadow>? shadowSm,
    List<BoxShadow>? shadowMd,
    List<BoxShadow>? shadowLg,
  }) {
    return AppTokens(
      bg: bg ?? this.bg,
      surface: surface ?? this.surface,
      sunken: sunken ?? this.sunken,
      hover: hover ?? this.hover,
      selected: selected ?? this.selected,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      text: text ?? this.text,
      textMuted: textMuted ?? this.textMuted,
      textFaint: textFaint ?? this.textFaint,
      accent: accent ?? this.accent,
      accentHover: accentHover ?? this.accentHover,
      accentSoft: accentSoft ?? this.accentSoft,
      accentText: accentText ?? this.accentText,
      onAccent: onAccent ?? this.onAccent,
      tan: tan ?? this.tan,
      gain: gain ?? this.gain,
      loss: loss ?? this.loss,
      warn: warn ?? this.warn,
      info: info ?? this.info,
      overlay: overlay ?? this.overlay,
      shadowSm: shadowSm ?? this.shadowSm,
      shadowMd: shadowMd ?? this.shadowMd,
      shadowLg: shadowLg ?? this.shadowLg,
    );
  }

  @override
  AppTokens lerp(AppTokens? other, double t) {
    if (other == null) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    List<BoxShadow> s(List<BoxShadow> a, List<BoxShadow> b) =>
        BoxShadow.lerpList(a, b, t)!;
    return AppTokens(
      bg: c(bg, other.bg),
      surface: c(surface, other.surface),
      sunken: c(sunken, other.sunken),
      hover: c(hover, other.hover),
      selected: c(selected, other.selected),
      border: c(border, other.border),
      borderStrong: c(borderStrong, other.borderStrong),
      text: c(text, other.text),
      textMuted: c(textMuted, other.textMuted),
      textFaint: c(textFaint, other.textFaint),
      accent: c(accent, other.accent),
      accentHover: c(accentHover, other.accentHover),
      accentSoft: c(accentSoft, other.accentSoft),
      accentText: c(accentText, other.accentText),
      onAccent: c(onAccent, other.onAccent),
      tan: c(tan, other.tan),
      gain: c(gain, other.gain),
      loss: c(loss, other.loss),
      warn: c(warn, other.warn),
      info: c(info, other.info),
      overlay: c(overlay, other.overlay),
      shadowSm: s(shadowSm, other.shadowSm),
      shadowMd: s(shadowMd, other.shadowMd),
      shadowLg: s(shadowLg, other.shadowLg),
    );
  }
}

extension AppTokensContext on BuildContext {
  /// Shorthand for [AppTokens.of].
  AppTokens get tokens => AppTokens.of(this);
}

/// Spacing scale on a 4pt grid. Web uses MUI's 8px unit; `AppSpacing.sm`
/// equals one MUI unit, `lg` two, `xxl` three.
abstract final class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double huge = 48;

  /// Horizontal page gutter on phones (web `px: { xs: 2 }`).
  static const double gutter = lg;
}

/// Corner radii, matching the web component overrides.
abstract final class AppRadii {
  /// Logo plates, tiny tags.
  static const double xs = 6;

  /// Chips, menu items, tooltips.
  static const double sm = 8;

  /// Buttons, inputs, list rows, segmented controls.
  static const double md = 10;

  /// Snackbars, alerts.
  static const double lg = 12;

  /// Cards, popovers, panels.
  static const double xl = 14;

  /// Dialogs and bottom sheets.
  static const double xxl = 20;

  /// Fully rounded pills.
  static const double pill = 999;

  static const BorderRadius smAll = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgAll = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius xlAll = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius xxlAll = BorderRadius.all(Radius.circular(xxl));
}

/// Type families and helpers. Archivo sets headings and titles, Onest sets
/// body and label text (the web pairing).
abstract final class AppType {
  /// Heading / title family.
  static TextStyle display([TextStyle? style]) => GoogleFonts.archivo(
        textStyle: style,
      );

  /// Body / label family.
  static TextStyle body([TextStyle? style]) => GoogleFonts.onest(
        textStyle: style,
      );

  /// Fixed-width digits so prices and counts line up in columns.
  static const tabularFigures = [FontFeature.tabularFigures()];

  /// [style] with tabular figures switched on.
  static TextStyle? tabular(TextStyle? style) =>
      style?.copyWith(fontFeatures: tabularFigures);

  /// The type scale. Sizes track the web scale (h1 36, h2 28, h3 22, h4 20,
  /// h5 17, h6 15, body 15/14) while keeping Material's roles, so existing
  /// `textTheme.titleMedium` etc. call sites pick up the new look unchanged.
  static TextTheme textTheme(Color text, Color muted) {
    TextStyle d(double size, FontWeight weight, double height,
            [double tracking = 0]) =>
        display(TextStyle(
          fontSize: size,
          fontWeight: weight,
          height: height,
          letterSpacing: tracking,
          color: text,
        ));
    TextStyle b(double size, FontWeight weight, double height,
            [double tracking = 0, Color? color]) =>
        body(TextStyle(
          fontSize: size,
          fontWeight: weight,
          height: height,
          letterSpacing: tracking,
          color: color ?? text,
        ));

    return TextTheme(
      displayLarge: d(36, FontWeight.w800, 1.1, -0.7),
      displayMedium: d(32, FontWeight.w800, 1.12, -0.6),
      displaySmall: d(28, FontWeight.w800, 1.15, -0.4),
      headlineLarge: d(28, FontWeight.w800, 1.15, -0.4),
      headlineMedium: d(24, FontWeight.w700, 1.2, -0.3),
      headlineSmall: d(22, FontWeight.w700, 1.2, -0.2),
      titleLarge: d(20, FontWeight.w700, 1.25, -0.2),
      titleMedium: d(16, FontWeight.w700, 1.3),
      titleSmall: d(14, FontWeight.w600, 1.35),
      bodyLarge: b(15, FontWeight.w400, 1.55),
      bodyMedium: b(14, FontWeight.w400, 1.5),
      bodySmall: b(12, FontWeight.w400, 1.4, 0, muted),
      labelLarge: b(14, FontWeight.w600, 1.3),
      labelMedium: b(12, FontWeight.w600, 1.3),
      labelSmall: b(11, FontWeight.w600, 1.4, 0.6),
    );
  }
}

/// Central theme for FAB Trades. Builds Material [ThemeData] for light and
/// dark from [AppTokens], with component themes matching the web overrides.
class AppTheme {
  // ── FAB brand palette (packages/contracts/brand_palette.json) ──────────
  static const brown = Color(0xFF8B4513);
  static const brownBright = Color(0xFFA0643F);
  static const brownDeep = Color(0xFF5D2F0D);
  static const tan = Color(0xFFD4A574);
  static const tanBright = Color(0xFFE4C09C);
  static const tanDeep = Color(0xFFA8824E);
  static const cream = Color(0xFFF5F1ED);
  static const espresso = Color(0xFF2C1810);
  static const espressoDeep = Color(0xFF1A0F0A);

  // Kept for backwards-compat with existing references.
  static const seed = brown;

  // Brightness-independent semantic colors, for places with no BuildContext.
  // Prefer `context.tokens.gain` / `.loss` / `.accent`, which also adapt to
  // dark mode.
  static const positive = Color(0xFF1D8A55);
  static const negative = Color(0xFFC9372C);
  static const haveAccent = positive;
  static const wantAccent = brown;

  static ThemeData light() => _base(Brightness.light);
  static ThemeData dark() => _base(Brightness.dark);

  // ── Color schemes ──────────────────────────────────────────────────────
  // Every role is pinned so nothing falls back to a seed-generated hue.
  static ColorScheme _lightScheme(AppTokens t) => ColorScheme(
        brightness: Brightness.light,
        primary: t.accent,
        onPrimary: t.onAccent,
        primaryContainer: const Color(0xFFF1E6DD),
        onPrimaryContainer: brownDeep,
        primaryFixed: const Color(0xFFF1E6DD),
        primaryFixedDim: const Color(0xFFE6D3C3),
        onPrimaryFixed: brownDeep,
        onPrimaryFixedVariant: brown,
        secondary: t.tan,
        onSecondary: Colors.white,
        secondaryContainer: const Color(0xFFF3E9DC),
        onSecondaryContainer: brownDeep,
        tertiary: brownBright,
        onTertiary: Colors.white,
        tertiaryContainer: const Color(0xFFF1E6DD),
        onTertiaryContainer: brownDeep,
        error: t.loss,
        onError: Colors.white,
        errorContainer: const Color(0xFFF9E1DF),
        onErrorContainer: const Color(0xFF7A1A13),
        surface: t.surface,
        onSurface: t.text,
        onSurfaceVariant: t.textMuted,
        surfaceDim: const Color(0xFFE9E2DA),
        surfaceBright: t.surface,
        surfaceContainerLowest: t.surface,
        surfaceContainerLow: const Color(0xFFFBF9F6),
        surfaceContainer: t.bg,
        surfaceContainerHigh: t.sunken,
        surfaceContainerHighest: const Color(0xFFE9E2DA),
        outline: t.textFaint,
        outlineVariant: const Color(0xFFE6DFD8),
        shadow: Colors.black,
        scrim: Colors.black,
        inverseSurface: t.text,
        onInverseSurface: t.bg,
        inversePrimary: const Color(0xFFE7A174),
        surfaceTint: Colors.transparent,
      );

  static ColorScheme _darkScheme(AppTokens t) => ColorScheme(
        brightness: Brightness.dark,
        primary: t.accent,
        onPrimary: t.onAccent,
        primaryContainer: const Color(0xFF3A271B),
        onPrimaryContainer: t.accentText,
        primaryFixed: const Color(0xFFF1E6DD),
        primaryFixedDim: const Color(0xFFE6D3C3),
        onPrimaryFixed: brownDeep,
        onPrimaryFixedVariant: brown,
        secondary: t.tan,
        onSecondary: espressoDeep,
        secondaryContainer: const Color(0xFF3A3024),
        onSecondaryContainer: tanBright,
        tertiary: t.accentHover,
        onTertiary: espressoDeep,
        tertiaryContainer: const Color(0xFF3A271B),
        onTertiaryContainer: t.accentText,
        error: t.loss,
        onError: espressoDeep,
        errorContainer: const Color(0xFF4A1E1A),
        onErrorContainer: const Color(0xFFFFD9D5),
        surface: t.surface,
        onSurface: t.text,
        onSurfaceVariant: t.textMuted,
        surfaceDim: t.bg,
        surfaceBright: const Color(0xFF332D29),
        surfaceContainerLowest: t.bg,
        surfaceContainerLow: const Color(0xFF171412),
        surfaceContainer: t.surface,
        surfaceContainerHigh: t.sunken,
        surfaceContainerHighest: const Color(0xFF2E2925),
        outline: t.textFaint,
        outlineVariant: const Color(0xFF302B27),
        shadow: Colors.black,
        scrim: Colors.black,
        inverseSurface: t.text,
        onInverseSurface: const Color(0xFF1E1612),
        inversePrimary: brown,
        surfaceTint: Colors.transparent,
      );

  static ThemeData _base(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final t = isDark ? AppTokens.dark : AppTokens.light;
    final scheme = isDark ? _darkScheme(t) : _lightScheme(t);
    final textTheme = AppType.textTheme(t.text, t.textMuted);

    // On iOS, center the nav-bar title to match the platform convention; keep
    // the left-aligned look everywhere else. Uses defaultTargetPlatform (no
    // BuildContext here), so Android/web/desktop are unaffected.
    final isIOS = defaultTargetPlatform == TargetPlatform.iOS;

    const mdShape = RoundedRectangleBorder(borderRadius: AppRadii.mdAll);
    final buttonText = textTheme.labelLarge?.copyWith(fontSize: 15);

    // Inverted chrome for snackbars and tooltips (dark on light, light on dark).
    final inverseBg = scheme.inverseSurface;
    final inverseFg = scheme.onInverseSurface;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      fontFamily: GoogleFonts.onest().fontFamily,
      scaffoldBackgroundColor: t.bg,
      canvasColor: t.bg,
      dividerColor: t.border,
      hoverColor: t.hover,
      splashFactory: InkSparkle.splashFactory,
      extensions: [t],
      // Platform-adaptive page transitions: Android gets the modern
      // predictive-back animation; iOS/macOS keep their native slide +
      // back-swipe gesture.
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      // Flat top bar on the page canvas with a hairline underline, like the
      // web's mobile top bar (replaces the old brown header).
      appBarTheme: AppBarTheme(
        centerTitle: isIOS,
        backgroundColor: t.bg,
        foregroundColor: t.text,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        shape: Border(bottom: BorderSide(color: t.border)),
        systemOverlayStyle:
            isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        iconTheme: IconThemeData(color: t.text),
        actionsIconTheme: IconThemeData(color: t.textMuted),
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        color: t.surface,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.xlAll,
          side: BorderSide(color: t.border),
        ),
      ),
      dividerTheme: DividerThemeData(color: t.border, thickness: 1, space: 1),
      iconTheme: IconThemeData(color: t.textMuted),
      listTileTheme: ListTileThemeData(
        iconColor: t.textMuted,
        textColor: t.text,
        selectedColor: t.accentText,
        selectedTileColor: t.selected,
        titleTextStyle: textTheme.bodyLarge?.copyWith(
          fontWeight: FontWeight.w500,
        ),
        subtitleTextStyle:
            textTheme.bodyMedium?.copyWith(color: t.textMuted),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: t.sunken,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: TextStyle(color: t.textFaint),
        labelStyle: TextStyle(color: t.textMuted),
        floatingLabelStyle: TextStyle(color: t.text),
        prefixIconColor: t.textMuted,
        suffixIconColor: t.textMuted,
        border: const OutlineInputBorder(
          borderRadius: AppRadii.mdAll,
          borderSide: BorderSide.none,
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: AppRadii.mdAll,
          borderSide: BorderSide(color: Colors.transparent),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.mdAll,
          borderSide: BorderSide(color: t.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.mdAll,
          borderSide: BorderSide(color: t.loss),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadii.mdAll,
          borderSide: BorderSide(color: t.loss, width: 1.5),
        ),
      ),
      chipTheme: ChipThemeData(
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.smAll),
        side: BorderSide(color: t.borderStrong),
        labelStyle: textTheme.labelLarge?.copyWith(fontSize: 13),
        backgroundColor: t.surface,
        selectedColor: t.accentSoft,
        secondarySelectedColor: t.accentSoft,
        checkmarkColor: t.accentText,
        iconTheme: IconThemeData(color: t.textMuted, size: 18),
      ),
      // The web bottom tab bar: surface background, hairline top border,
      // pill indicator in the selected wash, accent icon when active.
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: t.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        indicatorColor: t.selected,
        indicatorShape: const StadiumBorder(),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? t.accent
                : t.textMuted,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => textTheme.labelMedium?.copyWith(
            color: states.contains(WidgetState.selected)
                ? t.text
                : t.textMuted,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: mdShape,
          textStyle: buttonText,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: t.accentSoft,
          foregroundColor: t.accentText,
          shadowColor: Colors.transparent,
          shape: mdShape,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: t.text,
          side: BorderSide(color: t.borderStrong),
          shape: mdShape,
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: t.accentText,
          shape: mdShape,
          textStyle: textTheme.labelLarge,
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          shape: const WidgetStatePropertyAll(mdShape),
          side: WidgetStatePropertyAll(BorderSide(color: t.borderStrong)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? t.accentSoft
                : Colors.transparent,
          ),
          foregroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? t.accentText
                : t.textMuted,
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: t.accent,
        foregroundColor: t.onAccent,
        elevation: 2,
        focusElevation: 2,
        hoverElevation: 3,
        highlightElevation: 3,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.xlAll),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: t.text,
        unselectedLabelColor: t.textMuted,
        indicatorColor: t.accent,
        dividerColor: t.border,
        labelStyle: textTheme.labelLarge,
        unselectedLabelStyle: textTheme.labelLarge,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: t.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        barrierColor: t.overlay,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.xxlAll,
          side: BorderSide(color: t.border),
        ),
        titleTextStyle: textTheme.titleLarge,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: t.textMuted),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: t.surface,
        modalBackgroundColor: t.surface,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: t.overlay,
        elevation: 0,
        modalElevation: 0,
        dragHandleColor: t.borderStrong,
        shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadii.xxl)),
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: t.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 4,
        shadowColor: Colors.black.withValues(alpha: isDark ? 0.6 : 0.2),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.xlAll,
          side: BorderSide(color: t.border),
        ),
        textStyle: textTheme.bodyMedium,
      ),
      menuTheme: MenuThemeData(
        style: MenuStyle(
          backgroundColor: WidgetStatePropertyAll(t.surface),
          surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
          shape: WidgetStatePropertyAll(RoundedRectangleBorder(
            borderRadius: AppRadii.xlAll,
            side: BorderSide(color: t.border),
          )),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: inverseBg,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: inverseFg),
        actionTextColor: isDark ? brown : t.accentHover,
        closeIconColor: inverseFg,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.lgAll),
      ),
      tooltipTheme: TooltipThemeData(
        waitDuration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: inverseBg,
          borderRadius: AppRadii.smAll,
        ),
        textStyle: textTheme.labelMedium?.copyWith(
          color: inverseFg,
          fontWeight: FontWeight.w500,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: t.accent,
        linearTrackColor: t.sunken,
        circularTrackColor: Colors.transparent,
        linearMinHeight: 4,
      ),
      switchTheme: SwitchThemeData(
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.transparent
              : t.borderStrong,
        ),
      ),
      badgeTheme: BadgeThemeData(
        backgroundColor: t.accent,
        textColor: t.onAccent,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: t.accent,
        thumbColor: t.accent,
        inactiveTrackColor: t.sunken,
      ),
    );
  }
}
