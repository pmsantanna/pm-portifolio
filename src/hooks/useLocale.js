import { useState } from 'react'
import pt from '../i18n/pt'
import en from '../i18n/en'

const detect = () =>
  navigator.language?.startsWith('pt') ? 'pt' : 'en'

export default function useLocale() {
  const [locale, setLocale] = useState(detect)
  const t = locale === 'pt' ? pt : en
  const toggle = () => setLocale((l) => (l === 'pt' ? 'en' : 'pt'))
  return { locale, t, toggle }
}
