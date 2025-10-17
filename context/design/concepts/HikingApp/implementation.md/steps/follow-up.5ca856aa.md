---
timestamp: 'Thu Oct 16 2025 19:07:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_190755.5d828e6c.md]]'
content_id: 5ca856aa72a74708cbeae3652ea717d308d5d7845735eabdbf6ba36c122d84e0
---

# follow-up: Optional Gemini behaviors

* If spec requires LLM behavior, wire exact calls here:
  * Which methods call `llm.summarize` or `llm.classify`
  * Inputs (stringified minimal context) and expected outputs (primitives)
* Keep calls budget-friendly and easily stubbed/mocked in tests.
