# AEGIS: Automated Emergency Generation & Intelligent System

AEGIS is a state-of-the-art multi-agent orchestration platform designed to automate and optimize emergency response workflows. By leveraging advanced agentic AI architectures, AEGIS processes emergency call transcripts, extracts critical incident data, prevents redundant dispatches, and coordinates resource allocation in real-time.

## Project Overview

AEGIS addresses the complexities of emergency dispatch by implementing a decentralized swarm of specialized AI agents. The system transforms raw unstructured data (such as emergency call transcripts) into actionable intelligence, ensuring that life-saving resources are deployed with maximum efficiency and minimum human error.

## Core Features

- **Agentic Orchestration**: Managed by LangGraph, the system utilizes a directed acyclic graph (DAG) to route data through specialized agents.
- **Observability**: Integrated with LangSmith for real-time tracing, debugging, and performance monitoring of agentic workflows.
- **Semantic Deduplication**: Prevents redundant dispatching by identifying duplicate reports of the same incident using semantic similarity and geographic proximity.
- **Intelligent Triage**: Automatically prioritizes incidents (P1 to P4) based on severity, victim count, and distress signals.
- **Dynamic Resource Allocation**: Matches incidents with appropriate emergency services (Ambulance, Fire, Police) and calculates real-time ETA.
- **Simulation Suite**: Includes a robust simulation engine to test system performance under various conditions, including disaster scenarios and high-volume traffic.
- **Multilingual Support**: Capable of processing emergency reports in multiple languages (e.g., English, Hindi) by leveraging advanced NLP models.
- **Incident Visualization**: A modern React-based dashboard providing real-time views of active incidents, agent processing trails, and resource status.

## System Architecture

The AEGIS backend is built on a multi-agent swarm architecture where each agent has a specific domain of expertise:

1.  **Ingestion Agent**: Normalizes incoming data streams and prepares them for processing.
2.  **Parsing Agent**: Extracts key entities, locations, and intents from raw text using Large Language Models.
3.  **Deduplication Agent**: Analyzes incoming reports against active incidents to identify overlaps and prevent double-dispatch.
4.  **Validation Agent**: Assesses the completeness and confidence of the extracted data, triggering callbacks if critical information is missing.
5.  **Triage Agent**: Conducts severity assessment and assigns response priorities.
6.  **Dispatch Agent**: Coordinates with resource management systems to assign personnel and equipment.
7.  **Supervisor Agent**: The orchestrator that manages the state transitions and workflow execution across the graph.

## Technical Stack

### Backend
- **Framework**: FastAPI
- **Agent Orchestration**: LangGraph, LangChain
- **AI Models**: Google Gemini (via LangChain Google GenAI)
- **Natural Language Processing**: Sentence-Transformers
- **Spatial Logic**: GeoPy, NetworkX
- **Data Validation**: Pydantic

### Frontend
- **Framework**: React (Vite)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks and Context API

## Project Structure

```text
AEGIS/
├── agents/             # Core logic for specialized AI agents
├── api/                # FastAPI application and endpoints
├── config/             # System configuration and environment settings
├── portal/             # React-based frontend dashboard
├── simulation/         # Scenario generators for testing and demos
├── state/              # LangGraph state schemas and persistence
├── routing/            # Resource routing and spatial logic
├── tests/              # Comprehensive test suite for agents and system
├── docker-compose.yml  # Containerization configuration
└── requirements.txt    # Python dependencies
```

## Setup and Installation

### Prerequisites
- Python 3.9+
- Node.js 18+
- Google Gemini API Key

### Backend Setup
1.  Navigate to the root directory.
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure environment variables in a `.env` file:
    ```text
    GOOGLE_API_KEY=your_api_key_here
    CORS_ORIGINS=http://localhost:5173
    ```
5.  Start the API server:
    ```bash
    python api/main.py
    ```

### Frontend Setup
1.  Navigate to the `portal` directory:
    ```bash
    cd portal
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Testing

The system includes a suite of tests to ensure agent reliability and system integrity.

- **Run all tests**:
  ```bash
  pytest
  ```
- **Run specific agent tests**:
  ```bash
  pytest tests/test_agents.py
  ```

## Simulation Scenarios

AEGIS can be tested using the built-in simulation engine. Scenarios include:
- `normal`: Standard incident load.
- `flood`: Disaster scenario with high-volume, localized incidents.
- `prank`: Evaluates the system's ability to identify and filter non-emergency calls.

These can be triggered via the `/api/v1/simulation/run` endpoint.

## Evaluation

AEGIS includes a quantitative evaluation framework to measure agent performance across different metrics:
- **Triage Accuracy**: Correctness of priority assignment.
- **Extraction Recall**: Ability to capture all critical incident entities.
- **Deduplication Precision**: Accuracy in identifying redundant calls.

To run the evaluation suite:
```bash
python evaluation/run_evals.py
```

## Deployment

The system is ready for cloud deployment using the provided `docker-compose.yml` or via **Render** using the `render.yaml` specification.

### Docker Deployment
```bash
docker-compose up --build
```