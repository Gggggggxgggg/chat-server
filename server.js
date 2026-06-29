const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

// храним пользователей
const users = new Map();

function broadcast(data) {
    const msg = JSON.stringify(data);

    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

server.on("connection", (ws) => {
    const id = crypto.randomUUID();
    users.set(ws, { id, name: "Guest_" + id.slice(0, 5) });

    console.log("User connected:", id);

    // приветствие
    ws.send(JSON.stringify({
        type: "system",
        text: "Connected to server",
        id
    }));

    ws.on("message", (raw) => {
        let msg;

        // защита от битых данных
        try {
            msg = JSON.parse(raw.toString());
        } catch (e) {
            return;
        }

        const user = users.get(ws);

        // ========================
        // TEXT MESSAGE
        // ========================
        if (msg.type === "text") {
            broadcast({
                type: "text",
                id: user.id,
                name: user.name,
                text: msg.text,
                time: Date.now()
            });
        }

        // ========================
        // IMAGE / VIDEO / FILE
        // ========================
        else if (
            msg.type === "image" ||
            msg.type === "video" ||
            msg.type === "file"
        ) {
            broadcast({
                type: msg.type,
                id: user.id,
                name: user.name,
                fileName: msg.fileName || "unknown",
                data: msg.data, // base64
                time: Date.now()
            });
        }

        // ========================
        // CHANGE NAME
        // ========================
        else if (msg.type === "name") {
            user.name = msg.name;

            ws.send(JSON.stringify({
                type: "system",
                text: "Name changed to " + msg.name
            }));
        }
    });

    ws.on("close", () => {
        users.delete(ws);

        broadcast({
            type: "system",
            text: "User disconnected"
        });
    });
});

console.log("🚀 Chat Server running on port " + PORT);
