### CopilotKit Realtime Voice: How This Example Implements It

This guide explains how the `copilot-form-filling-realtime` example integrates this fork of CopilotKit to enable realtime, voice-driven form filling using the OpenAI Realtime API over WebRTC.

---

## Overview

- **Realtime voice transport**: WebRTC session directly to OpenAI Realtime servers.
- **Auth**: Server-side endpoint issues short-lived ephemeral tokens for the client.
- **Client control**: `useRealtimeChat` drives connect/disconnect, mic control, audio level, server VAD, and tool registration.
- **Action/tool bridge**: `useRealtimeActionHandler` executes CopilotKit actions from voice tool calls; domain tools are exposed via `useRealtimeActions`.
- **UI**: `VoiceControls` provides connection state, mic toggle, and audio-level meter; `MedicalIntakeForm` wires CopilotKit actions and the realtime tool bridge.

---

## Key Files

- `app/api/realtime/token/route.ts`: Issues OpenAI Realtime ephemeral tokens server-side.
- `components/VoiceControls.tsx`: Connects to Realtime, toggles mic, shows status/audio level, registers tools.
- `components/IncidentReportForm.tsx` (`MedicalIntakeForm`): Defines CopilotKit actions and bridges them to Realtime tools.
- `lib/use-realtime-actions.ts`: Converts domain actions to Realtime tool schema and routes tool calls back to CopilotKit.
- `app/layout.tsx`: Wraps app with `CopilotKit` provider and public API key.
- `app/page.tsx`: Loads the popup chat UI and registers user-readable context.
- `lib/prompt.ts`: System instructions guiding the AI’s behavior.
- `lib/user-info.ts`: Example user context provided to the model.

---

## Server: Ephemeral Token Endpoint

The client never sees your OpenAI API key. Instead, it requests a short-lived token from the app server:

```ts
// app/api/realtime/token/route.ts
export async function GET() {
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o-realtime-preview', voice: 'alloy' }),
  });
  const data = await response.json();
  return NextResponse.json({ value: data.client_secret.value, expires_at: data.client_secret.expires_at });
}
```

Environment required:

- `OPENAI_API_KEY` set on the server (never the client)

---

## Client: Realtime Connection and Controls

`VoiceControls` uses the fork’s `useRealtimeChat` hook from `@copilotkit/react-core`:

```tsx
const { connect, disconnect, status, isMicActive, toggleMic, audioLevel, registerTools } = useRealtimeChat({
  tokenEndpoint: '/api/realtime/token',
  model: 'gpt-4o-realtime-preview',
  voice: 'alloy',
  turnDetection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 },
  onToolCall, // routes tool calls to your handler
  debug: true,
});
```

- `connect()`/`disconnect()` start/stop the WebRTC session.
- `toggleMic()` controls microphone capture.
- `audioLevel` drives a simple VU meter.
- `registerTools(tools)` makes your domain tools callable by the model.

Tools are supplied by the form component and registered when connected.

---

## Action/Tool Bridge

This fork provides `useRealtimeActionHandler` to execute CopilotKit actions from voice tool calls and render Generative UI when appropriate. The example wraps this with a small adapter in `lib/use-realtime-actions.ts`:

```ts
const { executeVoiceAction } = useRealtimeActionHandler();

// Expose domain tools to Realtime
const realtimeTools = [
  { type: 'function', name: 'fillMedicalIntakeForm', /* JSON schema */ },
  { type: 'function', name: 'confirmMedicalIntake', /* JSON schema */ },
  { type: 'function', name: 'scheduleAppointment', /* JSON schema */ },
];

// Route tool calls
const handleToolCall = async (toolName, args) => {
  if (toolName === 'fillMedicalIntakeForm') {
    props?.onFillForm?.(args); // directly update form
    return { success: true };
  }
  return await executeVoiceAction(toolName, args); // executes CopilotKit action + GenerativeUI
};
```

This keeps voice/tool semantics aligned with CopilotKit’s action system.

---

## Form: Readable Context and Actions

`MedicalIntakeForm` exposes form state as readable context and defines actions the model can call:

```tsx
useCopilotReadable({ description: 'The medical intake form fields and their current values', value: form }, [form]);

useCopilotAction({
  name: 'fillMedicalIntakeForm',
  /* parameters... */, 
  handler: async (args) => { /* set form fields */ },
});

useCopilotAction({
  name: 'confirmMedicalIntake',
  /* parameters... */, 
  render: ({ args }) => (<div>...Generative UI confirmation...</div>),
});

useCopilotAction({
  name: 'scheduleAppointment',
  /* parameters... */, 
  renderAndWaitForResponse: ({ args, respond, status }) => (<Editor ... />),
});
```

Then it bridges those actions as Realtime tools and passes them to `VoiceControls`:

```tsx
const { realtimeTools, handleToolCall } = useRealtimeActions({ onFillForm: (args) => {/* set form */} });

<VoiceControls tools={realtimeTools} onToolCall={handleToolCall} />
```

---

## Provider and Prompt

- `app/layout.tsx` wraps the app with `CopilotKit`, passing `NEXT_PUBLIC_COPILOT_PUBLIC_API_KEY` for chat UI and action wiring.
- `app/page.tsx` uses `CopilotPopup` with `lib/prompt.ts` to guide behavior, and registers `retrieveUserInfo()` as readable context.

Environment required:

- `NEXT_PUBLIC_COPILOT_PUBLIC_API_KEY` exposed to client for CopilotKit UI and action context

---

## Realtime Voice Flow

1. User clicks “Start Voice Chat”.
2. Client fetches ephemeral token from `/api/realtime/token`.
3. `useRealtimeChat` establishes a WebRTC session to OpenAI Realtime with server-side VAD.
4. Model calls registered tools based on the conversation.
5. `handleToolCall` updates the form directly or executes CopilotKit actions via `executeVoiceAction`, rendering Generative UI as needed.
6. User can mute/unmute mic, and end the call.

---

## Notes & Production Considerations

- Authenticate users before issuing tokens; consider rate limiting the token route.
- Keep OpenAI API key server-only; rotate periodically.
- Validate and sanitize tool inputs before mutating state.
- Handle Safari/WebRTC quirks (autoplay policy, input device selection) as needed.

---

## Quick Start

1) Set env vars:

```bash
cp .env.local.example .env.local
echo "OPENAI_API_KEY=sk-..." >> .env.local
echo "NEXT_PUBLIC_COPILOT_PUBLIC_API_KEY=pk-..." >> .env.local
```

2) Run the app:

```bash
pnpm install
pnpm dev
```

3) Connect voice: Click “Start Voice Chat”, grant mic permission, and speak naturally.


