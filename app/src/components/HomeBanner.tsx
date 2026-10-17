import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Circle, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { isDark } from '@/components/PaperBackground';
import { API_URL } from '@/lib/api';
import { R, tint } from '@/lib/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Weather = { available: true; city: string | null; tempF: number; code: number; isDay: boolean } | { available: false };

/** Sky colors by time of day: [from, to, text]. */
function skyFor(hour: number): { colors: [string, string]; text: string; greeting: string } {
  if (hour >= 5 && hour < 11) return { colors: ['#FFE1B8', '#FFB8D2'], text: '#3B2A4A', greeting: 'Good morning' };
  if (hour >= 11 && hour < 17) return { colors: ['#9CCBFF', '#B9A4FF'], text: '#1F2147', greeting: 'Good afternoon' };
  if (hour >= 17 && hour < 21) return { colors: ['#FF9E8F', '#9A6BFF'], text: '#FFFFFF', greeting: 'Good evening' };
  return { colors: ['#2B2763', '#5B3FE6'], text: '#FFFFFF', greeting: 'Up late?' };
}

/** WMO weather code → icon + short label (https://open-meteo.com/en/docs). */
function describe(code: number, isDay: boolean): { icon: IconName; label: string } {
  if (code === 0) return isDay ? { icon: 'weather-sunny', label: 'Clear' } : { icon: 'weather-night', label: 'Clear' };
  if (code <= 2) return isDay ? { icon: 'weather-partly-cloudy', label: 'Partly cloudy' } : { icon: 'weather-night-partly-cloudy', label: 'Partly cloudy' };
  if (code === 3) return { icon: 'weather-cloudy', label: 'Cloudy' };
  if (code <= 48) return { icon: 'weather-fog', label: 'Foggy' };
  if (code <= 57) return { icon: 'weather-rainy', label: 'Drizzle' };
  if (code <= 67) return { icon: 'weather-pouring', label: 'Rain' };
  if (code <= 77) return { icon: 'weather-snowy', label: 'Snow' };
  if (code <= 82) return { icon: 'weather-pouring', label: 'Showers' };
  if (code <= 86) return { icon: 'weather-snowy-heavy', label: 'Snow showers' };
  return { icon: 'weather-lightning-rainy', label: 'Storms' };
}

let cachedWeather: { at: number; data: Weather } | null = null;

function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(cachedWeather?.data ?? null);
  useEffect(() => {
    if (cachedWeather && Date.now() - cachedWeather.at < 10 * 60_000) return;
    let alive = true;
    fetch(`${API_URL}/weather`)
      .then((r) => r.json() as Promise<Weather>)
      .then((data) => {
        cachedWeather = { at: Date.now(), data };
        if (alive) setWeather(data);
      })
      .catch(() => {}); // the banner just skips weather when offline
    return () => {
      alive = false;
    };
  }, []);
  return weather;
}

type Props = {
  /** Folder color; omit for the "All notes" sky banner. */
  color?: string;
  title: string;
  subtitle: string;
  /** Rendered on the right (e.g. the New note button). */
  action?: ReactNode;
};

/** The colorful header on the notes home: greeting or folder name, date, weather, and the mascot. */
export function HomeBanner({ color, title, subtitle, action }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [now] = useState(() => new Date());
  const weather = useWeather();

  const sky = skyFor(now.getHours());
  const colors: [string, string] = color ? [tint(color, 0.45), color] : sky.colors;
  const text = color ? (isDark(color) ? '#FFFFFF' : '#1C1C1E') : sky.text;
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const w = weather?.available ? { ...weather, ...describe(weather.code, weather.isDay) } : null;

  return (
    <View style={styles.banner} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={0} y={0} width={size.w} height={size.h}>
            <LinearGradient start={vec(0, 0)} end={vec(size.w, size.h)} colors={colors} />
          </Rect>
          {/* ink bubbles */}
          <Circle cx={size.w * 0.62} cy={size.h * 0.2} r={size.h * 0.55} color="rgba(255,255,255,0.14)" />
          <Circle cx={size.w * 0.78} cy={size.h * 1.05} r={size.h * 0.45} color="rgba(255,255,255,0.12)" />
          <Circle cx={size.w * 0.52} cy={size.h * 0.8} r={10} color="rgba(255,255,255,0.35)" />
          <Circle cx={size.w * 0.56} cy={size.h * 0.6} r={5} color="rgba(255,255,255,0.35)" />
          <Circle cx={size.w * 0.585} cy={size.h * 0.45} r={3} color="rgba(255,255,255,0.35)" />
        </Canvas>
      )}

      <View style={styles.left}>
        <Text style={[styles.kicker, { color: text }]}>{color ? 'Folder' : sky.greeting}</Text>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.sub, { color: text }]}>
            {date} · {subtitle}
          </Text>
          {w && (
            <View style={styles.weather}>
              <MaterialCommunityIcons name={w.icon} size={16} color={text} />
              <Text style={[styles.weatherText, { color: text }]}>
                {w.tempF}° {w.label}
                {w.city ? ` · ${w.city}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.right}>
        {action}
        <View style={styles.mascot}>
          <Logo size={92} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', minHeight: 128, borderRadius: R.lg, overflow: 'hidden', paddingLeft: 28, paddingRight: 16, paddingVertical: 18, gap: 16 },
  left: { flex: 1, gap: 2 },
  kicker: { fontSize: 13, fontWeight: '600', opacity: 0.85 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  sub: { fontSize: 13, opacity: 0.85 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.28)' },
  weatherText: { fontSize: 13, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mascot: { marginVertical: -12 },
});
