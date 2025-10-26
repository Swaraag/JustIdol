# Karaoke App - Real-time Pitch Analysis

A modern Next.js karaoke web application that provides real-time pitch analysis and scoring using the Web Audio API.

## 🎤 Features

- **Upload MP3 Backing Tracks**: Upload instrumental tracks for karaoke
- **Real-time Recording**: Record your voice with live pitch detection
- **Pitch Visualization**: Interactive charts showing target vs. your pitch
- **Karaoke Scoring**: Comprehensive scoring based on pitch accuracy, timing, and vocal stability
- **Practice Mode**: Real-time feedback with pitch correction hints
- **Modern UI**: Dark theme with responsive design

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   cd karaoke-app
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎵 How to Use

### 1. Upload Backing Track
- Click "Upload" tab
- Select an MP3 instrumental track
- The app will automatically analyze the reference pitch

### 2. Record Your Performance
- Click "Record" tab
- Allow microphone access when prompted
- Click "Start Recording" and sing along
- Click "Stop Recording" when finished

### 3. View Analysis
- Click "Visualize" tab to see pitch comparison charts
- Enable "Practice Mode" for real-time feedback
- Click "Score" tab to see detailed performance analysis

## 🧠 Technical Features

### Pitch Detection
- **YIN Algorithm**: Advanced pitch detection using autocorrelation
- **Real-time Analysis**: Live pitch detection during recording
- **Confidence Scoring**: Filters out low-confidence detections

### Scoring System
- **Pitch Accuracy (50%)**: Measures how well you match the target pitch
- **Timing Accuracy (30%)**: Evaluates rhythm and timing alignment
- **Vocal Stability (20%)**: Assesses consistency during held notes

### Visualization
- **Interactive Charts**: Built with Recharts for smooth animations
- **Note Names**: Displays musical note names (C4, D#4, etc.)
- **Cents Analysis**: Shows pitch deviation in cents

## 🛠️ Tech Stack

- **Next.js 14+**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Web Audio API**: Real-time audio processing
- **Recharts**: Interactive data visualization
- **Lucide React**: Modern icon library

## 📁 Project Structure

```
karaoke-app/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main karaoke interface
├── components/
│   ├── AudioPlayer.tsx      # MP3 playback component
│   ├── AudioRecorder.tsx    # Microphone recording
│   ├── PitchVisualizer.tsx  # Real-time pitch charts
│   └── ScoreDisplay.tsx    # Performance scoring
├── lib/
│   └── pitchAnalysis.ts     # YIN algorithm & scoring
└── package.json
```

## 🎯 Browser Compatibility

- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (iOS 14.3+)
- **Edge**: Full support

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Requirements

- Node.js 18+ 
- Modern browser with Web Audio API support
- Microphone access permissions

## 🎵 Audio Processing

The app uses advanced audio processing techniques:

1. **YIN Pitch Detection**: Robust algorithm for accurate pitch detection
2. **FFT Analysis**: Frequency domain analysis for pitch extraction
3. **Real-time Processing**: Low-latency audio analysis
4. **Confidence Filtering**: Removes unreliable pitch detections

## 🏆 Scoring Algorithm

The karaoke scoring system evaluates three key aspects:

### Pitch Accuracy
- Compares your frequency to the target frequency
- Uses semitone differences for musical accuracy
- Allows tolerance for natural vocal variations

### Timing Accuracy
- Analyzes onset detection and rhythm alignment
- Measures synchronization with the backing track
- Evaluates timing consistency

### Vocal Stability
- Calculates pitch variance during sustained notes
- Measures consistency of vocal performance
- Rewards steady, controlled singing

## 🎨 UI/UX Features

- **Dark Theme**: Easy on the eyes for extended use
- **Responsive Design**: Works on desktop and mobile
- **Real-time Feedback**: Live updates during recording
- **Intuitive Navigation**: Tab-based interface
- **Visual Indicators**: Clear status indicators for recording/playback

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist folder to Netlify
```

### Self-hosted
```bash
npm run build
npm run start
```

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Troubleshooting

### Common Issues

1. **Microphone not working**: Check browser permissions
2. **Audio not playing**: Ensure audio file format is supported
3. **Poor pitch detection**: Try singing louder or in a quieter environment
4. **Performance issues**: Close other browser tabs to free up resources

### Browser Permissions

Make sure to allow:
- Microphone access
- Audio playback
- Local storage (for settings)

## 🎤 Tips for Better Scores

1. **Use headphones** to hear the backing track clearly
2. **Sing in a quiet environment** for better analysis
3. **Practice matching pitch** before recording
4. **Use practice mode** for real-time feedback
5. **Record multiple takes** to improve consistency

---

Built with ❤️ using Next.js, Web Audio API, and modern web technologies.
