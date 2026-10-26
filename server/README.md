# Calorie Tracker backend

Accounts and sync run on [PocketBase](https://pocketbase.io), a single program with logins and a database,
on your own Linux server. [Tailscale](https://tailscale.com) makes it reachable over HTTPS from your own
devices only, without opening any ports on your router.

Each account stores one copy of its diary, weigh-ins, foods and goals. Only the signed-in owner can read or
change it (see `pb_migrations/`).

## Install

On the server:

```sh
curl -fsSL https://raw.githubusercontent.com/SuperJosh800/calorie-tracker/main/server/install.sh | sudo bash
```

This creates a `calorie-backend` user, installs PocketBase in `/opt/calorie-backend`, and runs it as the
`calorie-backend` systemd service, listening only on `127.0.0.1:8090`. Running the same command again updates it
and keeps your data.

Create the admin login for the dashboard (use your own email and a strong password):

```sh
sudo -u calorie-backend /opt/calorie-backend/pocketbase superuser upsert you@example.com 'a-long-password' \
  --dir=/opt/calorie-backend/pb_data
```

## Make it reachable with Tailscale

1. Install Tailscale on the server and sign in: `curl -fsSL https://tailscale.com/install.sh | sh`, then
   `sudo tailscale up`.
2. Install the Tailscale app on your phone and sign in with the same account.
3. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), turn on **MagicDNS** and
   **HTTPS Certificates**.
4. On the server: `sudo tailscale serve --bg 8090`. It prints the address, like
   `https://joshserver1.tail1234.ts.net`.

Enter that address in the app under **Settings → Account**, then **Create account**. The admin dashboard is at the
same address followed by `/_/`.

Your phone needs Tailscale switched on to sync. When it's off, the app keeps working and syncs next time.

## Look after it

- Status and logs: `systemctl status calorie-backend` and `sudo journalctl -u calorie-backend -f`.
- Backups: everything is in `/opt/calorie-backend/pb_data`. Copy it somewhere else now and then, or use
  **Settings → Backups** in the dashboard.
- Stop sharing: `sudo tailscale serve --https=443 off`.
