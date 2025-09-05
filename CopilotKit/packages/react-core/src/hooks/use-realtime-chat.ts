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
import type { Message } from "@copilotkit/shared";

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
  
  // Debug logging to understand the issue
  // console.log("[RealtimeChat] Hook initialization:", {
  //   chatResultDefined: !!chatResult,
  //   sendMessageDefined: !!sendCopilotMessage,
  //   chatResultKeys: chatResult ? Object.keys(chatResult) : [],
  // });
  
  const { executeAction } = useRealtimeActionHandler();
  
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
  // Track order of created items to fix race conditions
  const messageCreationOrder = useRef<string[]>([]);
  
  // Audio level monitoring
  useEffect(() => {
    if (!streamRef.current || !isMicActive) {
      setAudioLevel(0);
      return;
    }
    
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(streamRef.current);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    microphone.connect(analyser);
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      if (isMicActive) {
        requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
    
    return () => {
      microphone.disconnect();
      audioContext.close();
    };
  }, [streamRef.current, isMicActive]);
  
  // Handle realtime events
  const handleRealtimeEvent = useCallback(async (event: any) => {
    const { type } = event;
    const timestamp = new Date().toLocaleTimeString();
    
    // CRITICAL: Log message flow to debug history resetting
    if (type === "conversation.item.created" || 
        type === "conversation.item.input_audio_transcription.completed" ||
        type === "response.audio_transcript.done") {
      const itemId = event.item_id || event.item?.id;
      const role = event.item?.role || (type.includes("response") ? "assistant" : "user");
      console.log(`\n🔍 [MESSAGE FLOW] ${timestamp}`);
      console.log(`   Type: ${type}`);
      console.log(`   ID: ${itemId}`);
      console.log(`   Role: ${role}`);
      console.log(`   Already processed: ${processedItemIds.current.has(itemId || '')}`);
      console.log(`   Total processed: ${processedItemIds.current.size}`);
      console.log(`   Total sent messages: ${sentMessages.current.size}`);
    }
    
    switch (type) {
      // Skip conversation.updated for now to avoid duplicates
      case "conversation.updated": {
        // We're relying on specific events instead
        break;
      }
      
      case "conversation.item.created": {
        const item = event.item;
        // Minimal logging for clarity
        
        // Track creation order for all items
        if (item?.id && !messageCreationOrder.current.includes(item.id)) {
          messageCreationOrder.current.push(item.id);
        }
        
        // Handle different item types
        if (item && !processedItemIds.current.has(item.id)) {
          processedItemIds.current.add(item.id);
          
          let role: "user" | "assistant" = "assistant";
          let content = "";
          
          // Handle message items (user or assistant messages)
          if (item.type === "message") {
            role = item.role === "user" ? "user" : "assistant";
            
            if (item.content && Array.isArray(item.content)) {
              // Extract text content - simplified
              content = item.content
                .filter((c: any) => c?.type === "text" || c?.type === "input_text" || c?.transcript)
                .map((c: any) => c.text || c.transcript || "")
                .join("")
                .trim();
            }
            
            // Skip user messages without content - wait for transcription event
            if (role === "user" && !content) {
              processedItemIds.current.delete(item.id);
              break;
            }
          }
          
          // Skip function calls - handled elsewhere
          if (item.type === "function_call" || item.type === "function_call_output") {
            break;
          }
          
          // Send message to CopilotKit if we have content
          if (content && sendCopilotMessage) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] SEND TO UI: ${item.id} | ${role}: "${content.substring(0, 50)}..."`);
            sendCopilotMessage({
              id: item.id,
              role,
              content,
            } as Message);
          }
        }
        break;
      }
      
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = event.transcript?.trim();
        const itemId = event.item_id;
        
        if (transcript && itemId) {
          const transcriptKey = `${itemId}_user_transcript`;
          if (!processedItemIds.current.has(transcriptKey)) {
            processedItemIds.current.add(transcriptKey);
            
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] USER TRANSCRIPT: ${itemId} | "${transcript.substring(0, 50)}..."`);
            
            if (sendCopilotMessage) {
              // Check for duplicate content
              const messageKey = `user:${transcript}`;
              const existingId = sentMessages.current.get(messageKey);
              
              if (existingId && existingId !== itemId) {
                console.log(`[${timestamp}] USER DUPLICATE BLOCKED: ${itemId} (already sent as ${existingId})`);
              } else {
                sentMessages.current.set(messageKey, itemId);
                // Send as regular message with voice metadata
                // IMPORTANT: skipInference must be TRUE because OpenAI Realtime handles the response
                const userMessage: Message = {
                  id: itemId,
                  role: "user",
                  content: transcript,
                  metadata: {
                    source: 'voice',
                    voiceData: {
                      timestamp: Date.now(),
                      transcript: transcript
                    },
                    skipInference: true, // CRITICAL: OpenAI Realtime handles inference, not CopilotKit
                    // Use creation order to help with message ordering
                    creationIndex: messageCreationOrder.current.indexOf(itemId)
                  }
                } as Message;
                console.log("[RealtimeChat] Sending user message to UI:", userMessage);
                try {
                  // CRITICAL: Pass followUp: false to prevent CopilotKit from generating AI response
                  sendCopilotMessage(userMessage, { followUp: false });
                  console.log("[RealtimeChat] User message sent successfully");
                } catch (error) {
                  console.error("[RealtimeChat] Error sending user message:", error);
                }
              }
            }
          }
        }
        break;
      }
      
      case "response.audio_transcript.done": {
        const transcript = event.transcript?.trim();
        const itemId = event.item_id;
        
        if (transcript && itemId && !processedItemIds.current.has(`${itemId}_transcript`)) {
          processedItemIds.current.add(`${itemId}_transcript`);
          
          const timestamp = new Date().toLocaleTimeString();
          console.log(`[${timestamp}] ASSISTANT TRANSCRIPT: ${itemId} | "${transcript.substring(0, 50)}..."`);
          
          if (sendCopilotMessage) {
            // Send as regular message with voice metadata
            const assistantMessage: Message = {
              id: itemId,
              role: "assistant",
              content: transcript,
              metadata: {
                source: 'voice',
                voiceData: {
                  timestamp: Date.now(),
                  transcript: transcript
                },
                skipInference: true // Assistant responses don't trigger inference
              }
            } as Message;
            console.log("[RealtimeChat] Sending assistant message to UI:", assistantMessage);
            try {
              // Pass followUp: false since OpenAI Realtime already handled the response
              sendCopilotMessage(assistantMessage, { followUp: false });
              console.log("[RealtimeChat] Message sent successfully");
            } catch (error) {
              console.error("[RealtimeChat] Error sending message:", error);
            }
          } else {
            console.warn("[RealtimeChat] sendCopilotMessage is undefined - cannot send assistant transcript to UI");
          }
        }
        break;
      }
      
      case "response.function_call_arguments.done": {
        // Handle tool calls
        const toolName = event.name;
        const callId = event.call_id;
        const args = event.arguments ? JSON.parse(event.arguments) : {};
        
        if (config.debug) {
          console.log("[RealtimeChat] Tool call:", toolName, args);
        }
        
        // Handle voice-triggered actions with GenerativeUI support
        const handleVoiceAction = async () => {
          try {
            let result = null;
            
            // Try to execute through CopilotKit's action system first
            // This will handle GenerativeUI rendering automatically
            try {
              result = await executeAction(toolName, args, 'voice');
              console.log(`[RealtimeChat] Voice action executed for ${toolName}`);
            } catch (actionError) {
              // Action might not exist in CopilotKit, try custom handler
              console.log(`[RealtimeChat] CopilotKit action not found for ${toolName}, trying custom handler...`);
              
              // Fallback to custom onToolCall if provided
              if (config.onToolCall) {
                result = await config.onToolCall(toolName, args);
              } else {
                throw actionError;
              }
            }
            
            // Send result back to OpenAI Realtime
            if (dcRef.current && dcRef.current.readyState === "open") {
              const outputEvent = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify(result || { success: true })
                }
              };
              dcRef.current.send(JSON.stringify(outputEvent));
              
              if (config.debug) {
                console.log("[RealtimeChat] Sent tool result:", outputEvent);
              }
            }
          } catch (error) {
            console.error("[RealtimeChat] Tool execution error:", error);
            // Send error back to OpenAI Realtime
            if (dcRef.current && dcRef.current.readyState === "open") {
              const errorEvent = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({ error: (error as Error).message || "Tool execution failed" })
                }
              };
              dcRef.current.send(JSON.stringify(errorEvent));
            }
          }
        };
        
        handleVoiceAction();
        break;
      }
      
      case "error": {
        console.error("[RealtimeChat] Error event:", JSON.stringify(event));
        // Handle different error formats
        let errorMsg = "Unknown error";
        if (event.error) {
          errorMsg = typeof event.error === 'string' 
            ? event.error 
            : event.error.message || event.error.type || JSON.stringify(event.error);
        } else if (event.message) {
          errorMsg = event.message;
        } else if (event.code) {
          errorMsg = `Error code: ${event.code}`;
        }
        console.error("[RealtimeChat] Error details:", errorMsg);
        setError(errorMsg);
        break;
      }
      
      case "session.error":
      case "response.error": {
        console.error(`[RealtimeChat] ${type}:`, event);
        if (event.error) {
          setError(event.error.message || event.error.type || "Session error");
        }
        break;
      }
      
      // Silently ignore streaming delta events - we handle the complete versions
      case "response.function_call_arguments.delta":
      case "response.audio_transcript.delta":
      case "response.text.delta":
      case "response.audio.delta":
      case "input_audio_buffer.speech_started":
      case "input_audio_buffer.speech_stopped":
      case "input_audio_buffer.committed":
      case "response.created":
      case "response.done":
      case "conversation.item.truncated":
      case "rate_limits.updated":
        // These are expected streaming/status events that we don't need to process
        break;
      
      // Log other events in debug mode
      default: {
        if (config.debug) {
          console.log(`[RealtimeChat] Unhandled event ${type}:`, event);
        }
      }
    }
  }, [sendCopilotMessage, config.debug, config.onToolCall, executeAction]);
  
  // Connect to OpenAI Realtime
  const connect = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    
    setStatus("connecting");
    setError(undefined);
    
    try {
      // Fetch ephemeral token
      const tokenRes = await fetch(config.tokenEndpoint);
      if (!tokenRes.ok) throw new Error("Failed to fetch token");
      const { value: ephemeralKey } = await tokenRes.json();
      
      // Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      // Set up remote audio
      pc.ontrack = (e) => {
        const audio = audioElRef.current || document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = e.streams[0];
        audioElRef.current = audio;
      };
      
      // Create data channel
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      
      dc.onopen = () => {
        setStatus("connected");
        
        // Send session configuration
        // Enable input_audio_transcription to get user transcripts
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            voice: config.voice || "alloy",
            instructions: "You are a helpful AI assistant for filing incident reports. When users provide incident details (name, email, incident type, severity, etc.), use the 'fillIncidentReportForm' tool to populate the form. Only use 'confirmIncidentReport' to show a summary AFTER filling the form. IMPORTANT: Always respond in English only.",
            input_audio_transcription: {
              model: "whisper-1",
              language: "en"  // Force English transcription
            },
            turn_detection: config.turnDetection || {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            tools: registeredTools.current,
          },
        };
        
        dc.send(JSON.stringify(sessionConfig));
      };
      
      dc.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          handleRealtimeEvent(event);
        } catch (e) {
          console.error("[RealtimeChat] Failed to parse event:", e);
        }
      };
      
      dc.onerror = (e) => {
        console.error("[RealtimeChat] Data channel error:", e);
        setError("Data channel error");
        setStatus("error");
      };
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Exchange SDP with OpenAI
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${config.model || "gpt-4o-realtime-preview"}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        }
      );
      
      if (!sdpRes.ok) {
        const errorText = await sdpRes.text();
        console.error("[RealtimeChat] SDP exchange error:", errorText);
        throw new Error(`SDP exchange failed: ${errorText}`);
      }
      
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      
    } catch (e) {
      console.error("[RealtimeChat] Connection error:", e);
      setError((e as Error).message);
      setStatus("error");
    }
  }, [status, config, handleRealtimeEvent]);
  
  // Disconnect
  const disconnect = useCallback(() => {
    dcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    pcRef.current?.close();
    
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    
    setStatus("idle");
    setIsMicActive(true);
    processedItemIds.current.clear();
    sentMessages.current.clear();
  }, []);
  
  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicActive(audioTrack.enabled);
      }
    }
  }, []);
  
  // Register tools
  const registerTools = useCallback((tools: RealtimeToolDefinition[]) => {
    registeredTools.current = tools;
    
    // If already connected, update session with new tools
    if (status === "connected" && dcRef.current) {
      const updateEvent = {
        type: "session.update",
        session: {
          tools,
        },
      };
      dcRef.current.send(JSON.stringify(updateEvent));
    }
  }, [status]);
  
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
    registerTools,
  };
}