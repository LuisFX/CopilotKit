import { Message } from "./types";
import { parseJson } from "@copilotkit/shared";

export interface RealtimeActionExecutionMessageInput {
  name: string;
  arguments: Record<string, any>;
  parentMessageId?: string | null;
  status?: "pending" | "executing" | "completed" | "failed";
  voiceMetadata?: {
    triggeredBy: "voice" | "text";
    timestamp?: number;
  };
}

type RealtimeActionExecutionMessageConstructorOptions = {
  id?: string;
  parentMessageId?: string | null;
} & RealtimeActionExecutionMessageInput;

export class RealtimeActionExecutionMessage 
  extends Message 
  implements Omit<RealtimeActionExecutionMessageInput, "status">
{
  name: string;
  arguments: Record<string, any>;
  parentMessageId?: string | null;
  realtimeStatus?: "pending" | "executing" | "completed" | "failed";
  voiceMetadata?: {
    triggeredBy: "voice" | "text";
    timestamp?: number;
  };

  constructor(props: RealtimeActionExecutionMessageConstructorOptions) {
    super(props);
    this.type = "RealtimeActionExecutionMessage";
    this.name = props.name;
    this.arguments = props.arguments;
    this.parentMessageId = props.parentMessageId;
    this.realtimeStatus = props.status || "pending";
    this.voiceMetadata = props.voiceMetadata;
  }

  static decodeArguments(args: string): Record<string, any> {
    return parseJson(args, {});
  }

  static encodeArguments(args: Record<string, any>): string {
    return JSON.stringify(args);
  }
}

export class VoiceTranscriptMessage extends Message {
  content: string;
  audioData?: {
    duration?: number;
    confidence?: number;
    timestamp?: number;
  };

  constructor(props: {
    id?: string;
    content: string;
    audioData?: {
      duration?: number;
      confidence?: number;
      timestamp?: number;
    };
  }) {
    super(props);
    this.type = "VoiceTranscriptMessage";
    this.content = props.content;
    this.audioData = props.audioData;
  }
}