import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  Info,
  Keyboard,
  Mic2,
  Music,
  Play,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

type GuideSection = {
  title: string;
  intro: string;
  bullets: string[];
  icon: React.ReactNode;
  tone: string;
};

const productHighlights = [
  { label: 'Offline-first', icon: <WifiOff size={14} color="#38bdf8" /> },
  { label: 'Modo Vocalista', icon: <Mic2 size={14} color="#22c55e" /> },
  { label: 'PDFs', icon: <FileText size={14} color="#a855f7" /> },
  { label: 'Auto-scroll', icon: <Play size={14} color="#06b6d4" /> },
  { label: 'Backup seguro', icon: <ShieldCheck size={14} color="#f59e0b" /> },
];

const guideSections: GuideSection[] = [
  {
    title: 'Pensado para palco e ensaio',
    intro: 'Abra um repertorio, leia com calma, troque de musica ou PDF e siga tocando sem perder o ritmo.',
    icon: <Keyboard size={20} color="#38bdf8" />,
    tone: '#38bdf8',
    bullets: [
      'O CifrasGo foi feito para missa, culto, ensaio, palco e estudo pessoal, com foco em leitura continua no tablet ou celular.',
      'A experiencia prioriza poucos toques, troca rapida e uma tela que ajuda sem chamar mais atencao que a musica.',
    ],
  },
  {
    title: 'Cifras sem distracao',
    intro: 'A musica fica no centro: letra, acordes, tom, fonte e recursos de apoio aparecem quando fazem sentido.',
    icon: <Music size={20} color="#a855f7" />,
    tone: '#a855f7',
    bullets: [
      'Transposicao, tamanho de fonte, YouTube, metronomo, gravacao e post-it ajudam no preparo sem alterar a musica original.',
      'O Modo Vocalista oculta acordes durante a leitura, mantendo a cifra completa salva para quem toca.',
    ],
  },
  {
    title: 'Repertorios organizados',
    intro: 'Listas, pastas, subpastas, roteiros e PDFs ajudam a montar a ordem real de uma celebracao ou apresentacao.',
    icon: <Folder size={20} color="#f59e0b" />,
    tone: '#f59e0b',
    bullets: [
      'O repertorio pode ser organizado por grupo, evento, missa, culto, ensaio ou momento do roteiro.',
      'A Central de classificacao ajuda a organizar generos de muitas musicas de uma vez, sem duplicar musicas nem substituir a edicao individual.',
      'PDFs rapidos entram nas listas, e listas tambem podem virar PDF com acordes ou em Modo Vocalista para compartilhar ou imprimir.',
    ],
  },
  {
    title: 'Modo Play',
    intro: 'Uma leitura de execucao: mais espaco para a cifra, controles rapidos e continuidade entre musicas.',
    icon: <Play size={20} color="#06b6d4" />,
    tone: '#06b6d4',
    bullets: [
      'Auto-scroll, swipe entre musicas, lista atual e atalhos por teclado ou pedal Bluetooth reduzem a dependencia do toque na tela e ajudam a manter a continuidade do repertorio.',
      'Quando possivel, o app tenta manter a tela acordada durante a musica ou PDF para evitar interrupcoes no meio da execucao.',
    ],
  },
  {
    title: 'Offline e seguro',
    intro: 'O repertorio salvo fica com voce, pronto para abrir mesmo quando a internet nao esta no centro da cena.',
    icon: <ShieldCheck size={20} color="#22c55e" />,
    tone: '#22c55e',
    bullets: [
      'Depois de salvas, musicas, listas e PDFs locais ficam disponiveis no app; a internet entra para importar, abrir links e compartilhar quando necessario.',
      'Backup completo, backup personalizado e restauracao em modo mesclar ajudam a trocar de aparelho ou proteger o acervo sem susto.',
    ],
  },
  {
    title: 'Filosofia do app',
    intro: 'Uma ferramenta de repertorio precisa ser confiavel antes de ser chamativa.',
    icon: <Info size={20} color="#14b8a6" />,
    tone: '#14b8a6',
    bullets: [
      'O CifrasGo evolui em pequenas melhorias continuas, priorizando estabilidade, leitura fluida e uso real antes de mudancas arriscadas.',
      'A ideia e manter o app leve, direto e pronto para o momento em que a musica precisa acontecer.',
    ],
  },
];

