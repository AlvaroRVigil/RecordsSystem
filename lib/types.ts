export type Track = {
  position: string;
  title: string;
  duration: string;
};

export type Vinyl = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  label: string;
  country: string;
  palette: string[];
  discogsId: number | null;
  cover: string | null;
  previewUrl: string | null;
  tracklist: Track[];
};
