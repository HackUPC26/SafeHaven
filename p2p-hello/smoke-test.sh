#!/bin/bash
# Smoke test: sender -> receiver via DHT. Used to verify the P2P path works.
set -e
cd "$(dirname "$0")"

rm -rf storage-sender storage-receiver sender.out receiver.out sender.fifo

mkfifo sender.fifo

# Open fd 3 in read-write mode so it doesn't block waiting for a reader.
# We write "Enter" keystrokes through fd 3; sender reads from the fifo on stdin.
exec 3<> sender.fifo

node sender.js < sender.fifo > sender.out 2>&1 &
SENDER_PID=$!

# Wait for bootstrap key to appear.
for i in {1..40}; do
  if grep -q 'Bootstrap key:' sender.out 2>/dev/null; then break; fi
  sleep 0.25
done
BOOTSTRAP_KEY=$(grep 'Bootstrap key:' sender.out | awk '{print $3}')
echo "bootstrap=$BOOTSTRAP_KEY"

# Wait for sender to finish swarming.
for i in {1..40}; do
  if grep -q 'Waiting for receiver' sender.out 2>/dev/null; then break; fi
  sleep 0.25
done

node receiver.js "$BOOTSTRAP_KEY" > receiver.out 2>&1 &
RECEIVER_PID=$!

# Wait for peers to connect on both sides.
for i in {1..80}; do
  if grep -q 'peer connected' sender.out && grep -q 'peer connected' receiver.out; then break; fi
  sleep 0.25
done

# Press "Enter" in sender three times with pauses.
for i in 1 2 3; do
  echo "" >&3
  sleep 0.5
done

# Give replication time to flush.
sleep 3

echo "---- sender.out ----"
cat sender.out
echo "---- receiver.out ----"
cat receiver.out

kill "$SENDER_PID" "$RECEIVER_PID" 2>/dev/null || true
exec 3>&-
rm -f sender.fifo
wait 2>/dev/null || true
