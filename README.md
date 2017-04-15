# Playbook Notifier

This is a simple WebSocket server that notifies the Playbook client about
live events. It works in concert with the Operator Console.

## Requirements

You need Node.js. Once installed, do:

    npm install
    npm start

By default, the server listens on port 8080.

## Client Protocol

The protocol used is a JSON-based message-oriented protocol. It's simple:
messages are JSON-based and contain two properties: "event" and "data".

The following events are sent from server to client:

- `server:state`
- `server:stateChanged`
- `server:playsCreated`
- `server:clearPredictions`
- `server:error`

The following events are sent from client to server:

- `client:getState`
- `operator:setState`
- `operator:createPlays`
- `operator:clearPredictions`
