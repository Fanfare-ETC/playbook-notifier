'use strict';
const http = require('http');
const Promise = require('bluebird');
const redis = require('redis');
const moment = require('moment');
const request = require('request-promise');
const config = require('config');
const express = require('express');
const WebSocket = require('ws');
const Ajv = require('ajv');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const app = express();
const server = http.createServer(app);
const redisClient = redis.createClient(config.get('redis.port'), config.get('redis.host'));
const webSocketServer = new WebSocket.Server({ server });

const ajv = new Ajv();
const validate = ajv.compile(require('./schema.json'));

// Game state.
const state = {
  inning: null,
  half: null
};

// Helper functions.
function createMessage(event, data) {
  if (data !== undefined) {
    return JSON.stringify({ event, data });
  } else {
    return JSON.stringify({ event });
  }
};

function broadcast(server, message) {
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

/**
 * Individual message handlers.
 * @type {Object.<string, Function>}
 */
const messageHandlers = {
  'client:makePredictions': function (client, message, server) {
    const validate = ajv.compile(require('./schemas/client-make-predictions.json'));
    if (!validate(message.data)) {
      return client.send(createMessage('server:error', validate.errors));
    }

    message.data.plays.forEach(play => {
      redisClient.sadd(`predictions:${play}`, message.data.id);
    });
  },

  'client:getState': function (client) {
    client.send(createMessage('server:state', state));
  },

  'operator:setState': (client, message, server) => {
    Object.assign(state, message.data);
    broadcast(server, createMessage('server:stateChanged', message.data));
  },

  'operator:createPlays': (client, message, server) => {
    const request = require('request-promise');
    request({
      method: 'POST',
      uri: 'https://gcm-http.googleapis.com/gcm/send',
      body: {
        to: '/topics/playsCreated',
        data: {
          message: JSON.stringify({
            event: 'server:playsCreated',
            data: message.data
          })
        }
      },
      headers: {
        Authorization: `key=${config.get('gcm.key')}`
      },
      json: true
    });
    broadcast(server, createMessage('server:playsCreated', message.data));
  },

  'operator:clearPredictions': (client, message, server) => {
    broadcast(server, createMessage('server:clearPredictions'));
  }
};

/**
 * Core message handler.
 * @param {WebSocket} client 
 * @param {*} message 
 * @param {WebSocket.Server} server 
 */
function handleMessage(client, message, server) {
  try {
    message = JSON.parse(message);
    if (!validate(message)) {
      client.send(createMessage('server:error', validate.errors));
      return;
    }

    console.log(`${client.upgradeReq.connection.remoteAddress} ${message.event}`);
    messageHandlers[message.event].call(this, client, message, server);

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
