export type MusicTrack = {
  id: string;
  name: string;
  mood: string;
  url: string;
};

// Trilhas royalty-free hospedadas no Pixabay/Mixkit (acesso público).
// Caso alguma URL caia, basta substituir aqui.
export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: "lofi-chill",
    name: "Lo-fi Chill",
    mood: "Calmo / lo-fi",
    url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
  },
  {
    id: "corporate-upbeat",
    name: "Corporate Upbeat",
    mood: "Corporativo / motivacional",
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e49b53.mp3",
  },
  {
    id: "energetic-rock",
    name: "Energetic Rock",
    mood: "Energético / rock",
    url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_8fdfde04a6.mp3",
  },
  {
    id: "cinematic-trailer",
    name: "Cinematic Trailer",
    mood: "Épico / cinematográfico",
    url: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_2dde668ca0.mp3",
  },
  {
    id: "tech-pulse",
    name: "Tech Pulse",
    mood: "Tech / eletrônico",
    url: "https://cdn.pixabay.com/download/audio/2023/06/19/audio_42e07d5a40.mp3",
  },
  {
    id: "soft-ambient",
    name: "Soft Ambient",
    mood: "Ambiente / suave",
    url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bdd.mp3",
  },
];
