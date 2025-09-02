# CopilotKit Realtime Integration - Complete Code Changes

This document contains the ACTUAL CODE that exists in the current snapshot to support realtime voice features.
All code shown here is what needs to be implemented in a clean branch.

## 1. NEW FILES - Complete Code

### 1.1 `CopilotKit/packages/react-core/src/hooks/use-realtime-chat.ts`
```typescript
/**
 * useRealtimeChat - OpenAI Realtime WebRTC Integration for CopilotKit
 * 
 * This hook provides seamless integration between OpenAI's Realtime API (WebRTC)
 * and CopilotKit's chat interface, enabling:
 * - Real-time voice conversations with ultra-low latency
 * - Automatic speech recognition and transcription
 * - Voice synthesis for assistant responses
 * - Full integration with CopilotKit's action system
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useCopilotChat } from "./use-copilot-chat_internal";
import { useRealtimeActionHandler } from "./use-realtime-action-handler";

export interface RealtimeConfig {
  /** Endpoint to fetch ephemeral token for OpenAI Realtime */
  tokenEndpoint: string;
  /** OpenAI Realtime model (default: gpt-realtime) */
  model?: string;
  /** Voice for assistant (default: alloy) */
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  /** Turn detection configuration */
  turnDetection?: {
    type: "server_vad";
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  /** Callback when a tool is invoked by OpenAI Realtime */
  onToolCall?: (toolName: string, args: any) => Promise<any>;
  /** Enable debug logging */
  debug?: boolean;
}

export interface RealtimeToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface UseRealtimeChatReturn {
  /** Connect to OpenAI Realtime */
  connect: () => Promise<void>;
  /** Disconnect from OpenAI Realtime */
  disconnect: () => void;
  /** Connection status */
  status: "idle" | "connecting" | "connected" | "error";
  /** Error message if connection failed */
  error?: string;
  /** Whether microphone is currently active */
  isMicActive: boolean;
  /** Toggle microphone on/off */
  toggleMic: () => void;
  /** Current audio level (0-1) for visualization */
  audioLevel: number;
  /** Register tools/functions for the realtime session */
  registerTools: (tools: RealtimeToolDefinition[]) => void;
}

export function useRealtimeChat(config: RealtimeConfig): UseRealtimeChatReturn {
  // Hook is initialized - confirmed using local fork
  
  const chatResult = useCopilotChat();
  const sendCopilotMessage = chatResult?.sendMessage;
  const { executeVoiceAction, sendVoiceGenerativeUI } = useRealtimeActionHandler();
  
  // WebRTC references
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // State
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string>();
  const [isMicActive, setIsMicActive] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Track processed items to avoid duplicates
  const processedItemIds = useRef<Set<string>>(new Set());
  const registeredTools = useRef<RealtimeToolDefinition[]>([]);
  // Track message contents to prevent duplicates with different IDs
  const sentMessages = useRef<Map<string, string>>(new Map()); // role:content -> itemId
  
  // Audio level monitoring
  useEffect(() => {
    if (!streamRef.current || !isMicActive) {
      setAudioLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const analyzer = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(streamRef.current);
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    microphone.connect(analyzer);
    
    const checkAudioLevel = () => {
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
    };
    
    const interval = setInterval(checkAudioLevel, 100);
    
    return () => {
      clearInterval(interval);
      microphone.disconnect();
      audioContext.close();
    };
  }, [streamRef.current, isMicActive]);
  
  const registerTools = useCallback((tools: RealtimeToolDefinition[]) => {
    console.log('[useRealtimeChat] Registering tools:', tools.map(t => t.name));
    registeredTools.current = tools;
    
    // If already connected, update the session
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({
        type: 'session.update',
        session: {
          tools: tools.map(tool => ({
            type: 'function',
            ...tool
          }))
        }
      }));
    }
  }, []);
  
  const connect = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(undefined);
      
      // Reset tracking when reconnecting
      processedItemIds.current.clear();
      sentMessages.current.clear();
      
      // Fetch ephemeral token
      const tokenResponse = await fetch(config.tokenEndpoint);
      if (!tokenResponse.ok) {
        throw new Error(`Failed to fetch token: ${tokenResponse.statusText}`);
      }
      const { token } = await tokenResponse.json();
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;
      
      // Add audio track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Setup audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };
      
      // Create data channel
      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;
      
      dc.onopen = () => {
        console.log('[useRealtimeChat] Data channel opened');
        setStatus("connected");
        
        // Send initial session configuration
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            model: config.model || 'gpt-4o-realtime-preview',
            voice: config.voice || 'alloy',
            instructions: 'You are a helpful AI assistant. Keep responses brief and conversational.',
            turn_detection: config.turnDetection || {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800
            },
            tools: registeredTools.current.map(tool => ({
              type: 'function',
              ...tool
            }))
          }
        }));
      };
      
      dc.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (config.debug) {
            console.log('[useRealtimeChat] Received:', message.type, message);
          }
          
          // Handle different message types
          switch (message.type) {
            case 'conversation.item.created': {
              const item = message.item;
              
              // Skip if already processed
              if (processedItemIds.current.has(item.id)) {
                console.log('[useRealtimeChat] Skipping duplicate item:', item.id);
                return;
              }
              
              // For text messages, check content-based deduplication
              if (item.type === 'message' && item.content) {
                const contentKey = `${item.role}:${item.content[0]?.text || ''}`;
                if (sentMessages.current.has(contentKey)) {
                  console.log('[useRealtimeChat] Skipping duplicate content:', contentKey);
                  processedItemIds.current.add(item.id);
                  return;
                }
                sentMessages.current.set(contentKey, item.id);
              }
              
              processedItemIds.current.add(item.id);
              
              // Handle message items
              if (item.type === 'message' && item.content && sendCopilotMessage) {
                const textContent = item.content.find((c: any) => c.type === 'text');
                if (textContent?.text) {
                  console.log('[useRealtimeChat] Processing message:', item.role, textContent.text);
                  // Send to CopilotKit's message system
                  sendCopilotMessage(textContent.text, item.role);
                }
              }
              break;
            }
            
            case 'response.output_item.added': {
              const item = message.item;
              if (item?.content) {
                // Assistant is speaking, this will be captured when completed
                console.log('[useRealtimeChat] Assistant speaking...');
              }
              break;
            }
            
            case 'response.done': {
              const response = message.response;
              if (response?.output) {
                response.output.forEach((outputItem: any) => {
                  // Skip if already processed
                  if (processedItemIds.current.has(outputItem.id)) {
                    return;
                  }
                  
                  // Check content-based deduplication
                  if (outputItem.type === 'message' && outputItem.content) {
                    const textContent = outputItem.content.find((c: any) => c.type === 'text');
                    if (textContent?.text) {
                      const contentKey = `${outputItem.role}:${textContent.text}`;
                      if (sentMessages.current.has(contentKey)) {
                        console.log('[useRealtimeChat] Skipping duplicate assistant response');
                        processedItemIds.current.add(outputItem.id);
                        return;
                      }
                      
                      sentMessages.current.set(contentKey, outputItem.id);
                      processedItemIds.current.add(outputItem.id);
                      
                      if (sendCopilotMessage) {
                        console.log('[useRealtimeChat] Sending assistant message to CopilotKit');
                        sendCopilotMessage(textContent.text, 'assistant');
                      }
                    }
                  }
                });
              }
              break;
            }
            
            // Handle tool invocations
            case 'tool_invocation': {
              const { tool_name, call_id, arguments: args } = message;
              console.log('[useRealtimeChat] Tool invoked:', tool_name, args);
              
              let result;
              try {
                // Use the voice action handler for CopilotKit integration
                if (executeVoiceAction) {
                  result = await executeVoiceAction(tool_name, args);
                } else if (config.onToolCall) {
                  // Fallback to custom handler
                  result = await config.onToolCall(tool_name, args);
                } else {
                  result = { error: 'No tool handler configured' };
                }
              } catch (error) {
                console.error('[useRealtimeChat] Tool execution error:', error);
                result = { error: error instanceof Error ? error.message : 'Tool execution failed' };
              }
              
              // Send tool response
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id,
                    output: JSON.stringify(result)
                  }
                }));
              }
              break;
            }
            
            case 'error': {
              console.error('[useRealtimeChat] Server error:', message.error);
              setError(message.error?.message || 'Unknown error');
              break;
            }
          }
        } catch (error) {
          console.error('[useRealtimeChat] Message handling error:', error);
        }
      };
      
      dc.onerror = (error) => {
        console.error('[useRealtimeChat] Data channel error:', error);
        setError('Data channel error');
        setStatus("error");
      };
      
      dc.onclose = () => {
        console.log('[useRealtimeChat] Data channel closed');
        setStatus("idle");
      };
      
      // Create and set offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send offer to server
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });
      
      if (!sdpResponse.ok) {
        throw new Error(`SDP exchange failed: ${sdpResponse.statusText}`);
      }
      
      const answer = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answer
      });
      
    } catch (error) {
      console.error('[useRealtimeChat] Connection error:', error);
      setError(error instanceof Error ? error.message : 'Connection failed');
      setStatus("error");
      
      // Cleanup on error
      disconnect();
    }
  }, [config, sendCopilotMessage, executeVoiceAction]);
  
  const disconnect = useCallback(() => {
    console.log('[useRealtimeChat] Disconnecting...');
    
    // Close data channel
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Remove audio element
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    
    // Clear tracking
    processedItemIds.current.clear();
    sentMessages.current.clear();
    
    setStatus("idle");
    setError(undefined);
    setAudioLevel(0);
  }, []);
  
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicActive(audioTrack.enabled);
      }
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    connect,
    disconnect,
    status,
    error,
    isMicActive,
    toggleMic,
    audioLevel,
    registerTools
  };
}
```

