#!/usr/bin/env python3
"""
Simple script to test different speaker IDs for FastPitch multispeaker model.
Run this to hear different voices and pick the best male/female speakers.
"""

import sys
import os
from pathlib import Path

# Add current directory to path so we can import from services
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_speakers():
    """Generate audio samples for different speaker IDs"""
    
    # Create output directory
    output_dir = Path("speaker_samples")
    output_dir.mkdir(exist_ok=True)
    print(f"Saving audio samples to: {output_dir.absolute()}")
    
    # Test text - same for all speakers so you can compare
    test_text = "Hello, I am testing different speaker voices for the podcast system. This should help identify male and female speakers."
    
    print(f"\nTest text: '{test_text}'")
    print("=" * 80)
    
    # We'll test speaker IDs 0-20 to cover most models
    for speaker_id in range(21):
        try:
            # Import here to avoid issues if torch isn't available
            import torch
            from services.tts import _get_fastpitch_hifigan
            from scipy.io import wavfile
            import numpy as np
            
            # Load models (only once)
            if speaker_id == 0:
                device = "cuda:0" if torch.cuda.is_available() else "cpu"
                print(f"Loading models on {device}...")
                fastpitch, hifigan = _get_fastpitch_hifigan(device)
                print("Models loaded successfully!\n")
            
            # Generate audio for this speaker
            with torch.no_grad():
                tokens = fastpitch.parse(test_text)
                mel_spec = fastpitch.generate_spectrogram(tokens=tokens, speaker=speaker_id)
                wav = hifigan.convert_spectrogram_to_audio(spec=mel_spec)
                wav = wav.cpu().numpy()
                
                # Simple processing
                if wav.max() > 0:
                    wav = wav / np.abs(wav).max() * 0.95
                wav = (wav * 32767).astype(np.int16)
                if wav.ndim > 1:
                    wav = wav.squeeze()
                    if wav.ndim > 1:
                        wav = wav.mean(axis=1)
                
                # Save audio file
                output_file = output_dir / f"speaker_{speaker_id:02d}.wav"
                wavfile.write(str(output_file), 44100, wav)
                
                # Calculate some basic stats
                duration = len(wav) / 44100
                rms = np.sqrt(np.mean(wav.astype(float) ** 2))
                
                print(f"Speaker {speaker_id:2d}: ✓ Generated {output_file.name} | Duration: {duration:.2f}s | RMS: {rms:.0f}")
                
        except Exception as e:
            print(f"Speaker {speaker_id:2d}: ✗ Error - {str(e)}")
    
    print("\n" + "=" * 80)
    print("🎵 TESTING COMPLETE!")
    print(f"📁 Audio files saved in: {output_dir.absolute()}")
    print("\n📋 NEXT STEPS:")
    print("1. Listen to all the speaker_XX.wav files")
    print("2. Identify which ones sound clearly MALE vs FEMALE")
    print("3. Pick the best quality voices for each gender")
    print("4. Update the speaker IDs in the TTS code:")
    print("   - Edit backend/services/tts.py")
    print("   - Find the lines with 'speaker_id = 0' and 'speaker_id = 1'")
    print("   - Replace with your chosen speaker IDs")
    print("\n💡 TIP: Look for:")
    print("   - Clear gender distinction (deep male vs higher female)")
    print("   - Good audio quality (no distortion)")
    print("   - Natural-sounding speech")

if __name__ == "__main__":
    try:
        test_speakers()
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("💡 Make sure you're running this from the backend directory")
        print("💡 And that all dependencies are installed")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc() 