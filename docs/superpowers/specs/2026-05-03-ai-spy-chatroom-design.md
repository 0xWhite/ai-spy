# AI Spy Chatroom Design

Date: 2026-05-03
Project: `F:\code\ai-spy`
Status: Approved in conversation, written for review

## Summary

AI Spy Chatroom is a real-time social deduction game played in a shared chat room. A host creates a private room with an invite code, real players join, and 1 to 2 AI agents are secretly mixed into the game as undercover participants. Players only see each seat as an avatar color plus a number, not a nickname or profile identity.

The game alternates between timed discussion and voting rounds. Round 1 discussion lasts 5 minutes. Later discussion rounds last 3 minutes each. After each discussion phase, surviving players vote to eliminate one seat. Eliminated players become spectators who can keep watching but can no longer speak or vote. When 3 players remain alive, the game ends immediately. If any AI is still alive at that point, the human team loses. If all AI have been eliminated before then, the human team wins.

The first version focuses on one complete playable loop for private friend-group games. It does not include public matchmaking, accounts, rankings, or extra game modes.

## Product Goals

The first version succeeds if it achieves these outcomes:

1. A host can create and start a private room with minimal setup.
2. A full room can play from lobby through final reveal without moderator intervention.
3. Players feel real uncertainty about which seats are AI.

## Design Principles

- Keep the product focused on one game loop, not a general social platform.
- Make the room feel like a game table, not a profile-driven chat app.
- Use strong system pacing through visible phases and synchronized countdowns.
- Keep AI believable rather than maximally intelligent.
- Preserve suspense by hiding AI identities until the game ends.

## Game Rules

### Room configuration

- Entry mode: host-created private room with invite code
- Default room size: 7 total seats
- AI count: configurable by host, default 1, allowed values in v1 are 1 or 2
- Discussion timers:
  - Round 1: 5 minutes
  - Later rounds: 3 minutes
- Tie-break discussion timer: 60 seconds
- Voting timer: 60 seconds

### Seat presentation

- Each participant is shown only as an avatar color plus seat number
- Nicknames are not shown
- Profile information is not shown

Example seat labels:

- Red 1
- Blue 4
- Green 6

### Game flow

1. Host creates room and receives invite code.
2. Players join the waiting room until the room reaches the required player count.
3. Host starts the game.
4. The system assigns hidden roles:
   - Human seats
   - AI seats
5. Discussion and voting rounds repeat until a win condition is reached.
6. Eliminated seats become spectators.
7. The game ends immediately when either:
   - all AI seats have been eliminated, or
   - only 3 seats remain alive

### Discussion phase

- Round 1 discussion lasts 5 minutes
- Every later discussion phase lasts 3 minutes
- Only living players can send messages
- Spectators can watch but cannot send messages
- The current round countdown is shown in real time to everyone
- System messages are inserted into the chat stream to mark phase changes and alerts

### Voting phase

- Only living players can vote
- A player cannot vote for their own seat
- A player can only vote for currently living seats
- Votes can be changed until the voting phase closes
- The phase ends when all living players have voted or the voting timer expires
- The eliminated seat is announced, but its AI or human identity is not revealed

### Tie-break rules

If the highest vote total is tied:

1. Start a 60-second tie-break discussion phase.
2. Start a tie-break re-vote limited to the tied seats.
3. If the re-vote is still tied, randomly eliminate one of the tied seats.

This rule exists to prevent deadlock and keep a room from stalling indefinitely.

### Elimination and spectator rules

- Eliminated seats become spectators immediately
- Spectators can continue reading chat and system messages
- Spectators cannot speak
- Spectators cannot vote

### Win conditions

Humans win when all AI seats have been eliminated.

AI wins when 3 seats remain alive and at least one surviving seat is AI.

### Multi-AI rule

If the room uses 2 AI seats:

- each AI knows there is another AI in the game
- this hidden coordination is internal only
- the UI does not expose any relationship between AI seats

## Product Structure

The first version uses four core views.

### 1. Create room view

Purpose: let the host create a room quickly.

Visible controls:

- total seats
- AI count
- round 1 duration
- later round duration
- create room action

The UI should prefer strong defaults over excessive options.

### 2. Waiting room view

Purpose: let players gather and understand the match before it starts.

Visible content:

- invite code
- current player count versus target
- seat list shown as avatar color plus number
- short rule summary
- host start action once start conditions are met

### 3. In-game room view

Purpose: serve as the single main play surface.

Layout:

- Top status bar
  - current round
  - current phase
  - synchronized real-time countdown
  - living player count
- Main chat area
  - player messages
  - system phase messages
  - elimination announcements
- Contextual action area
  - message composer during discussion
  - vote panel during voting
  - spectator notice when eliminated
  - tie-break focus state when relevant

The countdown must remain visible at all times during active phases.

### 4. Results view

Purpose: resolve suspense and support replay.

Visible content:

