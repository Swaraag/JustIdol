/**
 * Upload page
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

type ProcessingStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "error";

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError("Please select a video file");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setStatus("uploading");
    setProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", selectedFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      const newVideoId = uploadData.videoId;
      setVideoId(newVideoId);
      setProgress(50);

      // Process video
      setStatus("processing");
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: newVideoId, sampledFps: 15 }),
      });

      if (!processRes.ok) {
        const error = await processRes.json();
        throw new Error(error.error || "Processing failed");
      }

      setProgress(100);
      setStatus("completed");

      // Redirect to game after 1 second
      setTimeout(() => {
        router.push(`/game/${newVideoId}`);
      }, 1000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleSubmit = () => {
    uploadFile();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 p-8">
      <header className="mb-8">
        <Link
          href="/"
          className="inline-block text-white hover:text-pink-300 transition-colors"
        >
          ← Back to Home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-lg"
        >
          <h1 className="mb-8 text-4xl font-bold text-white">
            Upload Dance Video
          </h1>

          {/* File Upload */}

          <div>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative mb-4 rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
                dragActive
                  ? "border-pink-400 bg-pink-400/20"
                  : "border-white/40 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={status !== "idle" && status !== "error"}
              />
              <div className="text-6xl mb-4">🎥</div>
              <p className="text-xl font-semibold text-white mb-2">
                {selectedFile ? selectedFile.name : "Drag & drop video here"}
              </p>
              <p className="text-gray-300">or click to browse</p>
              <p className="mt-2 text-sm text-gray-400">
                Supported: MP4, WebM, MOV, AVI (max 300MB)
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-400/50 bg-red-500/20 p-4 text-red-200">
              {error}
            </div>
          )}

          {/* Progress */}
          {status !== "idle" && status !== "error" && (
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-sm text-white">
                <span>
                  {status === "uploading" && "Uploading..."}
                  {status === "processing" &&
                    "Processing video (this may take a while)..."}
                  {status === "completed" && "Complete! Redirecting..."}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={
              !selectedFile || (status !== "idle" && status !== "error")
            }
            className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 text-xl font-bold text-white shadow-2xl transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {status === "idle" || status === "error"
              ? "Process Video"
              : "Processing..."}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
