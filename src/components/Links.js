import React from 'react'

const trackOutbound = () => {
  // todo: get this old code running the way it should work.
  // e=>rga.outboundLink({label: href},c=>{})
}

export const ClickLink = ({onClick, className, children}) => <a href="#" className={className} onClick={e => {
  e.preventDefault()
  onClick(e)
}}>{children}</a>
export const NewTabLink = ({href, title, className, children}) => <a className={className} href={href}
                                                                     onClick={trackOutbound} rel="noopener noreferrer"
                                                                     title={title || 'Open link in new tab'}
                                                                     target="_blank">{children}</a>
export const KivaLink = ({path, title, className, children}) => <NewTabLink className={className}
                                                                            href={`https://www.kiva.org/${path}`}
                                                                            title={title || 'Open page on www.kiva.org in new tab'}>{children}</NewTabLink>
export const LenderLink = ({lender, title, className, children}) => <KivaLink className={className}
                                                                              path={`lender/${lender}?super_graphs=1`}
                                                                              title={title || "View Lender's page in a new tab"}>{children}</KivaLink>
export const LoanLink = ({id, title, children, className, loan}) => {
  if (loan) {
    id = loan.id
    title = `View loan for ${loan.name} on Kiva.org in a new tab`
  }
  return <KivaLink className={className} path={`lend/${id}`}
                   title={title || 'View Loan in a new tab'}>{children}</KivaLink>
}

export const EmailLink = ({email, subject, body, title, className, children}) => {
  const params = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  return <NewTabLink className={className} href={`mailto:${email ? email : 'contact@kivalens.org'}?${params.join('&')}`}
                     title={title || 'Open your default email program'}>{children}</NewTabLink>
}

export const KLALink = ({children = <span>Kiva Lender Assistant Chrome Extension</span>, className}) => {
  return <NewTabLink className={className}
                     href="https://chrome.google.com/webstore/detail/kiva-lender-assistant/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US"
                     title="Go to Google Chrome WebStore">{children}</NewTabLink>
}
