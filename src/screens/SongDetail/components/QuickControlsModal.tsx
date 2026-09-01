import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { ChevronLeft, ChevronRight, ListMusic, Menu } from 'lucide-react';
import { AppModal } from '../../../components/AppModal';

interface AutoScrollPresetOption<PresetValue extends string = string> {
  value: PresetValue;
  label: string;
  speed: number;
}

interface QuickControlsModalProps<PresetValue extends string = string> {
  visible: boolean;
  currentListName: string;
  currentSongIndex: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
  selectedTom: string;
  playlistControlsVisible: boolean;
  autoScrollPreset: PresetValue | 'custom';
  autoScrollPresetOptions: readonly AutoScrollPresetOption<PresetValue>[];
  customAutoScrollSpeed: number;
  hasAudioNote: boolean;
  audioPlayer: ReactNode;
  onClose: () => void;
  onNavigateToIndex: (index: number) => void;
  onOpenCurrentList: () => void;
  onOpenAddToPlaylist: () => void;
  onChangeFontSize: (delta: number) => void;
  onOpenTom: () => void;
  onTogglePlaylistControls: () => void;
  onOpenCustomAutoScroll: () => void;
  onSelectAutoScrollPreset: (preset: PresetValue) => void;
}

export function QuickControlsModal<PresetValue extends string = string>({
  visible,
  currentListName,
  currentSongIndex,
  previousDisabled,
  nextDisabled,
  selectedTom,
  playlistControlsVisible,
  autoScrollPreset,
  autoScrollPresetOptions,
  customAutoScrollSpeed,
  hasAudioNote,
  audioPlayer,
  onClose,
  onNavigateToIndex,
  onOpenCurrentList,
  onOpenAddToPlaylist,
  onChangeFontSize,
  onOpenTom,
  onTogglePlaylistControls,
  onOpenCustomAutoScroll,
  onSelectAutoScrollPreset,
}: QuickControlsModalProps<PresetValue>) {
  return (
    <AppModal
      visible={visible}
      title="Controles Rápidos"
      onClose={onClose}
      icon={<Menu size={16} color="var(--app-accent)" />}
      maxWidth={520}
    >
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.body}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navegação</Text>
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[
                styles.navButton,
                previousDisabled && styles.disabledButton,
              ]}
              disabled={previousDisabled}
              onPress={() => onNavigateToIndex(currentSongIndex - 1)}
            >
              <ChevronLeft size={18} color={previousDisabled ? '#777' : '#4FC3F7'} />
              <Text style={[styles.navButtonText, previousDisabled && styles.disabledText]}>
                Anterior
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.navButton,
                !nextDisabled && styles.navButtonPrimary,
                nextDisabled && styles.disabledButton,
              ]}
              disabled={nextDisabled}
              onPress={() => onNavigateToIndex(currentSongIndex + 1)}
            >
              <Text style={[styles.navButtonText, nextDisabled && styles.disabledText]}>
                Próxima
              </Text>
              <ChevronRight size={18} color={nextDisabled ? '#777' : '#4FC3F7'} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lista atual</Text>
          <TouchableOpacity
            style={styles.featureButton}
            onPress={onOpenCurrentList}
          >
            <View style={styles.featureIcon}>
              <ListMusic size={20} color="#4FC3F7" />
            </View>
            <View style={styles.featureTextBlock}>
              <Text style={styles.featureTitle}>Ver Lista Atual</Text>
              <Text style={styles.featureSubtitle} numberOfLines={1}>{currentListName}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.featureButton, styles.featureButtonTight, { display: 'none' }]}
            onPress={onOpenAddToPlaylist}
          >
            <View style={styles.featureIcon}>
              <ListMusic size={19} color="#4FC3F7" />
            </View>
            <View style={styles.featureTextBlock}>
              <Text style={styles.featureTitle}>Adicionar à lista</Text>
              <Text style={styles.featureSubtitle} numberOfLines={1}>Enviar música atual para um repertório</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exibição</Text>
          <View style={styles.controlGrid}>
            <TouchableOpacity style={styles.controlPill} onPress={() => onChangeFontSize(-1)}>
              <Text style={styles.controlPillText}>A-</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlPill} onPress={() => onChangeFontSize(1)}>
              <Text style={styles.controlPillText}>A+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlPill, styles.controlPillSoft]} onPress={onOpenTom}>
              <Text style={styles.controlPillAccent}>{selectedTom}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlPill, styles.controlPillWide]}
              onPress={onTogglePlaylistControls}
            >
              <Text style={styles.controlPillAccent}>
                {playlistControlsVisible ? 'Ocultar botões' : 'Mostrar botões'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-scroll</Text>
          <View style={styles.autoScrollBox}>
            <View style={styles.autoScrollHeader}>
              <View>
                <Text style={styles.featureTitle}>Auto-scroll</Text>
                <Text style={styles.featureSubtitle}>Rolar cifra no modo Play</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.autoScrollCustomHeaderButton,
                  autoScrollPreset === 'custom' && styles.autoScrollPresetActive,
                ]}
                onPress={onOpenCustomAutoScroll}
              >
                <Text style={[
                  styles.autoScrollPresetText,
                  autoScrollPreset === 'custom' && styles.autoScrollPresetTextActive,
                ]}>
                  Personalizado
                </Text>
                <Text style={[
                  styles.autoScrollPresetHint,
                  autoScrollPreset === 'custom' && styles.autoScrollPresetTextActive,
                ]}>
                  {customAutoScrollSpeed} px/s
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.autoScrollSectionTitle}>Velocidade da rolagem</Text>
            <View style={styles.autoScrollPresetRow}>
              {autoScrollPresetOptions.map((option) => {
                const selected = autoScrollPreset === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.autoScrollPreset,
                      selected && styles.autoScrollPresetActive,
                    ]}
                    onPress={() => onSelectAutoScrollPreset(option.value)}
                  >
                    <Text style={[
                      styles.autoScrollPresetText,
                      selected && styles.autoScrollPresetTextActive,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.autoScrollPresetHint,
                      selected && styles.autoScrollPresetTextActive,
                    ]}>
                      {option.speed} px/s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                styles.autoScrollPreset,
                styles.autoScrollCustomPreset,
                { display: 'none' },
                autoScrollPreset === 'custom' && styles.autoScrollPresetActive,
              ]}
              onPress={onOpenCustomAutoScroll}
            >
              <Text style={[
                styles.autoScrollPresetText,
                autoScrollPreset === 'custom' && styles.autoScrollPresetTextActive,
              ]}>
                Personalizado
              </Text>
              <Text style={[
                styles.autoScrollPresetHint,
                autoScrollPreset === 'custom' && styles.autoScrollPresetTextActive,
              ]}>
                {customAutoScrollSpeed} px/s
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasAudioNote ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gravação</Text>
            <View style={styles.audioSection}>
              {audioPlayer}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    maxHeight: '72vh',
    minHeight: 0,
  },
  body: {
    paddingHorizontal: 4,
    paddingBottom: 12,
    gap: 10,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'rgba(255,255,255,0.015)',
    padding: 9,
    gap: 8,
  },
  sectionTitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonPrimary: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  navButtonText: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.46,
  },
  disabledText: {
    color: 'var(--app-muted-text)',
  },
  featureButton: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureButtonTight: {
    minHeight: 48,
    paddingVertical: 8,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  featureSubtitle: {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  controlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlPill: {
    flexGrow: 1,
    minWidth: 68,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPillSoft: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  controlPillWide: {
    flexBasis: 132,
    minWidth: 118,
  },
  controlPillText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  controlPillAccent: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '900',
  },
  autoScrollBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  autoScrollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autoScrollCustomHeaderButton: {
    minWidth: 128,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  autoScrollSectionTitle: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  autoScrollPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  autoScrollPreset: {
    flexGrow: 1,
    flexBasis: 92,
    minWidth: 82,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  autoScrollPresetActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  autoScrollCustomPreset: {
    flexBasis: 'auto',
    width: '100%',
    minHeight: 42,
  },
  autoScrollPresetText: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  autoScrollPresetHint: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  autoScrollPresetTextActive: {
    color: 'var(--app-accent)',
  },
  audioSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    padding: 8,
  },
});
