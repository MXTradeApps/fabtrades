#!/usr/bin/env bash
# Flutter writes FlutterGeneratedPluginSwiftPackage with iOS 13.0 on pub get.
# file_picker_darwin requires 14.0+, and this app already ships at 15.5
# (Podfile + Runner). Xcode resolves SPM before any build script, so the
# generated Package.swift must already match the app minimum on disk.
#
# Usage: tool/sync_spm_ios_platform.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
manifest="$root/ios/Flutter/ephemeral/Packages/FlutterGeneratedPluginSwiftPackage/Package.swift"
min_ios="${SPM_IOS_MIN:-15.5}"

if [[ ! -f "$manifest" ]]; then
  exit 0
fi

python3 - "$manifest" "$min_ios" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
min_ios = sys.argv[2]
text = path.read_text()
updated, n = re.subn(r'\.iOS\("[0-9.]+"\)', f'.iOS("{min_ios}")', text)
if n and updated != text:
    path.write_text(updated)
    print(f"Set {path} platform to iOS {min_ios}")
PY
