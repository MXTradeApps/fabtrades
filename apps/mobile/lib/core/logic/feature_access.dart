/// Temporary product switch: every formerly-Pro feature is free.
///
/// Flip to `false` (and `unlockAllFeatures` in
/// `apps/web/src/utils/featureAccess.js`) to restore Pro gating.
/// RevenueCat, entitlements, paywall UI, and [FreeLimits] stay in place.
/// My Account still offers See plans so a purchase can complete.
const bool unlockAllFeatures = true;
