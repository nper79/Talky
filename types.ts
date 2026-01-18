
export enum AvatarState {
  IDLE = 'idle',
  TALKING = 'talking'
}

export interface Frame {
  id: string;
  dataUrl: string;
  state: AvatarState;
}

export interface SourceVideo {
  id: string;
  file: File;
  state: AvatarState;
  previewUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface AppState {
  step: 'setup' | 'processing' | 'interact';
  sourceVideos: SourceVideo[];
  frames: Frame[];
}
