# Just Idol - Pose Similarity Comparison

A web application that uses AI-powered pose detection to help you match your dance moves with reference videos. Practice your dance skills by comparing your poses in real-time!

## Features

- 🎥 Upload reference dance videos
- 📷 Real-time webcam pose detection
- 🎯 Live similarity scoring
- 🤖 MediaPipe pose estimation (runs locally, no cloud API needed)
- ⚡️ Built with React, TypeScript, and Vite

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (or npm/yarn)
- A webcam

### Installation

1. Install the dependencies:

```bash
pnpm install
```

2. Download the required MediaPipe model files:

```bash
# Create the models directory
mkdir -p public/models

# Download the pose detection model (5.6MB)
curl -L -o public/models/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

# Download the WASM files
curl -L -o public/models/vision_wasm_internal.js \
  https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm/vision_wasm_internal.js

curl -L -o public/models/vision_wasm_internal.wasm \
  https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm/vision_wasm_internal.wasm
```

**Windows users:** Use PowerShell or Git Bash for the curl commands, or download the files manually:
- [pose_landmarker_lite.task](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task)
- [vision_wasm_internal.js](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm/vision_wasm_internal.js)
- [vision_wasm_internal.wasm](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm/vision_wasm_internal.wasm)

Place all downloaded files in the `public/models/` directory.

### Development

Start the development server:

```bash
pnpm dev
```

Your application will be available at `http://localhost:5173`.

## How to Use

1. **Upload a reference video** - Choose an MP4, WebM, or OGG video of the dance moves you want to practice
2. **Allow camera access** - Grant permission when prompted to use your webcam
3. **Position yourself** - Make sure your full body is visible in the webcam frame
4. **Start comparison** - Click "Start Comparison" to begin
5. **Match the moves** - Follow along with the reference video and watch your similarity score!

The similarity score shows how well your pose matches the reference video:
- 🟢 Green (80%+): Excellent match!
- 🟡 Yellow (60-80%): Good, keep practicing
- 🔴 Red (<60%): Keep trying!

## Building for Production

Create a production build:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Technology Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **MediaPipe** - Pose detection AI
- **Canvas API** - Real-time video rendering

## Model Files

This application requires MediaPipe model files to run. These files are:
- Stored locally in `public/models/`
- Downloaded once during setup
- Run entirely in your browser (no cloud API calls)
- Total size: ~15MB

The models are NOT included in the repository to keep it lightweight. You must download them as part of the setup process.

---

Built with ❤️ for dance enthusiasts and learners!
