import { createContext, useContext, useState, useCallback } from 'react'

const DashboardContext = createContext(null)

export function DashboardProvider({ children }) {
  const [activeTab, setActiveTab] = useState('overview')
  
  const changeTab = useCallback((tabId) => {
    setActiveTab(tabId)
  }, [])

  return (
    <DashboardContext.Provider value={{ activeTab, setActiveTab, changeTab }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  return context
}

export default DashboardContext
