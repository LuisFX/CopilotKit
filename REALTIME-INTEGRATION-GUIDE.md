# CopilotKit OpenAI Realtime Voice Integration Guide

## 🎯 Overview

This guide documents the **complete integration** of OpenAI's Realtime API (WebRTC) with CopilotKit, enabling ultra-low latency voice conversations with full GenerativeUI support. This monumental feature allows developers to build voice-enabled AI applications with seamless integration into CopilotKit's existing action system.

## 🏗️ Architecture Overview

### Core Components

1. **`useRealtimeChat` Hook** (`packages/react-core/src/hooks/use-realtime-chat.ts`)
   - WebRTC connection management
   - Message routing and deduplication
   - Voice transcript handling
   - Tool/Action execution bridge

2. **`useRealtimeActionHandler` Hook** (`packages/react-core/src/hooks/use-realtime-action-handler.ts`)
   - Unified action execution for voice/text/API sources
   - GenerativeUI preservation
   - Metadata tracking for source attribution

3. **Message System Extensions**
   - Extended `Message` types with metadata support
   - `ActionExecutionMessage` with realtime status tracking
   - Source attribution (`voice`, `text`, `api`)

4. **UI Components**
   - `RenderMessage.tsx` with voice/text indicators
   - Visual source attribution for all messages
   - GenerativeUI support for voice-triggered actions

## 🔑 Key Integration Points

### 1. Message Flow Architecture

```typescript
// Critical: Prevent double inference
sendCopilotMessage(userMessage, { followUp: false });

// Message metadata structure
{
  id: itemId,
  role: "user",
  content: transcript,
  metadata: {
    source: 'voice',
    voiceData: {
      timestamp: Date.now(),
      transcript: transcript
    },
    skipInference: true, // CRITICAL: OpenAI Realtime handles inference
  }
}
```

### 2. Action Execution Flow

```typescript
// Voice actions flow through unified handler
executeAction(actionName, args, 'voice');

// ActionExecutionMessage with metadata
new ActionExecutionMessage({
  id: callId || `${source}-action-${Date.now()}`,
  name: actionName,
  arguments: cleanArgs,
  metadata: {
    source,
    skipInference: source === 'voice',
    ...(source === 'voice' && { voiceData: { timestamp: Date.now() } })
  }
});
```

### 3. Critical Bug Fixes Implemented

#### Double Inference Prevention
- **Problem**: Both OpenAI Realtime AND CopilotKit were generating responses
- **Solution**: Added `{ followUp: false }` to prevent CopilotKit inference
- **Implementation**: `sendCopilotMessage(message, { followUp: false })`

#### Message History Preservation
- **Problem**: Messages were clearing when actions executed
- **Solution**: Use functional setState pattern
- **Implementation**: `setMessages((prev) => [...prev, actionMessage])`

#### Message Ordering
- **Problem**: Voice transcripts arriving after triggered actions
- **Solution**: 500ms delay for voice action messages
- **Implementation**: Voice actions delayed to ensure transcript arrives first

## 📝 Implementation Checklist

### Library Setup

1. **Export Realtime Hooks**
```typescript
// packages/react-core/src/hooks/index.ts
export { useRealtimeChat } from "./use-realtime-chat";
export { useRealtimeActionHandler } from "./use-realtime-action-handler";
```

2. **Configure Token Endpoint**
```typescript
const realtimeConfig = {
  tokenEndpoint: "/api/realtime/token",
  model: "gpt-realtime",
  voice: "alloy",
  turnDetection: {
    type: "server_vad",
    threshold: 0.5,
    silence_duration_ms: 500
  }
};
```

3. **Hook Integration**
```typescript
const { connect, disconnect, status, toggleMic, registerTools } = useRealtimeChat(realtimeConfig);
```

### Action Registration

```typescript
// Register CopilotKit actions for voice
useCopilotAction({
  name: "updateField",
  description: "Update a form field",
  parameters: [
    { name: "fieldName", type: "string" },
    { name: "value", type: "string" }
  ],
  handler: async ({ fieldName, value }) => {
    // Implementation
  },
  render: ({ args, status }) => {
    // GenerativeUI component
    return <FieldUpdate {...args} status={status} />;
  }
});
```

### Message Handling