### 1.2 `CopilotKit/packages/react-core/src/hooks/use-realtime-action-handler.ts`
```typescript
/**
 * Voice/Realtime Action Handler for CopilotKit
 * 
 * This hook provides proper integration between voice commands and CopilotKit actions,
 * ensuring that GenerativeUI renders correctly through the normal pipeline.
 */

import { useCallback } from "react";
import { useCopilotContext, useCopilotMessagesContext } from "../context";
import { FrontendAction } from "../types/frontend-action";
import { TextMessage, Role, ActionExecutionMessage, ResultMessage } from "@copilotkit/runtime-client-gql";

export interface UseRealtimeActionHandlerReturn {
  /**
   * Execute an action triggered by voice, with proper GenerativeUI support
   */
  executeVoiceAction: (actionName: string, args: Record<string, any>) => Promise<any>;
  
  /**
   * Get all available actions for voice commands
   */
  getAvailableActions: () => FrontendAction<any>[];
  
  /**
   * Send a GenerativeUI message for voice actions
   */
  sendVoiceGenerativeUI: (actionName: string, args: Record<string, any>) => Promise<any>;
}

export function useRealtimeActionHandler(): UseRealtimeActionHandlerReturn {
  const { actions } = useCopilotContext();
  const { messages, setMessages } = useCopilotMessagesContext();
  
  const executeVoiceAction = useCallback(async (actionName: string, args: Record<string, any>) => {
    console.log(`[RealtimeActionHandler] Executing voice action: ${actionName}`, args);
    
    // Find the specific action
    const action = Object.values(actions).find((a: any) => a.name === actionName);
    
    if (!action) {
      console.warn(`[RealtimeActionHandler] Action not found: ${actionName}`);
      throw new Error(`Action not found: ${actionName}`);
    }
    
    console.log(`[RealtimeActionHandler] Found action with render:`, !!action.render);
    
    // If the action has a render function, add an ActionExecutionMessage to trigger rendering
    if (action.render) {
      const actionMessage = new ActionExecutionMessage({
        id: `voice-action-${Date.now()}`,
        name: actionName,
        arguments: args,
        parentMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
      });
      
      // Add the action message to trigger rendering
      setMessages([...messages, actionMessage]);
      console.log(`[RealtimeActionHandler] Added ActionExecutionMessage for GenerativeUI rendering`);
    }
    
    // Execute the action handler if it exists
    if (action.handler) {
      try {
        const result = await action.handler(args);
        console.log(`[RealtimeActionHandler] Action handler executed successfully:`, result);
        return result;
      } catch (error) {
        console.error(`[RealtimeActionHandler] Action handler failed:`, error);
        throw error;
      }
    }
    
    return { success: true };
  }, [actions, messages, setMessages]);
  
  const getAvailableActions = useCallback(() => {
    return Object.values(actions) as FrontendAction<any>[];
  }, [actions]);
  
  const sendVoiceGenerativeUI = useCallback(async (actionName: string, args: Record<string, any>) => {
    console.log(`[RealtimeActionHandler] Sending GenerativeUI for voice action: ${actionName}`);
    
    const action = Object.values(actions).find((a: any) => a.name === actionName);
    
    if (!action || !action.render) {
      console.warn(`[RealtimeActionHandler] No render function for action: ${actionName}`);
      return null;
    }
    
    // Create an ActionExecutionMessage specifically for GenerativeUI
    const actionMessage = new ActionExecutionMessage({
      id: `voice-ui-${Date.now()}`,
      name: actionName,
      arguments: args,
      parentMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
    });
    
    // Add to messages to trigger rendering
    setMessages([...messages, actionMessage]);
    
    return { rendered: true };
  }, [actions, messages, setMessages]);
  
  return {
    executeVoiceAction,
    getAvailableActions,
    sendVoiceGenerativeUI
  };
}
```

