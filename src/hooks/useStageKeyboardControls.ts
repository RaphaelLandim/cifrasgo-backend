import { useEffect } from 'react';

interface UseStageKeyboardControlsOptions {
  enabled: boolean;
  isPlaying: boolean;
  overlayOpen?: boolean;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  onToggleAutoScroll?: () => void;
  onNextSong?: () => void;
  onPreviousSong?: () => void;
  onEscape?: () => void;
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if (target.isContentEditable) return true;

  return !!target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"]');
};

export function useStageKeyboardControls({
  enabled,
  isPlaying,
  overlayOpen = false,
  canGoNext = false,
  canGoPrevious = false,
  onToggleAutoScroll,
  onNextSong,
  onPreviousSong,
  onEscape,
}: UseStageKeyboardControlsOptions) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      if (!isPlaying) return;

      const isEscape = event.key === 'Escape' || event.code === 'Escape';
      const isSpace = event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space';
      const isNext = event.key === 'ArrowDown' || event.key === 'PageDown' || event.code === 'ArrowDown' || event.code === 'PageDown';
      const isPrevious = event.key === 'ArrowUp' || event.key === 'PageUp' || event.code === 'ArrowUp' || event.code === 'PageUp';

      if (isEscape) {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (overlayOpen) return;

      if (isSpace) {
        event.preventDefault();
        onToggleAutoScroll?.();
        return;
      }

      if (isNext && canGoNext) {
        event.preventDefault();
        onNextSong?.();
        return;
      }

      if (isPrevious && canGoPrevious) {
        event.preventDefault();
        onPreviousSong?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canGoNext,
    canGoPrevious,
    enabled,
    isPlaying,
    onEscape,
    onNextSong,
    onPreviousSong,
    onToggleAutoScroll,
    overlayOpen,
  ]);
}
