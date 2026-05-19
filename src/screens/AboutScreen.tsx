import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native-web';
import {
  Archive,
  BookOpen,
  Clock,
  Folder,
  Info,
  Lightbulb,
  ListMusic,
  Mic,
  Music,
  Palette,
  StickyNote,
} from 'lucide-react';

const APP_VERSION = '0.0.0';

type GuideSection = {
  title: string;
  intro: string;
  bullets: string[];
  icon: React.ReactNode;
};

const guideSections: GuideSection[] = [
  {
    title: 'Sobre o CifrasGo',
    intro: 'Um app de repertório para músicos, ministérios e ensaios, feito para organizar cifras com rapidez e segurança.',
    icon: <Info size={20} color="var(--app-accent)" />,
    bullets: [
      'Funciona como biblioteca offline de músicas, listas, pastas e subpastas.',
      'Mantém recursos de palco como modo apresentação, transposição, post-it, metrônomo e gravação de referência.',
      'Preserva compatibilidade com backups próprios do CifrasGo e formatos legados.',
    ],
  },
  {
    title: 'Guia rápido',
    intro: 'O fluxo principal começa em Músicas, Pastas/Listas ou Importar Cifras.',
    icon: <BookOpen size={20} color="var(--app-accent)" />,
    bullets: [
      'Use Importar para trazer cifras por URL quando o backend estiver configurado.',
      'Use o editor para ajustar título, artista, gêneros, fonte, metrônomo e gravação de referência.',
      'Abra a música para transpor, tocar, editar post-it, ouvir áudio e entrar no modo apresentação.',
    ],
  },
  {
    title: 'Pastas e subpastas',
    intro: 'Pastas ajudam a separar repertórios por evento, grupo, celebração ou finalidade.',
    icon: <Folder size={20} color="var(--app-accent)" />,
    bullets: [
      'A estrutura aceita pasta, subpasta e sub-subpasta.',
      'Dentro de cada nível é possível criar listas, vincular músicas e compartilhar a pasta completa.',
      'O app preserva o caminho real no botão voltar para não pular etapas profundas.',
    ],
  },
  {
    title: 'Playlists / Listas',
    intro: 'Listas podem funcionar como sequência simples ou roteiro completo de ensaio.',
    icon: <ListMusic size={20} color="var(--app-accent)" />,
    bullets: [
      'Modo padrão mantém uma ordem simples de músicas.',
      'Modo roteiro permite seções litúrgicas, cores por seção, drag/drop e fallbacks por botões.',
      'Ao tocar uma lista no modo apresentação, use swipe horizontal para avançar ou voltar músicas do repertório.',
      'Listas podem ser compartilhadas em ZIP próprio com músicas e estrutura preservadas.',
    ],
  },
  {
    title: 'Post-it musical',
    intro: 'Anotações rápidas ficam na própria tela da música, como lembretes de performance.',
    icon: <StickyNote size={20} color="var(--app-accent)" />,
    bullets: [
      'Crie, edite, mova, redimensione, troque a cor e oculte por música.',
      'O X apenas esconde a nota; excluir anotação remove o texto salvo.',
      'Posição, tamanho, cor e estado aberto/fechado são preservados por música.',
    ],
  },
  {
    title: 'Gravação de referência',
    intro: 'Cada música pode ter um áudio curto para lembrar entrada, melodia ou condução.',
    icon: <Mic size={20} color="var(--app-accent)" />,
    bullets: [
      'A gravação usa microfone via APIs nativas do navegador/WebView.',
      'O mini player permite tocar, pausar, acompanhar progresso e buscar um trecho.',
      'O áudio fica salvo localmente junto da música nesta versão MVP.',
    ],
  },
  {
    title: 'Metrônomo',
    intro: 'O metrônomo é configurado por música para apoiar ensaio e execução.',
    icon: <Clock size={20} color="var(--app-accent)" />,
    bullets: [
      'Configure BPM, compasso, beep visual e beep sonoro no editor.',
      'Na tela da música, indicadores discretos mostram e controlam o estado do metrônomo.',
      'O áudio usa Web Audio API quando disponível.',
    ],
  },
  {
    title: 'Temas / Aparência',
    intro: 'A área de Configurações concentra tema, fonte e leitura da cifra.',
    icon: <Palette size={20} color="var(--app-accent)" />,
    bullets: [
      'Escolha tema escuro, claro ou personalizado.',
      'Ao alternar entre escuro e claro, o app aplica cores seguras de letra e acorde para manter a cifra legível.',
      'Em Acordes e transposição, escolha entre sustenidos, bemóis ou escrita mista/popular.',
      'Ajuste cores de acordes, letras e editor.',
      'A barra inferior da música pode ser exibida ou ocultada de forma global.',
    ],
  },
  {
    title: 'Backup e importação',
    intro: 'O backup foi desenhado para testes, troca de aparelho e compatibilidade com acervos antigos.',
    icon: <Archive size={20} color="var(--app-accent)" />,
    bullets: [
      'Backup completo exporta músicas, listas, pastas, vínculos, gêneros e configurações úteis.',
      'Importação em modo mesclar deduplica músicas por artista/título e preserva o máximo possível.',
      'Continua aceitando CifrasGo antigo, ZIP de lista/pasta, TXT próprio, TXT simples e legado .cfs.',
    ],
  },
  {
    title: 'Dicas de uso',
    intro: 'Alguns hábitos deixam o app mais rápido no ensaio.',
    icon: <Lightbulb size={20} color="var(--app-accent)" />,
    bullets: [
      'Crie uma lista por celebração ou apresentação e use o Modo roteiro para dividir momentos.',
      'Use post-it para entradas, pausas, solos e observações que precisam aparecer na hora certa.',
      'Faça backup completo antes de limpar dados, trocar aparelho ou testar restaurações.',
    ],
  },
{
  title: 'Versão',
  intro: `CifrasGo ${APP_VERSION}`,
  icon: <Music size={20} color="var(--app-accent)" />,
  bullets: [
    '',
  ],
},
];

