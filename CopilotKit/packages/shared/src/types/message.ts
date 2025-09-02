import agui from "@ag-ui/core";

export interface ImageData {
  format: string;
  bytes: string;
}

// Pass through types
export type Role = agui.Role;
export type SystemMessage = agui.SystemMessage;
export type DeveloperMessage = agui.DeveloperMessage;
export type ToolCall = agui.ToolCall;

// Extended message types
export type ToolResult = agui.ToolMessage & {
  toolName?: string;
};

export type AIMessage = agui.AssistantMessage & {
  generativeUI?: (props?: any) => any;
  agentName?: string;
  state?: any;
  image?: ImageData;
};

export type UserMessage = agui.UserMessage & {
  image?: ImageData;
};

// Voice/Realtime specific message types
export type VoiceTranscriptMessage = {
  id: string;
  role: "voice_transcript";
  content: string;
  audioData?: {
    duration?: number;
    confidence?: number;
    timestamp?: number;
  };
};

export type RealtimeActionMessage = {
  id: string;
  role: "realtime_action";
  name: string;
  arguments: Record<string, any>;
  content?: string; // Optional content for compatibility
  generativeUI?: (props?: any) => any;
  status?: "pending" | "executing" | "completed" | "failed";
  voiceMetadata?: {
    triggeredBy: "voice" | "text";
    timestamp?: number;
  };
};

export type Message = AIMessage | ToolResult | UserMessage | SystemMessage | DeveloperMessage | VoiceTranscriptMessage | RealtimeActionMessage;