```typescript
// Critical event handlers in useRealtimeChat
switch (type) {
  case "conversation.item.created":
    // Track creation order for message ordering
    messageCreationOrder.current.push(item.id);
    break;
    
  case "conversation.item.input_audio_transcription.completed":
    // User voice transcript - send with metadata
    sendCopilotMessage(userMessage, { followUp: false });
    break;
    
  case "response.audio_transcript.done":
    // Assistant voice response - send with metadata
    sendCopilotMessage(assistantMessage, { followUp: false });
    break;
    
  case "response.function_call_arguments.done":
    // Voice-triggered action execution
    executeAction(toolName, argsWithMetadata, 'voice');
    break;
}
```

## 🎨 UI Integration

### Voice Indicators

```tsx
// RenderMessage.tsx - Visual source attribution
function MessageSourceIndicator({ metadata }) {
  const source = metadata?.source || 'text';
  return (
    <div className="copilotKitMessageSourceIndicator" data-source={source}>
      <span className="copilotKitSourceIcon">
        {source === 'voice' ? '🎤' : '⌨️'}
      </span>
      <span className="copilotKitSourceLabel">
        {source === 'voice' ? 'Voice' : 'Text'}
      </span>
    </div>
  );
}
```

### GenerativeUI with Voice Actions

```tsx
// Actions render correctly when triggered by voice
if (action?.render) {
  const RenderedComponent = action.render({ 
    args: actionMessage.arguments,
    status: actionMessage.realtimeStatus || 'pending',
    inProgress
  });
  
  return (
    <MessageWithSourceIndicator metadata={actionMessage.metadata}>
      {RenderedComponent}
    </MessageWithSourceIndicator>
  );
}
```

## 🐛 Troubleshooting Guide

### Common Issues and Solutions

1. **Double Inference**
   - Symptom: Both OpenAI and CopilotKit respond to voice input
   - Solution: Ensure `{ followUp: false }` on all realtime messages

2. **Messages Disappearing**
   - Symptom: Chat history clears when action executes
   - Solution: Use functional setState: `setMessages(prev => [...prev, msg])`

3. **Out-of-Order Messages**
   - Symptom: Action appears before user's voice transcript
   - Solution: 500ms delay on voice action messages

4. **Missing Voice Indicators**
   - Symptom: Can't distinguish voice from text messages
   - Solution: Check metadata is properly passed through message chain

5. **GenerativeUI Not Rendering**
   - Symptom: Voice actions don't show custom UI
   - Solution: Ensure action has `render` function defined

## 🚀 Quick Start Example

```typescript
import { useRealtimeChat, useCopilotAction } from "@copilotkit/react-core";

function VoiceEnabledChat() {
  const { connect, disconnect, status, isMicActive, toggleMic } = useRealtimeChat({
    tokenEndpoint: "/api/realtime/token",
    voice: "alloy"
  });

  // Define voice-enabled action
  useCopilotAction({
    name: "processVoiceCommand",
    description: "Process a voice command",
    parameters: [
      { name: "command", type: "string" },
      { name: "context", type: "object" }
    ],
    handler: async ({ command, context }) => {
      // Handle the voice command
      return { success: true, processed: command };
    },
    render: ({ args, status }) => (
      <div className="voice-command-result">
        <h3>Voice Command: {args.command}</h3>
        <p>Status: {status}</p>
      </div>
    )
  });

  return (
    <div>
      <button onClick={status === "connected" ? disconnect : connect}>
        {status === "connected" ? "Disconnect Voice" : "Connect Voice"}
      </button>
      {status === "connected" && (
        <button onClick={toggleMic}>
          {isMicActive ? "Mute" : "Unmute"}
        </button>
      )}
    </div>
  );
}
```

## 📊 Performance Considerations

- **Latency**: WebRTC provides <300ms round-trip latency
- **Message Deduplication**: Prevents duplicate transcripts/messages
- **Memory Management**: Proper cleanup in disconnect handlers
- **Error Recovery**: Automatic reconnection on WebRTC failures

## 🔒 Security Notes

- Token endpoint should validate authentication
- Ephemeral keys expire after session
- No audio is stored by default
- All messages pass through CopilotKit's security layer

## 📚 Further Reading

- [TECHNICAL-IMPLEMENTATION.md](./TECHNICAL-IMPLEMENTATION.md) - Deep dive into architecture
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [CopilotKit Actions Guide](https://docs.copilotkit.ai/concepts/actions)

---

*This integration represents a significant advancement in voice-enabled AI applications, providing developers with a seamless way to add real-time voice conversations to their CopilotKit applications while maintaining full GenerativeUI support.*