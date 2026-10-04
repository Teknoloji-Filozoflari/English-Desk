import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function StoryAudio({ audioId, pauseForEditor = false }: { audioId: string; pauseForEditor?: boolean }) {
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (pauseForEditor) player.current?.pause(); }, [pauseForEditor]);
  return <View style={styles.box}>
    <Text style={styles.title}>🎧 Hikâyeyi dinle</Text>
    <View style={styles.playerRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="5 saniye geri al" accessibilityHint="Ses kaydını beş saniye geri sarar" onPress={() => { if (player.current) player.current.currentTime = Math.max(0, player.current.currentTime - 5); }} style={styles.back}>
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 6v5H2" stroke={theme.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 11a8 8 0 1 1-1 7" stroke={theme.ink} strokeWidth="1.8" strokeLinecap="round" />
          <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill={theme.ink}>5</text>
        </svg>
      </Pressable>
      <audio ref={player} key={audioId} controls preload="metadata" src={`/api/story-audio/${audioId}`} onError={() => setFailed(true)} style={{ flex: 1, minWidth: 0, height: 40 }} aria-label="Hikâye ses kaydı" />
    </View>
    {failed && <Text style={styles.error}>Ses dosyası açılamadı. Yerel uygulama sunucusunu ve ses dosyasını kontrol et.</Text>}
  </View>;
}

const styles = StyleSheet.create({ box: { marginTop: 24, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.accentSoft, gap: 10 }, title: { color: theme.ink, fontSize: 15, fontWeight: '700' }, playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }, error: { color: '#A32934', fontSize: 13, lineHeight: 20 } });
