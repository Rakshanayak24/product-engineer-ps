# Problem 1: Offline Mobile Queue

## Context

Field teams sometimes need to report operational incidents from locations with unreliable or unavailable connectivity. Losing a report is unacceptable, but retrying the same report must not create duplicates.

## Your objective

Build a small mobile prototype that allows a user to create an incident while offline and synchronizes it when connectivity returns.

The purpose is to demonstrate mobile state management, local persistence, synchronization, and recovery behavior. This is not a visual-design exercise.

## Minimum incident data

Each incident should contain at least:

- A stable client-generated identifier
- A title or short description
- A severity
- A creation timestamp
- A visible synchronization state

You may add fields when they help your design, but additional form complexity is not rewarded.

## Required behavior

Your prototype must support:

1. Creating an incident while the app is offline
2. Persisting the incident locally
3. Showing whether it is pending, synchronizing, synchronized, or failed
4. Synchronizing pending incidents after connectivity returns
5. Retrying a failed synchronization
6. Preventing retries from creating duplicate server-side incidents

A mocked or minimal backend is acceptable. Document how the reviewer can switch between online, offline, and failing states.

## Acceptance scenarios

### AC1: Offline creation

**Given** the application has no network connectivity  
**When** the user creates a valid incident  
**Then** the incident is saved locally, remains visible, and is marked as pending

### AC2: Local durability

**Given** an incident was created offline  
**When** the application is restarted before synchronization  
**Then** the pending incident remains available with the correct state

### AC3: Successful synchronization

**Given** a pending incident exists  
**When** connectivity becomes available and synchronization runs  
**Then** the backend receives the incident and the local state becomes synchronized

### AC4: Failure and retry

**Given** the backend is unavailable or returns a temporary failure  
**When** synchronization is attempted  
**Then** the incident is not lost, its failed or pending state is visible, and it can be retried

### AC5: Duplicate prevention

**Given** the outcome of a previous synchronization is uncertain  
**When** the same incident is sent again  
**Then** the backend contains only one logical incident for the stable client-generated identifier

## Required tests

Include focused automated tests for:

- Persistence or queue behavior across an offline flow
- A failed synchronization followed by a successful retry
- Duplicate prevention or idempotent handling

You do not need to test framework or operating-system behavior that your code does not own.

## Demo checklist

In the demo video, show:

1. How offline mode is simulated
2. An incident created and retained while offline
3. A failed or interrupted synchronization
4. Connectivity restored and synchronization completed
5. A retry that does not create a duplicate

## Out of scope

- Authentication and user management
- Push notifications
- App-store packaging or deployment
- Background synchronization when the application is terminated
- Image uploads, maps, or location services
- Elaborate UI, animation, or design systems
- A production backend

You may implement an out-of-scope item if it directly supports your design, but it will not earn credit by itself.

## What reviewers will pay attention to

- Separation between UI state, durable queue state, and synchronization logic
- Choice of stable identifiers and duplicate-prevention semantics
- Handling of partial or uncertain failures
- Whether synchronization transitions are explicit and understandable
- Tests around logic that is easy to get wrong
- Simplicity relative to the problem

## Questions to address in `SUBMISSION.md`

- What happens if the app closes during synchronization?
- Where does duplicate prevention belong: client, server, or both?
- How would this design change with thousands of pending incidents?
- What would you monitor in a production version?
