import os
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Tuple, Dict
import textwrap
import re

import numpy as np
import torch
from pydub import AudioSegment
from concurrent.futures import ThreadPoolExecutor
import nemo.collections.tts as nemo_tts
from nemo.collections.tts.models import VitsModel, FastPitchModel, HifiGanModel
from scipy.io import wavfile

from core.config import settings

# ---------------------------------------------------------------------------
# Global TTS instances per GPU device
# ---------------------------------------------------------------------------
_tts_global: Dict[str, Dict[str, any]] = {}

# Standard sample rate for NeMo TTS models
NEMO_SAMPLE_RATE = 44100  # Correct sample rate based on model configs

def _get_vits_model(device_str: str = "cuda:0") -> VitsModel:
    """
    Return a VITS model pinned to the given CUDA device.
    VITS is an end-to-end model that produces more natural speech.
    """
    # Temporarily disable VITS to test if it's causing alien sounds
    print(f"[TTS] VITS temporarily disabled for debugging - using FastPitch fallback")
    return None
    
    global _tts_global
    if device_str not in _tts_global:
        _tts_global[device_str] = {}
    
    if "vits" not in _tts_global[device_str]:
        # Load VITS model - this is end-to-end and produces more natural speech
        dev = torch.device(device_str)
        try:
            # Try to load the multispeaker VITS model first (better quality)
            vits_model = VitsModel.from_pretrained("tts_en_hifitts_vits").to(dev).eval()
            print(f"[TTS] Loaded HiFiTTS VITS model on {device_str}")
        except Exception as e:
            print(f"[TTS] Failed to load HiFiTTS VITS model: {e}")
            try:
                # Fallback to single speaker VITS model
                vits_model = VitsModel.from_pretrained("tts_en_lj_vits").to(dev).eval()
                print(f"[TTS] Loaded LJSpeech VITS model on {device_str}")
            except Exception as e2:
                print(f"[TTS] Failed to load VITS models: {e2}")
                # Fallback to FastPitch + HiFiGAN if VITS fails
                return None
        
        _tts_global[device_str]["vits"] = vits_model
    
    return _tts_global[device_str]["vits"]

def _get_fastpitch_hifigan(device_str: str = "cuda:0") -> Tuple[FastPitchModel, HifiGanModel]:
    """
    Fallback to FastPitch + HiFiGAN if VITS is not available.
    """
    global _tts_global
    if device_str not in _tts_global:
        _tts_global[device_str] = {}
    
    if "fastpitch_hifigan" not in _tts_global[device_str]:
        dev = torch.device(device_str)
        
        try:
            # Try to load the multispeaker model first
            fastpitch = FastPitchModel.from_pretrained("tts_en_fastpitch_multispeaker").to(dev).eval()
            print(f"[TTS] Loaded FastPitch multispeaker model on {device_str}")
        except Exception as e:
            print(f"[TTS] Failed to load multispeaker FastPitch: {e}")
            try:
                # Fallback to single speaker model
                fastpitch = FastPitchModel.from_pretrained("tts_en_fastpitch").to(dev).eval()
                print(f"[TTS] Loaded FastPitch single speaker model on {device_str}")
            except Exception as e2:
                print(f"[TTS] Failed to load any FastPitch model: {e2}")
                raise RuntimeError(f"Could not load any FastPitch model: {e2}")
        
        try:
            # Try to load the HiFiTTS HiFiGAN model
            hifigan = HifiGanModel.from_pretrained("tts_en_hifitts_hifigan_ft_fastpitch").to(dev).eval()
            print(f"[TTS] Loaded HiFiTTS HiFiGAN model on {device_str}")
        except Exception as e:
            print(f"[TTS] Failed to load HiFiTTS HiFiGAN: {e}")
            try:
                # Fallback to standard HiFiGAN
                hifigan = HifiGanModel.from_pretrained("tts_en_hifigan").to(dev).eval()
                print(f"[TTS] Loaded standard HiFiGAN model on {device_str}")
            except Exception as e2:
                print(f"[TTS] Failed to load any HiFiGAN model: {e2}")
                raise RuntimeError(f"Could not load any HiFiGAN model: {e2}")
        
        _tts_global[device_str]["fastpitch_hifigan"] = (fastpitch, hifigan)
    
    return _tts_global[device_str]["fastpitch_hifigan"]

# Ensure pydub knows where ffmpeg is
AudioSegment.converter = AudioSegment.converter or "/usr/bin/ffmpeg"

# ---------------------------------------------------------------------------
# Helper: synthesize a single line into an AudioSegment using VITS
# ---------------------------------------------------------------------------

