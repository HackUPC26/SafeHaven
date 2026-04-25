#!/bin/bash
# Smoke test: sender -> receiver via Autopass over the DHT.
set -e
cd "$(dirname "$0")"

rm -rf storage-sender storage-receiver sender.out receiver.out sender.fifo

mkfifo sender.fifo

# Open fd 3 in read-write mode so it doesn't block waiting for a reader.
# We write "Enter" keystrokes through fd 3; sender reads from the fifo on stdin.
exec 3<> sender.fifo

node sender.js < sender.fifo > sender.out 2>&1 &
SENDER_PID=$!

# Wait for invite to appear.
for i in {1..40}; do
  if grep -q '^Invite:' sender.out 2>/dev/null; then break; fi
  sleep 0.25
done
INVITE=$(grep '^Invite:' sender.out | awk '{print $2}')
echo "invite=$INVITE"

if [ -z "$INVITE" ]; then
  echo "no invite, sender output:"
  cat sender.out
  kill "$SENDER_PID" 2>/dev/null || true
  exec 3>&-
  rm -f sender.fifo
  exit 1
fi

node receiver.js "$INVITE" > receiver.out 2>&1 &
RECEIVER_PID=$!

# Wait for receiver to finish pairing.
for i in {1..120}; do
  if grep -q 'Paired' receiver.out 2>/dev/null; then break; fi
  sleep 0.5
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
