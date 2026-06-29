const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const db = new sqlite3.Database("./chat.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT,
avatar TEXT DEFAULT '',
birthday TEXT DEFAULT ''
)
`);

let clients = new Map();

function broadcastRoom(room, data, except=null){
wss.clients.forEach(c=>{
if(c.readyState===1 && c.room===room && c!==except){
c.send(JSON.stringify(data));
}
});
}

function sendOnline(room){
let list=[];
wss.clients.forEach(c=>{
if(c.room===room && c.user){
list.push({
id:c.user.id,
name:c.user.username,
avatar:c.user.avatar
});
}
});

broadcastRoom(room,{type:"online",users:list});
}

wss.on("connection",(ws)=>{

ws.room="global";

ws.on("message",(raw)=>{
let data;
try{ data=JSON.parse(raw);}catch{return;}

/////////////////////////////////////////////////
// REGISTER
/////////////////////////////////////////////////
if(data.type==="register"){
let hash=bcrypt.hashSync(data.password,10);

db.run(
"INSERT INTO users(username,password) VALUES(?,?)",
[data.username,hash],
(err)=>{
if(err){
ws.send(JSON.stringify({type:"error",text:"User exists"}));
return;
}
ws.send(JSON.stringify({type:"login_ok"}));
}
);
}

/////////////////////////////////////////////////
// LOGIN
/////////////////////////////////////////////////
if(data.type==="login"){
db.get("SELECT * FROM users WHERE username=?",[data.username],(err,u)=>{
if(!u){
ws.send(JSON.stringify({type:"error",text:"No user"}));
return;
}
if(!bcrypt.compareSync(data.password,u.password)){
ws.send(JSON.stringify({type:"error",text:"Wrong password"}));
return;
}

ws.user=u;
ws.send(JSON.stringify({
type:"login_ok",
user:u
}));
});
}

/////////////////////////////////////////////////
// JOIN
/////////////////////////////////////////////////
if(data.type==="join"){
ws.room=data.room;
sendOnline(ws.room);
}

/////////////////////////////////////////////////
// PROFILE
/////////////////////////////////////////////////
if(data.type==="update_profile"){
db.run(
"UPDATE users SET avatar=?, birthday=? WHERE id=?",
[data.avatar,data.birthday,ws.user.id]
);
ws.user.avatar=data.avatar;
}

/////////////////////////////////////////////////
// TEXT
/////////////////////////////////////////////////
if(data.type==="text"){
broadcastRoom(ws.room,{
type:"text",
name:ws.user.username,
text:data.text,
avatar:ws.user.avatar
});
}

/////////////////////////////////////////////////
// FILE
/////////////////////////////////////////////////
if(data.type==="file"){
broadcastRoom(ws.room,{
type:"file",
name:ws.user.username,
fileName:data.fileName,
data:data.data,
avatar:ws.user.avatar
});
}

/////////////////////////////////////////////////
// TYPING
/////////////////////////////////////////////////
if(data.type==="typing"){
broadcastRoom(ws.room,{
type:"typing",
name:ws.user.username
},ws);
}

});

ws.on("close",()=>{
sendOnline(ws.room);
});
});

server.listen(8080,()=>console.log("Server running"));
