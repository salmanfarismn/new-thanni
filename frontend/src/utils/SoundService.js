/**
 * SoundService - Handles notification sounds for the web application
 */
const WATER_DROP_URL = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';

export const SoundService = {
    playWaterDrop() {
        try {
            const audio = new Audio(WATER_DROP_URL);
            audio.volume = 0.6;
            audio.play().catch(err => {
                console.warn('Audio playback blocked by browser. User interaction required first.', err);
            });
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }
};
