import { supabase } from "./supabase";

const WS_BASE = process.env.EXPO_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000";

export type WSMessage =
  | { type: "ready" }
  | { type: "audio"; data: string }
  | { type: "session_end"; session_id: string; duration_seconds: number }
  | { type: "error"; message: string };

export class FoodlyWebSocket {
  private ws: WebSocket | null = null;
  private onMessage: (msg: WSMessage) => void;
  private onDisconnect: () => void;

  constructor(
    onMessage: (msg: WSMessage) => void,
    onDisconnect: () => void
  ) {
    this.onMessage = onMessage;
    this.onDisconnect = onDisconnect;
  }

  async connect(recipe?: string): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}/ws/session`);

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({ type: "init", token, recipe: recipe ?? null }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === "ready") resolve();
          this.onMessage(msg);
        } catch {}
      };

      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
      this.ws.onclose = () => this.onDisconnect();
    });
  }

  sendAudio(base64Pcm: string) {
    this.send({ type: "audio", data: base64Pcm });
  }

  sendVideo(base64Jpeg: string) {
    this.send({ type: "video", data: base64Jpeg });
  }

  end() {
    this.send({ type: "end" });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
