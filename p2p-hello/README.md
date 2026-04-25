# SafeHaven P2P Hello World

Minimal [Autopass](https://github.com/holepunchto/autopass) demo. One peer creates an Autopass instance and prints a pairing invite. Another peer pairs with that invite and receives `hello world` entries in real time over the Pear DHT — no server, no signalling, no cloud.

Hackathon constraint: we must use Autopass (it's a required Holepunch building block). Autopass wraps Autobase + Hyperswarm + BlindPairing internally so we don't roll our own.

## Install

```
cd p2p-hello
npm install
```

## Run

Open two terminals.

### Terminal 1 — sender

```
node sender.js
```

It prints an `Invite:` z32 string. Copy it.

### Terminal 2 — receiver

```
node receiver.js <invite>
```

Wait for `Paired. Watching for updates...`, then press **Enter** in the sender terminal. `hello world` shows up in the receiver terminal as a new key/value entry in the shared Autopass.

## What's happening

- Sender creates an Autopass and calls `createInvite()` to mint a one-time pairing code.
- Receiver calls `Autopass.pair(store, invite)` and waits for `pair.finished()`. Under the hood this runs BlindPairing over Hyperswarm and adds the receiver as a writer to the shared Autobase.
- Each Enter keypress calls `pass.add('hello-N', value)`. The entry is appended to the shared HyperDB view backed by Autobase.
- Receiver subscribes to `pass.on('update')` and streams new entries from `pass.list()`.

Storage lives in `storage-sender/` and `storage-receiver/`. Delete those to reset.
