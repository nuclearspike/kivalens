import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// TODO: import { useLoanStore } from '../stores'

export default function ClearBasket() {
  const navigate = useNavigate()

  useEffect(() => {
    // TODO: useLoanStore.getState().clearBasket()
    navigate('/search', { replace: true })
  }, [navigate])

  return <div><span>One moment...</span></div>
}
