# Build Workout App APK

## Copy to your local machine:
```bash
scp -r claude1@38.242.207.4:/home/claude1/workout-app ~/workout-app
```

## On your local machine:
```bash
cd ~/workout-app

# Set Android SDK path
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties

# Install dependencies
bun install   # or: npm install

# Build release APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

## Or build debug APK (faster, no signing):
```bash
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
