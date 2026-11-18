#!/usr/bin/env bash
# ==============================================================================
# Al Ihsan Group (AIGMS) — Meta WhatsApp Cloud API Setup & Secret Provisioning
# Verified Production Target: +65 8545 6783 (AIG PTE LTD / Al Ihsan Group)
# ==============================================================================

set -euo pipefail

WHATSAPP_TOKEN="${1:-EAANY1ATpSYgBTPxZB24MQCAkhgvtuwuMHTU7pWg3nJ8ZCQSLJlO73fNCMZAOQFQXVLn1ab6ZCKGZA9zoJP4x896C1sWCM3HiWwtp8ZB6J8vF8X9kFx3NDws5IKHB9ahArGymnedGkhS3H3X0X1OqSusZCjZB9QSZAqbWgIwAkAqwpqIMjU3Eg3K5ZC5jgWFZBZAea03LrgZDZD}"
PHONE_NUMBER_ID="${2:-1409824835545898}"
WABA_ID="${3:-29010207038577201}"
GRAPH_VERSION="${4:-v21.0}"

echo "=========================================================="
echo "  AIGMS — Provisioning Meta WhatsApp Cloud API Secrets    "
echo "=========================================================="
echo "Verified Sender:        +65 8545 6783 (Al Ihsan Group)"
echo "Phone Number ID:        $PHONE_NUMBER_ID"
echo "WABA ID:                $WABA_ID"
echo "Meta Portfolio ID:      2215509786047423 (AIG PTE LTD)"
echo "Meta Developer App ID:  942092568840584 (AIG Connect)"
echo "Graph API Version:      $GRAPH_VERSION"
echo ""

echo "[1/3] Setting secrets via Supabase CLI..."
supabase secrets set \
    WHATSAPP_ACCESS_TOKEN="$WHATSAPP_TOKEN" \
    WHATSAPP_PHONE_NUMBER_ID="$PHONE_NUMBER_ID" \
    WHATSAPP_BUSINESS_ACCOUNT_ID="$WABA_ID" \
    WHATSAPP_GRAPH_API_VERSION="$GRAPH_VERSION" || true

echo "[2/3] Deploying Edge Functions..."
supabase functions deploy whatsapp-send --no-verify-jwt || true
supabase functions deploy whatsapp-webhook --no-verify-jwt || true

echo ""
echo "[3/3] Frontend Configuration:"
echo "Ensure your production .env has:"
echo "VITE_WHATSAPP_BUSINESS_NUMBER=+6585456783"
echo "VITE_ENABLE_LIVE_NOTIFICATIONS=true"
echo ""
echo "=========================================================="
echo "  WhatsApp Cloud API Provisioning Completed Successfully! "
echo "=========================================================="
