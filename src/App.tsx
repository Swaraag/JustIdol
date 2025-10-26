import { useState } from "react";
import PoseComparison from "./components/PoseComparison";

type Difficulty = 'easy' | 'medium' | 'hard' | null;

function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDifficultySelector, setShowDifficultySelector] = useState(false);

  // Difficulty video paths - UPDATE THESE WITH YOUR ACTUAL VIDEO FILES
  const difficultyVideos = {
    easy: 'public/videos/easy-dance.mp4',
    medium: 'public/videos/medium-dance.mp4',
    hard: 'public/videos/hard-dance.mp4'
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const handleDifficultySelect = (difficulty: Difficulty) => {
    if (difficulty) {
      setVideoUrl(difficultyVideos[difficulty]);
      setShowDifficultySelector(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* K-pop Demon Hunter Animated Background with Moon and Characters */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dark mystical energy waves */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-950 via-black to-purple-950 opacity-60"></div>
        
        {/* Floating demon energy orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse" style={{ animationDuration: '3s' }}></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-25 animate-pulse" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>
        
        {/* Large Moon in Background - Top Right */}
        <div className="absolute -top-32 -right-32 opacity-10 animate-pulse" style={{ animationDuration: '6s' }}>
          <img 
            src="/images/moon.png" 
            alt="" 
            className="w-[600px] h-[600px] object-contain"
          />
        </div>

        {/* Fading K-pop Demon Hunter Characters */}
        <div className="absolute top-20 right-20 opacity-15 animate-pulse" style={{ animationDuration: '4s' }}>
          <img 
            src="/images/demon-hunter.png" 
            alt="" 
            className="w-64 h-96 object-contain"
          />
        </div>
        <div className="absolute bottom-40 left-20 opacity-10 animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}>
          <img 
            src="/images/demon-hunter.png" 
            alt="" 
            className="w-56 h-84 object-contain transform scale-x-[-1]"
          />
        </div>
        <div className="absolute top-1/2 right-1/3 opacity-8 animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }}>
          <img 
            src="/images/demon-hunter.png" 
            alt="" 
            className="w-52 h-78 object-contain"
          />
        </div>
        <div className="absolute top-1/3 left-1/3 opacity-12 animate-pulse" style={{ animationDelay: '3s', animationDuration: '6s' }}>
          <img 
            src="/images/demon-hunter.png" 
            alt="" 
            className="w-60 h-90 object-contain transform scale-x-[-1]"
          />
        </div>
      </div>

      <div className="container mx-auto py-12 px-4 relative z-10">
        {/* Header - K-pop Demon Hunter Style */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4 relative">
            {/* Glowing aura behind title */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 blur-3xl opacity-50 animate-pulse"></div>
            
            <div className="relative">
              <h1 className="text-8xl font-black mb-2 relative">
                <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 blur-sm">
                  JUST IDOL
                </span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-pink-400">
                  JUST IDOL
                </span>
              </h1>
              <div className="flex items-center justify-center gap-3 text-2xl font-bold">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-300 to-purple-300 tracking-widest">
                  DEMON HUNTER ACADEMY
                </span>
              </div>
            </div>
          </div>
          <p className="text-xl text-red-200/80 max-w-2xl mx-auto font-medium">
            Train like a K-pop demon hunter! Master the choreography and banish bad moves to the shadow realm!
          </p>
        </div>

        {!videoUrl ? (
          <div className="max-w-4xl mx-auto">
            {/* Upload Section - Dark Energy Portal */}
            <div className="relative group mb-8">
              {/* Outer glow - demon energy */}
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse"></div>
              
              {/* Dark portal with mystical border */}
              <div 
                className={`relative bg-gradient-to-br from-gray-950 via-red-950/50 to-purple-950/50 backdrop-blur-xl rounded-3xl shadow-2xl p-12 text-center border-2 transition-all duration-300 ${
                  isDragging 
                    ? "border-red-400 border-dashed scale-105 shadow-red-500/50 shadow-2xl" 
                    : "border-red-900/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Mystical portal icon */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 mx-auto mb-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 rounded-full animate-spin opacity-20" style={{ animationDuration: '3s' }}></div>
                    <div className="absolute inset-2 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full animate-spin opacity-30" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-300 via-purple-300 to-pink-300 mb-4">
                  CHOOSE YOUR MISSION
                </h2>
                <p className="text-red-200/70 text-lg mb-8">
                  Select a pre-loaded mission or upload your own choreography video
                </p>

                {/* Dual Button Layout */}
                <div className="flex gap-6 justify-center items-center flex-wrap">
                  {/* Difficulty Selector Button */}
                  <button
                    onClick={() => setShowDifficultySelector(true)}
                    className="group/btn relative"
                  >
                    {/* Button glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-75 group-hover/btn:opacity-100 transition duration-300"></div>
                    
                    <div className="relative bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white font-black py-5 px-12 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-110 flex items-center gap-3 text-xl border-2 border-purple-400/30">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>CHOOSE DIFFICULTY</span>
                    </div>
                  </button>

                  {/* OR Divider */}
                  <div className="text-red-300/50 font-black text-xl">OR</div>

                  {/* Custom Upload Button */}
                  <label
                    htmlFor="video-upload"
                    className="group/btn relative cursor-pointer"
                  >
                    {/* Button glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-purple-600 rounded-xl blur opacity-75 group-hover/btn:opacity-100 transition duration-300"></div>
                    
                    <div className="relative bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 hover:from-red-500 hover:via-purple-500 hover:to-pink-500 text-white font-black py-5 px-20 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-110 flex items-center gap-3 text-xl border-2 border-red-400/30">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>UPLOAD VIDEO</span>
                    </div>
                  </label>
                  <input
                    id="video-upload"
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </div>

                <p className="mt-6 text-sm text-red-300/50 font-medium">
                  MP4 • WebM • OGG
                </p>
              </div>
            </div>

            {/* Instructions - Demon Hunter Training Manual */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur opacity-50 group-hover:opacity-75 transition duration-500"></div>
              <div className="relative bg-gradient-to-br from-gray-950 via-purple-950/50 to-pink-950/50 backdrop-blur-xl p-8 rounded-3xl border border-red-900/50">
                <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-300 to-pink-300 mb-6">
                  DEMON HUNTER TRAINING PROTOCOL
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { step: "STEP 1", title: "SUMMON", text: "Upload your training choreography video" },
                    { step: "STEP 2", title: "REVEAL", text: "Allow camera access to track your movements" },
                    { step: "STEP 3", title: "POSITION", text: "Stand in full view like a true demon hunter" },
                    { step: "STEP 4", title: "ENGAGE", text: "Click 'Start Hunt' to begin your training" },
                    { step: "STEP 5", title: "EXECUTE", text: "Match the choreography with precision" },
                    { step: "STEP 6", title: "RANK UP", text: "Achieve high scores to level up your hunter rank!" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-5 rounded-xl bg-black/50 hover:bg-red-950/30 transition-all duration-300 border border-red-900/30 hover:border-red-500/50 group/item">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-red-500 to-purple-500 flex items-center justify-center text-white text-sm font-black">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-red-300 font-black text-sm mb-1">{item.title}</p>
                        <p className="text-red-200/70 text-sm">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Demon Hunter Ranks */}
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-red-950/50 to-purple-950/50 border border-red-700/30">
                  <p className="text-center text-red-300 font-bold mb-2">HUNTER RANKS</p>
                  <div className="flex justify-center gap-6 text-sm">
                    <span className="text-pink-400 font-bold">&lt;60% = TRAINEE HUNTER</span>
                    <span className="text-purple-400 font-bold">60%+ = A-RANK HUNTER</span>
                    <span className="text-red-400 font-bold">80%+ = S-RANK HUNTER</span>
                    
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <PoseComparison
            referenceVideoUrl={videoUrl}
            onChangeVideo={() => setVideoUrl(null)}
          />
        )}
      </div>

      {/* Difficulty Selector Modal */}
      {showDifficultySelector && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="relative max-w-5xl w-full mx-4">
            {/* Close button */}
            <button
              onClick={() => setShowDifficultySelector(false)}
              className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white font-black text-2xl transition-all duration-300 hover:scale-110 shadow-lg z-10"
            >
              ×
            </button>

            {/* Glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-75 animate-pulse"></div>
            
            <div className="relative bg-gradient-to-br from-gray-950 via-red-950/80 to-purple-950/80 backdrop-blur-xl rounded-3xl p-12 border-2 border-red-500/50">
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-300 via-purple-300 to-pink-300 mb-4 text-center">
                SELECT DIFFICULTY
              </h2>
              <p className="text-center text-red-200/70 mb-12 text-lg">
                Choose your challenge level, Hunter!
              </p>

              {/* Difficulty Cards */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Easy */}
                <button
                  onClick={() => handleDifficultySelect('easy')}
                  className="group relative"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-gradient-to-br from-gray-900 to-green-950 rounded-2xl p-8 border-2 border-green-500/50 hover:border-green-400 transition-all duration-300 hover:scale-105 shadow-xl">
                    <div className="text-6xl mb-4 text-center">🌱</div>
                    <h3 className="text-3xl font-black text-green-400 mb-2 text-center">EASY</h3>
                    <p className="text-green-200/70 text-center text-sm mb-4">
                      Perfect for beginners
                    </p>
                    <div className="flex justify-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                    </div>
                  </div>
                </button>

                {/* Medium */}
                <button
                  onClick={() => handleDifficultySelect('medium')}
                  className="group relative"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-gradient-to-br from-gray-900 to-orange-950 rounded-2xl p-8 border-2 border-orange-500/50 hover:border-orange-400 transition-all duration-300 hover:scale-105 shadow-xl">
                    <div className="text-6xl mb-4 text-center">⚡</div>
                    <h3 className="text-3xl font-black text-orange-400 mb-2 text-center">MEDIUM</h3>
                    <p className="text-orange-200/70 text-center text-sm mb-4">
                      A balanced challenge
                    </p>
                    <div className="flex justify-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                      <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                    </div>
                  </div>
                </button>

                {/* Hard */}
                <button
                  onClick={() => handleDifficultySelect('hard')}
                  className="group relative"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-gradient-to-br from-gray-900 to-red-950 rounded-2xl p-8 border-2 border-red-500/50 hover:border-red-400 transition-all duration-300 hover:scale-105 shadow-xl">
                    <div className="text-6xl mb-4 text-center">🔥</div>
                    <h3 className="text-3xl font-black text-red-400 mb-2 text-center">HARD</h3>
                    <p className="text-red-200/70 text-center text-sm mb-4">
                      For elite hunters
                    </p>
                    <div className="flex justify-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;