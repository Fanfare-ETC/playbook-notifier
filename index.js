const http = require('http');
const Promise = require('bluebird');
const mysql = require('promise-mysql');
const moment = require('moment');
const express = require('express');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });

Promise.coroutine(function* () {
  // Listen on server events.
  webSocketServer.on('connection', (ws) => {
    console.log(`${ws.upgradeReq.connection.remoteAddress} connected`);

    ws.on('message', (msg) => {
      webSocketServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          console.log(`Received from ${client.upgradeReq.connection.remoteAddress}: ${msg}`)
          client.send(msg);
        }
      });
    });
  });

  // Listen on port.
  server.listen(8080, '0.0.0.0', function () {
    console.log(`Server listening on ${server.address().address}:${server.address().port}`);
  });
})();
