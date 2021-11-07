import {createContext} from 'react'

const GroupEnabledContext = createContext({enabled: true, setEnabled: () => true})

export default GroupEnabledContext
