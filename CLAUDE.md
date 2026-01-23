# Workout App - Development Guide

## Overview
A mobile workout tracking app built with React Native (Expo), Clerk authentication, and Convex backend.

## Tech Stack
- **Framework**: React Native with Expo Router
- **Auth**: Clerk (`@clerk/clerk-expo`)
- **Backend**: Convex (real-time database)
- **Camera**: `expo-image-picker`

## Environment Variables
```
EXPO_PUBLIC_CONVEX_URL=https://rightful-shrimp-804.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZmFzdC1lZWwtODguY2xlcmsuYWNjb3VudHMuZGV2JA
CONVEX_DEPLOYMENT=prod:rightful-shrimp-804
```

## Project Structure
```
workout-app/
├── app/                      # Expo Router screens
│   ├── _layout.tsx           # Root layout with providers
│   ├── index.tsx             # Home - workout list
│   └── workout/
│       └── [id].tsx          # Workout detail - add exercises
├── convex/
│   ├── schema.ts             # Database schema
│   ├── workouts.ts           # Workout CRUD functions
│   ├── exercises.ts          # Exercise CRUD with images
│   └── sets.ts               # Set tracking functions
└── .env                      # Environment variables
```

## Database Schema (Convex)
- **workouts**: name, date, completed status
- **exercises**: name, imageUrl (optional), linked to workout
- **sets**: weight, reps, linked to exercise

---

## Running the App

### Prerequisites
- Bun installed at `~/.bun/bin/bun`
- Convex account linked

### Step 1: Start Convex Dev Server
```bash
# Create/attach tmux session
tmux new-session -d -s convex1 || tmux attach -t convex1

# In tmux, run:
cd ~/workout-app
~/.bun/bin/bunx convex dev
```

First time will require authentication:
1. A URL like `https://auth.convex.dev/device?user_code=XXXX-XXXX` appears
2. Open in browser and log in
3. Once authenticated, you'll see: `Convex functions ready!`

### Step 2: Start Expo Dev Server
```bash
# In a new tmux window (Ctrl+b c)
~/.bun/bin/bunx expo start --lan --port 8083
```

This shows:
- QR code for Expo Go
- URL like `exp://38.242.207.4:8083`

### Step 3: Test on Device/Emulator
- **Physical device**: Scan QR code with Expo Go
- **Waydroid**: Enter URL manually in Expo Go

---

## Convex Commands

### View Dashboard
https://dashboard.convex.dev/d/rightful-shrimp-804

### Useful Commands
```bash
# Run dev server (watches for changes)
~/.bun/bin/bunx convex dev

# Deploy to production
~/.bun/bin/bunx convex deploy

# Generate types only
~/.bun/bin/bunx convex codegen

# View logs
~/.bun/bin/bunx convex logs
```

### Convex Functions
- `api.workouts.list` - Get all workouts
- `api.workouts.create` - Create new workout
- `api.workouts.get` - Get single workout
- `api.exercises.listByWorkout` - Get exercises for workout
- `api.exercises.create` - Add exercise with optional image
- `api.sets.listByExercise` - Get sets for exercise
- `api.sets.create` - Add set with weight/reps

---

## tmux Session Management

### Create Session
```bash
tmux new-session -d -s convex1
```

### Attach to Session
```bash
tmux attach -t convex1
```

### Window Navigation
- `Ctrl+b c` - New window
- `Ctrl+b n` - Next window
- `Ctrl+b p` - Previous window
- `Ctrl+b d` - Detach (leave running)

### Current Setup
- **Window 0**: `bunx convex dev` (Convex functions)
- **Window 1**: `bunx expo start` (Metro bundler)

---

## Testing on Waydroid

### Prerequisites
- Waydroid running with Expo Go installed
- Expo dev server running (`bunx expo start --lan`)

### Enter URL in Expo Go
```bash
# Launch Expo Go
sudo waydroid shell -- am start -n host.exp.exponent/.experience.HomeActivity
sleep 2

# Tap "Enter URL manually" (center of screen)
sudo waydroid shell -- input tap 215 483
sleep 2

# Tap URL input field
sudo waydroid shell -- input tap 215 560
sleep 1

# Type the Expo URL (use %s for spaces, no special chars needed here)
sudo waydroid shell -- input text 'exp://38.242.207.4:8083'
sleep 1

# Press Enter to connect
sudo waydroid shell -- input keyevent KEYCODE_ENTER
```

