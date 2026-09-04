// src/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket;

export const initSocket = () => {
  if (!socket) {
    socket = io("http://localhost:3000", {
      query: { userId: "123" }, // ✅ userId query তে পাঠানো হচ্ছে
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error("Socket not initialized!");
  }
  return socket;
};