### 1.3 `CopilotKit/packages/runtime-client-gql/src/client/RealtimeActionExecutionMessage.ts`
```typescript
import { BaseMessage, Role } from "./base-message";

export interface RealtimeActionExecutionMessageInput {
  id: string;
  role?: Role;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status?: "pending" | "executing" | "completed" | "failed";
  parentMessageId?: string | null;
}

export class RealtimeActionExecutionMessage extends BaseMessage {
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: "pending" | "executing" | "completed" | "failed";

  constructor(input: RealtimeActionExecutionMessageInput) {
    super(input.id, input.role || "realtime_action" as Role, input.parentMessageId);
    this.name = input.name;
    this.arguments = input.arguments;
    this.result = input.result;
    this.status = input.status || "pending";
  }

  static fromJSON(json: any): RealtimeActionExecutionMessage {
    return new RealtimeActionExecutionMessage({
      id: json.id,
      role: json.role,
      name: json.name,
      arguments: json.arguments,
      result: json.result,
      status: json.status,
      parentMessageId: json.parentMessageId,
    });
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      type: "realtime-action-execution",
      name: this.name,
      arguments: this.arguments,
      result: this.result,
      status: this.status,
    };
  }

  toChatCompletionMessage(): any {
    return {
      role: this.role,
      content: JSON.stringify({
        action: this.name,
        arguments: this.arguments,
        result: this.result,
        status: this.status,
      }),
      name: this.name,
    };
  }

  isTextMessage(): boolean {
    return false;
  }

  isEmpty(): boolean {
    return false;
  }

  clone(): RealtimeActionExecutionMessage {
    return new RealtimeActionExecutionMessage({
      id: this.id,
      role: this.role,
      name: this.name,
      arguments: this.arguments,
      result: this.result,
      status: this.status,
      parentMessageId: this.parentMessageId,
    });
  }
}
```

