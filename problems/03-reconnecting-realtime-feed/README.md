# Problem 3: Reconnecting Real-Time Feed

## Context

People coordinating an incident need to see new updates without refreshing. Network connections can drop, laptops can sleep, and clients may reconnect after other participants have posted updates.

## Your objective

Build a minimal shared incident feed that supports at least two clients and recovers updates missed during a temporary disconnection.

The purpose is to demonstrate real-time communication, durable event history, reconnection, ordering, and duplicate handling. The client may be a plain webpage or terminal interface.

## Minimum update data

Each update should contain at least:

- A stable update identifier
- An incident or room identifier
- Message content
- A creation timestamp or server-assigned ordering value

One incident room is sufficient, although your design should not accidentally mix updates from different room identifiers.

## Required behavior

Your prototype must support:

1. Connecting two or more clients to the same incident feed
2. Publishing an update from a client
3. Broadcasting new updates to other connected clients without refresh
4. Persisting enough history to recover missed updates
5. Reconnecting after a temporary interruption
6. Recovering updates created during that interruption
7. Avoiding duplicate display after reconnection
8. Showing whether a client is connected, reconnecting, or disconnected

WebSockets, Server-Sent Events, long polling, or another justified transport may be used.

## Acceptance scenarios

### AC1: Live update

**Given** two clients are connected to the same incident feed  
**When** client A publishes an update  
**Then** client B displays it without a manual refresh

### AC2: Connection state

**Given** a client is connected  
**When** its real-time connection is interrupted  
**Then** the client exposes a disconnected or reconnecting state rather than silently appearing current

### AC3: Missed-update recovery

**Given** client B is disconnected  
**When** client A publishes one or more updates and client B later reconnects  
**Then** client B receives the updates it missed

### AC4: Duplicate prevention

**Given** an update may arrive through initial history, recovery, or a live connection  
**When** those delivery paths overlap  
**Then** the client displays each logical update only once

### AC5: Stable ordering

**Given** multiple updates have been accepted  
**When** a client loads or recovers the feed  
**Then** the updates appear in a deterministic documented order

## Required tests

Include focused automated tests for:

- Publishing and receiving a live update
- Querying or replaying updates after a cursor, sequence, or equivalent checkpoint
- Deduplicating an update delivered through overlapping paths

You may demonstrate the physical disconnect and reconnect in the video if it is impractical to test at the browser level, but the underlying recovery logic should be testable.

## Demo checklist

In the demo video, show:

1. Two clients viewing the same feed
2. A live update moving from one client to the other
3. One client disconnected
4. Updates published while that client is disconnected
5. The client reconnecting and recovering missed updates without duplicates
6. Visible connection-state changes

## Decisions you must document

- Why you selected the transport
- How the client identifies the point from which to resume
- Which component determines ordering
- Where deduplication occurs
- How reconnect attempts are bounded or delayed

## Out of scope

- Authentication, permissions, and user profiles
- Typing indicators or presence
- Message editing, deletion, reactions, or attachments
- Multiple production servers
- Rich visual design
- Offline creation of new messages
- Internet-scale load testing

Optimistic updates are optional. If used, document how temporary client identifiers become accepted server identifiers.

## What reviewers will pay attention to

- Separation between durable history and transient delivery
- Resume or cursor semantics
- Deterministic ordering and stable identifiers
- Races between history loading and live messages
- Reconnection behavior that does not create a tight retry loop
- Observable connection state and errors
- Tests around recovery rather than only the happy-path connection

## Questions to address in `SUBMISSION.md`

- What happens if a client disconnects immediately after sending an update?
- How would multiple backend instances share and order events?
- How would you prevent an unbounded history replay?
- What would you monitor in production?
