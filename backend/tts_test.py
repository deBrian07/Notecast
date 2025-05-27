import torch
import numpy as np
from pathlib import Path
from nemo.collections.tts.models import FastPitchModel, HifiGanModel
from scipy.io import wavfile

# Set device
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# Load models
print("Loading FastPitch model...")
fastpitch = FastPitchModel.from_pretrained("tts_en_fastpitch_multispeaker").to(device).eval()
print("Loading HifiGAN model...")
hifigan = HifiGanModel.from_pretrained("tts_en_hifitts_hifigan_ft_fastpitch").to(device).eval()

# Sample rate for NeMo models
SAMPLE_RATE = 44100

# Create output directory
output_dir = Path("voice_samples")
output_dir.mkdir(exist_ok=True)

def generate_sample(text, speaker_id, filename):
    print(f"Generating {filename} with speaker_id={speaker_id}...")
    
    with torch.no_grad():
        # Parse text
        tokens = fastpitch.parse(text)
        
        # Generate spectrogram
        mel_spec = fastpitch.generate_spectrogram(tokens=tokens, speaker=speaker_id)
        
        # Convert to audio
        audio = hifigan.convert_spectrogram_to_audio(spec=mel_spec)
        audio = audio.cpu().numpy()
        
        # Convert to int16
        audio = np.clip(audio, -1.0, 1.0)
        audio = (audio * 32767).astype(np.int16)
        
        # Ensure audio is mono
        if audio.ndim > 1:
            audio = audio.squeeze()
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
        
        # Write WAV file
        output_path = output_dir / filename
        wavfile.write(str(output_path), SAMPLE_RATE, audio)
        print(f"Generated {output_path}")
        return output_path

# Test texts
female_text = "This is a test of the female voice. It should sound like a woman speaking with natural intonation and clear pronunciation."
male_text = "This is a test of the male voice. It should sound like a man speaking with natural intonation and clear pronunciation."

# Generate female voice (speaker_id=0)
female_path = generate_sample(female_text, speaker_id=0, filename="female_voice.wav")

# Generate male voice (speaker_id=1)
male_path = generate_sample(male_text, speaker_id=1, filename="male_voice.wav")

print("\nVoice samples generated:")
print(f"Female voice: {female_path}")
print(f"Male voice: {male_path}")

# Generate samples with different speaker IDs to find additional voices
print("\nGenerating samples with different speaker IDs...")
test_text = "This is a voice sample test with different speaker IDs."

for speaker_id in range(1, 21):  # Test a few speaker IDs
    generate_sample(test_text, speaker_id=speaker_id, filename=f"speaker_{speaker_id}.wav")

print("\nDone! Check the voice_samples directory for the generated audio files.")