/**
 * Game page - Main dance game interface
 */

import { notFound } from 'next/navigation';
import DanceGame from '@/components/DanceGame';
import { loadReferenceData } from '@/lib/videoProcessor';

export default async function GamePage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  // Load reference data
  const referenceData = await loadReferenceData(videoId);

  if (!referenceData) {
    notFound();
  }

  // Construct video URL
  const videoUrl = `/videos/${videoId}.mp4`;

  return <DanceGame referenceData={referenceData} videoUrl={videoUrl} />;
}
