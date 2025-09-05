import React from "react";
import { RenderMessageProps } from "../props";
import { UserMessage as DefaultUserMessage } from "./UserMessage";
import { AssistantMessage as DefaultAssistantMessage } from "./AssistantMessage";
import { ImageRenderer as DefaultImageRenderer } from "./ImageRenderer";
import { useCopilotContext } from "@copilotkit/react-core";

// Message source indicator component for composition
function MessageSourceIndicator({ metadata }: { metadata?: any }) {
  const source = metadata?.source || 'text';
  
  return (
    <div className="copilotKitMessageSourceIndicator" data-source={source}>
      <span className="copilotKitSourceIcon">
        {source === 'voice' ? '🎤' : '⌨️'}
      </span>
      <span className="copilotKitSourceLabel">
        {source === 'voice' ? 'Voice' : 'Text'}
      </span>
      {source === 'voice' && metadata.voiceData?.confidence && (
        <span className="copilotKitSourceConfidence">
          {Math.round(metadata.voiceData.confidence * 100)}%
        </span>
      )}
    </div>
  );
}

// Wrapper component for messages with source indicator
function MessageWithSourceIndicator({ children, metadata }: { children: React.ReactNode; metadata?: any }) {
  return (
    <div className="copilotKitMessageWrapper">
      <MessageSourceIndicator metadata={metadata} />
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
      // Always show source indicator
      return (
        <MessageWithSourceIndicator metadata={(message as any).metadata}>
          {userMessage}
        </MessageWithSourceIndicator>
      );

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
          
          return (
            <MessageWithSourceIndicator metadata={(actionMessage as any).metadata}>
              {actionElement}
            </MessageWithSourceIndicator>
          );
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
      
      return (
        <MessageWithSourceIndicator metadata={(message as any).metadata}>
          {assistantMessage}
        </MessageWithSourceIndicator>
      );
      
    default:
      return null;
  }
}
