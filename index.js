const http = require('http');
const Promise = require('bluebird');
const mysql = require('promise-mysql');
const moment = require('moment');
const express = require('express');
const WebSocket = require('ws');
const Ajv = require('ajv');

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });

const ajv = new Ajv();
const validate = ajv.compile(require('./schema.json'));

// Helper functions.
const createMessage = function (event, data) {
  if (data !== undefined) {
    return JSON.stringify({ event, data });
  } else {
    return JSON.stringify({ event });
  }
};

const broadcast = function (server, message) {
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Individual message handlers.
const messageHandlers = {
  'operator:createPlays': (message, server) => {
    broadcast(server, createMessage('server:playsCreated', message.data));
  },
  'operator:clearPredictions': (message, server) => {
    broadcast(server, createMessage('server:clearPredictions'));
  }
};

// Core message handler.
const handleMessage = function (client, message, server) {
  try {
    message = JSON.parse(message);
    if (!validate(message)) {
      console.log('Failed to validate?');
      client.send(createMessage('server:error', validate.errors));
      return;
    }

    console.log(`${client.upgradeReq.connection.remoteAddress} ${message.event}`);
    messageHandlers[message.event].call(client, message, server);

  } catch (e) {
    client.send(createMessage('server:error', 'Invalid JSON was received by the server.'));
    console.log(e);
  }
};

Promise.coroutine(function* () {
  // Listen on server events.
  webSocketServer.on('connection', (ws) => {
    console.log(`${ws.upgradeReq.connection.remoteAddress} connected`);

    ws.on('message', (message) => {
      handleMessage(ws, message, webSocketServer);
    });

    ws.on('close', () => {
      console.log(`${ws.upgradeReq.connection.remoteAddress} disconnected`);
    });
  });

  // Listen on port.
  server.listen(8080, '0.0.0.0', function () {
    console.log(`Server listening on ${server.address().address}:${server.address().port}`);
  });
})();
