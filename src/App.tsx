import { useState } from "react";
import PoseComparison from "./components/PoseComparison";

function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold text-center mb-8">
          Just Idol - Pose Similarity Comparison
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Match your poses with the reference video to improve your dance skills!
        </p>

        {!videoUrl ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4">Upload a Reference Video</h2>
              <p className="text-gray-600 mb-6">
                Choose an MP4 video of the dance or pose you want to practice
              </p>

              <label
                htmlFor="video-upload"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg cursor-pointer transition-colors"
              >
                <svg
                  className="inline-block w-5 h-5 mr-2 -mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Choose Video File
              </label>
              <input
                id="video-upload"
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={handleVideoUpload}
                className="hidden"
              />

              <p className="mt-4 text-sm text-gray-500">
                Supported formats: MP4, WebM, OGG
              </p>
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">How to use:</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Upload a reference video of the pose or dance you want to practice</li>
                <li>Allow camera access when prompted</li>
                <li>Position yourself so your full body is visible in the webcam</li>
                <li>Click "Start Comparison" to begin</li>
                <li>Follow the reference video movements</li>
                <li>Watch the similarity score to see how well you match!</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-center">
              <button
                onClick={() => setVideoUrl(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ← Change Video
              </button>
            </div>

            <PoseComparison referenceVideoUrl={videoUrl} />

            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Tips:</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Make sure your full body is visible in the webcam</li>
                <li>Ensure good lighting for better pose detection</li>
                <li>Try to match the exact pose angles for higher scores</li>
                <li>Green (&gt;80%) means excellent match!</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
