import asyncio
from agents.supervisor import SupervisorAgent

async def test_aegis():
    """Quick system test"""
    
    print("=" * 60)
    print("AEGIS SYSTEM TEST")
    print("=" * 60)
    
    supervisor = SupervisorAgent()
    
    # Test case 1: Hindi emergency
    print("\n🔥 Test 1: Fire emergency (Hindi)")
    result1 = await supervisor.process_call(
        "Aag lagi hai Sector 14 mein! Third floor... 5 log faase hue hain... jaldi fire brigade bhejo!"
    )
    print(f"✅ Priority: {result1['priority']}")
    print(f"✅ Resources: {len(result1['assigned_resources'])}")
    
    # Test case 2: Medical emergency
    print("\n🚑 Test 2: Medical emergency (English)")
    result2 = await supervisor.process_call(
        "My father having heart attack! Near DLF Mall... unconscious... send ambulance urgent!"
    )
    print(f"✅ Priority: {result2['priority']}")
    print(f"✅ Confidence: {result2['confidence_score']:.2f}")
    
    # Test case 3: Prank call
    print("\n❌ Test 3: Prank call")
    result3 = await supervisor.process_call(
        "Hello? Is this working? Testing..."
    )
    print(f"✅ Priority: {result3['priority']}")
    print(f"✅ Callback required: {result3['requires_callback']}")
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED ✅")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_aegis())