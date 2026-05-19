import { ArrowLeft, Eye, EyeOff, Link2, Menu, Plus, Save, Search } from 'lucide-react';
import { Text, TouchableOpacity, View } from 'react-native-web';
import type { SongEditorHeaderControls, TopBarControls } from '../navigation/manualTypes';

interface AppHeaderProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  isEditor: boolean;
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

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconBtn} onPress={onOpenDrawer}>
        <Menu size={22} color="#b1b8be" />
      </TouchableOpacity>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
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
            <TouchableOpacity style={styles.iconBtn} onPress={onBackPress}>
              <ArrowLeft size={20} color="#4FC3F7" />
            </TouchableOpacity>
          ) : null}
          {onToggleSongDetailControls ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onToggleSongDetailControls}>
              {songDetailControlsVisible ? (
                <Eye size={19} color="#4FC3F7" />
              ) : (
                <EyeOff size={19} color="#4FC3F7" />
              )}
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
