# SprintQuiz Security Specification (Phase 0)

## 1. Data Invariants
1. **Question Bank Authority**: Only verified admins (`markaito129@gmail.com` with `email_verified == true` or UID in `/admins/{uid}`) may create, update, or delete documents in `/questions/{questionId}`.
2. **Question Shape & Bounds**: Every question must belong to one of the 6 allowed age groups (`Beginners`, `Primary`, `Juniors`, `Intermediate`, `Seniors`, `Open`), contain exactly 4 bounded string options (1–300 chars each), a `correctIndex` integer in `[0, 3]`, bounded prompt (3–1200 chars), bounded topic (1–80 chars), bounded explanation (0–600 chars), `isActive == true` for public playback, and server-verified timestamps (`createdAt == request.time`, `updatedAt == request.time`).
3. **Leaderboard Integrity & Anti-Tampering**:
   - Students can only create `/leaderboard_entries/{entryId}` for their own verified `request.auth.uid`.
   - `correctCount + wrongCount + skippedCount == totalQuestions` must hold.
   - `score * 4 == correctCount * 4 - wrongCount` must hold (`+1` per correct, `-0.25` per wrong, `0` per skipped).
   - `elapsedSeconds` must be between `0` and `1800` (30 minutes max).
   - `submittedAt` must equal `request.time`.
   - Leaderboard entries are immutable once submitted (`allow update: if false;` for non-admins; only admin may delete).
4. **PII Isolation**: No email addresses, phone numbers, or sensitive PII are stored in `/leaderboard_entries` or `/questions`. `/users/{userId}` stores only non-PII preferences (`displayName`, `preferredAgeGroup`) and is strictly owner-only readable/writable without any role or admin fields.
5. **Path Hardening**: All document IDs (`questionId`, `entryId`, `adminUid`, `userId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated user attempting `create` on `/questions/q1`.
2. Non-admin verified student attempting `create` on `/questions/q1`.
3. Non-admin verified student attempting `delete` on `/questions/q1`.
4. Admin attempting `create` on `/questions/q1` with a ghost field `extraFlag: true` (Shadow Update).
5. Admin attempting `create` on `/questions/q1` with `options` of length 3 or `correctIndex: 5`.
6. Unverified email spoof (`email: 'markaito129@gmail.com', email_verified: false`) attempting `create` on `/questions/q1`.
7. Student attempting `create` on `/leaderboard_entries/e1` with someone else's `userId`.
8. Student attempting `create` on `/leaderboard_entries/e1` with falsified score (`correctCount: 2, wrongCount: 4, score: 99`).
9. Student attempting `create` on `/leaderboard_entries/e1` with `elapsedSeconds: 2400` (> 1800s).
10. Student attempting `update` on their own `/leaderboard_entries/e1` to boost score after submission.
11. Student attempting `create` on `/admins/{theirUid}` to self-escalate privileges.
12. Student attempting `get` or `list` on another student's `/users/{otherUid}` document.
