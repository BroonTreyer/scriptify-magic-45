export type HeygenAvatar = {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string;
};

export type HeygenVoice = {
  voice_id: string;
  name: string;
  gender: string;
  preview_audio?: string;
};

export type HeygenRatio = "9:16" | "1:1" | "16:9";
export type HeygenResolution = "720p" | "1080p";

export type HeygenVideoConfig = {
  avatar_id: string;
  voice_id: string;
  text: string;
  speed: number;
  ratio: HeygenRatio;
  resolution: HeygenResolution;
};

export type HeygenVideoStatus = {
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
};

export type GeneratedVideo = {
  videoId: string;
  videoUrl: string;
  generatedAt: string;
};