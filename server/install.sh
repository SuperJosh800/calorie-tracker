#!/usr/bin/env bash
# Installs or updates the Calorie Tracker backend (PocketBase) on a Linux server, running as its own user.
# Run with: curl -fsSL https://raw.githubusercontent.com/SuperJosh800/calorie-tracker/main/server/install.sh | sudo bash
set -euo pipefail

VERSION=0.40.6
REPO=${CT_REPO:-https://raw.githubusercontent.com/SuperJosh800/calorie-tracker/main}
SVC_USER=calorie-backend
DIR=/opt/calorie-backend

[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
case "$(uname -m)" in
  x86_64) ARCH=amd64; SHA=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f ;;
  aarch64) ARCH=arm64; SHA=d22c66ceb67ca92b7d767f36d826e848a276bcfa3c197ead20bf87c42208984f ;;
  *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;;
esac
command -v unzip >/dev/null || apt-get install -y unzip

# A separate user with no login, so the backend can't touch the GitHub runner or your files (and vice versa).
id "$SVC_USER" >/dev/null 2>&1 || useradd --system --home-dir "$DIR" --shell /usr/sbin/nologin "$SVC_USER"
mkdir -p "$DIR/pb_migrations" "$DIR/pb_data"

echo "Downloading PocketBase $VERSION..."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/pb.zip" "https://github.com/pocketbase/pocketbase/releases/download/v$VERSION/pocketbase_${VERSION}_linux_$ARCH.zip"
echo "$SHA  $tmp/pb.zip" | sha256sum -c --quiet
unzip -oq "$tmp/pb.zip" pocketbase -d "$tmp"
install -m 755 "$tmp/pocketbase" "$DIR/pocketbase"
curl -fsSL -o "$DIR/pb_migrations/1761436800_create_backups.js" "$REPO/server/pb_migrations/1761436800_create_backups.js"
chown -R "$SVC_USER:$SVC_USER" "$DIR"
chmod 700 "$DIR/pb_data"

cat > /etc/systemd/system/calorie-backend.service <<EOF
[Unit]
Description=Calorie Tracker backend (PocketBase)
After=network-online.target
Wants=network-online.target

[Service]
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$DIR
# Only listens on this machine; Tailscale Serve makes it reachable from your devices over HTTPS.
ExecStart=$DIR/pocketbase serve --http=127.0.0.1:8090 --dir=$DIR/pb_data --migrationsDir=$DIR/pb_migrations
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DIR/pb_data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable calorie-backend >/dev/null 2>&1
systemctl restart calorie-backend
sleep 2
if curl -fsS http://127.0.0.1:8090/api/health >/dev/null; then
  echo "Calorie Tracker backend is running on this machine (port 8090)."
else
  echo "The backend didn't start. See: sudo journalctl -u calorie-backend -n 50"
  exit 1
fi