### Screenshot Verification
```bash
# Take screenshot
sudo waydroid shell -- screencap -p /sdcard/screen.png

# Extract to host
sudo lxc-attach -P /var/lib/waydroid/lxc -n waydroid -- cat /sdcard/screen.png > /tmp/screen.png
sudo chmod 644 /tmp/screen.png

# View (if on VNC desktop)
DISPLAY=:1 feh /tmp/screen.png
```

---

## Troubleshooting

### Convex "Device flow expired"
Re-run `bunx convex dev` and complete browser login within 5 minutes.

### Port already in use
Use `--port` flag: `bunx expo start --lan --port 8083`

### Waydroid touch not working
Check viewport matches coordinates: `sudo waydroid shell -- wm size`

### Metro bundler issues
Clear cache: `bunx expo start --clear`

---

## Known Issues & Fixes (Project-Specific)

### react-native-screens v4.17+ Crash on Expo SDK 54

**Error**: `java.lang.String cannot be cast to java.lang.Boolean`

**Stack trace shows**: `setProperty` -> `updateProperties` -> `createViewInstance`

**Cause**: Bug in react-native-screens v4.17.0+ with Expo SDK 54 Fabric architecture

**Fix** (already applied to this project):
```bash
~/.bun/bin/bun add react-native-screens@4.16.0 --exact
```

**Important**: Do NOT upgrade react-native-screens above 4.16.0 until this is fixed upstream.

References:
- https://github.com/software-mansion/react-native-screens/issues/3470
- https://github.com/react-navigation/react-navigation/issues/12847

---

## Logcat Monitoring (Debug React Native Errors)

### Quick Error Check
```bash
sudo waydroid shell -- logcat -d 2>/dev/null | grep -iE "react|expo|error" | tail -30
```

### Stream Logs in tmux
```bash
# Add logcat window to existing session
tmux new-window -t convex1 -n logcat
tmux send-keys -t convex1:logcat "sudo waydroid shell -- logcat '*:E' 2>&1 | grep -vE 'ThemeUtils|AppCompat|TaskPersister'" Enter
```

### Filter for Specific Errors
```bash
# React Native errors
sudo waydroid shell -- logcat -d | grep -iE "ReactNative|ReactHost|FabricUIManager"

# Clerk auth errors
sudo waydroid shell -- logcat -d | grep -i "clerk"

# Convex errors
sudo waydroid shell -- logcat -d | grep -i "convex"
```

---

## Complete Development Setup (tmux)

### Start All Services
```bash
# Create session if not exists
tmux new-session -d -s convex1 -c ~/workout-app

# Window 0: Convex dev server
tmux send-keys -t convex1:0 "~/.bun/bin/bunx convex dev" Enter

# Window 1: Expo Metro bundler
tmux new-window -t convex1 -n expo -c ~/workout-app
tmux send-keys -t convex1:expo "~/.bun/bin/bunx expo start --lan --port 8083" Enter

# Window 2: Logcat streaming
tmux new-window -t convex1 -n logcat
tmux send-keys -t convex1:logcat "sudo waydroid shell -- logcat '*:E' 2>&1 | grep -vE 'ThemeUtils|AppCompat'" Enter
```

### Check Output from Any Window
```bash
tmux capture-pane -t convex1:0 -p | tail -20     # Convex
tmux capture-pane -t convex1:expo -p | tail -20  # Expo
tmux capture-pane -t convex1:logcat -p | tail -20 # Logcat
```

---

## Quick Launch on Waydroid

### One-Liner to Open App
```bash
sudo waydroid shell -- am start -a android.intent.action.VIEW -d "exp://192.168.240.1:8083"
```

### Force Reload
```bash
sudo waydroid shell -- am force-stop host.exp.exponent && sleep 2 && sudo waydroid shell -- am start -a android.intent.action.VIEW -d "exp://192.168.240.1:8083"
```

### Screenshot After Load
```bash
sleep 10 && sudo waydroid shell -- screencap -p /sdcard/screen.png && sudo sh -c 'lxc-attach -P /var/lib/waydroid/lxc -n waydroid -- cat /sdcard/screen.png > /tmp/waydroid_screen.png' && sudo chmod 644 /tmp/waydroid_screen.png
```

---

## Network Configuration

| Host | IP |
|------|-----|
| Host (from Waydroid) | 192.168.240.1 |
| Waydroid | 192.168.240.112 |

**Always use** `exp://192.168.240.1:8083` for Expo URLs inside Waydroid (not external IP).
