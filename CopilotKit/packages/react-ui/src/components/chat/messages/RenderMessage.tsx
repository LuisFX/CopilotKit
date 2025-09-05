import React from "react";
import { RenderMessageProps } from "../props";
import { UserMessage as DefaultUserMessage } from "./UserMessage";
import { AssistantMessage as DefaultAssistantMessage } from "./AssistantMessage";
import { ImageRenderer as DefaultImageRenderer } from "./ImageRenderer";
import { useCopilotContext } from "@copilotkit/react-core";

// Voice indicator component for composition
function VoiceIndicator({ metadata }: { metadata?: any }) {
  if (!metadata?.source || metadata.source !== 'voice') return null;
  
  return (
    <div className="copilotKitVoiceIndicator">
      <span className="copilotKitVoiceIcon">🎙️</span>
      <span className="copilotKitVoiceLabel">Voice</span>
      {metadata.voiceData?.confidence && (
        <span className="copilotKitVoiceConfidence">
          {Math.round(metadata.voiceData.confidence * 100)}%
        </span>
      )}
    </div>
  );
}

// Wrapper component for messages with voice metadata
function MessageWithVoiceIndicator({ children, metadata }: { children: React.ReactNode; metadata?: any }) {
  return (
    <div className="copilotKitMessageWrapper">
      <VoiceIndicator metadata={metadata} />
      {children}
    </div>
  );
}

export function RenderMessage({
  UserMessage = DefaultUserMessage,
  AssistantMessage = DefaultAssistantMessage,
  ImageRenderer = DefaultImageRenderer,
  ...props
}: RenderMessageProps) {
  const {
    message,
    inProgress,
    index,
    isCurrentMessage,
    onRegenerate,
    onCopy,
    onThumbsUp,
    onThumbsDown,
    markdownTagRenderers,
  } = props;

  const { actions } = useCopilotContext();

  // Handle regular message types with optional voice metadata
  switch (message.role) {
    case "user":
      const userMessage = (
        <UserMessage
          key={index}
          rawData={message}
          data-message-role="user"
          message={message}
          ImageRenderer={ImageRenderer}
        />
      );
      // Wrap with voice indicator if this is a voice message
      return (message as any).metadata?.source === 'voice' ? (
        <MessageWithVoiceIndicator metadata={(message as any).metadata}>
          {userMessage}
        </MessageWithVoiceIndicator>
      ) : userMessage;

    case "assistant":
      // Check if this is an action message
      if ((message as any).type === "ActionExecutionMessage") {
        const actionMessage = message as any;
        const action = Object.values(actions).find((a: any) => a.name === actionMessage.name) as any;
        
        // If action has render function, use it
        if (action?.render) {
          const RenderedComponent = action.render({ 
            args: actionMessage.arguments,
            status: actionMessage.realtimeStatus || 'pending',
            inProgress
          });
          
          const actionElement = RenderedComponent || (
            <div className="copilotKitActionDefault">
              <div className="copilotKitActionHeader">
                <span className="copilotKitActionName">{actionMessage.name}</span>
                <span className="copilotKitActionStatus" data-status={actionMessage.realtimeStatus}>
                  {actionMessage.realtimeStatus || "pending"}
                </span>
              </div>
              {Object.keys(actionMessage.arguments).length > 0 && (
                <div className="copilotKitActionArguments">
                  <pre>{JSON.stringify(actionMessage.arguments, null, 2)}</pre>
                </div>
              )}
            </div>
          );
          
          return (actionMessage as any).metadata?.source === 'voice' ? (
            <MessageWithVoiceIndicator metadata={(actionMessage as any).metadata}>
              {actionElement}
            </MessageWithVoiceIndicator>
          ) : actionElement;
        }
      }
      
      // Regular assistant message
      const assistantMessage = (
        <AssistantMessage
          key={index}
          data-message-role="assistant"
          subComponent={message.generativeUI?.()}
          rawData={message}
          message={message}
          isLoading={inProgress && isCurrentMessage && !message.content}
          isGenerating={inProgress && isCurrentMessage && !!message.content}
          isCurrentMessage={isCurrentMessage}
          onRegenerate={() => onRegenerate?.(message.id)}
          onCopy={onCopy}
          onThumbsUp={onThumbsUp}
          onThumbsDown={onThumbsDown}
          markdownTagRenderers={markdownTagRenderers}
          ImageRenderer={ImageRenderer}
        />
      );
      
      return (message as any).metadata?.source === 'voice' ? (
        <MessageWithVoiceIndicator metadata={(message as any).metadata}>
          {assistantMessage}
        </MessageWithVoiceIndicator>
      ) : assistantMessage;
      
    default:
      return null;
  }
}
