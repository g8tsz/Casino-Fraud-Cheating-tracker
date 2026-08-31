'use client';

import { useEffect, useRef, useState } from 'react';
import type { CctvCameraPublic } from '@/lib/types';

export function CctvPlayer({ camera, compact }: { camera: CctvCameraPublic; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (camera.streamType !== 'snapshot') return;
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, [camera.streamType]);

  useEffect(() => {
    if (camera.streamType !== 'hls' || !videoRef.current) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('hls.js');
        const Hls = mod.default;
        if (cancelled || !videoRef.current) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
          instance.loadSource(camera.playbackUrl);
          instance.attachMedia(videoRef.current);
          instance.on(Hls.Events.ERROR, () => setError('HLS playback failed'));
          hls = instance;
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = camera.playbackUrl;
        } else {
          setError('HLS not supported in this browser');
        }
      } catch {
        if (videoRef.current) videoRef.current.src = camera.playbackUrl;
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [camera.streamType, camera.playbackUrl]);

  const height = compact ? 'h-28' : 'h-44';

  if (camera.streamType === 'iframe') {
    return (
      <iframe
        title={camera.name}
        src={camera.playbackUrl}
        className={`w-full ${height} rounded border border-zinc-700 bg-black`}
        allow="autoplay; fullscreen"
      />
    );
  }

  if (camera.streamType === 'hls') {
    return (
      <div className={`relative w-full ${height} overflow-hidden rounded border border-zinc-700 bg-black`}>
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay controls={!compact} />
        {error && <p className="absolute inset-0 flex items-center justify-center bg-black/80 p-2 text-center text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  if (camera.streamType === 'mjpeg') {
    return (
      <img
        alt={camera.name}
        src={camera.playbackUrl}
        className={`w-full ${height} rounded border border-zinc-700 bg-black object-cover`}
        onError={() => setError('MJPEG stream unavailable')}
      />
    );
  }

  const snapshotSrc = `${camera.playbackUrl}${camera.playbackUrl.includes('?') ? '&' : '?'}t=${tick}`;
  return (
    <img
      alt={camera.name}
      src={snapshotSrc}
      className={`w-full ${height} rounded border border-zinc-700 bg-black object-cover`}
      onError={() => setError('Snapshot unavailable')}
    />
  );
}