### 1.4 `CopilotKit/packages/react-ui/src/components/chat/messages/RenderRealtimeActionMessage.tsx`
```tsx
import React from "react";
import { RealtimeActionExecutionMessage } from "@copilotkit/runtime-client-gql";

export interface RenderRealtimeActionMessageProps {
  message: RealtimeActionExecutionMessage;
}

export function RenderRealtimeActionMessage({ message }: RenderRealtimeActionMessageProps) {
  const getStatusIcon = () => {
    switch (message.status) {
      case "pending":
        return "⏳";
      case "executing":
        return "⚡";
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "❓";
    }
  };

  const getStatusColor = () => {
    switch (message.status) {
      case "pending":
        return "text-gray-500";
      case "executing":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <span className={`text-2xl ${getStatusColor()}`}>{getStatusIcon()}</span>
      <div className="flex-1">
        <div className="font-semibold text-gray-900 dark:text-gray-100">
          Voice Action: {message.name}
        </div>
        
        {Object.keys(message.arguments).length > 0 && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium">Parameters:</div>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto">
              {JSON.stringify(message.arguments, null, 2)}
            </pre>
          </div>
        )}
        
        {message.result && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium">Result:</div>
            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto">
              {typeof message.result === "string" 
                ? message.result 
                : JSON.stringify(message.result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          Status: <span className={getStatusColor()}>{message.status}</span>
        </div>
      </div>
    </div>
  );
}
```

