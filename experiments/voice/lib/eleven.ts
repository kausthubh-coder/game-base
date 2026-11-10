// ElevenLabs over plain fetch, for the server and the tools only. The key comes from
// ELEVENLABS_API_KEY (Bun loads .env.local), and never reaches the browser.
const API = 'https://api.elevenlabs.io';

export function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Put it in .env.local (see experiments/voice/README.md).');
  return key;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'xi-api-key': apiKey(), 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`ElevenLabs ${path.split('?')[0]} ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res;
}

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

export interface SpeakOptions {
  voiceId: string;
  text: string;
  modelId: string;
  settings?: VoiceSettings;
  /** codec_samplerate[_bitrate], e.g. mp3_44100_128 or pcm_24000. */
  format?: string;
  previousText?: string;
  nextText?: string;
  seed?: number;
}

const body = (o: SpeakOptions) =>
  JSON.stringify({
    text: o.text,
    model_id: o.modelId,
    ...(o.settings && { voice_settings: o.settings }),
    ...(o.previousText && { previous_text: o.previousText }),
    ...(o.nextText && { next_text: o.nextText }),
    ...(o.seed !== undefined && { seed: o.seed }),
  });

/** The characters of the line, each with the second it starts and ends at. */
export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** One whole line with its timing per character, for the made-ahead dialogue. */
export async function speakWithTimestamps(o: SpeakOptions): Promise<{ audio: Uint8Array; alignment: Alignment | null; normalized: Alignment | null }> {
  const res = await call(`/v1/text-to-speech/${o.voiceId}/with-timestamps?output_format=${o.format ?? 'mp3_44100_128'}`, { method: 'POST', body: body(o) });
  const j = (await res.json()) as { audio_base64: string; alignment: Alignment | null; normalized_alignment: Alignment | null };
  return { audio: Uint8Array.from(Buffer.from(j.audio_base64, 'base64')), alignment: j.alignment, normalized: j.normalized_alignment };
}

/** Streams a line as it is made. The body is the audio, in `format`. */
export async function speakStream(o: SpeakOptions, signal?: AbortSignal): Promise<Response> {
  return call(`/v1/text-to-speech/${o.voiceId}/stream?output_format=${o.format ?? 'mp3_44100_128'}`, { method: 'POST', body: body(o), signal });
}

export interface DesignPreview {
  audio_base_64: string;
  generated_voice_id: string;
  media_type: string;
  duration_secs: number;
}

/** Voice Design: three previews of a voice made from a description, saying `text`. */
export async function designVoice(description: string, text: string, opts: { seed?: number; guidance?: number; loudness?: number } = {}): Promise<{ previews: DesignPreview[]; text: string }> {
  const res = await call('/v1/text-to-voice/design?output_format=mp3_44100_128', {
    method: 'POST',
    body: JSON.stringify({
      voice_description: description,
      model_id: 'eleven_ttv_v3',
      text,
      auto_generate_text: false,
      should_enhance: false,
      ...(opts.seed !== undefined && { seed: opts.seed }),
      ...(opts.guidance !== undefined && { guidance_scale: opts.guidance }),
      ...(opts.loudness !== undefined && { loudness: opts.loudness }),
    }),
  });
  return (await res.json()) as { previews: DesignPreview[]; text: string };
}

/** Saves a designed preview as a voice on the account. Returns its voice id. */
export async function saveDesignedVoice(name: string, description: string, generatedVoiceId: string): Promise<string> {
  const res = await call('/v1/text-to-voice', {
    method: 'POST',
    body: JSON.stringify({ voice_name: name, voice_description: description, generated_voice_id: generatedVoiceId, labels: { project: 'greenhollow-voice-exp' } }),
  });
  return ((await res.json()) as { voice_id: string }).voice_id;
}

/** Characters used this billing period, and the limit. */
export async function usage(): Promise<{ used: number; limit: number }> {
  const j = (await (await call('/v1/user/subscription')).json()) as { character_count: number; character_limit: number };
  return { used: j.character_count, limit: j.character_limit };
}

/** Speech to text (Scribe). `audio` is any common audio file. */
export async function transcribe(audio: Blob, modelId = 'scribe_v1'): Promise<{ text: string }> {
  const form = new FormData();
  form.append('model_id', modelId);
  form.append('file', audio, 'speech.webm');
  form.append('language_code', 'en');
  const res = await fetch(API + '/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': apiKey() }, body: form });
  if (!res.ok) throw new Error(`ElevenLabs speech-to-text ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { text: string };
}
