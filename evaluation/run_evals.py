import asyncio
import json
from pathlib import Path

from agents.supervisor import SupervisorAgent

try:
    from langsmith import Client
except ImportError:  # pragma: no cover - optional dependency
    Client = None


class AEGISEvaluator:
    """Runs evaluations against a ground-truth dataset when one is available."""

    def __init__(self):
        self.supervisor = SupervisorAgent()
        self.langsmith = Client() if Client is not None else None
        self.dataset_path = Path("evaluation/datasets/ground_truth.json")
        self.ground_truth = self.load_ground_truth()

    def load_ground_truth(self):
        if not self.dataset_path.exists():
            return []
        with self.dataset_path.open() as handle:
            return json.load(handle)

    async def evaluate_triage_accuracy(self):
        if not self.ground_truth:
            print("No evaluation dataset found at evaluation/datasets/ground_truth.json")
            return None

        correct = 0
        for incident in self.ground_truth:
            result = await self.supervisor.process_call(incident["transcript"])
            if result["priority"] == incident["true_priority"]:
                correct += 1

        accuracy = (correct / len(self.ground_truth)) * 100
        print(f"Triage Accuracy: {accuracy:.2f}%")
        return accuracy

    async def evaluate_dispatch_latency(self):
        if not self.ground_truth:
            return None

        latencies = []
        for incident in self.ground_truth[:50]:
            import time

            start = time.time()
            await self.supervisor.process_call(incident["transcript"])
            latencies.append(time.time() - start)

        latencies.sort()
        p50 = latencies[len(latencies) // 2]
        p99 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.99))]
        print(f"Dispatch Latency P50: {p50:.2f}s, P99: {p99:.2f}s")
        return {"p50": p50, "p99": p99}

    async def run_full_evaluation(self):
        print("=== AEGIS Evaluation Suite ===\n")
        triage_acc = await self.evaluate_triage_accuracy()
        latency = await self.evaluate_dispatch_latency()

        if self.langsmith is not None and triage_acc is not None and latency is not None:
            self.langsmith.create_example(
                inputs={"evaluation_type": "full_system"},
                outputs={
                    "triage_accuracy": triage_acc,
                    "latency_p50": latency["p50"],
                    "latency_p99": latency["p99"],
                },
                dataset_name="aegis-evaluation-results",
            )


if __name__ == "__main__":
    evaluator = AEGISEvaluator()
    asyncio.run(evaluator.run_full_evaluation())
