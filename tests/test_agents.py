import pytest
from agents.parsing_agent import ParsingAgent

@pytest.mark.asyncio
async def test_parsing_agent_hindi():
    agent = ParsingAgent()
    
    state = {
        "normalized_text": "Aag lagi hai Sector 14 mein! 5 log faase hain!",
        "language_code": "hi",
        "agent_trail": [],
        "timestamp": datetime.now()
    }
    
    result = await agent.process(state)
    
    assert result["incident_type"]["category"] == "fire"
    assert result["victim_count"] >= 5
    assert result["location"]["raw_text"] == "Sector 14"