const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

// ws -> user
const users = new Map();

function broadcast(obj) {
    const msg = JSON.stringify(obj);

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

    console.log("User connected:", id);

    // отправка инфы клиенту
    ws.send(JSON.stringify({
        type: "system",
        text: "connected",
        id,
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
                id: user.id,
                name: user.name,
                text: msg.text,
                time: Date.now()
            });
        }

        // ================= FILE =================
        else if (msg.type === "file") {
            broadcast({
                type: "file",
                id: user.id,
                name: user.name,
                fileName: msg.fileName || "file",
                fileType: msg.fileType || "unknown",
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
