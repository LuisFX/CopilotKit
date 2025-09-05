import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // In production, authenticate the user here
  // const user = await authenticateUser(request);
  // if (!user) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }
  
  try {
    // Get ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to get ephemeral token' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      value: data.client_secret.value,
      expires_at: data.client_secret.expires_at,
    });
  } catch (error) {
    console.error('Error fetching ephemeral token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}