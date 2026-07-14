# Production deployment

The production layout deliberately separates the credential-bearing API from the Docker-socket-bearing Sandbox Worker.

- `web`: static human control plane, only bound to host loopback;
- `api`: SQLite, Vault, auth, Harness and MCP proxy; no Docker socket;
- `worker`: no Vault or model credentials; owns Docker execution and the shared workspace volume;
- host Nginx: TLS, `/ark/` path routing, security headers and login rate limiting.

## Deploy

1. Copy `.env.production.example` to `.env.production` and generate all secret values.
2. Ensure `ARK_HOST_DATA_DIR` is the absolute host path to `deploy/data`.
3. Run `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build` from this directory.
4. Make the existing catch-all Nginx server also listen on loopback port `8088`,
   then install `nginx-snowmountain-ark-acme.conf`. This preserves the server's
   existing direct-IP routes while giving the exact IP vhost ownership of ACME.
5. Obtain a trusted short-lived IP certificate with Certbot 5.4 or newer:

   ```sh
   docker run --rm \
     -v /etc/letsencrypt:/etc/letsencrypt \
     -v /var/www/certbot:/var/www/certbot \
     certbot/certbot:latest certonly --preferred-profile shortlived \
     --webroot --webroot-path /var/www/certbot --ip-address 106.14.73.99
   ```

6. Install `nginx-snowmountain-ark.conf` and schedule
   `renew-certificate.sh` daily. IP certificates are intentionally valid for
   about six days, so automated renewal is mandatory.

The resulting control plane is `https://106.14.73.99/ark/`. Keep the generated
administrator password outside the repository and deliver it through a
separate secret channel.

If a cloud-provider edge policy closes public TLS before it reaches Nginx, a
Cloudflare Quick Tunnel can provide an immediate trusted HTTPS acceptance URL:

```sh
docker run -d --name snowmountain-ark-tunnel --restart unless-stopped \
  --network host cloudflare/cloudflared:latest tunnel --no-autoupdate \
  --url https://127.0.0.1:443 --no-tls-verify
docker logs snowmountain-ark-tunnel
```

Quick Tunnel hostnames are ephemeral and intended for acceptance testing. A
stable production hostname requires a named Cloudflare Tunnel or a controlled,
compliant domain; neither should be silently inferred from source code.

The app is built with `VITE_BASE_PATH=/ark/` and `VITE_API_URL=/ark`. The API and Worker have no public host ports.

## Backup

`backup.sh` uses SQLite's online backup command and retains 14 days by default. Schedule it from the host; never copy only the main database file while WAL writes are active.

Example root crontab:

```cron
17 2 * * * /opt/snowmountain-ark/deploy/backup.sh >>/var/log/snowmountain-ark-backup.log 2>&1
31 3 * * * /opt/snowmountain-ark/deploy/renew-certificate.sh >>/var/log/snowmountain-ark-certbot.log 2>&1
```

Restore by stopping the Compose stack, copying one backup to
`deploy/data/snowmountain.db`, removing stale `-wal`/`-shm` siblings, and
starting the stack. The queue retains jobs that were still queued; jobs that
had begun execution are marked failed after restart and require an explicit
retry so tool side effects are never silently replayed.

## Security invariants

- only host Nginx and loopback port `4311` are reachable from outside the Compose network;
- the API container has Vault/model secrets and no Docker Socket;
- the Worker has the Docker Socket and no Vault/model secrets;
- child sandboxes use no network, read-only rootfs, dropped capabilities,
  `no-new-privileges`, PID/CPU/memory/runtime limits and one Session workspace;
- control-plane writes require an authenticated SameSite cookie plus a CSRF token;
- audit records contain actor, route, result, source IP and request ID, never passwords, prompts or tokens.
