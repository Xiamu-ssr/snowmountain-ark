#!/usr/bin/env sh
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

CERTBOT_IMAGE=${CERTBOT_IMAGE:-certbot/certbot:latest}
WEBROOT=${CERTBOT_WEBROOT:-/var/www/certbot}
LE_DIR=${LE_DIR:-/etc/letsencrypt}

docker run --rm \
  -v "$LE_DIR:/etc/letsencrypt" \
  -v "$WEBROOT:/var/www/certbot" \
  "$CERTBOT_IMAGE" renew --quiet

nginx -t
nginx -s reload
