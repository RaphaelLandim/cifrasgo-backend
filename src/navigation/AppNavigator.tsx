import React from 'react';
import { DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { Text, View } from 'react-native-web';
import { HomeScreen } from '../screens/HomeScreen';
import { ChordViewScreen } from '../screens/ChordViewScreen';
import { appTheme } from '../theme/theme';
import type { AppNavigation, RootStackParamList, StackEntry } from './types';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['cifrasgo://', 'http://localhost:3000', 'http://localhost:5173'],
  config: {
    screens: {
      Home: '',
      ChordView: 'song/:songId',
      Settings: 'settings',
    },
  },
};

const navigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: appTheme.colors.background,
    card: appTheme.colors.background,
    text: appTheme.colors.text,
    border: appTheme.colors.border,
    primary: appTheme.colors.chord,
  },
};

export function AppNavigator() {
  const [stack, setStack] = React.useState<StackEntry[]>([{ name: 'Home', params: undefined }]);
  const current = stack[stack.length - 1];

  const navigation = React.useMemo<AppNavigation>(
    () => ({
      navigate: (name, params) => {
        setStack((prev) => [...prev, { name, params } as StackEntry]);
      },
      goBack: () => {
        setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
      },
      canGoBack: () => stack.length > 1,
      addListener: (event, callback) => {
        if (event === 'focus') {
          window.setTimeout(callback, 0);
        }
        return () => {};
      },
    }),
    [stack.length]
  );

  const renderScreen = () => {
    if (current.name === 'ChordView') {
      return (
        <ChordViewScreen
          navigation={navigation}
          route={{ name: 'ChordView', params: current.params as RootStackParamList['ChordView'] }}
        />
      );
    }

    if (current.name === 'Settings') {
      return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: appTheme.colors.text, textAlign: 'center' }}>
            SettingsScreen sera ligada aqui depois que o navigator substituir a casca atual.
          </Text>
        </View>
      );
    }

    return <HomeScreen navigation={navigation} route={{ name: 'Home', params: undefined }} />;
  };

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      {renderScreen()}
    </NavigationContainer>
  );
}
