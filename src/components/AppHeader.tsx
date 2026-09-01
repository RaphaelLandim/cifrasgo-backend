import { ArrowLeft, Eye, EyeOff, HelpCircle, Link2, Menu, Plus, Save, Search } from 'lucide-react';
import { Text, TouchableOpacity, View } from 'react-native-web';
import type { SongEditorHeaderControls, TopBarControls } from '../navigation/manualTypes';

interface AppHeaderProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  isEditor: boolean;
  isSongDetail?: boolean;
  canGoBack: boolean;
  songEditorHeaderControls: SongEditorHeaderControls | null;
  topBarControls: TopBarControls | null;
  songDetailControlsVisible?: boolean;
  onToggleSongDetailControls?: () => void;
  onOpenDrawer: () => void;
  onBackPress: () => void;
  styles: any;
}

export function AppHeader({
  visible,
  title,
  subtitle,
  isEditor,
  isSongDetail,
  canGoBack,
  songEditorHeaderControls,
  topBarControls,
  songDetailControlsVisible,
  onToggleSongDetailControls,
  onOpenDrawer,
  onBackPress,
  styles,
}: AppHeaderProps) {
  if (!visible) return null;
  const songDetailHelp = topBarControls?.songDetailHelp;
  const headerHelpStyle = songDetailHelp?.active
    ? {
        borderColor: 'var(--app-accent)',
        backgroundColor: 'var(--app-accent-soft)',
        boxShadow: '0 0 0 2px rgba(79, 195, 247, 0.26), 0 0 18px rgba(79, 195, 247, 0.22)',
      }
    : null;
  const headerActiveHelpLayerStyle = songDetailHelp?.active
    ? {
        zIndex: 90,
      }
    : null;
  const helpToggleLayerStyle = songDetailHelp?.active
    ? {
        position: 'relative' as const,
        zIndex: 91,
      }
    : null;

  return (
    <View style={[styles.header, headerActiveHelpLayerStyle]}>
      <TouchableOpacity
        style={[styles.iconBtn, headerHelpStyle]}
        onPress={() => {
          if (songDetailHelp?.active) {
            songDetailHelp.onExplain('headerMenu');
            return;
          }
          onOpenDrawer();
        }}
      >
        <Menu size={22} color="#b1b8be" />
      </TouchableOpacity>
      <View style={[styles.headerTitleBlock, isSongDetail && styles.songHeaderTitleBlock]}>
        <Text style={[styles.headerTitle, isSongDetail && styles.songHeaderTitle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, isSongDetail && styles.songHeaderSubtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isEditor ? (
        <View style={styles.headerActionGroup}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => songEditorHeaderControls?.onCancel()}>
            <Text style={styles.editorActionLabel}>X</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !songEditorHeaderControls?.canOpenSource ? { opacity: 0.45 } : null]}
            onPress={() => songEditorHeaderControls?.onOpenSource()}
            disabled={!songEditorHeaderControls?.canOpenSource}
          >
            <Link2 size={17} color="#4FC3F7" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => songEditorHeaderControls?.onSave()}>
            <Save size={17} color="#4FC3F7" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.headerActionGroup}>
          {canGoBack ? (
            <TouchableOpacity
              style={[styles.iconBtn, headerHelpStyle]}
              onPress={() => {
                if (songDetailHelp?.active) {
                  songDetailHelp.onExplain('headerBack');
                  return;
                }
                onBackPress();
              }}
            >
              <ArrowLeft size={20} color="#4FC3F7" />
            </TouchableOpacity>
          ) : null}
          {onToggleSongDetailControls ? (
            <TouchableOpacity
              style={[styles.iconBtn, headerHelpStyle]}
              onPress={() => {
                if (songDetailHelp?.active) {
                  songDetailHelp.onExplain('headerControls');
                  return;
                }
                onToggleSongDetailControls();
              }}
            >
              {songDetailControlsVisible ? (
                <Eye size={19} color="#4FC3F7" />
              ) : (
                <EyeOff size={19} color="#4FC3F7" />
              )}
            </TouchableOpacity>
          ) : null}
          {songDetailHelp ? (
            <TouchableOpacity
              style={[styles.iconBtn, headerHelpStyle, helpToggleLayerStyle]}
              onPress={songDetailHelp.onToggle}
            >
              <HelpCircle size={19} color={songDetailHelp.active ? 'var(--app-accent)' : '#4FC3F7'} />
            </TouchableOpacity>
          ) : null}
          {topBarControls?.showSearch ? (
            <TouchableOpacity style={styles.iconBtn} onPress={topBarControls.onSearchPress}>
              <Search size={20} color={topBarControls.searchActive ? '#4FC3F7' : '#bbb'} />
            </TouchableOpacity>
          ) : null}
          {topBarControls?.showAdd ? (
            <TouchableOpacity style={styles.iconBtn} onPress={topBarControls.onAddPress}>
              <Plus size={22} color="#4FC3F7" />
            </TouchableOpacity>
          ) : null}
          {!canGoBack && !onToggleSongDetailControls && !topBarControls?.showSearch && !topBarControls?.showAdd ? (
            <View style={{ width: 40 }} />
          ) : null}
        </View>
      )}
    </View>
  );
}