- human win or AI win result
- surviving seats
- elimination order
- final AI identity reveal
- replay or return action

## System Messages

System messages are part of the experience, not just implementation detail. They should appear in the same timeline as chat, with clear visual distinction.

Examples:

- Round 1 discussion started
- 30 seconds remaining
- Discussion ended, voting started
- Red 4 eliminated and moved to spectator mode
- Tie detected, 60-second tie-break started

## State Model

Each room follows a strict state machine.

### Room states

- `waiting`
- `discussion`
- `voting`
- `tiebreak_discussion`
- `tiebreak_voting`
- `eliminated_reveal`
- `finished`

### State transitions

- `waiting` -> `discussion` when the host starts a valid room
- `discussion` -> `voting` when the timer expires
- `voting` -> `eliminated_reveal` when voting resolves without a tie
- `voting` -> `tiebreak_discussion` when the highest votes are tied
- `tiebreak_discussion` -> `tiebreak_voting` when the tie-break timer expires
- `tiebreak_voting` -> `eliminated_reveal` after the re-vote or random tie resolution
- `eliminated_reveal` -> `finished` if a win condition is reached
- `eliminated_reveal` -> `discussion` for the next round otherwise

### Core room data

Each room must track at least:

- room configuration
- current room state
- current round number
- current phase end timestamp
- seat roster
- hidden seat identity: human or AI
- seat status: alive or spectator
- chat message timeline
- current-round votes
- tied-seat list when relevant
- elimination order

## AI Behavior Constraints

The first version should wrap AI participation in game-specific rules instead of allowing unrestricted model output.

### AI goals

- avoid being identified as AI
- survive until the endgame when possible
- nudge human suspicion toward other seats

If 2 AI are present, they may indirectly protect each other, but should not behave as an obvious pair.

### Style variation

Each AI should be assigned a light conversational style, such as:

- cautious observer
- active questioner
- analytical summarizer
- casual social speaker

These styles should affect tone and cadence, not game permissions.

### Frequency constraints

- minimum interval between messages
- maximum number of messages per round
- no rapid multi-message spam
- limited end-of-phase catch-up behavior

### Length constraints

- messages should usually be short to medium length
- avoid essay-style output
- avoid overly formal structure

### Knowledge constraints

AI must never:

- reveal or admit it is AI
- refer to itself as a model or assistant
- act on hidden server state that is not publicly available
- use knowledge outside the room context

AI can only reason from:

- visible chat messages
- visible vote outcomes
- visible system messages
- its own hidden role information

### Voting behavior

AI voting should prioritize:

- self-preservation
- subtle ally protection when 2 AI exist
- plausible social reasoning
- variation, so it does not look deterministic

### Timing behavior

AI responses should include a human-like delay range for both speaking and voting. They should not reply or vote with perfectly instant machine timing.

## Technical Direction

This document defines product behavior, not final implementation details, but the design implies these requirements:

- real-time room synchronization across clients
- authoritative server-side game state
- server-owned timers and phase transitions
- deterministic validation for speaking, voting, and state changes
- AI participation integrated into the same room event model as human players

Because this project uses a version of Next.js with breaking changes, implementation must follow the local docs in `node_modules/next/dist/docs/` before architecture is finalized.

## Out of Scope for v1

The following are explicitly deferred:

- public matchmaking
- user accounts
- persistent player profiles
- rankings and match history
- voice or video chat
- room themes, shared prompts, or cooperative tasks
- spectator chat
- direct messages
- advanced disconnect recovery or seat replacement
- AI difficulty presets
- replay system
- moderation or reporting back office
- native mobile app features beyond responsive web behavior

## Risks and Mitigations

### Risk: free chat can stall

Without a prompt or task, some rooms may become quiet.

Mitigation:

- use strong system pacing
- make the countdown highly visible
- keep post-launch room modes open for future extension

### Risk: AI feels too robotic

Mitigation:

- vary styles
- cap length
- cap frequency
- apply human-like delay

### Risk: room deadlock during voting

Mitigation:

- tie-break discussion
- limited tie-break vote pool
- final random elimination on repeated tie

### Risk: room feels like generic chat instead of a game

Mitigation:

- visible phase structure
- constant timer presence
- strong system event styling
- seat-based identity instead of profile identity

## Acceptance Criteria for v1

The design is satisfied when:

1. A host can create a private invite-code room with default game settings.
2. Players can join and see seat identities as avatar color plus seat number only.
3. The room can move through waiting, discussion, voting, tie-break, elimination, and finished states correctly.
4. Phase countdowns are synchronized and visible in real time.
5. Eliminated players can spectate but cannot speak or vote.
6. AI identity remains hidden until the final results screen.
7. The game ends immediately at 3 surviving seats, unless all AI have already been eliminated earlier.
8. Final results reveal winner, AI seats, survivors, and elimination order.

## Next Step

After the user reviews this spec, the next step is to write an implementation plan for the first playable version.
