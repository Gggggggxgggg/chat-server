const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

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

    const user = {
        id,
        name: "Guest_" + id.slice(0, 5)
    };

    users.set(ws, user);

    console.log("User connected:", user.name);

    ws.send(JSON.stringify({
        type: "system",
        text: "connected",
        name: user.name
    }));

    ws.on("message", (raw) => {
        let msg;

        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        const user = users.get(ws);
        if (!user) return;

        // ================= TEXT =================
        if (msg.type === "text") {
            broadcast({
                type: "text",
                name: user.name,
                text: msg.text,
                time: Date.now()
            });
        }

        // ================= FILE =================
        else if (msg.type === "file") {
            broadcast({
                type: "file",
                name: user.name,
                fileName: msg.fileName,
                fileType: msg.fileType,
                data: msg.data,
                time: Date.now()
            });
        }

        // ================= NAME =================
        else if (msg.type === "name") {
            user.name = msg.name || user.name;
            users.set(ws, user);

            ws.send(JSON.stringify({
                type: "system",
                text: "name updated",
                name: user.name
            }));
        }
    });

    ws.on("close", () => {
        const user = users.get(ws);
        users.delete(ws);

        broadcast({
            type: "system",
            text: "user disconnected",
            name: user?.name
        });
    });
});

console.log("🚀 Server running on port " + PORT);
