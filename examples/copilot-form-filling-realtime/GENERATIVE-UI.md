### CopilotKit Generative UI: Usage and Configuration

This guide explains how to use CopilotKit’s Generative UI in this example and how to configure actions to render interactive UI blocks that the model can orchestrate.

---

## What is Generative UI?

Generative UI lets actions render rich, interactive UI in your app that the model can trigger and coordinate. You define actions with parameters and a UI to render, and (optionally) a response flow where the user confirms or edits before proceeding.

---

## Core Concepts

- **Action**: Declared via `useCopilotAction({ name, description, parameters, ... })`.
- **render**: Show UI when the action is invoked. Useful for non-blocking visuals (status banners, summaries, notifications).
- **renderAndWaitForResponse**: Show UI, allow user input, and send a structured response back to the model using `respond`.
- **status**: Indicates the action lifecycle during UI rendering. Common values include `inProgress` and `executing` (treat these as “busy”).
- **respond(data)**: Sends a structured payload back to the model to resume the conversation or continue a workflow.

---

## Quick Start: Simple Render

Use `render` to inject an informational UI block when the model triggers an action. This is useful for confirmations or summaries.

```tsx
useCopilotAction({
  name: 'confirmMedicalIntake',
  description: 'Show confirmation dialog for the medical intake form before submission',
  parameters: [
    { name: 'summary', type: 'string', required: true, description: 'Summary to display' },
  ],
  render: ({ args }) => (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-green-900 mb-2">🏥 Confirming Medical Intake</h3>
      <p className="text-green-800">{args.summary}</p>
      <p className="text-sm text-green-600 mt-2">The form has been filled. Please review and submit.</p>
    </div>
  ),
});
```

Behavior:

- The model calls `confirmMedicalIntake` and your UI renders inline in the chat area.
- No response is required from the user; the conversation continues.

---

## Editable UI with Response

Use `renderAndWaitForResponse` for interactive flows. The UI can collect input and call `respond` to return data to the model.

```tsx
useCopilotAction({
  name: 'scheduleAppointment',
  description: 'Schedule a medical appointment for the patient',
  parameters: [
    { name: 'preferredDate', type: 'string', required: true },
    { name: 'preferredTime', type: 'string', required: true },
    { name: 'appointmentType', type: 'string', required: true, enum: ['new_patient','follow_up','telemedicine','urgent_care','lab_work','imaging'] },
    { name: 'provider', type: 'string', required: false },
  ],
  renderAndWaitForResponse: ({ args, respond, status }) => {
    function Editor() {
      const [preferredDate, setPreferredDate] = React.useState(args.preferredDate || '');
      const [preferredTime, setPreferredTime] = React.useState(args.preferredTime || '');
      const [appointmentType, setAppointmentType] = React.useState(args.appointmentType || 'new_patient');
      const [provider, setProvider] = React.useState(args.provider || '');
      const isBusy = status === 'executing' || status === 'inProgress';
      return (
        <div>
          {/* inputs... */}
          <button
            onClick={() => respond?.({ confirmed: true, preferredDate, preferredTime, appointmentType, provider: provider || undefined })}
            disabled={isBusy || !preferredDate || !preferredTime}
          >
            Confirm Appointment
          </button>
          <button onClick={() => respond?.({ confirmed: false, reason: 'cancelled' })} disabled={isBusy}>Cancel</button>
        </div>
      );
    }
    if (status === 'inProgress' || status === 'executing') return <Editor />;
    return (
      <div>
        <h3>📅 Appointment Scheduled (Pending Confirmation)</h3>
        <p>Date: {args.preferredDate}</p>
        <p>Time: {args.preferredTime}</p>
        <p>Type: {args.appointmentType}</p>
        {args.provider && <p>Provider: {args.provider}</p>}
      </div>
    );
  },
});
```

Behavior:

- The model triggers the action and your editor UI renders.
- On confirm/cancel, call `respond(payload)` to return control to the model with structured data.
- After a response, show a summary or completion UI.

---

## Best Practices

- **Keep UI pure**: Avoid side effects on first render; perform mutations in action handlers or after user confirmation.
- **Gate by status**: Treat `inProgress`/`executing` as busy; disable buttons to avoid duplicate submits.
- **Validate inputs**: Ensure required fields are present before calling `respond`.
- **Shape responses**: Return structured, minimal data. The model uses this to proceed.
- **Compose with app state**: Use component state or form libs (e.g., React Hook Form) to edit values.

---

## Wiring with Voice (Realtime)

When used with the Realtime API, tool calls map to actions. This example routes calls via `useRealtimeActionHandler`:

```ts
const { executeVoiceAction } = useRealtimeActionHandler();

const handleToolCall = async (toolName, args) => {
  if (toolName === 'fillMedicalIntakeForm') { /* directly update form */ return { success: true }; }
  return await executeVoiceAction(toolName, args); // runs action + renders Generative UI
};
```

This keeps a single source of truth: CopilotKit actions define both parameters and UI; voice tools just delegate to them.

---

## Configuration Checklist

- Define clear `parameters` for each action with types and enums where possible.
- Use `render` for lightweight, non-blocking UI (e.g., confirmations).
- Use `renderAndWaitForResponse` when user input is required.
- Use `respond` to send minimal, structured data.
- Handle `status` to prevent double submits and show loading states.
- In voice mode, route tools through `executeVoiceAction` to get Generative UI.

---

## Where to Look in This Example

- `components/IncidentReportForm.tsx`:
  - `confirmMedicalIntake` uses `render` for a visual confirmation banner.
  - `scheduleAppointment` uses `renderAndWaitForResponse` to collect inputs and confirm.
- `lib/use-realtime-actions.ts`:
  - Bridges Realtime tool calls to `executeVoiceAction` for Generative UI.

---

## Troubleshooting

- If UI doesn’t appear, confirm the action name matches the tool call and that the component is mounted.
- If `respond` does nothing, ensure you’re inside `renderAndWaitForResponse` and not `render`.
- If inputs reset unexpectedly, check that local state is initialized from `args` and not re-created unnecessarily.