def _synthesize_line_vits(voice_preset: str, text: str, device_str: str) -> AudioSegment:
    """
    Synthesize speech using VITS end-to-end model for more natural output.
    """
    print(f"[TTS] VITS synthesis → device: {device_str}, voice: {voice_preset}, text: {text[:100]}...")
    torch.cuda.set_device(torch.device(device_str))
    
    vits_model = _get_vits_model(device_str)
    if vits_model is None:
        # Fallback to FastPitch + HiFiGAN
        return _synthesize_line_fastpitch(voice_preset, text, device_str)
    
    # Prepare temp WAV path
    with NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        wav_path = Path(tmp.name)

    try:
        with torch.no_grad():
            # VITS models can handle longer text better and produce more natural speech
            # Apply text preprocessing for better results
            processed_text = _preprocess_text_for_naturalness(text)
            
            # For VITS, we need to parse the text into tokens first
            try:
                # Parse text to tokens (similar to FastPitch)
                tokens = vits_model.parse(processed_text)
                
                # Check if model supports speaker selection
                if hasattr(vits_model, 'speakers') and vits_model.speakers is not None:
                    # Multi-speaker model
                    speaker_id = _get_speaker_id_for_voice(voice_preset, vits_model)
                    audio = vits_model.convert_text_to_waveform(tokens=tokens, speaker=speaker_id)
                else:
                    # Single speaker model
                    audio = vits_model.convert_text_to_waveform(tokens=tokens)
                    
            except Exception as parse_error:
                print(f"[TTS] VITS token parsing failed: {parse_error}, trying direct text input")
                # Some VITS models might accept direct text
                try:
                    if hasattr(vits_model, 'speakers') and vits_model.speakers is not None:
                        speaker_id = _get_speaker_id_for_voice(voice_preset, vits_model)
                        audio = vits_model.convert_text_to_waveform(text=processed_text, speaker=speaker_id)
                    else:
                        audio = vits_model.convert_text_to_waveform(text=processed_text)
                except Exception as text_error:
                    print(f"[TTS] VITS direct text input also failed: {text_error}")
                    raise parse_error  # Re-raise the original parsing error
            
            # Convert to numpy and ensure proper format
            if isinstance(audio, torch.Tensor):
                audio = audio.cpu().numpy()
            
            # Ensure audio is mono and properly scaled
            if audio.ndim > 1:
                audio = audio.squeeze()
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
            
            # Simple normalization without aggressive clipping
            audio_max = np.abs(audio).max()
            if audio_max > 0:
                audio = audio / audio_max * 0.95  # Scale to 95% to avoid clipping
            
            # Convert to int16 with proper scaling
            audio = (audio * 32767).astype(np.int16)
            
            # Use the model's actual sample rate to avoid speed issues
            # Both FastPitch and HiFiGAN are configured for 44100 Hz
            sample_rate = 44100  # Use the correct sample rate from model configs
            print(f"[TTS] Using sample rate: {sample_rate} Hz")
            wavfile.write(str(wav_path), sample_rate, audio)

    except Exception as e:
        print(f"[TTS] VITS synthesis failed: {e}, falling back to FastPitch")
        wav_path.unlink(missing_ok=True)
        return _synthesize_line_fastpitch(voice_preset, text, device_str)

    # Wait for file to be written
    for _ in range(30):
        if wav_path.exists() and wav_path.stat().st_size > 44:
            break
        time.sleep(1)
    else:
        print(f"[TTS] VITS did not produce WAV file in time, falling back")
        wav_path.unlink(missing_ok=True)
        return _synthesize_line_fastpitch(voice_preset, text, device_str)

    # Load with pydub and add natural pause
    try:
        audio_segment = AudioSegment.from_file(str(wav_path), format="wav")
        wav_path.unlink(missing_ok=True)
        
        # Add more natural pauses based on text content
        pause_duration = _calculate_natural_pause(text)
        return audio_segment + AudioSegment.silent(duration=pause_duration)
    except Exception as e:
        print(f"Error loading VITS WAV file: {e}")
        wav_path.unlink(missing_ok=True)
        return AudioSegment.silent(duration=1000)

