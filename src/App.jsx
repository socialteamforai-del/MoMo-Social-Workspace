import React from 'react'
import { AppProvider } from './context/AppContext.jsx'
import Layout from './components/layout/Layout.jsx'

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  )
}
