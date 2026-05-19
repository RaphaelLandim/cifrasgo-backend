import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native-web';
import { ListMusic } from 'lucide-react';
import { buildCifrasGoFullBackupZip, restoreBackupZip, restoreCifrasGoSongTextFile } from '../services/backup';
import { shareBlobFile } from '../services/share';

interface BackupScreenProps {
  styles: any;
}

export function BackupScreen({ styles }: BackupScreenProps) {
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<{ done: number; total: number } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busy = restoreLoading || exportLoading;

  const exportFullBackup = async () => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setExportLoading(true);
    try {
      const blob = await buildCifrasGoFullBackupZip();
      const date = new Date().toISOString().slice(0, 10);
      const shared = await shareBlobFile({
        blob,
        fileName: `CifrasGo-backup-${date}.zip`,
        title: 'Backup completo CifrasGo',
        text: 'Backup completo do CifrasGo.',
        fallbackMessage: 'O compartilhamento nao abriu, entao o backup completo foi baixado.',
      });
      if (shared) setRestoreMsg('Backup completo gerado com sucesso.');
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao gerar o backup completo.');
    } finally {
      setExportLoading(false);
    }
  };

  const restoreZip = async (file: File) => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setRestoreLoading(true);
    try {
      const result = await restoreBackupZip(file, {
        onProgress: setRestoreProgress,
      });
      setRestoreMsg(result.message);
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao restaurar o backup.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const restoreFile = async (file: File) => {
    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (!isTxt) {
      await restoreZip(file);
      return;
    }

    setRestoreMsg(null);
    setRestoreProgress(null);
    setRestoreLoading(true);
    try {
      const result = await restoreCifrasGoSongTextFile(file);
      setRestoreMsg(result.message);
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao importar a musica.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const cardStyle = {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border)',
    backgroundColor: 'var(--app-surface)',
    padding: 14,
    gap: 10,
  } as const;
  const cardHeaderStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  } as const;
  const cardTitleStyle = {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '800',
  } as const;
  const soonBadgeStyle = {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  } as const;
  const disabledButtonStyle = {
    opacity: 0.55,
  } as const;

  return (
    <View style={[styles.container, { padding: 16 }]}>
      <View style={styles.importBanner}>
        <ListMusic size={44} color="#4FC3F7" />
        <Text style={styles.importTitle}>Backup/Restauracao</Text>
        <Text style={styles.importDesc}>
          Aqui voce vai restaurar suas musicas a partir de um `.zip` ou `.txt` do CifrasGo.
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <View>
          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <Text style={cardTitleStyle}>Importar / Restaurar</Text>
            </View>
            <Text style={styles.subtitle}>Restaure backups legados, listas exportadas ou musicas em `.txt` do CifrasGo.</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginHorizontal: 0 }]}
              onPress={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {restoreLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={{ color: '#000', fontWeight: '700' }}>Selecionar arquivo (.zip/.txt)</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <Text style={cardTitleStyle}>Backup completo</Text>
            </View>
            <Text style={styles.subtitle}>Exporta musicas, listas, pastas, subpastas, vinculos, generos e configuracoes.</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginHorizontal: 0 }]}
              onPress={() => void exportFullBackup()}
              disabled={busy}
            >
              {exportLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={{ color: '#000', fontWeight: '700' }}>Gerar backup completo</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <View style={cardHeaderStyle}>
              <Text style={cardTitleStyle}>Backup personalizado</Text>
              <View style={soonBadgeStyle}>
                <Text style={[styles.subtitle, { fontSize: 12, fontWeight: '800' }]}>Em breve</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Escolha musicas, listas e pastas especificas para montar um backup sob medida.</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginHorizontal: 0 }, disabledButtonStyle]}
              disabled
            >
              <Text style={{ color: '#000', fontWeight: '700' }}>Configurar backup personalizado</Text>
            </TouchableOpacity>
          </View>

          <input
            ref={(element) => {
              fileInputRef.current = element;
            }}
            type="file"
            accept=".zip,.txt,application/zip,text/plain"
            disabled={busy}
            onChange={(event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void restoreFile(file);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
          {restoreProgress ? (
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginTop: 2 }]}>
              Processando {restoreProgress.done}/{restoreProgress.total}...
            </Text>
          ) : null}
          {restoreMsg ? <Text style={[styles.subtitle, { marginHorizontal: 12, marginTop: 8 }]}>{restoreMsg}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
