"""
Multi-agent system for LinguaCompanion.

Agents:
- orchestrator  : routes input, assembles response, streams to client
- stt           : Groq Whisper — multilingual transcription
- reconstruction: grammar correction + code-switching fix
- phrase_variants: 5 stylistic variants simultaneously
- companion     : dialogue with personality/style modes
- memory        : async RAG — interests, vocab gaps, history
- topic_discovery: Celery task — fetches HN/Reddit, generates prompts
- pronunciation : Phase 2 — Azure Speech SDK
- analytics     : passive aggregator — speed, vocab, grammar trends
"""
