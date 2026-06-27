import { Text, TouchableOpacity, ActivityIndicator } from 'react-native'

export interface DsButtonProps {
  title: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onPress: () => void
}

const variantClasses: Record<NonNullable<DsButtonProps['variant']>, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-slate-300 dark:border-slate-600 bg-transparent',
  ghost: 'bg-transparent',
}

const variantTextClasses: Record<NonNullable<DsButtonProps['variant']>, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-slate-900 dark:text-white',
  ghost: 'text-slate-700 dark:text-slate-300',
}

const sizeClasses: Record<NonNullable<DsButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 rounded-lg',
  md: 'px-5 py-2.5 rounded-xl',
  lg: 'px-6 py-3.5 rounded-xl',
}

const sizeTextClasses: Record<NonNullable<DsButtonProps['size']>, string> = {
  sm: 'text-xs font-semibold',
  md: 'text-sm font-semibold',
  lg: 'text-base font-semibold',
}

const sizeIndicator: Record<NonNullable<DsButtonProps['size']>, 'small' | number> = {
  sm: 'small',
  md: 'small',
  lg: 20,
}

export function DsButton({
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onPress,
}: DsButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      className={`items-center justify-center flex-row gap-2 ${variantClasses[variant]} ${sizeClasses[size]} ${
        isDisabled ? 'opacity-50' : ''
      }`}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size={sizeIndicator[size]}
          color={variant === 'outline' || variant === 'ghost' ? '#9B1C1C' : '#FFFFFF'}
        />
      ) : null}
      <Text className={`${variantTextClasses[variant]} ${sizeTextClasses[size]}`}>
        {title}
      </Text>
    </TouchableOpacity>
  )
}