## 2. MODIFIED FILES - Actual Changes

### 2.1 `CopilotKit/packages/react-core/src/components/copilot-provider/copilotkit-props.tsx`
```diff
@@ -98,6 +98,18 @@ export interface CopilotKitProps {
    */
   credentials?: RequestCredentials;
 
+  /**
+   * Enable realtime mode for external conversation handling (e.g., OpenAI Realtime).
+   * When enabled, CopilotKit will not trigger inference for messages, acting as a
+   * display and tool execution layer only.
+   * 
+   * @default false
+   * @remarks
+   * Use this when integrating with external AI systems that handle their own conversation flow,
+   * such as OpenAI's Realtime API. Messages will be displayed but won't trigger AI responses.
+   */
+  realtimeMode?: boolean;
+
   /**
    * Whether to show the dev console.
    *
```

### 2.2 `CopilotKit/packages/react-core/src/components/copilot-provider/copilotkit.tsx`
```diff
@@ -179,6 +179,7 @@ export function CopilotKit({
       chatComponentsCache,
       showDevConsole,
       cloud,
+      realtimeMode,
     }),
     [
       actions,
```

### 2.3 `CopilotKit/packages/react-core/src/context/copilot-context.tsx`
```diff
@@ -12,6 +12,7 @@ export interface CopilotContextType {
   showDevConsole: boolean;
   chatComponentsCache: ChatComponentsCache;
   cloud?: CopilotCloudConfig;
+  realtimeMode?: boolean;
 }
 
 const emptyChatComponentsCache = new ChatComponentsCache();
@@ -28,6 +29,7 @@ const CopilotContext = createContext<CopilotContextType>({
   chatComponentsCache: new ChatComponentsCache(),
   showDevConsole: false,
   cloud: undefined,
+  realtimeMode: false,
 });
 
 interface CopilotMessagesContextType {
@@ -97,6 +99,11 @@ export function useCopilotContext(): CopilotContextType {
   return context;
 }
 
+export function useIsRealtimeMode(): boolean {
+  const context = useCopilotContext();
+  return context.realtimeMode || false;
+}
+
 export function useCopilotMessagesContext(): CopilotMessagesContextType {
   const context = useContext(CopilotMessagesContext);
   if (!context) {
```

