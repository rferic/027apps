import { View, Text, StyleSheet } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>027Apps</Text>
      <Text style={styles.subtitle}>Mobile App</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#9B1C1C',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
  },
})
