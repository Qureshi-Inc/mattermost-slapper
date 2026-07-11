export interface ResolvedSong {
  title?: string;
  artist?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
}

export interface MusicResolver {
  resolve(url: string): Promise<ResolvedSong | null>;
}