export function AboutScreen() {
  return (
    <ScrollView style={localStyles.container} contentContainerStyle={localStyles.content}>
      <View style={localStyles.hero}>
        <View style={localStyles.heroIcon}>
          <BookOpen size={26} color="var(--app-accent)" />
        </View>
        <View style={localStyles.heroText}>
          <Text style={localStyles.eyebrow}>Guia oficial</Text>
          <Text style={localStyles.title}>Sobre / Guia do usuário</Text>
          <Text style={localStyles.subtitle}>
            Um mapa rápido para usar o CifrasGo em ensaios, repertórios, igreja e palco.
          </Text>
        </View>
      </View>

      <View style={localStyles.grid}>
        {guideSections.map((section) => (
          <View key={section.title} style={localStyles.card}>
            <View style={localStyles.cardHeader}>
              <View style={localStyles.cardIcon}>{section.icon}</View>
              <View style={localStyles.cardTitleWrap}>
                <Text style={localStyles.cardTitle}>{section.title}</Text>
                <Text style={localStyles.cardIntro}>{section.intro}</Text>
              </View>
            </View>
            <View style={localStyles.bulletList}>
              {section.bullets.map((bullet) => (
                <View key={bullet} style={localStyles.bulletRow}>
                  <Text style={localStyles.bulletDot}>•</Text>
                  <Text style={localStyles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
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
    maxWidth: 940,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    borderRadius: 8,
    padding: 16,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-alt)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: 'var(--app-text)',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  grid: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    borderRadius: 8,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-alt)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: 'var(--app-text)',
    fontSize: 17,
    fontWeight: '900',
  },
  cardIntro: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  bulletList: {
    gap: 8,
    marginTop: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: 'var(--app-accent)',
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
