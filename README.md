# Safe Haven

A real-time emergency monitoring system. A mobile sender app transmits location and status data over a P2P socket to a receiver PWA displayed on another device.

## Components

| Component | Directory | Description |
|-----------|-----------|-------------|
| Mobile App | `mobile/` | Expo React Native app — the sender |
| Receiver PWA | `receiver/` | Static PWA — displays incoming data |
| P2P Socket Server | `p2p-hello/` | Node.js WebSocket + Autopass bridge |

---

## Mobile App

Expo React Native app that runs on iOS or Android and sends location/status events to the P2P socket server.

```bash
cd mobile
npm install
npm start          # opens Expo dev tools
npm run android    # run on Android emulator/device
npm run ios        # run on iOS simulator/device
```

Requires [Expo Go](https://expo.dev/go) on your device, or a local Android/iOS emulator.

---

## Receiver PWA

Static HTML PWA — no build step needed. Serve it with any HTTP server.

```bash
cd receiver
python3 -m http.server 3000
# or
npx http-server -p 3000
```

Open `http://localhost:3000` in a browser. The service worker enables offline capability.

---

## P2P Socket Server

Node.js server that bridges the mobile app's WebSocket events into an Autopass (Hypercore-based) P2P stream. Run sender and receiver in separate terminals.

```bash
cd p2p-hello
npm install

# Terminal 1 — start the sender (also runs the WebSocket server on port 8080)
npm run sender
# Output: Invite: <KEY>

# Terminal 2 — start the receiver (paste the invite key from above)
npm run receiver <KEY>
```

The mobile app connects to the WebSocket on port `8080`. The receiver PWA reads data streamed by the receiver process.

---

## Running Everything Together

```bash
# 1. Install dependencies
cd mobile && npm install && cd ../p2p-hello && npm install

# 2. Start P2P sender (Terminal 1)
cd p2p-hello && npm run sender

# 3. Start P2P receiver with the invite key (Terminal 2)
cd p2p-hello && npm run receiver <KEY>

# 4. Serve the Receiver PWA (Terminal 3)
cd receiver && python3 -m http.server 3000

# 5. Start the mobile app (Terminal 4)
cd mobile && npm start
```
