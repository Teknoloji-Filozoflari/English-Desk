import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function StoryAudio({ audioId: _audioId, pauseForEditor: _pauseForEditor = false }: { audioId: string; pauseForEditor?: boolean }) {
  return <View style={styles.box}><Text style={styles.text}>Ses kaydı şu anda bilgisayardaki web sürümünde dinlenebilir.</Text></View>;
}

const styles = StyleSheet.create({
  box: { marginTop: 24, padding: 16, borderRadius: 10, backgroundColor: theme.accentSoft },
  text: { color: theme.ink, fontSize: 14, lineHeight: 21 },
});
