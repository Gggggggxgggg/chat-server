let ws;
let room = "global";
let chats = {};

const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";

function el(id){ return document.getElementById(id); }

function connect(){
ws = new WebSocket("wss://chat-server-1-7wdv.onrender.com");

ws.onmessage = (e) => {
const m = JSON.parse(e.data);

if(m.type === "login_ok"){
el("auth").style.display = "none";
}

if(m.type === "error"){
el("err").innerText = m.text;
}

if(m.type === "online"){
renderOnline(m.users);
}

if(m.type === "text" || m.type === "file"){
if(!chats[room]) chats[room] = [];
chats[room].push(m);
renderMessages();
}

if(m.type === "typing"){
showTyping(m.name);
}
};
}

function login(){
ws.send(JSON.stringify({
type:"login",
username:el("user").value,
password:el("pass").value
}));
}

function register(){
ws.send(JSON.stringify({
type:"register",
username:el("user").value,
password:el("pass").value
}));
}

function toggleSettings(){
const s = el("settings");
s.style.display = (s.style.display === "flex") ? "none" : "flex";
}

function saveProfile(){
ws.send(JSON.stringify({
type:"update_profile",
avatar:el("avatarInput").value,
birthday:el("birthInput").value
}));
toggleSettings();
}

function join(r){
room = r;
ws.send(JSON.stringify({type:"join", room:r}));

if(!chats[room]) chats[room] = [];
renderMessages();
}

function sendMessage(){
const input = el("msg");
if(!ws || !input.value.trim()) return;

ws.send(JSON.stringify({
type:"text",
text: input.value
}));

input.value = "";
}

function renderOnline(users){
const box = el("online");
box.innerHTML = "";

users.forEach(u=>{
const d = document.createElement("div");
d.className = "user";

d.innerHTML = `
<img src="${u.avatar || DEFAULT_AVATAR}">
<div>${u.name}</div>
`;

box.appendChild(d);
});
}

function renderMessages(){
const box = el("messages");
box.innerHTML = "";

if(!chats[room]) chats[room] = [];

chats[room].forEach(m=>{
const wrap = document.createElement("div");
wrap.className = "msg";

wrap.innerHTML = `
<img class="avatar" src="${m.avatar || DEFAULT_AVATAR}">
<div class="bubble">
<b>${m.name}</b><br>
${m.text || ""}
</div>
`;

box.appendChild(wrap);
});

box.scrollTop = box.scrollHeight;
}

el("fileInput").onchange = (e)=>{
const file = e.target.files[0];
if(!file) return;

const reader = new FileReader();

reader.onload = () => {
ws.send(JSON.stringify({
type:"file",
fileName:file.name,
fileType:file.type,
data:reader.result
}));
};

reader.readAsDataURL(file);
};

function showTyping(name){
el("typing").innerText = name + " typing...";

setTimeout(()=>{
el("typing").innerText = "";
}, 1000);
}

function filterUsers(){
const q = el("search").value.toLowerCase();
document.querySelectorAll(".user").forEach(u=>{
u.style.display = u.innerText.toLowerCase().includes(q) ? "flex" : "none";
});
}

el("sendBtn").onclick = sendMessage;

el("msg").addEventListener("keydown",(e)=>{
if(e.key === "Enter") sendMessage();
});

connect();
