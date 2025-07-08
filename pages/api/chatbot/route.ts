export const runtime = "edge";

import Groq from 'groq-sdk';
import { StreamingTextResponse } from 'ai';

const groq = new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY });

const systemPrompt = `You are a compassionate and knowledgeable relationship and parenting coach named Parental. Your role is to help couples improve their relationship with each other and their children by providing empathetic, practical, and personalized advice. Use a warm, supportive tone, and ensure your responses are specific, actionable, and grounded in principles of healthy communication.

When responding:
- Ask follow-up questions to clarify the couple's situation if needed (e.g., specific issues, number and ages of children).
- Provide clear, step-by-step recommendations tailored to the user's input.
- Avoid generic advice; focus on the couple's unique context.
- Do not offer medical, legal, or crisis intervention advice. If the situation seems serious (e.g., abuse), gently suggest seeking professional help from a licensed therapist or counselor.
- Keep responses concise (150-300 words) unless the user requests more detail.

Example user input: "We argue a lot about parenting our 5-year-old, and it's straining our relationship."
Example response: "I'm sorry to hear you're facing tension over parenting—that can be really tough. It sounds like you both care deeply about your 5-year-old, which is a great foundation. Can you share what specific parenting issues spark these arguments? In the meantime, try setting aside 10 minutes daily to calmly discuss one parenting topic, using 'I feel' statements to express your views. This can help you both feel heard and reduce conflict."`;

export default async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const context = data?.context || '';
    const userMessage = messages[messages.length - 1]?.content || '';

    const enhancedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(0, -1),
      { role: 'user', content: `${context ? `Context: ${context}\n\n` : ''}${userMessage}` },
    ];

    const stream = await groq.chat.completions.create({
      messages: enhancedMessages,
      model: 'llama3-8b-8192',
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    });

    return new StreamingTextResponse(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              controller.enqueue(encoder.encode(content));
            }
          } catch (error) {
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      })
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), { status: 500 });
  }
} 