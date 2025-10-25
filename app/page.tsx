/**
 * Landing page for Just Dance Clone
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 p-8">
      <main className="flex w-full max-w-4xl flex-col items-center gap-12 text-center">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col gap-6"
        >
          <h1 className="text-6xl font-bold tracking-tight text-white drop-shadow-2xl md:text-8xl">
            Just Dance
            <span className="block bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              AI Edition
            </span>
          </h1>
          <p className="text-xl text-gray-200 md:text-2xl">
            Dance along to videos and get scored in real-time using AI pose
            detection
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid w-full gap-6 md:grid-cols-3"
        >
          {[
            {
              icon: "🎥",
              title: "Upload Videos",
              description: "Upload your own dance videos or use YouTube URLs",
            },
            {
              icon: "🤖",
              title: "AI Scoring",
              description: "Real-time pose detection scores your moves",
            },
            {
              icon: "🏆",
              title: "Track Progress",
              description: "See your score, accuracy, and streaks",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md"
            >
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-300">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <Link
            href="/upload"
            className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 text-xl font-bold text-white shadow-2xl transition-all hover:scale-105 hover:shadow-pink-500/50"
          >
            Get Started
          </Link>
          <Link
            href="/test"
            className="rounded-full border-2 border-green-500/50 bg-green-500/10 px-8 py-4 text-xl font-bold text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-green-500/20"
          >
            Test Camera
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border-2 border-white/50 bg-white/10 px-8 py-4 text-xl font-bold text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20"
          >
            How It Works
          </a>
        </motion.div>

        {/* How It Works Section */}
        <motion.div
          id="how-it-works"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-12 w-full rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-md"
        >
          <h2 className="mb-8 text-4xl font-bold text-white">How It Works</h2>
          <div className="grid gap-6 text-left md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-pink-400">1. Upload</div>
              <p className="text-gray-300">
                Upload a dance video or paste a YouTube URL. The AI will analyze
                the dance moves.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-purple-400">
                2. Calibrate
              </div>
              <p className="text-gray-300">
                Position yourself in front of your webcam in the designated
                area.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-blue-400">3. Dance</div>
              <p className="text-gray-300">
                Follow along with the video. The AI tracks your movements in
                real-time.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-400">4. Score</div>
              <p className="text-gray-300">
                Get instant feedback with ratings like PERFECT, GREAT, GOOD, and
                build streaks!
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-400">
        <p>Built with Next.js, MediaPipe, and ❤️</p>
      </footer>
    </div>
  );
}
