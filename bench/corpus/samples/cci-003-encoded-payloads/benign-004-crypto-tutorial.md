# Base64 + hex encoding tutorial

This primitive explains the difference between base64 and hex
encoding for binary data. The examples below are illustrative; none
of them carry executable payloads.

## Base64 — 6 bits per character

A base64-encoded byte sequence pads to a multiple of 4 characters with
`=`. Example (the literal bytes `Hello, world!`):

```
SGVsbG8sIHdvcmxkIQ==
```

## Hex — 4 bits per character

Hex doubles the byte count. The same payload in hex:

```
48656c6c6f2c20776f726c6421
```

## When each is preferred

Base64 is denser; hex is human-readable and survives more transports
unmolested. For tokens that humans must transcribe, hex wins.
