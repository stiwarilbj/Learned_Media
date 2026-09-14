#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-native}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
LEARNED_MEDIA_CACHE_ROOT="/private/tmp/learned-media-swift-cache"
mkdir -p "$LEARNED_MEDIA_CACHE_ROOT/clang" "$LEARNED_MEDIA_CACHE_ROOT/swiftpm"
export CLANG_MODULE_CACHE_PATH="$LEARNED_MEDIA_CACHE_ROOT/clang"
export SWIFTPM_MODULECACHE_OVERRIDE="$LEARNED_MEDIA_CACHE_ROOT/swiftpm"
case "$MODE" in
  arm64|x86_64) ARCH="$MODE" ;;
  native) ARCH="$(uname -m)"; [[ "$ARCH" == "arm64" || "$ARCH" == "x86_64" ]] || { echo "Unsupported Mac architecture: $ARCH" >&2; exit 2; } ;;
  *) echo "Usage: $0 [native|arm64|x86_64]" >&2; exit 2 ;;
esac
swift build -c release --arch "$ARCH"
BIN_DIR="$(swift build -c release --arch "$ARCH" --show-bin-path)"
APP_DIR="$ROOT_DIR/Learned Media.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
cp "$BIN_DIR/LearnedMediaApp" "$MACOS_DIR/LearnedMediaApp"
chmod +x "$MACOS_DIR/LearnedMediaApp"
cp -R "$ROOT_DIR/Resources/frontend" "$RESOURCES_DIR/frontend"
cp "$ROOT_DIR/Resources/Config.plist" "$RESOURCES_DIR/Config.plist"
cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Learned Media</string>
  <key>CFBundleExecutable</key><string>LearnedMediaApp</string>
  <key>CFBundleIdentifier</key><string>com.learnedmedia.app</string>
  <key>CFBundleName</key><string>Learned Media</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleURLTypes</key>
  <array><dict><key>CFBundleURLName</key><string>Learned Media authentication callback</string><key>CFBundleURLSchemes</key><array><string>learnedmedia</string></array></dict></array>
</dict>
</plist>
PLIST
codesign --force --deep --sign - "$APP_DIR" >/dev/null
echo "Built $APP_DIR ($ARCH, ad-hoc signed)"