def _synthesize_line_fastpitch(voice_preset: str, text: str, device_str: str) -> AudioSegment:
    """
    Fallback synthesis using FastPitch + HiFiGAN (original implementation).
    """
    print(f"[TTS] FastPitch synthesis → device: {device_str}, voice: {voice_preset}, text: {text[:100]}...")
    torch.cuda.set_device(torch.device(device_str))
    fastpitch, hifigan = _get_fastpitch_hifigan(device_str)

    # Prepare temp WAV path
    with NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        wav_path = Path(tmp.name)

    # Generate WAV using FastPitch + HiFiGAN
    with torch.no_grad():
        # Apply text preprocessing
        processed_text = _preprocess_text_for_naturalness(text)
        tokens = fastpitch.parse(processed_text)
        
        # Simple speaker ID mapping - we'll test and adjust these manually
        name = voice_preset.lower()
        if name.startswith("male"):
            speaker_id = 0  # We'll test different IDs to find a good male voice
        elif name.startswith("female"):
            speaker_id = 19  # We'll test different IDs to find a good female voice
        else:
            speaker_id = 19  # Default to female
            
        print(f"[TTS] Using speaker ID {speaker_id} for voice preset '{voice_preset}'")
        
        # Generate mel-spectrogram
        mel_spec = fastpitch.generate_spectrogram(tokens=tokens, speaker=speaker_id)
        
        # Convert to audio using HiFiGAN
        wav = hifigan.convert_spectrogram_to_audio(spec=mel_spec)
        wav = wav.cpu().numpy()
        
        # Process audio with simple, clean normalization
        audio_max = np.abs(wav).max()
        if audio_max > 0:
            wav = wav / audio_max * 0.95  # Scale to 95% to avoid clipping
        
        # Convert to int16
        wav = (wav * 32767).astype(np.int16)
        
        if wav.ndim > 1:
            wav = wav.squeeze()
            if wav.ndim > 1:
                wav = wav.mean(axis=1)
        
        # Use the model's actual sample rate to avoid speed issues
        # Both FastPitch and HiFiGAN are configured for 44100 Hz
        sample_rate = 44100  # Use the correct sample rate from model configs
        print(f"[TTS] Using sample rate: {sample_rate} Hz")
        wavfile.write(str(wav_path), sample_rate, wav)

    # Wait for file
    for _ in range(30):
        if wav_path.exists() and wav_path.stat().st_size > 44:
            break
        time.sleep(1)
    else:
        raise RuntimeError("FastPitch did not produce WAV file in time")

    # Load and return
    try:
        audio_segment = AudioSegment.from_file(str(wav_path), format="wav")
        wav_path.unlink(missing_ok=True)
        pause_duration = _calculate_natural_pause(text)
        return audio_segment + AudioSegment.silent(duration=pause_duration)
    except Exception as e:
        print(f"Error loading FastPitch WAV file: {e}")
        wav_path.unlink(missing_ok=True)
        return AudioSegment.silent(duration=1000)

