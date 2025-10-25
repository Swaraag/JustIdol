# Just Idol - Real-Time Dance Scoring Web App

A Just Dance-style web application built with Next.js 16, TypeScript, and MediaPipe that scores your dance moves in real-time using AI pose detection.


## 🎯 Features

- **Video Upload** - Upload your own dance videos or use YouTube URLs
- **Real-Time Pose Detection** - MediaPipe tracks 33 body landmarks
- **AI Scoring** - Compares your moves against reference poses with angle-based matching
- **Smart Person Tracking** - Filters background people and validates correct dancer
- **Live Feedback** - Get instant ratings (PERFECT/GREAT/GOOD/OK/MISS)
- **Streak System** - Build combos for score multipliers (up to 3x!)
- **Beautiful UI** - Gaming-inspired interface with animations and glassmorphism

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** 18+
- **pnpm** (recommended) or npm
- **ffmpeg** - Required for video processing
  ```bash
  # Windows (using Chocolatey)
  choco install ffmpeg

  # macOS
  brew install ffmpeg

  # Linux (Ubuntu/Debian)
  sudo apt-get install ffmpeg
  ```

- **YouTube.js** - Included as dependency (official YouTube InnerTube API wrapper)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd dance-app
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Run the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
dance-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── upload/route.ts       # Video file upload
│   │   ├── download/route.ts     # YouTube video download
│   │   ├── process/route.ts      # Video pose extraction
│   │   └── reference/[id]/route.ts  # Serve reference data
│   ├── game/[videoId]/page.tsx   # Main game page
│   ├── upload/page.tsx           # Upload interface
│   ├── page.tsx                  # Landing page
│   └── layout.tsx                # Root layout
├── components/                   # React components
│   ├── DanceGame.tsx             # Main game logic
│   ├── PoseCanvas.tsx            # Skeleton overlay
│   ├── ScoreDisplay.tsx          # Score/streak UI
│   └── ROIOverlay.tsx            # Position guidance
├── lib/                          # Utility libraries
│   ├── types.ts                  # TypeScript definitions
│   ├── angleCalculator.ts        # Joint angle calculations
│   ├── poseComparator.ts         # Pose comparison & scoring
│   ├── personTracker.ts          # Person validation
│   └── videoProcessor.ts         # Server-side video processing
└── public/
    ├── videos/                   # Uploaded/downloaded videos
    └── references/               # Processed pose data (JSON)
