# Problem 4: Observable Agent Loop

## Context

An incident investigator needs an AI agent that can collect evidence from multiple sources before producing an answer. A single model response is not sufficient: the system must control tool execution, expose what happened, handle failures, and stop safely.

Caygnus works on AI harnesses for agents that can run locally and be deployed in cloud environments. For this exercise, only local execution is required; explain how you would preserve the agent's behavior when running it remotely.

## Your objective

Build a small, observable agent loop that receives an investigation question and chooses between at least two tools backed by synthetic or mocked data.

Example tools include:

- Searching application logs
- Looking up service metrics
- Reading service status
- Searching a small knowledge base

You may define a different incident domain and tool set if it demonstrates the same capabilities.

## Required behavior

Your agent must support:

1. Receiving an investigation objective from a user
2. Selecting an appropriate tool with structured input
3. Returning the tool result to the loop
4. Performing more than one tool step when the objective requires it
5. Producing a final response grounded in collected tool evidence
6. Exposing an ordered trace of model decisions, tool calls, tool results, errors, and the final response
7. Handling at least one tool failure deliberately
8. Stopping when a configurable step or usage limit is reached

A CLI or basic interface is sufficient. Tools may read static fixtures or call local mock services.

## Acceptance scenarios

### AC1: Appropriate tool selection

**Given** an objective whose answer exists in one available data source  
**When** the agent runs  
**Then** it calls an appropriate tool with valid structured input and uses the returned evidence

### AC2: Multi-step investigation

**Given** an objective requiring evidence from at least two sources  
**When** the agent runs  
**Then** it performs multiple tool calls and combines their results into the final response

### AC3: Observable trace

**Given** an agent run has completed  
**When** the reviewer inspects the trace  
**Then** tool inputs, tool outputs, errors, and the final response are distinguishable and ordered

Do not expose hidden chain-of-thought. The trace should contain operational events and concise model-visible summaries needed to understand execution.

### AC4: Tool failure

**Given** one selected tool returns an error or malformed result  
**When** the agent encounters that failure  
**Then** the failure is visible and the agent either recovers or stops with a clear explanation

### AC5: Execution limit

**Given** the agent cannot reach a final answer before its configured limit  
**When** that limit is reached  
**Then** the loop stops without another model or tool call and reports why it stopped

### AC6: Evidence and conclusions

**Given** the agent produces a final investigation response  
**When** the reviewer reads it  
**Then** evidence returned by tools can be distinguished from the agent's conclusions or recommendations

## Required tests

Include focused automated tests for:

- Tool registration, selection, or argument validation
- A multi-step loop using a deterministic fake model or scripted responses
- Tool failure handling
- Enforcement of the configured execution limit

Automated tests must not require a paid model API. You may use a fake model adapter, recorded response, or local deterministic substitute.

## Demo checklist

In the demo video, show:

1. The available tools and synthetic data
2. An objective requiring more than one tool
3. The ordered execution trace
4. A tool failure and its handling
5. A run stopped by the configured limit
6. The final evidence-linked response

## Decisions you must document

- How models and tools are represented behind interfaces
- How tool arguments and results are validated
- What state is retained between loop steps
- How limits are enforced
- How logs or traces avoid exposing secrets
- How the same harness could run remotely without changing core agent behavior

## Out of scope

- A complex multi-agent system
- Cloud deployment
- Production observability infrastructure
- Access to real company data or systems
- Long-term memory or semantic search infrastructure
- A polished chat interface
- Evaluation across a large benchmark dataset

Model-provider portability, durable resumable execution, human approval steps, and parallel tool calls are optional. Implement them only if the required loop is already clear and reliable.

## What reviewers will pay attention to

- A real control loop rather than one hard-coded sequence or a single prompt
- Clear separation between model, tools, orchestration, and presentation
- Structured validation at the model/tool boundary
- Deterministic tests that do not depend on live model behavior
- Explicit termination conditions and bounded execution
- Useful operational traces without hidden reasoning or secrets
- Honest distinction between evidence and inference

## Questions to address in `SUBMISSION.md`

- What prevents the agent from calling tools indefinitely?
- How would you add a consequential tool requiring human approval?
- How would you run concurrent agent jobs in a cloud environment?
- Which run data would you persist for debugging, cost analysis, and evaluation?
