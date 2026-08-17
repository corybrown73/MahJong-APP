import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { colors } from '../theme/tokens';
import { useSettings } from '../store/settings';
import { useStats } from '../store/stats';
import { useGame } from '../store/game';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateStats = useStats((s) => s.hydrate);
  const checkSaved = useGame((s) => s.checkSaved);

  useEffect(() => {
    void hydrateSettings();
    void hydrateStats();
    void checkSaved();
  }, [checkSaved, hydrateSettings, hydrateStats]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.feltDeep }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.feltDeep }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.feltDeep },
            animation: 'fade',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
