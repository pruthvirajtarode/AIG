# ==============================================================================
# Al Ihsan Group (AIGMS) — Meta WhatsApp Cloud API Setup & Secret Provisioning
# Verified Production Target: +65 8545 6783 (AIG PTE LTD / Al Ihsan Group)
# ==============================================================================

param(
    [string]$WhatsAppToken = "EAANY1ATpSYgBTPxZB24MQCAkhgvtuwuMHTU7pWg3nJ8ZCQSLJlO73fNCMZAOQFQXVLn1ab6ZCKGZA9zoJP4x896C1sWCM3HiWwtp8ZB6J8vF8X9kFx3NDws5IKHB9ahArGymnedGkhS3H3X0X1OqSusZCjZB9QSZAqbWgIwAkAqwpqIMjU3Eg3K5ZC5jgWFZBZAea03LrgZDZD",
    [string]$PhoneNumberId = "1409824835545898",
    [string]$WabaId = "29010207038577201",
    [string]$GraphVersion = "v21.0"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AIGMS — Provisioning Meta WhatsApp Cloud API Secrets    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Verified Sender:        +65 8545 6783 (Al Ihsan Group)" -ForegroundColor Green
Write-Host "Phone Number ID:        $PhoneNumberId" -ForegroundColor Green
Write-Host "WABA ID:                $WabaId" -ForegroundColor Green
Write-Host "Meta Portfolio ID:      2215509786047423 (AIG PTE LTD)" -ForegroundColor Green
Write-Host "Meta Developer App ID:  942092568840584 (AIG Connect)" -ForegroundColor Green
Write-Host "Graph API Version:      $GraphVersion" -ForegroundColor Green
Write-Host ""

# 1. Set Supabase Edge Function Secrets
Write-Host "[1/3] Setting secrets via Supabase CLI..." -ForegroundColor Yellow
supabase secrets set `
    WHATSAPP_ACCESS_TOKEN="$WhatsAppToken" `
    WHATSAPP_PHONE_NUMBER_ID="$PhoneNumberId" `
    WHATSAPP_BUSINESS_ACCOUNT_ID="$WabaId" `
    WHATSAPP_GRAPH_API_VERSION="$GraphVersion"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Secrets set successfully in Supabase!" -ForegroundColor Green
} else {
    Write-Host "  Note: If Supabase CLI is not linked, run 'supabase link' first." -ForegroundColor DarkYellow
}

# 2. Deploy Edge Functions
Write-Host "`n[2/3] Deploying Edge Functions..." -ForegroundColor Yellow
Write-Host "  - Deploying whatsapp-send..."
supabase functions deploy whatsapp-send --no-verify-jwt
Write-Host "  - Deploying whatsapp-webhook..."
supabase functions deploy whatsapp-webhook --no-verify-jwt

# 3. Environment Variable Notice for Frontend
Write-Host "`n[3/3] Frontend Configuration:" -ForegroundColor Yellow
Write-Host "  Ensure your production .env has:" -ForegroundColor White
Write-Host "  VITE_WHATSAPP_BUSINESS_NUMBER=+6585456783" -ForegroundColor Cyan
Write-Host "  VITE_ENABLE_LIVE_NOTIFICATIONS=true" -ForegroundColor Cyan

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  WhatsApp Cloud API Provisioning Completed Successfully! " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
