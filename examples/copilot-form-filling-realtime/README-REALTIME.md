# 🎙️ CopilotKit Realtime Voice Form Filling Example

This example demonstrates how to use CopilotKit's OpenAI Realtime API integration for voice-enabled form filling.

## Features

- **Voice-Enabled Form Filling**: Speak naturally to fill out forms
- **Real-time Transcription**: See your speech converted to text instantly
- **Ultra-Low Latency**: Direct WebRTC connection to OpenAI servers
- **Visual Feedback**: Audio level indicators and connection status
- **Microphone Controls**: Mute/unmute functionality

## Setup

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and add your OpenAI API key:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Start Voice Chat**: Click the "Start Voice Chat" button in the voice controls panel
2. **Allow Microphone Access**: Grant permission when prompted by your browser
3. **Speak Naturally**: Try saying:
   - "Fill out the incident report for a phishing attack that happened yesterday"
   - "Report a malware incident with critical severity"
   - "Create an incident report for unauthorized access detected this morning"
4. **Watch the Form Fill**: The form fields will automatically populate based on your voice input
5. **Mute/Unmute**: Use the mute button to control when the AI can hear you
6. **End Call**: Click "End Call" when finished

## Voice Commands Examples

- **Basic Fill**: "Fill the form with my name John Doe, email john@example.com"
- **Incident Report**: "Report a data breach incident that occurred on December 15th with high severity"
- **Detailed Report**: "Create an incident report for a phishing attack. The attacker sent emails impersonating our IT department. Impact level is medium. Suggested actions include user training and email filtering updates."

## Technical Details

### Architecture

- **WebRTC Connection**: Direct peer-to-peer connection to OpenAI Realtime servers
- **Ephemeral Tokens**: Secure, temporary authentication tokens
- **Tool Registration**: Form actions are registered as voice-callable tools
- **Real-time Updates**: Form updates happen instantly as you speak

### Key Components

- `VoiceControls.tsx`: Voice UI controls and WebRTC management
- `IncidentReportForm.tsx`: Form with integrated voice capabilities
- `/api/realtime/token/route.ts`: Backend endpoint for ephemeral tokens

## Troubleshooting

### Connection Issues
- Ensure your OpenAI API key is correctly set in `.env.local`
- Check that you have credits in your OpenAI account
- Verify microphone permissions in your browser

### No Audio
- Check browser microphone permissions
- Ensure your microphone is not muted at the system level
- Try refreshing the page and reconnecting

### Form Not Updating
- Speak clearly and wait for the transcription to complete
- Check the browser console for any errors
- Ensure the voice controls show "Connected" status

## Browser Support

- ✅ Chrome 90+ (Recommended)
- ✅ Firefox 88+
- ⚠️ Safari 15+ (Limited WebRTC support)
- ✅ Edge 90+

## Security Notes

- Never expose your OpenAI API key in client-side code
- The ephemeral token endpoint should include user authentication in production
- Consider rate limiting the token endpoint to prevent abuse

## Learn More

- [CopilotKit Documentation](https://docs.copilotkit.ai)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [WebRTC Fundamentals](https://webrtc.org)