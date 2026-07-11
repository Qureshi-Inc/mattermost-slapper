export interface ResolvedSong {
  title?: string;
  artist?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  spotifyIsSearch?: boolean;
  appleMusicIsSearch?: boolean;
}

export interface MusicResolver {
  resolve(url: string): Promise<ResolvedSong | null>;
}