def _preprocess_text_for_naturalness(text: str) -> str:
    """
    Preprocess text to improve naturalness of speech synthesis.
    """
    # Remove excessive whitespace
    text = " ".join(text.split())
    
    # Handle special characters that cause TTS issues
    # Remove or replace problematic symbols
    text = text.replace("*", "")  # Remove asterisks
    text = text.replace("#", "")  # Remove hash symbols
    text = text.replace("@", "at")  # Replace @ with "at"
    text = text.replace("&", "and")  # Replace & with "and"
    text = text.replace("%", " percent")  # Replace % with "percent"
    text = text.replace("$", " dollars")  # Replace $ with "dollars"
    text = text.replace("€", " euros")  # Replace € with "euros"
    text = text.replace("£", " pounds")  # Replace £ with "pounds"
    
    # Handle mathematical symbols
    text = text.replace("=", " equals ")
    text = text.replace("+", " plus ")
    text = text.replace("×", " times ")
    text = text.replace("÷", " divided by ")
    
    # Handle brackets and parentheses
    text = text.replace("[", " ")
    text = text.replace("]", " ")
    text = text.replace("{", " ")
    text = text.replace("}", " ")
    text = text.replace("(", " ")
    text = text.replace(")", " ")
    
    # Handle quotes and special punctuation
    text = text.replace('"', ' ')
    text = text.replace("'", "'")  # Replace smart quotes with regular apostrophes
    text = text.replace(""", " ")
    text = text.replace(""", " ")
    text = text.replace("'", "'")
    text = text.replace("'", "'")
    
    # Add natural pauses for better phrasing
    # Replace certain punctuation with longer pauses
    text = text.replace(" - ", " ... ")
    text = text.replace("—", " ... ")
    text = text.replace("–", " ... ")
    text = text.replace(";", ", ")
    
    # Handle multiple consecutive punctuation marks
    text = re.sub(r'[.]{2,}', '...', text)  # Multiple dots to ellipsis
    text = re.sub(r'[!]{2,}', '!', text)    # Multiple exclamations to single
    text = re.sub(r'[?]{2,}', '?', text)    # Multiple questions to single
    text = re.sub(r'[,]{2,}', ',', text)    # Multiple commas to single
    
    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text)
    
    # Ensure proper sentence endings
    text = text.strip()
    if text and not text.endswith(('.', '!', '?')):
        text += "."
    
    # Handle abbreviations for better pronunciation
    abbreviations = {
        "Dr.": "Doctor",
        "Mr.": "Mister", 
        "Mrs.": "Missus",
        "Ms.": "Miss",
        "Prof.": "Professor",
        "etc.": "etcetera",
        "vs.": "versus",
        "e.g.": "for example",
        "i.e.": "that is",
        "Inc.": "Incorporated",
        "Corp.": "Corporation",
        "Ltd.": "Limited",
        "Co.": "Company",
        "St.": "Street",
        "Ave.": "Avenue",
        "Blvd.": "Boulevard",
        "Rd.": "Road",
        "U.S.": "United States",
        "U.K.": "United Kingdom",
        "U.N.": "United Nations",
        "CEO": "Chief Executive Officer",
        "CFO": "Chief Financial Officer",
        "CTO": "Chief Technology Officer",
        "AI": "Artificial Intelligence",
        "ML": "Machine Learning",
        "API": "Application Programming Interface",
        "URL": "U R L",
        "HTTP": "H T T P",
        "HTTPS": "H T T P S",
        "HTML": "H T M L",
        "CSS": "C S S",
        "JS": "JavaScript",
        "SQL": "S Q L",
    }
    
    for abbrev, expansion in abbreviations.items():
        text = text.replace(abbrev, expansion)
    
    # Handle numbers and units
    text = re.sub(r'(\d+)%', r'\1 percent', text)
    text = re.sub(r'(\d+)°C', r'\1 degrees Celsius', text)
    text = re.sub(r'(\d+)°F', r'\1 degrees Fahrenheit', text)
    text = re.sub(r'(\d+)km', r'\1 kilometers', text)
    text = re.sub(r'(\d+)kg', r'\1 kilograms', text)
    text = re.sub(r'(\d+)mg', r'\1 milligrams', text)
    text = re.sub(r'(\d+)gb', r'\1 gigabytes', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+)mb', r'\1 megabytes', text, flags=re.IGNORECASE)
    
    return text

def _calculate_natural_pause(text: str) -> int:
    """
    Calculate natural pause duration based on text content.
    """
    # Base pause
    pause = 300
    
    # Longer pause for sentence endings
    if text.strip().endswith(('.', '!', '?')):
        pause += 200
    
    # Shorter pause for commas
    elif text.strip().endswith(','):
        pause = 200
    
    # Very short pause for continuing text
    else:
        pause = 150
    
    return pause

def _get_speaker_id_for_voice(voice_preset: str, model) -> int:
    """
    Map voice preset to speaker ID for multi-speaker models.
    """
    name = voice_preset.lower()
    
    # For HiFiTTS VITS model, we have multiple speakers
    if hasattr(model, 'speakers') and model.speakers is not None:
        num_speakers = len(model.speakers) if hasattr(model.speakers, '__len__') else 10
        
        if name.startswith("male"):
            # Use speakers in the latter half for male voices
            return min(num_speakers - 1, 7)
        elif name.startswith("female"):
            # Use speakers in the first half for female voices  
            return min(num_speakers - 1, 2)
    
    # Default fallback
    return 0

# ---------------------------------------------------------------------------
# Public API: generate a podcast MP3 from a script
# ---------------------------------------------------------------------------

