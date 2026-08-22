import '../models/binder.dart';

/// Result of create/rename name checks. [normalized] is trim-only (case kept).
class BinderNameResult {
  const BinderNameResult({
    required this.ok,
    required this.normalized,
    this.reason,
    this.role,
  });

  final bool ok;
  final String normalized;
  final String? reason;
  final BinderRole? role;
}

String normalizeBinderName(String raw) => raw.trim();

String _fold(String name) => normalizeBinderName(name).toLowerCase();

/// Validate a create or rename against live Binder names (trim + case-fold).
BinderNameResult validateBinderName({
  required String proposedName,
  required Iterable<Binder> binders,
  String? binderId,
}) {
  final normalized = normalizeBinderName(proposedName);
  if (normalized.isEmpty) {
    BinderRole? role;
    if (binderId != null) {
      for (final b in binders) {
        if (b.clientId == binderId) role = b.role;
      }
    }
    return BinderNameResult(
      ok: false,
      normalized: '',
      reason: 'empty',
      role: role,
    );
  }

  final folded = _fold(normalized);
  Binder? self;
  if (binderId != null) {
    for (final b in binders) {
      if (b.clientId == binderId) {
        self = b;
        break;
      }
    }
  }

  for (final b in binders) {
    if (!b.isLive) continue;
    if (binderId != null && b.clientId == binderId) continue;
    if (_fold(b.name) == folded) {
      return BinderNameResult(
        ok: false,
        normalized: normalized,
        reason: 'duplicate',
        role: self?.role,
      );
    }
  }

  return BinderNameResult(
    ok: true,
    normalized: normalized,
    role: self?.role ?? BinderRole.standard,
  );
}
