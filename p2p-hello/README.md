# SafeHaven P2P Hello World

Minimal Autobase + Hyperswarm P2P demo. One peer appends `hello world` to an Autobase, another peer receives it in real time over the Pear DHT — no server, no signalling, no cloud.

This is step 1 of the SafeHaven P2P layer. Once this works end-to-end, the next iterations swap the sender CLI for an iPhone app (React Native + Bare) and the receiver CLI for a browser dashboard (hyperswarm-web).

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

It prints a bootstrap key (hex). Copy it.

### Terminal 2 — receiver

```
node receiver.js <bootstrap-key-hex>
```

Once `[peer connected]` shows on both sides, press **Enter** in the sender terminal. `hello world` shows up in the receiver terminal, appended to the append-only log.

## What's happening

- Sender creates an Autobase with itself as the sole writer.
- Both peers join Hyperswarm on the Autobase's `discoveryKey` and replicate the underlying Corestore over the DHT.
- Each Enter keypress calls `base.append({ text: 'hello world', ... })`. The entry is cryptographically signed and chained to the previous one.
- Receiver subscribes to `base.on('update')` and reads new blocks from `base.view`.

Storage lives in `storage-sender/` and `storage-receiver/`. Delete those to reset.