def synthesize_podcast_audio(user_id: int, doc_id: int, script: str) -> Tuple[str, float, List[Dict]]:
    """
    Generate an MP3 podcast using VITS for improved naturalness.
    Falls back to FastPitch + HiFiGAN if VITS is unavailable.
    Returns: (filepath, total_duration, segment_timings)
    """
    print(f"[TTS] Starting synthesis with VITS for improved naturalness (~{len(script)} chars)...")
    print(f"[TTS] Voice presets - Female: '{settings.tts_voice_female}', Male: '{settings.tts_voice_male}'")
    
    # Parse script: extract speaker lines with original text
    segments: List[Tuple[str, str, str]] = []  # (speaker, text, original_line)
    for raw in script.splitlines():
        line = raw.strip()
        if line.startswith("Host A:"):
            text = line.split(":", 1)[1].strip()
            segments.append(("female", text, line))
        elif line.startswith("Host B:"):
            text = line.split(":", 1)[1].strip()
            segments.append(("male", text, line))
        elif line.strip():  # Non-empty narrative lines
            segments.append(("narrative", line, line))

    # Fallback: chunk long summary for single-voice TTS
    if not segments and script.strip():
        raw = script.strip()
        # Use smaller chunks for better naturalness
        chunks = textwrap.wrap(raw, width=200, break_long_words=False, replace_whitespace=False)
        segments = [("female", chunk, chunk) for chunk in chunks]

    if not segments:
        raise ValueError("No text segments found to synthesize")

    # Dispatch synthesis using single GPU to ensure consistent voices
    audio_chunks: List[AudioSegment] = []
    segment_timings: List[Dict] = []
    current_time = 0.0
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = []
        for i, (speaker, text, original_line) in enumerate(segments):
            if speaker == "narrative":
                # Skip narrative lines for audio but track them for timing
                segment_timings.append({
                    "index": i,
                    "text": original_line,
                    "speaker": "narrative",
                    "start_time": current_time,
                    "end_time": current_time,  # No duration for narrative
                    "duration": 0.0
                })
                continue
                
            preset = settings.tts_voice_female if speaker == "female" else settings.tts_voice_male
            device_str = "cuda:0"  # Use same GPU for all synthesis to ensure consistent voices
            print(f"[TTS] Segment {i}: {speaker} speaker using preset '{preset}' on {device_str}")
            # Use VITS for better naturalness
            futures.append((i, speaker, text, original_line, executor.submit(_synthesize_line_vits, preset, text, device_str)))
        
        for i, speaker, text, original_line, fut in futures:
            audio_chunk = fut.result()
            audio_chunks.append(audio_chunk)
            
            # Calculate timing for this segment
            chunk_duration = len(audio_chunk) / 1000.0  # Convert ms to seconds
            
            segment_timings.append({
                "index": i,
                "text": original_line,
                "speaker": speaker,
                "start_time": current_time,
                "end_time": current_time + chunk_duration,
                "duration": chunk_duration
            })
            
            current_time += chunk_duration
            
            # Add pause between speakers (except for last segment)
            if i < len([s for s in segments if s[0] != "narrative"]) - 1:
                pause_duration = 0.5  # 500ms pause
                current_time += pause_duration

    # Concatenate all chunks with natural transitions
    if not audio_chunks:
        raise RuntimeError("No audio chunks were generated")
    
    podcast = audio_chunks[0]
    for chunk in audio_chunks[1:]:
        # Add a brief natural pause between speakers
        podcast += AudioSegment.silent(duration=500) + chunk

    # Apply post-processing for better quality
    podcast = _apply_audio_post_processing(podcast)

    # Save to MP3 with higher quality settings
    user_dir = Path(settings.podcast_dir) / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{doc_id}_{int(time.time())}.mp3"
    filepath = user_dir / filename
    
    # Export with higher quality settings
    podcast.export(
        str(filepath), 
        format="mp3",
        bitrate="192k",  # Higher bitrate for better quality
        parameters=["-q:a", "0"]  # Highest quality
    )

    total_duration = len(podcast) / 1000.0
    
    # Sort segment timings by index to maintain order
    segment_timings.sort(key=lambda x: x["index"])
    
    print(f"[TTS] Generated podcast with {len(segment_timings)} segments, total duration: {total_duration:.2f}s")
    for timing in segment_timings:
        print(f"[TTS] Segment {timing['index']}: {timing['start_time']:.2f}s - {timing['end_time']:.2f}s ({timing['speaker']})")

    return str(filepath), total_duration, segment_timings

def _apply_audio_post_processing(audio: AudioSegment) -> AudioSegment:
    """
    Apply minimal post-processing to avoid artifacts while maintaining quality.
    """
    # Simple normalization only - avoid complex processing that can cause artifacts
    audio = audio.normalize()
    
    # Very gentle fade in/out for professional sound (no compression)
    if len(audio) > 1000:  # Only if audio is longer than 1 second
        audio = audio.fade_in(50).fade_out(100)
    
    return audio

def _fine_tune_audio_naturalness(audio: AudioSegment) -> AudioSegment:
    """
    Minimal audio adjustments to avoid artifacts.
    """
    # Remove the frame rate manipulation that was causing alien sounds
    # Just ensure proper volume levels without pitch changes
    
    # Simple volume adjustment if needed
    if audio.dBFS < -30:
        audio = audio + (abs(audio.dBFS + 25))  # Boost very quiet audio
    elif audio.dBFS > -5:
        audio = audio - (audio.dBFS + 10)  # Reduce very loud audio
    
    return audio
