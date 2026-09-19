import { createServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server } from "socket.io";

export interface FlagEvent {
  id: string;
  severity: string;
  triggeredRules: string[];
  summary: string | null;
  createdAt: string;
}

let io: Server | null = null;

export async function startSocketServer(): Promise<Server> {
  const httpServer = createServer();
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const redisUrl = process.env.CADUWARD_REDIS_URL ?? "redis://localhost:6379";
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  const port = Number(process.env.CADUWARD_SOCKET_PORT ?? "3001");
  httpServer.listen(port, () => {
    console.log(`Socket.IO server listening on port ${port}`);
  });

  return io;
}

export function emitNewFlag(flag: FlagEvent) {
  if (io) {
    io.emit("flag:new", flag);
  }
}
