#!/usr/bin/env node

var net = require("net"),
    BitTorrent = require("./bittorrent");

var stream = new BitTorrent.Protocol.TCP.Stream();
var socket = net.createConnection(51413, "127.0.0.1");

socket.pipe(stream);
stream.pipe(socket);

stream.on("handshake", function(handshake) {
  console.log("handshake", handshake);
});

stream.on("peer_id", function(peer_id) {
  console.log("peer_id", peer_id);
});

stream.on("data", function(data) {
//  console.log("data", data);
});

stream.on("packet", function(packet) {
  console.log("packet", packet);
});

stream.on("keep_alive", function() {
  console.log("keep_alive");
});

stream.on("choked", function() {
  console.log("choked");
});

stream.on("unchoked", function() {
  console.log("unchoked");
});

stream.on("interested", function() {
  console.log("interested");
});

stream.on("uninterested", function() {
  console.log("uninterested");
});

stream.on("have", function(index) {
  console.log("have", index);
});

stream.on("bitfield", function(bitfield) {
  console.log("bitfield", bitfield);
});

stream.on("request", function(request) {
  console.log("request", request);
});

stream.on("block", function(block) {
  console.log("block", block);
});

stream.on("cancel", function(request) {
  console.log("cancel", request);
});

stream.on("port", function(port) {
  console.log("port", port);
});

stream.handshake("BitTorrent protocol", Buffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), "76fa017cea2cf63013b21c75f55fbd1d4de7abbb");
stream.peer_id("BT.JS-00000000000000");
