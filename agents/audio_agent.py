import os
import shutil
import tempfile
import wave
import logging

try:
    import numpy as np
    import whisper
except ImportError:
    whisper = None

logger = logging.getLogger(__name__)

class AudioIngestionAgent:
    """Handles offline audio transcription using OpenAI Whisper."""
    
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.has_ffmpeg = shutil.which("ffmpeg") is not None
        
        # We load the model lazily or at startup
        if whisper is not None:
            try:
                # 'small' model is ~244MB and supports Hindi
                logger.info("Loading Whisper small model...")
                self.model = whisper.load_model("small")
                self.is_loaded = True
                logger.info("Whisper model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}")

    def _decode_audio_native(self, file_path: str):
        """
        Fallback decoder using native Python 'wave' module.
        Requires the input file to be a 16kHz, 16-bit Mono WAV file.
        Used when ffmpeg is not installed on the system.
        """
        try:
            with wave.open(file_path, "rb") as w:
                if w.getnchannels() != 1:
                    raise ValueError("Audio must be mono.")
                if w.getframerate() != 16000:
                    raise ValueError(f"Audio must be 16kHz. Found {w.getframerate()}Hz.")
                if w.getsampwidth() != 2:
                    raise ValueError("Audio must be 16-bit.")
                
                frames = w.readframes(w.getnframes())
                audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
                return audio
        except Exception as e:
            logger.error(f"Native audio decode failed: {e}")
            raise RuntimeError(f"Native audio decode failed. Ensure the file is a 16kHz Mono 16-bit WAV, or install ffmpeg. Error: {e}")

    def transcribe(self, audio_bytes: bytes, file_format: str = "wav") -> dict:
        """Transcribes audio bytes and returns text, language, and confidence."""
        if not self.is_loaded:
            return {
                "transcript": "[Audio transcription unavailable - Whisper model not loaded]",
                "language_detected": "unknown",
                "confidence": 0.0,
                "duration_seconds": 0.0
            }

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=f".{file_format}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            audio_input = tmp_path
            
            if not self.has_ffmpeg:
                if file_format.lower() != "wav":
                    raise ValueError("Without ffmpeg installed, only 16kHz Mono WAV files are supported.")
                audio_input = self._decode_audio_native(tmp_path)

            result = self.model.transcribe(audio_input, fp16=False)
            segments = result.get("segments", [])
            confidence = 0.0
            duration = 0.0
            if segments:
                avg_logprob = sum(segment.get("avg_logprob", -1.0) for segment in segments) / len(segments)
                confidence = float(np.clip(np.exp(avg_logprob), 0.0, 1.0))
                duration = segments[-1].get("end", 0.0)

            return {
                "transcript": result.get("text", "").strip(),
                "language_detected": result.get("language", "unknown"),
                "confidence": round(confidence, 2),
                "duration_seconds": round(duration, 1)
            }
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "transcript": f"[Transcription Error: {str(e)}]",
                "language_detected": "unknown",
                "confidence": 0.0,
                "duration_seconds": 0.0
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