export function AboutScreen() {
  const { themeSettings } = useSettings();
  const [expandedSectionTitle, setExpandedSectionTitle] = React.useState<string | null>('Pensado para uso real');
  const isLightTheme = themeSettings.mode === 'light';

  return (
    <ScrollView style={localStyles.container} contentContainerStyle={localStyles.content}>
      <View style={[localStyles.hero, isLightTheme && localStyles.heroLight]}>
        <View style={[localStyles.heroIcon, isLightTheme && localStyles.heroIconLight]}>
          <BookOpen size={33} color="#7dd3fc" />
        </View>
        <View style={localStyles.heroText}>
          <Text style={localStyles.eyebrow}>Sobre o app</Text>
          <Text style={localStyles.title}>Seu repertorio sempre pronto.</Text>
          <Text style={localStyles.subtitle}>
            Cifras, listas, PDFs e execucao ao vivo no mesmo fluxo.
          </Text>
          <View style={localStyles.highlightGrid}>
            {productHighlights.map((item) => (
              <View key={item.label} style={[localStyles.highlightPill, isLightTheme && localStyles.highlightPillLight]}>
                {item.icon}
                <Text style={localStyles.highlightText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={localStyles.grid}>
        {guideSections.map((section) => {
          const expanded = expandedSectionTitle === section.title;
          return (
            <TouchableOpacity
              key={section.title}
              accessibilityRole="button"
              accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} ${section.title}`}
              activeOpacity={0.86}
              onPress={() => setExpandedSectionTitle((current) => (current === section.title ? null : section.title))}
              style={[
                localStyles.card,
                isLightTheme && localStyles.cardLight,
                !expanded && localStyles.cardCollapsed,
                expanded && localStyles.cardExpanded,
              ]}
            >
              <View style={localStyles.cardHeader}>
                <View
                  style={[
                    localStyles.cardIcon,
                    { backgroundColor: `${section.tone}16`, borderColor: `${section.tone}33` },
                  ]}
                >
                  {section.icon}
                </View>
                <View style={localStyles.cardTitleWrap}>
                  <Text style={localStyles.cardTitle}>{section.title}</Text>
                  <Text style={localStyles.cardIntro} numberOfLines={expanded ? undefined : 2}>
                    {section.intro}
                  </Text>
                </View>
                <View style={[localStyles.chevronSlot, isLightTheme && localStyles.chevronSlotLight]}>
                  {expanded ? (
                    <ChevronUp size={17} color="var(--app-muted-text)" />
                  ) : (
                    <ChevronDown size={17} color="var(--app-muted-text)" />
                  )}
                </View>
              </View>
              {expanded && section.bullets.length ? (
                <View style={localStyles.bulletList}>
                  {section.bullets.map((bullet) => (
                    <View key={bullet} style={localStyles.bulletRow}>
                      <Text style={[localStyles.bulletDot, { color: section.tone }]}>-</Text>
                      <Text style={localStyles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'var(--app-bg)',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 12,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.38)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage:
      'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(2,6,23,0.30) 55%, rgba(14,165,233,0.12) 100%)',
    borderRadius: 10,
    padding: 18,
    boxShadow: '0 18px 34px rgba(0,0,0,0.18)',
  },
  heroLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: '#fffdf8',
    backgroundImage:
      'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(238,244,248,0.92) 58%, rgba(232,219,190,0.40) 100%)',
    boxShadow: '0 18px 34px rgba(31,41,55,0.08)',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.36)',
    boxShadow: '0 12px 24px rgba(14,165,233,0.12)',
    flexShrink: 0,
  },
  heroIconLight: {
    backgroundColor: 'rgba(15,131,201,0.10)',
    borderColor: 'rgba(15,131,201,0.24)',
    boxShadow: '0 12px 24px rgba(15,131,201,0.10)',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: 'var(--app-text)',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
  },
  subtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  highlightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    marginTop: 15,
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.20)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  highlightPillLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: 'rgba(255,253,248,0.82)',
  },
  highlightText: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage:
      'linear-gradient(135deg, rgba(15,23,42,0.18) 0%, rgba(30,41,59,0.08) 60%, rgba(14,165,233,0.05) 100%)',
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 10px 22px rgba(0,0,0,0.10)',
  },
  cardLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: '#fffdf8',
    backgroundImage:
      'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(241,245,247,0.82) 62%, rgba(15,131,201,0.035) 100%)',
    boxShadow: '0 10px 22px rgba(31,41,55,0.06)',
  },
  cardCollapsed: {
    minHeight: 76,
    justifyContent: 'center',
  },
  cardExpanded: {
    minHeight: 94,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  chevronSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    flexShrink: 0,
  },
  chevronSlotLight: {
    backgroundColor: 'rgba(238,244,248,0.72)',
    borderColor: 'rgba(15,131,201,0.12)',
  },
  cardTitle: {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  cardIntro: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  bulletList: {
    gap: 7,
    marginTop: 12,
    paddingLeft: 58,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  bulletText: {
    flex: 1,
    color: 'var(--app-text)',
    fontSize: 13,
    lineHeight: 20,
  },
});
