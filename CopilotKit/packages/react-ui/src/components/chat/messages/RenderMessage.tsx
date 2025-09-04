import { RenderMessageProps } from "../props";
import { UserMessage as DefaultUserMessage } from "./UserMessage";
import { AssistantMessage as DefaultAssistantMessage } from "./AssistantMessage";
import { ImageRenderer as DefaultImageRenderer } from "./ImageRenderer";
import { RenderRealtimeActionMessage, RenderVoiceTranscriptMessage } from "./RenderRealtimeActionMessage";

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

  switch (message.role) {
    case "user":
      return (
        <UserMessage
          key={index}
          rawData={message}
          data-message-role="user"
          message={message}
          ImageRenderer={ImageRenderer}
        />
      );
    case "assistant":
      return (
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
    case "realtime_action":
      return (
        <RenderRealtimeActionMessage
          key={index}
          message={message as any}
          inProgress={inProgress}
        />
      );
    case "voice_transcript":
      return (
        <RenderVoiceTranscriptMessage
          key={index}
          message={message}
        />
      );
  }
}