### 2.4 `CopilotKit/packages/react-core/src/hooks/index.ts`
```diff
@@ -8,3 +8,7 @@ export { useCopilotReadable } from "./use-copilot-readable";
 export { useMakeCopilotDocumentReadable } from "./use-make-copilot-document-readable";
 export { useCopilotChatSuggestions } from "./use-copilot-chat-suggestions";
 export * from "./use-copilot-chat";
+
+// Realtime/Voice support
+export { useRealtimeChat } from "./use-realtime-chat";
+export { useRealtimeActionHandler } from "./use-realtime-action-handler";
```

### 2.5 `CopilotKit/packages/react-core/src/hooks/use-chat.ts`
```diff
@@ -176,13 +176,21 @@ export function useChat(options?: UseChatOptions) {
     finishMessage: finishMessage,
   });
 
+  // Get realtime mode flag from context
+  const context = useContext(CopilotContext);
+  const isRealtimeMode = context?.realtimeMode || false;
+
   const sendMessage: SendMessage = (message: Message, options?: SendMessageOptions) => {
     const requestOptions: ChatRequestOptions = {
       options: {
         ...chatRequest.options,
         ...options,
         body: {
           ...chatRequest.options?.body,
           ...options?.body,
+          // Skip API call if in realtime mode (external conversation handling)
+          skipInference: isRealtimeMode,
         },
       },
     };
 
@@ -202,7 +210,9 @@ export function useChat(options?: UseChatOptions) {
     setMessages(initialMessages);
   }, [initialMessages, setMessages]);
 
-  const messages = messagesWithContext || chatRequest.messages;
+  // Filter out duplicate messages based on content when in realtime mode
+  const messages = isRealtimeMode 
+    ? deduplicateMessages(messagesWithContext || chatRequest.messages)
+    : messagesWithContext || chatRequest.messages;
```

### 2.6 `CopilotKit/packages/react-core/src/hooks/use-copilot-chat_internal.ts`
```diff
@@ -1,5 +1,6 @@
 import { useCopilotContext } from "../context/copilot-context";
 import { FrontendAction } from "../types/frontend-action";
+import { useIsRealtimeMode } from "../context/copilot-context";
 import { Message } from "./use-chat";
 import { UseChat } from "./use-chat";
 import { UseChatOptions } from "./use-chat";
@@ -226,6 +227,7 @@ export function useCopilotChat({
     id,
     initialMessages,
     ...useChatOptions,
+    realtimeMode: useIsRealtimeMode(),
   });
 
   // whenever the api is called, merge the messages from the api with the initial messages
```

### 2.7 `CopilotKit/packages/runtime-client-gql/src/client/index.ts`
```diff
@@ -9,3 +9,4 @@ export * from "./ActionExecutionMessage";
 export * from "./ResultMessage";
 export * from "./base-message";
 export * from "./types";
+export * from "./RealtimeActionExecutionMessage";
```

### 2.8 `CopilotKit/packages/runtime-client-gql/src/client/types.ts`
```diff
@@ -2,10 +2,11 @@ import { ActionExecutionMessage } from "./ActionExecutionMessage";
 import { ResultMessage } from "./ResultMessage";
 import { TextMessage } from "./TextMessage";
 import { BaseMessage } from "./base-message";
+import { RealtimeActionExecutionMessage } from "./RealtimeActionExecutionMessage";
 
 export * from "./TextMessage";
 export * from "./ActionExecutionMessage";
 export * from "./ResultMessage";
 
-export type Message = TextMessage | ActionExecutionMessage | ResultMessage | BaseMessage;
+export type Message = TextMessage | ActionExecutionMessage | ResultMessage | BaseMessage | RealtimeActionExecutionMessage;
 export type Role = "system" | "user" | "assistant";
+export type Role = "system" | "user" | "assistant" | "realtime_action";
```

