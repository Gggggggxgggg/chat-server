const WebSocket = require("ws");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

// ================= DB =================
const db = new sqlite3.Database("./database.db");

db.serialize(() => {
db.run(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT,
password TEXT,
avatar TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS messages (
id INTEGER PRIMARY KEY AUTOINCREMENT,
room TEXT,
fromUser TEXT,
toUser TEXT,
text TEXT,
type TEXT,
time INTEGER
)
`);
});

// ================= USERS =================
const clients = new Map();

const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";

// ================= BROADCAST ROOM =================
function sendToRoom(room, data){
server.clients.forEach(c=>{
const u = clients.get(c);
if(c.readyState === WebSocket.OPEN && u?.room === room){
c.send(JSON.stringify(data));
}
});
}

// ================= ONLINE =================
function sendOnline(room){
const list = [];

clients.forEach(u=>{
if(u.room === room){
list.push({
id:u.id,
name:u.name,
avatar:u.avatar
});
}
});

sendToRoom(room,{
type:"online",
users:list
});
}

// ================= CONNECTION =================
server.on("connection",(ws)=>{
const id = crypto.randomUUID();

const user = {
id,
name:"Guest_"+id.slice(0,5),
room:"global",
avatar:DEFAULT_AVATAR
};

clients.set(ws,user);

sendOnline(user.room);

ws.on("message",(raw)=>{
let msg;
try{ msg = JSON.parse(raw.toString()); }catch{return;}

const u = clients.get(ws);
if(!u) return;

// ================= REGISTER =================
if(msg.type==="register"){
db.get("SELECT * FROM users WHERE name=?",[msg.username],(err,row)=>{
if(row){
ws.send(JSON.stringify({type:"error",text:"User exists"}));
return;
}

const id = crypto.randomUUID();

db.run(
"INSERT INTO users VALUES (?,?,?,?)",
[id,msg.username,msg.password,DEFAULT_AVATAR]
);

ws.send(JSON.stringify({type:"login_ok"}));
});
}

// ================= LOGIN =================
if(msg.type==="login"){
db.get(
"SELECT * FROM users WHERE name=? AND password=?",
[msg.username,msg.password],
(err,row)=>{

if(!row){
ws.send(JSON.stringify({type:"error",text:"Wrong login"}));
return;
}

u.name = row.name;
u.avatar = row.avatar;
clients.set(ws,u);

ws.send(JSON.stringify({type:"login_ok"}));
sendOnline(u.room);
});
}

// ================= JOIN =================
if(msg.type==="join"){
u.room = msg.room;
clients.set(ws,u);
sendOnline(u.room);
}

// ================= TEXT =================
if(msg.type==="text"){
const data = {
type:"text",
name:u.name,
avatar:u.avatar,
text:msg.text,
room:u.room
};

db.run(
"INSERT INTO messages(room,fromUser,text,type,time) VALUES (?,?,?,?,?)",
[u.room,u.name,msg.text,"text",Date.now()]
);

sendToRoom(u.room,data);
}

// ================= FILE =================
if(msg.type==="file"){
sendToRoom(u.room,{
type:"file",
name:u.name,
avatar:u.avatar,
fileName:msg.fileName,
fileType:msg.fileType,
data:msg.data
});
}

// ================= DM =================
if(msg.type==="dm"){
const targetId = msg.to;

server.clients.forEach(c=>{
const t = clients.get(c);

if(t && t.id === targetId){
c.send(JSON.stringify({
type:"dm",
from:u.id,
name:u.name,
text:msg.text
}));
}
});
}

// ================= TYPING =================
if(msg.type==="typing"){
sendToRoom(u.room,{
type:"typing",
name:u.name
});
}

});

// ================= CLOSE =================
ws.on("close",()=>{
clients.delete(ws);
});
});

console.log("Server running on port " + PORT);
