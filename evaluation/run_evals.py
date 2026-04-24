from langsmith import Client
from agents.supervisor import SupervisorAgent
import json
import asyncio

class AEGISEvaluator:
    """
    Runs comprehensive evaluations on AEGIS
    """
    
    def __init__(self):
        self.supervisor = SupervisorAgent()
        self.langsmith = Client()
        
        # Load ground truth dataset
        with open("evaluation/datasets/ground_truth.json") as f:
            self.ground_truth = json.load(f)
    
    async def evaluate_triage_accuracy(self):
        """
        Metric: % of correct priority classifications
        """
        correct = 0
        total = len(self.ground_truth)
        
        for incident in self.ground_truth:
            result = await self.supervisor.process_call(incident["transcript"])
            
            if result["priority"] == incident["true_priority"]:
                correct += 1
        
        accuracy = (correct / total) * 100
        print(f"Triage Accuracy: {accuracy:.2f}%")
        return accuracy
    
    async def evaluate_dispatch_latency(self):
        """
        Metric: P50 and P99 dispatch latency
        """
        latencies = []
        
        for incident in self.ground_truth[:50]:
            import time
            start = time.time()
            
            result = await self.supervisor.process_call(incident["transcript"])
            
            latency = time.time() - start
            latencies.append(latency)
        
        latencies.sort()
        p50 = latencies[len(latencies) // 2]
        p99 = latencies[int(len(latencies) * 0.99)]
        
        print(f"Dispatch Latency P50: {p50:.2f}s, P99: {p99:.2f}s")
        return {"p50": p50, "p99": p99}
    
    async def run_full_evaluation(self):
        """
        Execute all evaluation metrics
        """
        print("=== AEGIS Evaluation Suite ===\n")
        
        triage_acc = await self.evaluate_triage_accuracy()
        latency = await self.evaluate_dispatch_latency()
        
        # Log to LangSmith
        self.langsmith.create_example(
            inputs={"evaluation_type": "full_system"},
            outputs={
                "triage_accuracy": triage_acc,
                "latency_p50": latency["p50"],
                "latency_p99": latency["p99"]
            },
            dataset_name="aegis-evaluation-results"
        )

if __name__ == "__main__":
    evaluator = AEGISEvaluator()
    asyncio.run(evaluator.run_full_evaluation())