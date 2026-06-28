import Constants from 'expo-constants'

export const isBeta = Constants.expoConfig?.extra?.appVariant === 'beta'

export const APP_NAME = isBeta ? '027Apps Beta' : '027Apps'
export const BRAND_COLOR = isBeta ? '#D97706' : '#9B1C1C'
