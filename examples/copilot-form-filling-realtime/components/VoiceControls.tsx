"use client";

import { useEffect, useState } from "react";
import { useRealtimeChat } from "@copilotkit/react-core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from "lucide-react";

interface VoiceControlsProps {
  tools?: any[];
  onToolCall?: (toolName: string, args: any) => Promise<any>;
}

export function VoiceControls({ tools = [], onToolCall }: VoiceControlsProps) {
  const {
    connect,
    disconnect,
    status,
    error,
    isMicActive,
    toggleMic,
    audioLevel,
    registerTools,
  } = useRealtimeChat({
    tokenEndpoint: "/api/realtime/token",
    model: "gpt-4o-realtime-preview",
    voice: "alloy",
    turnDetection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    onToolCall,
    debug: true,
  });

  const [isConnecting, setIsConnecting] = useState(false);

  // Register tools when they change
  useEffect(() => {
    if (tools.length > 0 && status === "connected") {
      registerTools(tools);
    }
  }, [tools, status, registerTools]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
    } catch (err) {
      console.error("Failed to connect:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return error || "Connection error";
      default:
        return "Not connected";
    }
  };

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>

          {/* Audio Level Indicator */}
          {status === "connected" && (
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Microphone Toggle */}
          {status === "connected" && (
            <Button
              onClick={toggleMic}
              variant={isMicActive ? "default" : "secondary"}
              size="sm"
            >
              {isMicActive ? (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Mute
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Unmute
                </>
              )}
            </Button>
          )}

          {/* Connect/Disconnect Button */}
          {status === "idle" && (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Start Voice Chat
                </>
              )}
            </Button>
          )}

          {status === "connected" && (
            <Button
              onClick={handleDisconnect}
              size="sm"
              variant="destructive"
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              End Call
            </Button>
          )}

          {status === "connecting" && (
            <Button disabled size="sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </Button>
          )}
        </div>
      </div>

      {/* Instructions */}
      {status === "connected" && (
        <div className="mt-3 text-sm text-gray-600">
          <p>🎙️ Voice chat is active. Speak naturally to fill out the form.</p>
          <p className="mt-1">Try saying: "Fill out the medical intake form for chest pain with level 7 pain"</p>
        </div>
      )}
    </Card>
  );
}