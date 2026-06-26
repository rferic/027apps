import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950 px-8">
          <Text className="text-5xl mb-4">⚠️</Text>
          <Text className="text-lg font-semibold text-secondary dark:text-gray-100 text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-sm text-slate-400 dark:text-slate-500 text-center mb-6">
            An unexpected error occurred. Please try again.
          </Text>
          {__DEV__ && this.state.error ? (
            <Text className="text-xs text-red-500 mb-4 text-center font-mono">
              {this.state.error.message}
            </Text>
          ) : null}
          <TouchableOpacity
            className="bg-primary rounded-xl px-6 py-3"
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Text className="text-white text-base font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}
