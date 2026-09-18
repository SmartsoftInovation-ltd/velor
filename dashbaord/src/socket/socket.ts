import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../hooks/useAxiosSecure";
import { socketUrl } from "../lib/env";

let socket: Socket | null = null;

// Connects with the access token: the server puts staff into their store's room,
// so events from other stores never arrive here.
export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(socketUrl(), {
      auth: (cb) => cb({ token: getAccessToken() }),
      withCredentials: true,
    });
  }
  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    throw new Error("Socket not initialized!");
  }
  return socket;
};

// Called on sign-out so the next session connects with its own token
export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};
