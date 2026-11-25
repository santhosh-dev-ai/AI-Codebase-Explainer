import { describe, it, expect, vi } from 'vitest';

describe('SSE Streaming Event Parsing & Resilience (REL-06, REL-04)', () => {
  it('correctly splits buffered chunks across SSE double-newline boundaries', () => {
    const rawBuffer = 'data: {"type":"chunk","content":"Hello "}\n\ndata: {"type":"chunk","content":"World!"}\n\n';
    const events = rawBuffer.split('\n\n');
    const parsedChunks: string[] = [];

    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;

      const parsed = JSON.parse(jsonStr);
      if (parsed.type === 'chunk') {
        parsedChunks.push(parsed.content);
      }
    }

    expect(parsedChunks).toEqual(['Hello ', 'World!']);
    expect(parsedChunks.join('')).toBe('Hello World!');
  });

  it('safely skips SSE comment frames (heartbeat : ping)', () => {
    const rawBuffer = ': ping\n\ndata: {"type":"chunk","content":"Data after ping"}\n\n: ping\n\n';
    const events = rawBuffer.split('\n\n');
    const validData: any[] = [];

    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed.startsWith('data:')) continue; // Heartbeat comments start with ':' and are ignored
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;

      validData.push(JSON.parse(jsonStr));
    }

    expect(validData).toHaveLength(1);
    expect(validData[0].content).toBe('Data after ping');
  });

  it('handles partial chunk buffers across reader iterations', () => {
    let buffer = '';
    const receivedChunks: string[] = [];

    const packet1 = 'data: {"type":"chunk","content":"Part1"}';
    const packet2 = '\n\ndata: {"type":"chunk","content":"Part2"}\n\n';

    // Packet 1 received incomplete
    buffer += packet1;
    let events = buffer.split('\n\n');
    buffer = events.pop() || ''; // Saves incomplete remainder
    expect(events).toHaveLength(0);
    expect(buffer).toBe(packet1);

    // Packet 2 arrives with double-newline delimiter
    buffer += packet2;
    events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr) {
        receivedChunks.push(JSON.parse(jsonStr).content);
      }
    }

    expect(receivedChunks).toEqual(['Part1', 'Part2']);
  });

  it('triggers connection timeout when stream fails to respond within threshold', async () => {
    vi.useFakeTimers();

    const abortController = new AbortController();
    let isTimeoutAbort = false;

    const connectionTimeout = setTimeout(() => {
      isTimeoutAbort = true;
      abortController.abort(new Error('Connection timed out waiting for AI response'));
    }, 20000);

    expect(abortController.signal.aborted).toBe(false);

    // Advance timer past 20s
    vi.advanceTimersByTime(20001);

    expect(isTimeoutAbort).toBe(true);
    expect(abortController.signal.aborted).toBe(true);

    clearTimeout(connectionTimeout);
    vi.useRealTimers();
  });
});
