#!/bin/sh
# Installs Pitcher for the current user on macOS or Linux. No root, no npm, no developer tools.
# Needs Node.js 20+ (it is the only requirement); the open-source speech runtimes are downloaded and hash-verified.
set -eu
SRC=$(cd "$(dirname "$0")/.." && pwd)
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/pitcher"
BIN="$HOME/.local/bin"

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "Pitcher needs Node.js 20 or newer. Install it from https://nodejs.org (or your package manager), then run this again."
  exit 1
fi

echo "Installing Pitcher into $DEST"
mkdir -p "$DEST/data" "$BIN"
for item in server.js package.json README.md lib public scripts install; do
  [ -e "$SRC/$item" ] && cp -R "$SRC/$item" "$DEST/"
done
[ -f "$DEST/public/vendor/manifest.json" ] || node "$DEST/scripts/fetch-vendor.mjs" || echo "Speech runtimes could not be downloaded; the browser's speech will be used. Run this again later to retry."

cat > "$BIN/pitcher" <<EOF
#!/bin/sh
# Starts Pitcher (if needed) and opens it. The server stops 10 minutes after the last window closes.
URL=http://127.0.0.1:8787
if ! curl -fs "\$URL/api/health" >/dev/null 2>&1; then
  (cd "$DEST" && PITCHER_AUTOSTOP=10 nohup node server.js >"$DEST/data/server.log" 2>&1 &)
  i=0; while [ \$i -lt 40 ] && ! curl -fs "\$URL/api/health" >/dev/null 2>&1; do sleep 0.25; i=\$((i+1)); done
fi
for b in google-chrome chromium chromium-browser microsoft-edge; do
  if command -v "\$b" >/dev/null 2>&1; then "\$b" --app="\$URL/#pitch" >/dev/null 2>&1 & exit 0; fi
done
if [ -d "/Applications/Google Chrome.app" ]; then open -na "Google Chrome" --args --app="\$URL/#pitch"; exit 0; fi
if [ -d "/Applications/Microsoft Edge.app" ]; then open -na "Microsoft Edge" --args --app="\$URL/#pitch"; exit 0; fi
command -v xdg-open >/dev/null 2>&1 && xdg-open "\$URL/#pitch" || open "\$URL/#pitch"
EOF
chmod +x "$BIN/pitcher"

if [ "$(uname)" = "Linux" ]; then
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/pitcher.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Pitcher
Comment=Pitch a Roblox game to a crowd of claudes
Exec=$BIN/pitcher
Icon=$DEST/public/icons/icon-512.png
Categories=Game;Development;
EOF
fi
echo "Done. Run 'pitcher' (make sure $BIN is on your PATH). To remove: rm -rf \"$DEST\" \"$BIN/pitcher\""
