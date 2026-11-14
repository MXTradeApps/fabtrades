import 'package:cached_network_image/cached_network_image.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// Network image that tries [imageUrl] first, then [fallbackUrl] on load error.
///
/// Mirrors the web card-image fallback chain so full-screen art can prefer the
/// FAB CDN but still show TCGplayer art when the CDN is missing a printing
/// (common for brand-new sets).
class FallbackNetworkImage extends StatelessWidget {
  const FallbackNetworkImage({
    super.key,
    required this.imageUrl,
    this.fallbackUrl,
    this.fit = BoxFit.contain,
    this.width,
    this.height,
    this.placeholder,
    this.errorWidget,
    this.cacheManager,
  });

  final String imageUrl;
  final String? fallbackUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final PlaceholderWidgetBuilder? placeholder;
  final LoadingErrorWidgetBuilder? errorWidget;
  final BaseCacheManager? cacheManager;

  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: fit,
      width: width,
      height: height,
      cacheManager: cacheManager,
      placeholder: placeholder,
      errorWidget: (context, url, error) {
        final next = fallbackUrl?.trim();
        if (next != null && next.isNotEmpty && next != url) {
          return FallbackNetworkImage(
            imageUrl: next,
            fit: fit,
            width: width,
            height: height,
            placeholder: placeholder,
            errorWidget: errorWidget,
            cacheManager: cacheManager,
          );
        }
        if (errorWidget != null) return errorWidget!(context, url, error);
        return const SizedBox.shrink();
      },
    );
  }
}