### 2.9 `CopilotKit/packages/shared/src/types/message.ts`
```diff
@@ -19,7 +19,7 @@ export interface Message {
   /**
    * The role of the message.
    */
-  role: "system" | "user" | "assistant" | "function";
+  role: "system" | "user" | "assistant" | "function" | "realtime_action";
   /**
    * The content of the message.
    */
@@ -61,6 +61,32 @@ export interface ActionExecutionMessage extends Message {
   scope: "client" | "server";
 }
 
+/**
+ * Represents a realtime action execution message.
+ */
+export interface RealtimeActionExecutionMessage extends Message {
+  /**
+   * The name of the action being executed.
+   */
+  name: string;
+  /**
+   * The arguments passed to the action.
+   */
+  arguments: Record<string, any>;
+  /**
+   * The result of the action execution.
+   */
+  result?: any;
+  /**
+   * The status of the action execution.
+   */
+  status: "pending" | "executing" | "completed" | "failed";
+  /**
+   * Indicates this is a realtime/voice-triggered action.
+   */
+  isRealtime: true;
+}
+
 /**
  * Represents a result message.
  */
```

### 2.10 `CopilotKit/packages/react-ui/src/components/chat/messages/RenderMessage.tsx`
```diff
@@ -5,6 +5,8 @@ import {
   ActionExecutionMessage,
   ResultMessage,
   Message,
+  RealtimeActionExecutionMessage,
 } from "@copilotkit/runtime-client-gql";
 import { RenderActionExecutionMessage } from "./RenderActionExecutionMessage";
 import { RenderTextMessage } from "./RenderTextMessage";
+import { RenderRealtimeActionMessage } from "./RenderRealtimeActionMessage";
@@ -37,6 +39,20 @@ export interface RenderMessageProps {
  * A hook for rendering different types of messages.
  */
 export function RenderMessage(props: RenderMessageProps) {
+  // Handle RealtimeActionExecutionMessage
+  if (props.message instanceof RealtimeActionExecutionMessage) {
+    return (
+      <RenderRealtimeActionMessage 
+        message={props.message}
+      />
+    );
+  }
+
+  // Handle messages with realtime_action role
+  if ((props.message as any).role === "realtime_action") {
+    return <RenderRealtimeActionMessage message={props.message as any} />;
+  }
+
   if (props.message instanceof ActionExecutionMessage) {
     return (
       <RenderActionExecutionMessage

```

## 3. ENVIRONMENT CONFIGURATION

### 3.1 Token Endpoint Implementation (Server-side)
This needs to be implemented in the application using CopilotKit:

```typescript
// app/api/realtime/token/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
    }),
  });

  const data = await response.json();
  
  return NextResponse.json({
    token: data.client_secret.value,
    expires_at: data.client_secret.expires_at,
  });
}
```

## 4. USAGE EXAMPLE

```tsx
// In your React component
import { useRealtimeChat, useRealtimeActionHandler } from "@copilotkit/react-core";
import { CopilotKit } from "@copilotkit/react-core";

function App() {
  return (
    <CopilotKit 
      realtimeMode={true}
      runtimeUrl="/api/copilotkit"
    >
      <VoiceChat />
    </CopilotKit>
  );
}

function VoiceChat() {
  const { connect, disconnect, status, isMicActive, toggleMic, registerTools } = useRealtimeChat({
    tokenEndpoint: "/api/realtime/token",
    model: "gpt-4o-realtime-preview",
    voice: "alloy",
  });

  useEffect(() => {
    // Register available tools/actions
    registerTools([
      {
        name: "fillForm",
        description: "Fill out a form field",
        parameters: {
          type: "object",
          properties: {
            field: { type: "string" },
            value: { type: "string" }
          },
          required: ["field", "value"]
        }
      }
    ]);
  }, [registerTools]);

  return (
    <div>
      {status === "idle" && (
        <button onClick={connect}>Start Voice Chat</button>
      )}
      {status === "connected" && (
        <>
          <button onClick={toggleMic}>
            {isMicActive ? "Mute" : "Unmute"}
          </button>
          <button onClick={disconnect}>End Chat</button>
        </>
      )}
    </div>
  );
}
```

---

This document contains the COMPLETE CODE that exists in the current snapshot for realtime voice support in CopilotKit.