import React from "react";
import { RealtimeActionExecutionMessage } from "@copilotkit/runtime-client-gql";
import { useCopilotContext } from "@copilotkit/react-core";

export interface RenderRealtimeActionMessageProps {
  message: RealtimeActionExecutionMessage;
  inProgress: boolean;
}

export const RenderRealtimeActionMessage: React.FC<RenderRealtimeActionMessageProps> = ({ 
  message,
  inProgress 
}) => {
  const { actions } = useCopilotContext();
  
  // Find the action with render function
  const action = Object.values(actions).find((a: any) => a.name === message.name) as any;
  
  // If the action has a render function, use it
  if (action?.render) {
    const RenderedComponent = action.render({ 
      args: message.arguments,
      status: message.realtimeStatus,
      inProgress
    });
    
    if (RenderedComponent) {
      return (
        <div className="copilotKitRealtimeActionMessage">
          {message.voiceMetadata?.triggeredBy === "voice" && (
            <div className="copilotKitVoiceIndicator">
              <span className="copilotKitVoiceIcon">🎙️</span>
              <span className="copilotKitVoiceLabel">Voice Command</span>
            </div>
          )}
          {RenderedComponent}
        </div>
      );
    }
  }
  
  // Fallback rendering if no custom render function
  return (
    <div className="copilotKitRealtimeActionMessage copilotKitRealtimeActionDefault">
      {message.voiceMetadata?.triggeredBy === "voice" && (
        <div className="copilotKitVoiceIndicator">
          <span className="copilotKitVoiceIcon">🎙️</span>
          <span className="copilotKitVoiceLabel">Voice Command</span>
        </div>
      )}
      <div className="copilotKitActionHeader">
        <span className="copilotKitActionName">{message.name}</span>
        <span className="copilotKitActionStatus" data-status={message.realtimeStatus}>
          {message.realtimeStatus || "pending"}
        </span>
      </div>
      {Object.keys(message.arguments).length > 0 && (
        <div className="copilotKitActionArguments">
          <pre>{JSON.stringify(message.arguments, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export const RenderVoiceTranscriptMessage: React.FC<{ message: any }> = ({ message }) => {
  return (
    <div className="copilotKitVoiceTranscriptMessage">
      <div className="copilotKitVoiceTranscriptHeader">
        <span className="copilotKitVoiceIcon">🎤</span>
        <span className="copilotKitVoiceLabel">Voice Input</span>
        {message.audioData?.confidence && (
          <span className="copilotKitVoiceConfidence">
            {Math.round(message.audioData.confidence * 100)}% confidence
          </span>
        )}
      </div>
      <div className="copilotKitVoiceTranscriptContent">
        {message.content}
      </div>
    </div>
  );
};