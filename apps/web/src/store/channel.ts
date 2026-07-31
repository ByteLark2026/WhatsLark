import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChannelInfo {
  id: string;
  name: string;
  phone_number: string;
}

interface ChannelState {
  channels: ChannelInfo[];
  selectedChannelId: string | null;
  setChannels: (channels: ChannelInfo[]) => void;
  setSelectedChannelId: (id: string | null) => void;
}

export const useChannelStore = create<ChannelState>()(
  persist(
    (set) => ({
      channels: [],
      selectedChannelId: null,
      setChannels: (channels) => set({ channels }),
      setSelectedChannelId: (selectedChannelId) => set({ selectedChannelId }),
    }),
    { name: 'whatslark-channel' },
  ),
);
