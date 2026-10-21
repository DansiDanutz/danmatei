/**
 * Self-hosted audio worklets for the ElevenLabs voice SDK.
 *
 * By default the SDK loads its worklets from blob:/data: URLs and a resampler
 * from cdn.jsdelivr.net, all of which the site's CSP (`script-src 'self'`)
 * blocks — the call would fail to start. Importing them with `?url` makes
 * Vite emit them as same-origin assets that match the installed SDK version.
 * `no-inline` stops Vite from turning small files back into data: URLs.
 */
import rawAudioProcessor from "@elevenlabs/client/worklets/rawAudioProcessor.js?url&no-inline";
import audioConcatProcessor from "@elevenlabs/client/worklets/audioConcatProcessor.js?url&no-inline";
import libsampleratePath from "@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js?url&no-inline";

export const ELEVENLABS_AUDIO_ASSETS = {
  workletPaths: { rawAudioProcessor, audioConcatProcessor },
  libsampleratePath,
};
