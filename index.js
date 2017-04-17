'use strict';
const http = require('http');
const Promise = require('bluebird');
const mysql = require('promise-mysql');
const moment = require('moment');
const request = require('request-promise');
const config = require('config');
const express = require('express');
const WebSocket = require('ws');
const Ajv = require('ajv');

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });

const ajv = new Ajv();
const validate = ajv.compile(require('./schema.json'));

// Game state.
const state = {
  inning: null,
  half: null
};

/**
 * Creates a message to be sent to clients.
 * @param {string} event
 * @param {*} data
 */
function createMessage(event, data) {
  if (data !== undefined) {
    return JSON.stringify({ event, data });
  } else {
    return JSON.stringify({ event });
  }
}

/**
 * Broadcasts a message to all clients.
 * @param {WebSocket.Server} server
 * @param {*} message
 */
function broadcast(server, message) {
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Forwards a message to Google Cloud Messaging.
 * @param {string} topic
 * @param {string} event
 * @param {*} message
 */
function forwardMessageToGcm(topic, event, message) {
  const request = require('request-promise');
  return request({
    method: 'POST',
    uri: 'https://gcm-http.googleapis.com/gcm/send',
    body: {
      to: `/topics/${topic}`,
      data: {
        message: JSON.stringify({
          event: event,
          data: message.data
        })
      }
    },
    headers: {
      Authorization: `key=${config.get('gcm.key')}`
    },
    json: true
  });
}

/**
 * Individual message handlers.
 * @type {Object.<string, Function>}
 */
const messageHandlers = {
  'client:getState': (client) => {
    client.send(createMessage('server:state', state));
  },
  'operator:setState': (client, message, server) => {
    Object.assign(state, message.data);
    broadcast(server, createMessage('server:stateChanged', message.data));
  },
  'operator:createPlays': (client, message, server) => {
    forwardMessageToGcm('playsCreated', 'server:playsCreated', message);
    broadcast(server, createMessage('server:playsCreated', message.data));
  },
  'operator:clearPredictions': (client, message, server) => {
    forwardMessageToGcm('clearPredictions', 'server:clearPredictions', message);
    broadcast(server, createMessage('server:clearPredictions'));
  }
};

/**
 * Core message handler.
 * @param {WebSocket} client
 * @param {string} message
 * @param {WebSocket.Server} server
 */
function handleMessage(client, message, server) {
  try {
    message = JSON.parse(message);
    if (!validate(message)) {
      console.log('Failed to validate?');
      client.send(createMessage('server:error', validate.errors));
      return;
    }

    console.log(`${client.upgradeReq.connection.remoteAddress} ${message.event}`);
    messageHandlers[message.event].call(this, client, message, server);

  } catch (e) {
    client.send(createMessage('server:error', 'Invalid JSON was received by the server.'));
    console.log(e);
  }
}

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
