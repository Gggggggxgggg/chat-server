const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

const server = new WebSocket.Server({ port: PORT });

server.on("connection", (ws) => {

    ws.on("message", (msg) => {

        server.clients.forEach(client => {

            if (client.readyState === WebSocket.OPEN) {
                client.send(msg.toString());
            }

        });

    });

});

console.log("Chat Server Started on port " + PORT);
