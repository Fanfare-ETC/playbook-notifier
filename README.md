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

    State of the game. Sent in response to `client:getState` for the client to retrieve initial information. At present, initial information includes the current `inning` and `half`.

- `server:stateChanged` (broadcast)

    Game state has changed. The data contains the same information as `server:state`.

- `server:playsCreated` (broadcast)

    New plays have been created. The data is an array of play IDs.

- `server:clearPredictions` (broadcast)

    Predictions should be cleared.

- `server:predictionCorrect`

    A prediction made turned out to be correct. Sent after client sends `client:makePredictions`.

- `server:error`

    An error has occurred. Possible reasons include malformed JSON, invalid inputs or a server-side problem.

The following events are sent from client to server:

- `client:makePredictions`

    Makes one or more predictions. Client will receive `server:predictionCorrect` at some of point in the future. The data should include an `id` and an array of play IDs (`plays`).

- `client:getState`

    Retrieves the game state. Client will receive `server:state`.

- `operator:setState`

    Sets the state of the game. A broadcast `server:stateChanged` will be sent to all clients.

- `operator:createPlays`

    Creates a play. A broadcast `server:playsCreated` will be sent.

- `operator:clearPredictions`

    Clears predictions. A broadcast `server:clearPredictions` will be sent.
