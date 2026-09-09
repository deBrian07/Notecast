import asyncio
import time
from pathlib import Path
from typing import Dict, List, Tuple

import edge_tts
from pydub import AudioSegment

from core.config import settings


def _parse_script(script: str) -> List[Tuple[str, str, str]]:
    segments: List[Tuple[str, str, str]] = []
    for raw in script.splitlines():
        line = raw.strip()
        if line.startswith("Host A:"):
            segments.append(("female", line.split(":", 1)[1].strip(), line))
        elif line.startswith("Host B:"):
            segments.append(("male", line.split(":", 1)[1].strip(), line))
        elif line:
            segments.append(("narrative", line, line))

    if not segments and script.strip():
        chunks = [script.strip()[i:i + 400] for i in range(0, len(script.strip()), 400)]
        segments = [("female", chunk, chunk) for chunk in chunks if chunk.strip()]

    return segments


async def _synthesize_line(text: str, voice: str, dest: Path) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(dest))


def synthesize_podcast_audio(user_id: int, doc_id: int, script: str) -> Tuple[str, float, List[Dict]]:
    segments = _parse_script(script)
    if not segments:
        raise ValueError("No text segments found to synthesize")

    def _edge_voice(name: str, fallback: str) -> str:
        if name and ("Neural" in name or name.count("-") >= 2):
            return name
        return fallback

    female_voice = _edge_voice(settings.tts_voice_female, "en-US-AriaNeural")
    male_voice = _edge_voice(settings.tts_voice_male, "en-US-GuyNeural")

    user_dir = Path(settings.podcast_dir) / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    work_dir = user_dir / f"tmp_{doc_id}_{int(time.time())}"
    work_dir.mkdir(parents=True, exist_ok=True)

    audio_chunks: List[AudioSegment] = []
    segment_timings: List[Dict] = []
    current_time = 0.0

    async def _run() -> None:
        nonlocal current_time
        for i, (speaker, text, original_line) in enumerate(segments):
            if speaker == "narrative" or not text.strip():
                segment_timings.append({
                    "index": i,
                    "text": original_line,
                    "speaker": "narrative",
                    "start_time": current_time,
                    "end_time": current_time,
                    "duration": 0.0,
                })
                continue

            voice = female_voice if speaker == "female" else male_voice
            part_path = work_dir / f"{i:04d}.mp3"
            await _synthesize_line(text, voice, part_path)
            chunk = AudioSegment.from_file(str(part_path))
            audio_chunks.append(chunk)

            duration = len(chunk) / 1000.0
            segment_timings.append({
                "index": i,
                "text": original_line,
                "speaker": speaker,
                "start_time": current_time,
                "end_time": current_time + duration,
                "duration": duration,
            })
            current_time += duration
            if i < len(segments) - 1:
                current_time += 0.5

    asyncio.run(_run())

    if not audio_chunks:
        raise RuntimeError("No audio chunks were generated")

    podcast = audio_chunks[0]
    for chunk in audio_chunks[1:]:
        podcast += AudioSegment.silent(duration=500) + chunk

    filepath = user_dir / f"{doc_id}_{int(time.time())}.mp3"
    podcast.export(str(filepath), format="mp3", bitrate="192k")

    for leftover in work_dir.glob("*"):
        leftover.unlink(missing_ok=True)
    work_dir.rmdir()

    segment_timings.sort(key=lambda item: item["index"])
    return str(filepath), len(podcast) / 1000.0, segment_timings
