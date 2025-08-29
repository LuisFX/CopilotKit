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
    
    // Debug: Log ALL events to find where user transcript appears
    console.log(`[RealtimeChat] Event: ${type}`, event);
    
    // Special logging for events that might contain transcripts
    if (event.transcript || event.item?.content?.some?.((c: any) => c.transcript)) {
      console.log("[RealtimeChat] 🎯 FOUND TRANSCRIPT IN EVENT:", type, event);
    }
    
    switch (type) {
      // Handle conversation updates - these often contain transcripts after initial creation
      case "conversation.updated": {
        const item = event.item;
        if (!item) break;
        
        console.log("[RealtimeChat] conversation.updated with item:", JSON.stringify(item, null, 2));
        
        // Check if this is a user message update with transcript
        if (item.type === "message" && item.role === "user" && item.content && Array.isArray(item.content)) {
          for (const contentItem of item.content) {
            if (contentItem?.type === "input_audio" && contentItem.transcript) {
              console.log("[RealtimeChat] ✅ Found user transcript in conversation.updated:", contentItem.transcript);
              
              // Send the user message with transcript
              const transcriptKey = `${item.id}_user_transcript`;
              if (!processedItemIds.current.has(transcriptKey)) {
                processedItemIds.current.add(transcriptKey);
                
                if (sendCopilotMessage) {
                  void sendCopilotMessage({
                    id: item.id,
                    role: "user",
                    content: contentItem.transcript,
                  }).then(() => {
                    console.log("[RealtimeChat] ✅ User message sent to CopilotKit successfully");
                  }).catch((error: any) => {
                    console.error("[RealtimeChat] ❌ Failed to send user message:", error);
                  });
                } else {
                  console.error("[RealtimeChat] sendCopilotMessage is not available");
                }
              }
              break;
            }
          }
        }
        break;
      }
      
      case "conversation.item.created": {
        const item = event.item;
        console.log("[RealtimeChat] Processing conversation.item.created:", JSON.stringify(item, null, 2));
        
        // Handle different item types
        if (item && !processedItemIds.current.has(item.id)) {
          processedItemIds.current.add(item.id);
          
          let role: "user" | "assistant" = "assistant";
          let content = "";
          
          // Handle message items (user or assistant messages)
          if (item.type === "message") {
            role = item.role === "user" ? "user" : "assistant";
            
            if (item.content && Array.isArray(item.content)) {
              console.log(`[RealtimeChat] ${role} message content array:`, JSON.stringify(item.content, null, 2));
              
              // Extract text/transcript from content items
              for (const contentItem of item.content) {
                if (contentItem?.type === "text" && contentItem.text) {
                  content = contentItem.text;
                  break;
                } else if (contentItem?.type === "input_text" && contentItem.text) {
                  content = contentItem.text;
                  break;
                } else if (contentItem?.type === "input_audio" && contentItem.transcript) {
                  // User audio with transcript
                  content = contentItem.transcript;
                  console.log("[RealtimeChat] Found user audio transcript in content:", content);
                  break;
                } else if (contentItem?.type === "audio" && contentItem.transcript) {
                  // Assistant audio with transcript
                  content = contentItem.transcript;
                  break;
                }
              }
            }
            
            // For user messages with input_audio, check if transcript is available
            if (role === "user" && !content && item.content?.some((c: any) => c?.type === "input_audio")) {
              console.log("[RealtimeChat] User audio message detected without transcript, will wait for later events");
              // Remove from processed items so we can process it again when transcript arrives
              processedItemIds.current.delete(item.id);
              break;
            }
          }
          
          // Handle function_call items (for tool execution)
          if (item.type === "function_call") {
            // We'll handle this in response.function_call_arguments.done
            console.log("[RealtimeChat] Function call item created:", item.name);
            break;
          }
          
          // Handle function_call_output items
          if (item.type === "function_call_output") {
            // Skip these as they're internal
            break;
          }
          
          // Send message to CopilotKit if we have content
          if (content) {
            console.log("[RealtimeChat] Sending message to CopilotKit:", {
              id: item.id,
              role,
              content,
            });
            
            if (sendCopilotMessage) {
              void sendCopilotMessage({
                id: item.id,
                role,
                content,
              }).then(() => {
                console.log("[RealtimeChat] Message sent successfully");
              }).catch((error: any) => {
                console.error("[RealtimeChat] Failed to send message:", error);
              });
            } else {
              console.error("[RealtimeChat] sendCopilotMessage is not available");
            }
          }
        }
        break;
      }
      
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = event.transcript?.trim();
        const itemId = event.item_id;
        
        console.log("[RealtimeChat] ✅ User transcription completed event:", { itemId, transcript });
        
        if (transcript && itemId) {
          const transcriptKey = `${itemId}_user_transcript`;
          if (!processedItemIds.current.has(transcriptKey)) {
            processedItemIds.current.add(transcriptKey);
            
            console.log("[RealtimeChat] ✅ Sending user message to CopilotKit:", transcript);
            
            if (sendCopilotMessage) {
              void sendCopilotMessage({
                id: itemId,
                role: "user",
                content: transcript,
              }).then(() => {
                console.log("[RealtimeChat] ✅ User message sent successfully");
              }).catch((error: any) => {
                console.error("[RealtimeChat] ❌ Failed to send user message:", error);
              });
            } else {
              console.error("[RealtimeChat] sendCopilotMessage is not available");
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
          
          console.log("[RealtimeChat] Assistant audio transcript done:", transcript);
          console.log("[RealtimeChat] Sending assistant message to CopilotKit:", {
            id: itemId,
            role: "assistant",
            content: transcript,
          });
          
          if (sendCopilotMessage) {
            void sendCopilotMessage({
              id: itemId,
              role: "assistant",
              content: transcript,
            }).then(() => {
              console.log("[RealtimeChat] Assistant message sent successfully");
            }).catch((error: any) => {
              console.error("[RealtimeChat] Failed to send assistant message:", error);
            });
          } else {
            console.error("[RealtimeChat] sendCopilotMessage is not available");
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
        
        // Execute the tool call via callback
        if (config.onToolCall) {
          config.onToolCall(toolName, args)
            .then(result => {
              // Send function output back to OpenAI Realtime
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
            })
            .catch(error => {
              console.error("[RealtimeChat] Tool execution error:", error);
              // Send error back to OpenAI Realtime
              if (dcRef.current && dcRef.current.readyState === "open") {
                const errorEvent = {
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: JSON.stringify({ error: error.message || "Tool execution failed" })
                  }
                };
                dcRef.current.send(JSON.stringify(errorEvent));
              }
            });
        }
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
      
      // Log other events in debug mode
      default: {
        if (config.debug) {
          console.log(`[RealtimeChat] Unhandled event ${type}:`, event);
        }
      }
    }
  }, [sendCopilotMessage, config.debug]);
  
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
            instructions: "You are a helpful AI assistant integrated with CopilotKit. Respond naturally to voice input.",
            input_audio_transcription: {
              model: "whisper-1"
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