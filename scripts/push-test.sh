#!/bin/bash
# ============================================================
# push-test.sh — «Nivå 1»-pushtesting uten Apple Developer-konto.
#
# Sender et varsel rett inn i simulatoren med `xcrun simctl push`.
# Dette tester VISNING + HÅNDTERING i appen (AppDelegate → pod'en →
# forgrunns-banner), ikke APNs. Ekte APNs krever Apple-konto + fysisk
# enhet — simulatoren får normalt aldri en ekte device-token.
#
# Payloaden speiler nøyaktig det push-fanout/apns.ts faktisk sender:
#   { aps: {alert:{title,body}, sound, thread-id}, feed_post_id, ... }
#
# Bruk:
#   ./scripts/push-test.sh                 # mål, til alle bootede simer
#   ./scripts/push-test.sh start           # kampstart
#   ./scripts/push-test.sh melding         # vanlig feed-post
#   ./scripts/push-test.sh maal <UDID>     # kun én sim
#
# NB: appen må ha fått varsel-tillatelse i simulatoren (🔔 «Varslinger»
# på ProfilScreen), ellers vises ingenting selv om kommandoen sier OK.
# ============================================================
set -euo pipefail

BUNDLE_ID="${HEIA_BUNDLE_ID:-org.reactjs.native.example.Heia2}"
TEAM_SPACE_ID="11111111-1111-1111-1111-111111111111"
PRESET="${1:-maal}"
TARGET="${2:-}"

case "$PRESET" in
  maal|goal)
    TITLE="Aztek G14"
    BODY="⚽ MÅL! Aztek 1–0 Lyn (23')"
    ;;
  start)
    TITLE="Aztek G14"
    BODY="⚽ Kampen er i gang: Aztek mot Lyn"
    ;;
  pause)
    TITLE="Aztek G14"
    BODY="⏸ Pause — Aztek 1–0 Lyn"
    ;;
  slutt|end)
    TITLE="Aztek G14"
    BODY="🏁 Slutt! Aztek 2–1 Lyn"
    ;;
  melding|text)
    TITLE="Brage Lothe Weium"
    BODY="Husk å ta med drikkeflaske til treningen i morgen!"
    ;;
  *)
    echo "Ukjent preset: $PRESET (maal|start|pause|slutt|melding)" >&2
    exit 1
    ;;
esac

PAYLOAD=$(mktemp -t heia-push).apns
cat > "$PAYLOAD" <<JSON
{
  "aps": {
    "alert": {"title": "$TITLE", "body": "$BODY"},
    "sound": "default",
    "thread-id": "$TEAM_SPACE_ID"
  },
  "feed_post_id": "22222222-2222-2222-2222-222222222222",
  "event_id": "33333333-3333-3333-3333-333333333333",
  "team_space_id": "$TEAM_SPACE_ID"
}
JSON

if [ -n "$TARGET" ]; then
  DEVICES="$TARGET"
else
  DEVICES=$(xcrun simctl list devices booted | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' || true)
fi

if [ -z "$DEVICES" ]; then
  echo "Ingen bootede simulatorer funnet." >&2
  exit 1
fi

for DEV in $DEVICES; do
  printf '→ %s: ' "$DEV"
  xcrun simctl push "$DEV" "$BUNDLE_ID" "$PAYLOAD"
done

rm -f "$PAYLOAD"
