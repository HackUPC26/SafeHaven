#!/bin/bash
# SafeHaven live-stream demo script
# Usage: ./scripts/demo-stream.sh
set -e
cd "$(dirname "$0")/.."

echo ""
echo "=== SafeHaven Live Stream Demo ==="
echo ""

# Detect local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "localhost")
PORT="${PORT:-8080}"

echo "Local IP: $LOCAL_IP"
echo "Port:     $PORT"
echo ""
echo "Starting signaling server..."
echo ""

cd p2p-hello
node signaling.js &
SIG_PID=$!

# Wait for server to be ready
sleep 1

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           STEP-BY-STEP DEMO INSTRUCTIONS             ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  OPTION A — Browser-only test (no iPhone needed):    ║"
echo "║    1. Open sender:   http://$LOCAL_IP:$PORT/sender   ║"
echo "║    2. Click 'Start Broadcast' — allow camera/mic     ║"
echo "║    3. Copy the receiver URL shown on the page        ║"
echo "║    4. Open receiver URL in another tab/device        ║"
echo "║    5. Verify video+audio appear                      ║"
echo "║                                                      ║"
echo "║  OPTION B — iPhone sender:                           ║"
echo "║    1. Set EXPO_PUBLIC_SIGNAL_HOST=$LOCAL_IP:$PORT    ║"
echo "║       in mobile/.env                                 ║"
echo "║    2. cd mobile && npx expo run:ios                  ║"
echo "║    3. In app: type 'sunny' in search box             ║"
echo "║    4. Tap the invite link shown at bottom            ║"
echo "║    5. Open http://$LOCAL_IP:$PORT/#<token> in browser║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Signaling server running (PID $SIG_PID). Press Ctrl+C to stop."
echo ""

trap "kill $SIG_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait $SIG_PID
