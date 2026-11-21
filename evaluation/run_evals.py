import asyncio
import json
from collections import Counter
from pathlib import Path
from time import perf_counter

from agents.supervisor import SupervisorAgent


async def evaluate() -> bool:
    """Check the labeled demo cases without external telemetry or shared fleet state."""
    dataset = Path(__file__).with_name("datasets") / "ground_truth.json"
    cases = json.loads(dataset.read_text(encoding="utf-8"))
    supervisor = SupervisorAgent()
    matched = Counter()
    elapsed_ms = []
    for case in cases:
        start = perf_counter()
        result = await supervisor.process_call(case["transcript"])
        elapsed_ms.append((perf_counter() - start) * 1000)
        actual = {
            "category": result["incident_type"]["category"],
            "priority": result["priority"],
            "location": result["location"]["source"],
            "dispatch": result["dispatch_status"],
        }
        failures = []
        for name, expected in case["expected"].items():
            if actual[name] == expected:
                matched[name] += 1
            else:
                failures.append(f"{name}: expected {expected}, got {actual[name]}")
        print(f"{case['name']} — {', '.join(failures) if failures else 'PASS'}")
        await supervisor.dispatch.release_resources(result["incident_id"])
        supervisor.dedup.forget(result["incident_id"])

    print(f"Results ({len(cases)} labeled simulation cases)")
    for name in ("category", "priority", "location", "dispatch"):
        print(f"  {name:<10} {matched[name]}/{len(cases)}")
    elapsed_ms.sort()
    print(f"  latency    median {elapsed_ms[len(elapsed_ms) // 2]:.1f} ms, max {elapsed_ms[-1]:.1f} ms")
    return all(matched[field] == len(cases) for field in ("category", "priority", "location", "dispatch"))


if __name__ == "__main__":
    raise SystemExit(0 if asyncio.run(evaluate()) else 1)
