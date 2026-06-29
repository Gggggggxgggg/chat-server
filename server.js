let ws;
let room = "global";
let typingTimeout;

const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";
let myAvatar = DEFAULT_AVATAR;

// ---------------- CONNECT ----------------
function connect(){
ws = new WebSocket("wss://chat-server-1-7wdv.onrender.com");

ws.onmessage = (e)=>{
const m = JSON.parse(e.data);

// AUTH
if(m.type === "login_ok"){
document.getElementById("auth").style.display = "none";
}

// ERROR
if(m.type === "error"){
document.getElementById("err").innerText = m.text;
}

// ONLINE
if(m.type === "online"){
renderOnline(m.users);
}

// CHAT
if(m.type === "text" || m.type === "file"){
renderMessage(m);
}

// TYPING
if(m.type === "typing"){
showTyping(m.name);
}
};
}

// ---------------- AUTH ----------------
function login(){
ws.send(JSON.stringify({
type:"login",
username:document.getElementById("user").value,
password:document.getElementById("pass").value
}));
}

function register(){
ws.send(JSON.stringify({
type:"register",
username:document.getElementById("user").value,
password:document.getElementById("pass").value
}));
}

// ---------------- SETTINGS ----------------
function toggleSettings(){
let s = document.getElementById("settings");
s.style.display = (s.style.display === "flex") ? "none" : "flex";
}

function saveProfile(){
ws.send(JSON.stringify({
type:"update_profile",
avatar: document.getElementById("avatarInput").value || myAvatar,
birthday: document.getElementById("birthInput").value
}));

toggleSettings();
}

// ---------------- ONLINE ----------------
function renderOnline(users){
let box = document.getElementById("online");
box.innerHTML = "";

users.forEach(u=>{
let d = document.createElement("div");
d.className = "user";

d.innerHTML = `
<img src="${u.avatar || DEFAULT_AVATAR}">
<div>${u.name}</div>
`;

box.appendChild(d);
});
}

// ---------------- MESSAGE ----------------
function renderMessage(m){
let box = document.getElementById("messages");

let wrap = document.createElement("div");
wrap.className = "msg other";

wrap.innerHTML = `
<img class="avatar" src="${m.avatar || DEFAULT_AVATAR}">
<div class="bubble">
<b>${m.name}</b><br>
</div>
`;

if(m.type === "text"){
wrap.querySelector(".bubble").innerHTML += m.text;
}

if(m.type === "file"){
if(m.fileType?.startsWith("image")){
wrap.querySelector(".bubble").innerHTML += `<img src="${m.data}" style="max-width:200px;border-radius:8px">`;
}else if(m.fileType?.startsWith("video")){
wrap.querySelector(".bubble").innerHTML += `<video controls src="${m.data}" style="max-width:200px"></video>`;
}else{
wrap.querySelector(".bubble").innerHTML += m.fileName;
}
}

box.appendChild(wrap);
box.scrollTop = box.scrollHeight;
}

// ---------------- SEND ----------------
function send(){
let input = document.getElementById("msg");
if(!ws || !input.value.trim()) return;

ws.send(JSON.stringify({
type:"text",
text:input.value
}));

input.value = "";
}

// ---------------- JOIN ----------------
function join(r){
room = r;

ws.send(JSON.stringify({
type:"join",
room:r
}));

document.getElementById("messages").innerHTML = "";
}

// ---------------- FILE ----------------
document.getElementById("fileInput").onchange = (e)=>{
let file = e.target.files[0];
if(!file) return;

let reader = new FileReader();

reader.onload = ()=>{
ws.send(JSON.stringify({
type:"file",
fileName:file.name,
fileType:file.type,
data:reader.result
}));
};

reader.readAsDataURL(file);
};

// ---------------- TYPING ----------------
document.getElementById("msg").addEventListener("input",()=>{
if(!ws) return;

ws.send(JSON.stringify({type:"typing"}));
});

function showTyping(n){
let el = document.getElementById("typing");
el.textContent = n + " typing...";

clearTimeout(typingTimeout);
typingTimeout = setTimeout(()=> el.textContent = "", 1000);
}

// ---------------- SEND BUTTON ----------------
document.getElementById("send").onclick = send;

// START
connect();
