import os
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Tuple, Dict
import textwrap

import numpy as np
from pydub import AudioSegment
import torch
from concurrent.futures import ThreadPoolExecutor

# ---------------------------------------------------------------------------
# Import the correct TTS class for any tortoise-tts version
# ---------------------------------------------------------------------------
try:
    # Newer tortoise-tts (>=0.5.x)
    from tortoise.api import TextToSpeech as _TTSClass
except ImportError:
    # Older tortoise-tts (<0.5)
    from tortoise.api import Tortoise as _TTSClass  # type: ignore

from core.config import settings

# ---------------------------------------------------------------------------
# Global TTS instances per GPU device
# ---------------------------------------------------------------------------
_tts_global: Dict[str, _TTSClass] = {}

def _get_tts(device_str: str = "cuda:0") -> _TTSClass:
    """
    Return a TextToSpeech instance pinned to the given CUDA device.
    Instances are cached per device.
    """
    global _tts_global
    if device_str not in _tts_global:
        # Create a new TTS instance
        tts = _TTSClass()
        # Move each internal module to the target device
        dev = torch.device(device_str)
        for name in ("autoregressive", "diffusion", "clvp", "cvvp", "vocoder"):  # sub-modules
            module = getattr(tts, name, None)
            if isinstance(module, torch.nn.Module):
                module.to(dev)
        _tts_global[device_str] = tts
    return _tts_global[device_str]

# Ensure pydub knows where ffmpeg is
AudioSegment.converter = AudioSegment.converter or "/usr/bin/ffmpeg"

# ---------------------------------------------------------------------------
# Helper: synthesize a single line into an AudioSegment
# ---------------------------------------------------------------------------

def _synthesize_line(voice_preset: str, text: str, device_str: str) -> AudioSegment:
    print(f"[TTS] Synthesizing line → device: {device_str}, voice: {voice_preset}, text: {text[:100]}...")
    # Bind to correct CUDA device
    torch.cuda.set_device(torch.device(device_str))
    tts = _get_tts(device_str)

    # Prepare temp WAV path
    with NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        wav_path = Path(tmp.name)

    # Generate WAV: either direct-to-file or in-memory bytes
    if hasattr(tts, "tts_to_file"):
        tts.tts_to_file(
            text=text,
            voice_preset=voice_preset,
            output_path=str(wav_path)
        )
    else:
        try:
            wav_bytes = tts.tts(text, voice_preset=voice_preset)
        except (TypeError, ValueError):
            wav_bytes = tts.tts(text)
        if isinstance(wav_bytes, list):
            wav_bytes = np.concatenate(wav_bytes).tobytes()
        wav_path.write_bytes(wav_bytes)

    # Wait up to 30s for file to exist and contain data
    for _ in range(30):
        if wav_path.exists() and wav_path.stat().st_size > 44:
            break
        time.sleep(1)
    else:
        raise RuntimeError("TTS did not produce WAV file in time")

    # Load with pydub and add a short pause
    audio = AudioSegment.from_wav(str(wav_path))
    wav_path.unlink(missing_ok=True)
    return audio + AudioSegment.silent(duration=400)

# ---------------------------------------------------------------------------
# Public API: generate a podcast MP3 from a script
# ---------------------------------------------------------------------------

def synthesize_podcast_audio(user_id: int, doc_id: int, script: str) -> Tuple[str, float]:
    print(f"[TTS] Full script (~{len(script)} chars) to synthesize...")
    """
    Generate an MP3 podcast and return (file_path, duration_sec).
    This will dispatch up to 2 concurrent synthesis jobs across GPU 0 and GPU 1.
    """
    # Parse script: extract speaker lines
    segments: List[Tuple[str, str]] = []
    for raw in script.splitlines():
        line = raw.strip()
        if line.startswith("Host A:"):
            segments.append(("female", line.split(":", 1)[1].strip()))
        elif line.startswith("Host B:"):
            segments.append(("male", line.split(":", 1)[1].strip()))

    # Fallback: chunk long summary for single-voice TTS
    if not segments and script.strip():
        raw = script.strip()
        chunks = textwrap.wrap(raw, width=300, break_long_words=False, replace_whitespace=False)
        segments = [("female", chunk) for chunk in chunks]

    if not segments:
        raise ValueError("No text segments found to synthesize")

    # Dispatch synthesis in parallel across 2 GPUs
    audio_chunks: List[AudioSegment] = []
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = []
        for i, (speaker, text) in enumerate(segments):
            preset = settings.tts_voice_female if speaker == "female" else settings.tts_voice_male
            # Alternate between GPU 0 and GPU 1
            device_str = f"cuda:{i % 2}"
            futures.append(executor.submit(_synthesize_line, preset, text, device_str))
        # Collect in original order
        for fut in futures:
            audio_chunks.append(fut.result())

    # Concatenate all chunks
    podcast = audio_chunks[0]
    for chunk in audio_chunks[1:]:
        podcast += chunk

    # Save to MP3
    user_dir = Path(settings.podcast_dir) / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{doc_id}_{int(time.time())}.mp3"
    filepath = user_dir / filename
    podcast.export(str(filepath), format="mp3")

    return str(filepath), len(podcast) / 1000.0
