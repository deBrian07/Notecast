import os
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Tuple, Dict
import textwrap

import numpy as np
import torch
from pydub import AudioSegment
from concurrent.futures import ThreadPoolExecutor
import nemo.collections.tts as nemo_tts
from nemo.collections.tts.models import FastPitchModel, HifiGanModel
from scipy.io import wavfile

from core.config import settings

# ---------------------------------------------------------------------------
# Global TTS instances per GPU device
# ---------------------------------------------------------------------------
_tts_global: Dict[str, Tuple[FastPitchModel, HifiGanModel]] = {}

# Standard sample rate for NeMo TTS models
NEMO_SAMPLE_RATE = 44100

def _get_tts(device_str: str = "cuda:0") -> Tuple[FastPitchModel, HifiGanModel]:
    """
    Return a tuple of (FastPitch, HiFiGAN) models pinned to the given CUDA device.
    Instances are cached per device.
    """
    global _tts_global
    if device_str not in _tts_global:
        # 1) pick the torch device
        dev = torch.device(device_str)

        # 2) load & pin both models to that device, in eval mode
        fastpitch = FastPitchModel.from_pretrained("tts_en_fastpitch_multispeaker").to(dev).eval()
        hifigan   = HifiGanModel.from_pretrained("tts_en_hifitts_hifigan_ft_fastpitch").to(dev).eval()
        
        _tts_global[device_str] = (fastpitch, hifigan)
    return _tts_global[device_str]

# Ensure pydub knows where ffmpeg is
AudioSegment.converter = AudioSegment.converter or "/usr/bin/ffmpeg"

# ---------------------------------------------------------------------------
# Helper: synthesize a single line into an AudioSegment
# ---------------------------------------------------------------------------

def _synthesize_line(voice_preset: str, text: str, device_str: str) -> AudioSegment:
    print(f"[TTS] Synthesizing line → device: {device_str}, voice: {voice_preset}, text: {text[:100]}...")
    torch.cuda.set_device(torch.device(device_str))
    fastpitch, hifigan = _get_tts(device_str)

    # Prepare temp WAV path
    with NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        wav_path = Path(tmp.name)

    # Generate WAV using NeMo
    with torch.no_grad():
        # tokenize/normalize your text
        tokens = fastpitch.parse(text)
        
        # Map your preset names to speaker IDs explicitly
        # (female_dainty → 0, male_deep → 1)
        name = voice_preset.lower()
        if name.startswith("male"):
            speaker_id = 16
        elif name.startswith("female"):
            speaker_id = 14
        
        # generate a mel-spectrogram batch
        mel_spec = fastpitch.generate_spectrogram(tokens=tokens, speaker=speaker_id)
        
        # Convert mel spectrogram to audio using HiFiGAN
        wav = hifigan.convert_spectrogram_to_audio(spec=mel_spec)
        wav = wav.cpu().numpy()
        
        # Save as WAV file - ensure format is mono and 16-bit PCM
        # Convert float32 [-1,1] to int16 [-32768,32767]
        wav = np.clip(wav, -1.0, 1.0)
        wav = (wav * 32767).astype(np.int16)
        
        # Ensure wav is mono (1D array)
        if wav.ndim > 1:
            wav = wav.squeeze()  # Remove singleton dimensions
            if wav.ndim > 1:     # If still multi-dimensional, convert to mono
                wav = wav.mean(axis=1)
        
        # Write WAV file with explicit parameters
        wavfile.write(str(wav_path), NEMO_SAMPLE_RATE, wav)

    # Wait up to 30s for file to exist and contain data
    for _ in range(30):
        if wav_path.exists() and wav_path.stat().st_size > 44:
            break
        time.sleep(1)
    else:
        raise RuntimeError("TTS did not produce WAV file in time")

    # Load with pydub and add a short pause
    try:
        audio = AudioSegment.from_file(str(wav_path), format="wav")
        wav_path.unlink(missing_ok=True)
        return audio + AudioSegment.silent(duration=400)
    except Exception as e:
        print(f"Error loading WAV file: {e}")
        # Fall back to a silent audio segment if loading fails
        wav_path.unlink(missing_ok=True)
        return AudioSegment.silent(duration=1000)  # 1 second of silence as fallback

# ---------------------------------------------------------------------------
# Public API: generate a podcast MP3 from a script
# ---------------------------------------------------------------------------

def synthesize_podcast_audio(user_id: int, doc_id: int, script: str) -> Tuple[str, float]:
    print(f"[TTS] Full script (~{len(script)} chars) to synthesize...")
    # Debug log the voice settings
    print(f"[TTS] Voice presets configured - Female: '{settings.tts_voice_female}', Male: '{settings.tts_voice_male}'")
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
            device_str = f"cuda:{i % 2}"
            futures.append(executor.submit(_synthesize_line, preset, text, device_str))
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