```

## 🎮 How to Use

### 1. Upload a Video

Navigate to `/upload` and either:
- **Drag & drop** a dance video (MP4, WebM, MOV, AVI - max 300MB)

### 2. Processing

The server will:
- Extract frames at 15 FPS using ffmpeg
- Run MediaPipe pose detection on each frame
- Calculate 14 joint angles per frame
- Save reference poses as JSON

This may take 1-3 minutes depending on video length.

### 3. Calibration

- Position yourself in the **green box** (ROI)
- Stay centered and visible
- Wait for the 3-second countdown

### 4. Dance!

- Follow the reference video (left side)
- Your webcam shows on the right with pose overlay
- Get scored in real-time with visual feedback
- Build streaks for score multipliers!

### 5. Results

View your final score, accuracy breakdown, and max streak.

## 🧠 How It Works

### Angle-Based Pose Comparison

Instead of comparing raw landmark coordinates, we calculate **14 joint angles**:

**Arms:**
- Elbow angles (left/right)
- Shoulder angles
- Armpit angles
- Arm raise angles

**Legs:**
- Knee angles (left/right)
- Hip angles

**Body:**
- Torso lean
- Neck tilt

### Scoring Algorithm

1. **Calculate angles** from user's pose and reference pose
2. **Weighted comparison** (arms/legs weighted 1.5-2x more than body)
3. **Similarity score** (0-1 based on angle differences)
4. **Rating system:**
   - Similarity ≥ 0.9 = **PERFECT** (100 pts)
   - Similarity ≥ 0.8 = **GREAT** (80 pts)
   - Similarity ≥ 0.7 = **GOOD** (60 pts)
   - Similarity ≥ 0.6 = **OK** (40 pts)
   - Below = **MISS** (0 pts)
5. **Streak multiplier** applied (up to 3x)

### Person Tracking

To filter background people, we use:

1. **ROI Validation** - Dancer must stay in center 70% of frame
2. **Continuity Tracking** - Detects sudden "jumps" (person switching)
3. **Body Size Matching** - Ensures same person throughout
4. **Visibility Checks** - Requires 70%+ landmarks visible

## 🛠️ Configuration

### MediaPipe Settings (in `lib/types.ts`)

```typescript
{
  modelComplexity: 1,           // 0-2 (balance speed/accuracy)
  enableSegmentation: true,      // For person filtering
  smoothLandmarks: true,         // Temporal smoothing
  minDetectionConfidence: 0.5,   // Initial detection threshold
  minTrackingConfidence: 0.5,    // Tracking threshold
}
```

### Comparison Settings

```typescript
{
  angleTolerance: 30,            // Degrees of tolerance per angle
  armWeight: 1.5,                // Arm importance multiplier
  legWeight: 1.5,                // Leg importance multiplier
  scoreCooldown: 200,            // ms between scores
  similarityThresholds: {
    perfect: 0.9,
    great: 0.8,
    good: 0.7,
    ok: 0.6,
  },
}
```

## 🔧 Development

### Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion
- **Pose Detection:** MediaPipe Pose Landmarker
- **Video Processing:** ffmpeg, yt-dlp-wrap
- **Canvas Rendering:** HTML5 Canvas, node-canvas

### Key Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### API Routes

**POST `/api/upload`**
- Upload video file
- Returns: `{ videoId, filename, size, type }`

**POST `/api/download`**
- Download from YouTube URL using YouTube.js (official API)
- Body: `{ url: string }`
- Returns: `{ videoId, title, duration, thumbnail, fileSize }`
- Supports multiple URL formats (watch, youtu.be, embed, raw ID)
- Limitations: Max 10 minutes, 300MB file size
- More stable than scraping-based solutions

**POST `/api/process`**
- Process video to extract poses
- Body: `{ videoId: string, sampledFps?: number }`
- Returns: `{ videoId, poseCount, duration, sampledFps }`

**GET `/api/reference/[id]`**
- Fetch processed reference data
- Returns: `{ success: true, data: ReferenceData }`

## 📊 Performance Tips

1. **Video Length** - Keep videos under 2 minutes for faster processing
2. **Resolution** - 720p is optimal (balance quality/speed)
3. **Lighting** - Good lighting improves pose detection accuracy
4. **Camera Placement** - Full body visible, 6-10 feet away
5. **Background** - Plain background reduces false detections

## 🚧 Known Limitations

- **YouTube Downloads** - May be blocked by some providers or violate ToS
- **Processing Time** - 1-3 minutes for typical 2-minute video
- **Browser Support** - Requires modern browser with WebGL support
- **Webcam Required** - No mobile support yet (needs camera access)
- **Windows Paths** - Uses backslashes; may need adjustment for Unix systems

## 🔮 Future Enhancements

- [ ] Multiplayer mode (compare with friends)
- [ ] Leaderboards and replay system
- [ ] Custom difficulty levels
- [ ] Mobile support (React Native)
- [ ] More dance move categories
- [ ] AI-generated choreography suggestions
- [ ] Export performance videos
- [ ] Cloud storage integration (S3/R2)

## 📝 License

MIT License - feel free to use this project for learning or personal use!

## 🙏 Acknowledgments

- **MediaPipe** - Google's pose detection framework
- **Next.js** - React framework
- **YouTube.js** - Official YouTube InnerTube API wrapper
- **ffmpeg** - Video processing

---

**Built with Next.js, MediaPipe, and ❤️**
